#!/usr/bin/env node
/**
 * Genera supabase/seed.sql a partir de dataset-ficticio-colegio/*.csv (datos sintéticos, CC0).
 * Uso: pnpm db:seed   (luego `supabase db reset` aplica migraciones + seed)
 *
 * Misma correspondencia que el modo simulado (src/data/mock/seed.ts):
 *   estudiantes.csv → guardians (por representante_codigo) + students + enrollments (año en curso)
 *   pensiones.csv   → installments (pensión; vence el día DUE_DAY; vencido/por_vencer → pendiente, se deriva al leer)
 *   docentes.csv    → teachers · horarios.csv → schedule_blocks · asistencia.csv → attendance · notas.csv → grade_records
 * El seed es idempotente (on conflict do nothing) y corre en una sola transacción.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET = path.join(ROOT, "dataset-ficticio-colegio");
const OUT = path.join(ROOT, "supabase", "seed.sql");

// Deben coincidir con src/content/institution.ts (currentYear, fees.dueDay).
const ACADEMIC_YEAR = "2025-2026";
const DUE_DAY = 10;

const COURSE_TO_GRADE = {
  "8vo EGB": "octavo_egb", "9no EGB": "noveno_egb", "10mo EGB": "decimo_egb",
  "1ro BGU": "primero_bgu", "2do BGU": "segundo_bgu", "3ro BGU": "tercero_bgu",
};

function readCsv(file) {
  const text = readFileSync(path.join(DATASET, file), "utf8").replace(/^﻿/, "");
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const cols = header.split(",").map((c) => c.trim());
  return lines.map((line) => {
    const cells = line.split(",");
    if (cells.length !== cols.length) throw new Error(`${file}: fila con ${cells.length} columnas (esperadas ${cols.length}): ${line}`);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i].trim()]));
  });
}

const q = (v) => (v === undefined || v === null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Número inválido: ${v}`);
  return String(n);
};

/** INSERT ... SELECT FROM (VALUES ...) en lotes, para no generar sentencias gigantes. */
function batched(rows, size, render) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(render(rows.slice(i, i + size)));
  return out.join("\n");
}

const students = readCsv("estudiantes.csv");
const pensions = readCsv("pensiones.csv");
const teachers = readCsv("docentes.csv");
const schedule = readCsv("horarios.csv");
const attendance = readCsv("asistencia.csv");
const grades = readCsv("notas.csv");

for (const s of students) if (!COURSE_TO_GRADE[s.curso]) throw new Error(`Curso desconocido: ${s.curso}`);
for (const h of schedule) if (!COURSE_TO_GRADE[h.curso]) throw new Error(`Curso desconocido en horarios: ${h.curso}`);

const startYear = Number(ACADEMIC_YEAR.slice(0, 4));
const reps = [...new Map(students.map((s) => [s.representante_codigo, s])).values()];
const pad = (n) => String(n).padStart(2, "0");

const sql = [];
sql.push(`-- GENERADO por scripts/build-seed-sql.mjs desde dataset-ficticio-colegio/ — no editar a mano.
-- Datos 100 % sintéticos (dataset ficticio del Hackathon EduTech 2026, CC0). Año lectivo ${ACADEMIC_YEAR}.
-- Filas: ${reps.length} representantes, ${students.length} estudiantes y matrículas, ${pensions.length} pensiones,
--        ${teachers.length} docentes, ${schedule.length} bloques de horario, ${attendance.length} registros de asistencia, ${grades.length} notas.
-- Demo: /pagos con estudiante EST-001 (o MAT-${startYear}-0001) y representante REP-001.
begin;
`);

sql.push("-- Representantes (el dataset solo trae el código)");
sql.push(batched(reps, 500, (rows) => `insert into guardians (code, relationship, created_at) values
${rows.map((s) => `  (${q(s.representante_codigo)}, 'otro', ${q(s.fecha_ingreso)})`).join(",\n")}
on conflict (code) do nothing;`));

sql.push("\n-- Estudiantes");
sql.push(batched(students, 500, (rows) => `insert into students (code, full_name, birth_year, gender, special_needs, scholarship_pct, admission_date, guardian_id, created_at)
select v.code, v.full_name, v.birth_year, v.gender, v.special_needs, v.scholarship_pct, v.admission_date, g.id, v.admission_date
from (values
${rows.map((s) => `  (${q(s.codigo)}, ${q(s.nombre_ficticio)}, ${num(s.anio_nacimiento)}::smallint, ${q(s.genero)}, ${s.necesidad_educativa === "ninguna" ? "null" : q(s.necesidad_educativa)}, ${num(s.beca_porcentaje)}::smallint, ${q(s.fecha_ingreso)}::date, ${q(s.representante_codigo)})`).join(",\n")}
) as v(code, full_name, birth_year, gender, special_needs, scholarship_pct, admission_date, rep)
join guardians g on g.code = v.rep
on conflict (code) do nothing;`));

sql.push(`\n-- Matrículas del año en curso (MAT-${startYear}-0001 ↔ EST-001)`);
sql.push(batched(students, 500, (rows) => `insert into enrollments (code, student_id, grade, section, academic_year, status, enrolled_at)
select v.code, st.id, v.grade, v.section, '${ACADEMIC_YEAR}', 'activa', '${startYear}-09-01'
from (values
${rows.map((s) => `  (${q(`MAT-${startYear}-${s.codigo.replace(/\D/g, "").padStart(4, "0")}`)}, ${q(s.codigo)}, ${q(COURSE_TO_GRADE[s.curso])}, ${q(s.paralelo)})`).join(",\n")}
) as v(code, student_code, grade, section)
join students st on st.code = v.student_code
on conflict do nothing;`));

const beca = new Map(students.map((s) => [s.codigo, Number(s.beca_porcentaje) || 0]));
sql.push("\n-- Pensiones (pagado → pagada; vencido y por_vencer → pendiente, el estado vencido se deriva de la fecha)");
sql.push(batched(pensions, 500, (rows) => `insert into installments (enrollment_id, student_id, concept, period, description, amount, amount_paid, due_date, status, paid_at)
select e.id, e.student_id, 'pension', v.period, v.description, v.amount, case when v.paid then v.amount else 0 end,
       v.due_date, case when v.paid then 'pagada' else 'pendiente' end::installment_status, v.paid_at
from (values
${rows.map((p) => {
  const b = beca.get(p.codigo_estudiante) ?? 0;
  const paid = p.estado === "pagado";
  if (paid && !p.fecha_pago) throw new Error(`Pensión pagada sin fecha: ${p.codigo_estudiante} ${p.mes}`);
  return `  (${q(p.codigo_estudiante)}, ${q(p.mes)}, ${q(`Pensión ${p.mes}${b ? ` (beca ${b}%)` : ""}`)}, ${num(p.valor)}::numeric, ${paid}, ${q(`${p.mes}-${pad(DUE_DAY)}`)}::date, ${paid ? `${q(`${p.fecha_pago}T00:00:00Z`)}::timestamptz` : "null::timestamptz"})`;
}).join(",\n")}
) as v(student_code, period, description, amount, paid, due_date, paid_at)
join students st on st.code = v.student_code
join enrollments e on e.student_id = st.id and e.academic_year = '${ACADEMIC_YEAR}'
on conflict (enrollment_id, concept, period) do nothing;`));

sql.push("\n-- Docentes");
sql.push(`insert into teachers (code, full_name, main_subject) values
${teachers.map((t) => `  (${q(t.codigo)}, ${q(t.nombre_ficticio)}, ${q(t.materia_principal)})`).join(",\n")}
on conflict (code) do nothing;`);

sql.push("\n-- Horarios");
sql.push(batched(schedule, 500, (rows) => `insert into schedule_blocks (academic_year, grade, section, weekday, starts_at, ends_at, subject, teacher_id)
select '${ACADEMIC_YEAR}', v.grade, v.section, v.weekday, v.starts_at, v.ends_at, v.subject, t.id
from (values
${rows.map((h) => `  (${q(COURSE_TO_GRADE[h.curso])}, ${q(h.paralelo)}, ${q(h.dia)}, ${q(h.hora_inicio)}::time, ${q(h.hora_fin)}::time, ${q(h.materia)}, ${q(h.docente_codigo)})`).join(",\n")}
) as v(grade, section, weekday, starts_at, ends_at, subject, teacher_code)
join teachers t on t.code = v.teacher_code
on conflict do nothing;`));

sql.push("\n-- Asistencia");
sql.push(batched(attendance, 2000, (rows) => `insert into attendance (student_id, date, status)
select st.id, v.date, v.status::attendance_status
from (values
${rows.map((a) => `  (${q(a.codigo_estudiante)}, ${q(a.fecha)}::date, ${q(a.estado)})`).join(",\n")}
) as v(student_code, date, status)
join students st on st.code = v.student_code
on conflict do nothing;`));

sql.push("\n-- Notas");
sql.push(batched(grades, 2000, (rows) => `insert into grade_records (student_id, academic_year, term, partial, subject, score)
select st.id, v.academic_year, v.term, v.partial, v.subject, v.score
from (values
${rows.map((n) => `  (${q(n.codigo_estudiante)}, ${q(n.anio_lectivo)}, ${num(n.quimestre)}::smallint, ${num(n.parcial)}::smallint, ${q(n.materia)}, ${num(n.nota)}::numeric)`).join(",\n")}
) as v(student_code, academic_year, term, partial, subject, score)
join students st on st.code = v.student_code
on conflict do nothing;`));

sql.push("\ncommit;\n");
writeFileSync(OUT, sql.join("\n"));
console.log(`seed.sql generado: ${path.relative(ROOT, OUT)} (${students.length} estudiantes, ${pensions.length} pensiones, ${attendance.length} asistencias, ${grades.length} notas)`);
