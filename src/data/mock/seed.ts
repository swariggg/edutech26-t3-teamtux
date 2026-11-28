/**
 * Base simulada en memoria: SOLO datos del dataset ficticio del hackatón (dataset-ficticio-colegio/,
 * 240 estudiantes, año 2025-2026, corte enero 2026). Misma correspondencia que supabase/seed.sql.
 * - estudiantes.csv → students + enrollments (matrícula del año en curso, curso y paralelo).
 * - representante_codigo → guardians (el dataset solo trae el código; no hay nombre, cédula ni contacto).
 * - pensiones.csv → installments (concepto pensión, vence el día 10 de cada mes).
 * No hay solicitudes ni bitácora precargadas: se crean al usar el sistema.
 */
import type { AuditLog, Enrollment, Grade, Guardian, Installment, Student, Application } from "@/domain/types";
import { institution } from "@/content/institution";
import { loadDataset } from "./dataset";

export interface MockDB {
  guardians: Guardian[];
  students: Student[];
  applications: Application[];
  enrollments: Enrollment[];
  installments: Installment[];
  auditLogs: AuditLog[];
  chatMessages: { id: string; sessionId: string; role: "user" | "assistant"; content: string; createdAt: string }[];
  seq: { application: number; enrollment: number; id: number };
}

/** Curso del dataset → grado del sistema. */
export const COURSE_TO_GRADE: Record<string, Grade> = {
  "8vo EGB": "octavo_egb", "9no EGB": "noveno_egb", "10mo EGB": "decimo_egb",
  "1ro BGU": "primero_bgu", "2do BGU": "segundo_bgu", "3ro BGU": "tercero_bgu",
};

export function buildSeed(): MockDB {
  let id = 0;
  const nid = (p: string) => `${p}_${(++id).toString(36).padStart(4, "0")}`;
  const ds = loadDataset();
  const year = institution.currentYear;
  const startYear = Number(year.slice(0, 4));
  const dueDay = String(institution.fees.dueDay).padStart(2, "0");

  const guardians: Guardian[] = [];
  const students: Student[] = [];
  const enrollments: Enrollment[] = [];
  const installments: Installment[] = [];
  const guardianByCode = new Map<string, Guardian>();
  const byStudentCode = new Map<string, { student: Student; enrollment: Enrollment }>();

  for (const row of ds.students) {
    const grade = COURSE_TO_GRADE[row.curso];
    if (!grade) continue;
    let guardian = guardianByCode.get(row.representante_codigo);
    if (!guardian) {
      guardian = {
        id: nid("gua"),
        code: row.representante_codigo,
        fullName: `Representante ${row.representante_codigo}`,
        email: "",
        phone: "",
        relationship: "otro",
        createdAt: `${row.fecha_ingreso}T00:00:00.000Z`,
      };
      guardianByCode.set(row.representante_codigo, guardian);
      guardians.push(guardian);
    }
    const student: Student = {
      id: nid("stu"),
      code: row.codigo,
      fullName: row.nombre_ficticio,
      birthYear: Number(row.anio_nacimiento) || undefined,
      scholarshipPct: Number(row.beca_porcentaje) || 0,
      gender: (["F", "M", "X"] as const).find((g) => g === row.genero),
      guardianId: guardian.id,
      specialNeeds: row.necesidad_educativa && row.necesidad_educativa !== "ninguna" ? row.necesidad_educativa : undefined,
      createdAt: `${row.fecha_ingreso}T00:00:00.000Z`,
    };
    students.push(student);
    const enrollment: Enrollment = {
      id: nid("enr"),
      // MAT-2025-0001 ↔ EST-001 (mismo número)
      code: `MAT-${startYear}-${row.codigo.replace(/\D/g, "").padStart(4, "0")}`,
      studentId: student.id,
      grade,
      section: row.paralelo || undefined,
      academicYear: year,
      status: "activa",
      enrolledAt: `${startYear}-09-01T00:00:00.000Z`,
    };
    enrollments.push(enrollment);
    byStudentCode.set(row.codigo, { student, enrollment });
  }

  for (const p of ds.pensions) {
    const ref = byStudentCode.get(p.codigo_estudiante);
    if (!ref) continue;
    const amount = Number(p.valor);
    const paid = p.estado === "pagado";
    const beca = ref.student.scholarshipPct ?? 0;
    installments.push({
      id: nid("ins"),
      enrollmentId: ref.enrollment.id,
      studentId: ref.student.id,
      concept: "pension",
      period: p.mes,
      description: `Pensión ${p.mes}${beca ? ` (beca ${beca}%)` : ""}`,
      amount,
      amountPaid: paid ? amount : 0,
      dueDate: `${p.mes}-${dueDay}`,
      // «vencido» y «por_vencer» se guardan como pendiente: el estado efectivo se deriva de la fecha.
      status: paid ? "pagada" : "pendiente",
      paidAt: paid && p.fecha_pago ? `${p.fecha_pago}T00:00:00.000Z` : undefined,
    });
  }

  return {
    guardians, students, applications: [], enrollments, installments, auditLogs: [], chatMessages: [],
    seq: { application: 0, enrollment: enrollments.length, id },
  };
}
