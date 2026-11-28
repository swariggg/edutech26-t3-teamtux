-- Semilla mínima para Supabase (datos ficticios). Los datos realistas completos viven en el modo simulado.
-- Idempotente: puede ejecutarse varias veces sin duplicar filas.
-- Credenciales de demostración: /estado → ADM-2026-0001 + 0912345678 · /pagos → 0910000000 o MAT-2026-0001 + 0912345678.
insert into guardians (id, full_name, document_id, email, phone, relationship)
values ('00000000-0000-0000-0000-000000000001', 'María Andrade Torres', '0912345678', 'maria.andrade@ejemplo.com', '+593 99 100 1000', 'madre')
on conflict do nothing;

insert into students (id, full_name, document_id, birth_date, gender, guardian_id)
values ('00000000-0000-0000-0000-000000000101', 'Lucía Andrade Torres', '0910000000', '2014-05-12', 'F', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Solicitud aprobada (coherente con la matrícula activa de abajo)
insert into applications (id, tracking_code, student_id, guardian_id, grade_applied, academic_year, status, documents, submitted_at)
values ('00000000-0000-0000-0000-000000000201', 'ADM-2026-0001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'octavo_egb', '2026-2027', 'aprobada',
        '[{"kind":"cedula_estudiante","received":true},{"kind":"cedula_representante","received":true},{"kind":"partida_nacimiento","received":true},{"kind":"certificado_notas","received":true},{"kind":"foto","received":true},{"kind":"certificado_medico","received":false}]',
        '2026-07-10')
on conflict do nothing;

insert into application_status_events (id, application_id, status, actor, at) values
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000201', 'enviada', 'familia', '2026-07-10'),
  ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000201', 'en_revision', 'secretaria', '2026-07-14'),
  ('00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000201', 'aprobada', 'secretaria', '2026-07-24')
on conflict do nothing;

insert into enrollments (id, code, student_id, application_id, grade, section, academic_year, status, enrolled_at)
values ('00000000-0000-0000-0000-000000000301', 'MAT-2026-0001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'octavo_egb', 'A', '2026-2027', 'activa', '2026-08-02')
on conflict do nothing;

insert into installments (id, enrollment_id, student_id, concept, period, description, amount, amount_paid, due_date, status, paid_at, method)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'matricula', '2026-08', 'Matrícula 2026-2027', 150, 150, '2026-08-20', 'pagada', '2026-08-18', 'transferencia'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'pension', '2026-09', 'Pensión 2026-09', 220, 220, '2026-09-05', 'pagada', '2026-09-04', 'transferencia'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'pension', '2026-10', 'Pensión 2026-10', 220, 0, '2026-10-05', 'pendiente', null, null),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'pension', '2026-11', 'Pensión 2026-11', 220, 0, '2026-11-05', 'pendiente', null, null)
on conflict do nothing;
