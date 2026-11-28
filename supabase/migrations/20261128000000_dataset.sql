-- Eight Academy · Esquema alineado al dataset ficticio del hackatón (dataset-ficticio-colegio/, CC0).
-- 1) Representantes y estudiantes se identifican por el código del dataset (REP-### / EST-###). El dataset no
--    trae cédulas, nombres de representantes ni fechas exactas de nacimiento: esas columnas pasan a ser
--    opcionales, pero cada fila debe tener código o cédula (las familias que postulan en línea dan su cédula).
-- 2) Tablas nuevas para el resto del dataset: docentes, horarios, asistencia y notas.
-- Datos: supabase/seed.sql, generado con `pnpm db:seed` (scripts/build-seed-sql.mjs) desde los CSV.

-- ===== Representantes =====
alter table guardians add column code text unique check (code ~ '^REP-\d{3,4}$');
alter table guardians alter column full_name drop not null;
alter table guardians alter column document_id drop not null;
alter table guardians add constraint guardians_identity_chk check (code is not null or document_id is not null);

-- ===== Estudiantes =====
alter table students add column code text unique check (code ~ '^EST-\d{3,4}$');
alter table students add column birth_year smallint check (birth_year between 1990 and 2030);
alter table students add column scholarship_pct smallint not null default 0 check (scholarship_pct in (0, 10, 25, 50));
alter table students add column admission_date date;
alter table students alter column document_id drop not null;
alter table students alter column birth_date drop not null;
alter table students add constraint students_identity_chk check (code is not null or document_id is not null);
alter table students add constraint students_birth_chk check (birth_date is not null or birth_year is not null);
alter table students add constraint students_special_needs_chk
  check (special_needs is null or char_length(special_needs) <= 200);

-- ===== Docentes (docentes.csv) =====
create table teachers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^DOC-\d{2,3}$'),
  full_name text not null check (char_length(full_name) between 3 and 120),
  main_subject text not null check (char_length(main_subject) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Horarios (horarios.csv): un bloque de clase de un curso y paralelo =====
create table schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  grade text not null check (grade in ('inicial_1','inicial_2','primero_egb','segundo_egb','tercero_egb','cuarto_egb','quinto_egb','sexto_egb','septimo_egb','octavo_egb','noveno_egb','decimo_egb','primero_bgu','segundo_bgu','tercero_bgu')),
  section text not null check (char_length(section) <= 4),
  weekday text not null check (weekday in ('lunes','martes','miercoles','jueves','viernes')),
  starts_at time not null,
  ends_at time not null,
  subject text not null check (char_length(subject) <= 80),
  teacher_id uuid not null references teachers(id) on delete restrict,
  check (ends_at > starts_at),
  unique (academic_year, grade, section, weekday, starts_at),
  unique (academic_year, teacher_id, weekday, starts_at)      -- un docente no da dos clases a la vez
);

-- ===== Asistencia (asistencia.csv): un estudiante en un día lectivo =====
create type attendance_status as enum ('presente','atraso','falta_justificada','falta_injustificada');
create table attendance (
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status attendance_status not null,
  primary key (student_id, date)
);

-- ===== Notas (notas.csv): nota parcial de una materia (0 a 10, mínimo 7 para aprobar) =====
create table grade_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  term smallint not null check (term between 1 and 2),          -- quimestre
  partial smallint not null check (partial between 1 and 3),    -- parcial
  subject text not null check (char_length(subject) <= 80),
  score numeric(4,2) not null check (score between 0 and 10),
  unique (student_id, academic_year, term, partial, subject)
);

-- ===== Triggers e índices =====
create trigger trg_teachers_updated before update on teachers for each row execute function public.set_updated_at();
create index idx_schedule_blocks_teacher on schedule_blocks(teacher_id);
create index idx_schedule_blocks_course on schedule_blocks(academic_year, grade, section);
create index idx_attendance_date on attendance(date);
create index idx_attendance_absences on attendance(student_id) where status in ('falta_injustificada', 'atraso');
create index idx_grade_records_student on grade_records(student_id, academic_year);
create index idx_grade_records_failing on grade_records(academic_year, subject) where score < 7;

-- ===== RLS (mismo modelo que el esquema inicial: sin acceso anónimo) =====
alter table teachers enable row level security;
alter table schedule_blocks enable row level security;
alter table attendance enable row level security;
alter table grade_records enable row level security;

create policy staff_select_teachers on teachers for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_schedule on schedule_blocks for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_attendance on attendance for select to authenticated using ((select public.staff_role()) in ('secretaria','admin'));
create policy staff_select_grades on grade_records for select to authenticated using ((select public.staff_role()) in ('secretaria','admin'));

create policy sec_write_teachers on teachers for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_schedule on schedule_blocks for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_attendance on attendance for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_grades on grade_records for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
