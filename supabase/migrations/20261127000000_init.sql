-- Eight Academy · Esquema inicial: admisiones, matrículas, cobranzas, bitácora y chat.
-- Acceso público (formularios y consultas) pasa por las rutas API de Next.js con service role (omite RLS).
-- El personal accede con Supabase Auth (fase futura) y rol en app_metadata.role: secretaria | colecturia | admin.
-- Las escrituras críticas (crear solicitud, registrar pago) son funciones transaccionales llamadas vía rpc().
-- Estado "vencida": se DERIVA al leer en la app (src/data/repository.ts, día calendario UTC); nunca se almacena.
-- Nota de zona horaria: la institución opera en America/Guayaquil (UTC-5); la diferencia de borde es de horas.

create extension if not exists pgcrypto;

-- ===== Enums =====
create type application_status as enum ('borrador','enviada','en_revision','documentos_pendientes','entrevista_agendada','aprobada','rechazada','lista_espera');
create type enrollment_status as enum ('pendiente_pago','activa','retirada','anulada');
create type installment_status as enum ('pendiente','pagada','vencida','parcial','anulada');
create type installment_concept as enum ('matricula','pension','otros');
create type payment_method as enum ('transferencia','tarjeta','efectivo','deposito');
create type guardian_relationship as enum ('madre','padre','tutor','otro');
create type audit_entity as enum ('application','enrollment','installment','system','chat');
create type chat_role as enum ('user','assistant');

-- ===== updated_at automático =====
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ===== Tablas =====
create table guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 120),
  document_id text not null unique check (document_id ~ '^\d{10}$'),
  email text check (char_length(email) <= 160),
  phone text check (char_length(phone) <= 20),
  relationship guardian_relationship not null default 'otro',
  address text check (char_length(address) <= 200),
  auth_user_id uuid unique,            -- futuro: portal de familias con Supabase Auth
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 120),
  document_id text not null unique check (document_id ~ '^\d{10}$'),
  birth_date date not null,
  gender text check (gender in ('F','M','X')),
  guardian_id uuid not null references guardians(id) on delete restrict,
  previous_school text,
  special_needs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  -- Formato nuevo: ADM-2026-K7P2QX (6 caracteres aleatorios). Se aceptan códigos heredados de 4 dígitos (semilla).
  tracking_code text not null unique check (tracking_code ~ '^ADM-\d{4}-[A-Z0-9]{4,8}$'),
  student_id uuid not null references students(id) on delete restrict,
  guardian_id uuid not null references guardians(id) on delete restrict,
  grade_applied text not null check (grade_applied in ('inicial_1','inicial_2','primero_egb','segundo_egb','tercero_egb','cuarto_egb','quinto_egb','sexto_egb','septimo_egb','octavo_egb','noveno_egb','decimo_egb','primero_bgu','segundo_bgu','tercero_bgu')),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  status application_status not null default 'enviada',
  documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents) = 'array'),
  interview_at timestamptz,
  submitted_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  status application_status not null,
  note text,
  actor text not null,
  at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^MAT-\d{4}-[A-Z0-9]{4,8}$'),
  student_id uuid not null references students(id) on delete restrict,
  application_id uuid references applications(id) on delete set null,
  grade text not null check (grade in ('inicial_1','inicial_2','primero_egb','segundo_egb','tercero_egb','cuarto_egb','quinto_egb','sexto_egb','septimo_egb','octavo_egb','noveno_egb','decimo_egb','primero_bgu','segundo_bgu','tercero_bgu')),
  section text,
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  status enrollment_status not null default 'pendiente_pago',
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year),
  unique (id, student_id)               -- destino de la FK compuesta de installments
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  student_id uuid not null references students(id) on delete restrict,
  concept installment_concept not null,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  due_date date not null,
  status installment_status not null default 'pendiente',
  paid_at timestamptz,
  method payment_method,
  reference text check (char_length(reference) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- student_id redundante, pero no puede divergir de la matrícula
  foreign key (enrollment_id, student_id) references enrollments(id, student_id) on delete cascade,
  unique (enrollment_id, concept, period),
  check (status <> 'vencida'),                                            -- se deriva al leer
  check (status <> 'pagada' or (amount_paid = amount and paid_at is not null)),
  check (status <> 'parcial' or (amount_paid > 0 and amount_paid < amount)),
  check (status <> 'pendiente' or amount_paid = 0)
);

-- Cada pago registrado (idempotente por referencia de comprobante)
create table installment_payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references installments(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  applied_amount numeric(10,2) not null check (applied_amount >= 0),
  method payment_method not null,
  reference text check (char_length(reference) <= 80),
  actor text not null,
  created_at timestamptz not null default now()
);
create unique index uq_installment_payments_reference on installment_payments(installment_id, reference) where reference is not null;

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity audit_entity not null,
  entity_id text,                      -- texto: puede referir a ids no-uuid (p. ej. "cedula-…")
  details jsonb
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'web',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role chat_role not null,
  content text not null check (char_length(content) <= 16000),
  created_at timestamptz not null default now()
);

-- ===== Triggers =====
create trigger trg_guardians_updated before update on guardians for each row execute function public.set_updated_at();
create trigger trg_students_updated before update on students for each row execute function public.set_updated_at();
create trigger trg_applications_updated before update on applications for each row execute function public.set_updated_at();
create trigger trg_enrollments_updated before update on enrollments for each row execute function public.set_updated_at();
create trigger trg_installments_updated before update on installments for each row execute function public.set_updated_at();

-- Bitácoras de solo inserción: nadie (ni el service role) puede modificar o borrar filas.
create or replace function public.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% es de solo inserción', tg_table_name using errcode = '42501';
end $$;
create trigger trg_audit_logs_immutable before update or delete on audit_logs for each row execute function public.forbid_mutation();
create trigger trg_status_events_immutable before update on application_status_events for each row execute function public.forbid_mutation();
create trigger trg_installment_payments_immutable before update or delete on installment_payments for each row execute function public.forbid_mutation();

-- ===== Índices =====
create index idx_students_guardian on students(guardian_id);
create index idx_applications_status on applications(status);
create index idx_applications_year_grade on applications(academic_year, grade_applied);
create index idx_applications_updated on applications(updated_at desc);
create index idx_applications_student on applications(student_id);
create index idx_applications_guardian on applications(guardian_id);
create index idx_status_events_app on application_status_events(application_id, at);
create index idx_enrollments_year_grade on enrollments(academic_year, grade);
create index idx_enrollments_application on enrollments(application_id);
create index idx_installments_status_due on installments(status, due_date);
create index idx_installments_student on installments(student_id);
create index idx_installments_enrollment on installments(enrollment_id);
create index idx_installments_period on installments(period);
create index idx_audit_logs_at on audit_logs(at desc);
create index idx_audit_logs_entity on audit_logs(entity, entity_id);
create index idx_chat_messages_session on chat_messages(session_id, created_at);
create index idx_installment_payments_installment on installment_payments(installment_id);
-- Una solicitud activa por estudiante y año lectivo (las rechazadas no bloquean una nueva)
create unique index uq_applications_student_year_active on applications(student_id, academic_year) where status <> 'rechazada';

-- (Sin vista de estado efectivo: "vencida" se deriva solo en la app para tener una única fuente.)

-- ===== Funciones transaccionales (llamadas por la app con service role vía rpc) =====

-- Crea representante (o reutiliza sin modificar sus datos), estudiante (o reutiliza si pertenece al
-- mismo representante), la solicitud con código aleatorio y su primer evento. Todo en una transacción.
-- Cualquier conflicto devuelve el mismo error genérico 'application_conflict' (no revela existencias).
create or replace function public.create_application(
  p_student_name text, p_student_document text, p_birth_date date, p_gender text,
  p_previous_school text, p_special_needs text,
  p_guardian_name text, p_guardian_document text, p_email text, p_phone text,
  p_relationship public.guardian_relationship, p_address text,
  p_grade text, p_academic_year text, p_documents jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_guardian uuid;
  v_student uuid;
  v_student_guardian uuid;
  v_app uuid;
  v_code text;
  v_constraint text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  insert into public.guardians (full_name, document_id, email, phone, relationship, address)
  values (p_guardian_name, p_guardian_document, p_email, p_phone, p_relationship, p_address)
  on conflict (document_id) do nothing
  returning id into v_guardian;
  if v_guardian is null then
    select id into v_guardian from public.guardians where document_id = p_guardian_document;
  end if;

  select id, guardian_id into v_student, v_student_guardian from public.students where document_id = p_student_document;
  if v_student is null then
    insert into public.students (full_name, document_id, birth_date, gender, guardian_id, previous_school, special_needs)
    values (p_student_name, p_student_document, p_birth_date, p_gender, v_guardian, p_previous_school, p_special_needs)
    returning id into v_student;
  elsif v_student_guardian <> v_guardian then
    raise exception 'application_conflict' using errcode = 'P0001';
  end if;

  for attempt in 1..6 loop
    v_code := 'ADM-' || extract(year from now())::int || '-' ||
      (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.applications (tracking_code, student_id, guardian_id, grade_applied, academic_year, status, documents, submitted_at)
      values (v_code, v_student, v_guardian, p_grade, p_academic_year, 'enviada', p_documents, now())
      returning id into v_app;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'applications_tracking_code_key' or attempt = 6 then
        raise exception 'application_conflict' using errcode = 'P0001';
      end if;
    end;
  end loop;

  insert into public.application_status_events (application_id, status, actor) values (v_app, 'enviada', 'familia');
  return v_app;
exception when unique_violation then
  raise exception 'application_conflict' using errcode = 'P0001';
end $$;

-- Registra un pago con bloqueo de fila. Idempotente por (cuota, referencia): repetir devuelve la cuota sin
-- volver a aplicar. Rechaza cuotas anuladas o ya pagadas. Escribe la bitácora en la misma transacción.
create or replace function public.register_payment(
  p_installment_id uuid, p_amount numeric, p_method public.payment_method, p_reference text, p_actor text
) returns table (installment public.installments, applied boolean)
language plpgsql set search_path = '' as $$
declare
  v public.installments;
  v_new numeric(10,2);
  v_applied numeric(10,2);
  v_ref text := nullif(btrim(p_reference), '');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select * into v from public.installments i where i.id = p_installment_id for update;
  if not found then
    raise exception 'installment_not_found' using errcode = 'P0002';
  end if;
  if v_ref is not null and exists (select 1 from public.installment_payments ip where ip.installment_id = p_installment_id and ip.reference = v_ref) then
    return query select v, false;
    return;
  end if;
  if v.status in ('anulada', 'pagada') then
    raise exception 'installment_closed' using errcode = 'P0001';
  end if;

  v_new := least(v.amount, v.amount_paid + p_amount);
  v_applied := v_new - v.amount_paid;
  insert into public.installment_payments (installment_id, amount, applied_amount, method, reference, actor)
  values (p_installment_id, p_amount, v_applied, p_method, v_ref, p_actor);

  update public.installments i set
    amount_paid = v_new,
    status = case when v_new >= v.amount then 'pagada'::public.installment_status else 'parcial'::public.installment_status end,
    paid_at = case when v_new >= v.amount then now() else null end,
    method = p_method,
    reference = coalesce(v_ref, i.reference)
  where i.id = p_installment_id
  returning * into v;

  insert into public.audit_logs (actor, action, entity, entity_id, details)
  values (p_actor, 'payment.received', 'installment', p_installment_id::text,
          jsonb_build_object('amount', v_applied, 'requested', p_amount, 'method', p_method, 'reference', v_ref, 'status', v.status));
  return query select v, true;
end $$;

-- Solo el service role (la app) ejecuta las funciones de escritura.
revoke execute on function public.create_application(text, text, date, text, text, text, text, text, text, text, public.guardian_relationship, text, text, text, jsonb) from public;
revoke execute on function public.register_payment(uuid, numeric, public.payment_method, text, text) from public;
grant execute on function public.create_application(text, text, date, text, text, text, text, text, text, text, public.guardian_relationship, text, text, text, jsonb) to service_role;
grant execute on function public.register_payment(uuid, numeric, public.payment_method, text, text) to service_role;

-- ===== RLS =====
alter table guardians enable row level security;
alter table students enable row level security;
alter table applications enable row level security;
alter table application_status_events enable row level security;
alter table enrollments enable row level security;
alter table installments enable row level security;
alter table audit_logs enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table installment_payments enable row level security;

-- Rol del personal desde el JWT (app_metadata no es editable por el usuario)
create or replace function public.staff_role() returns text
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '')
$$;
revoke execute on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

-- Lectura para todo el personal
create policy staff_select_guardians on guardians for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_students on students for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_applications on applications for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_status_events on application_status_events for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_enrollments on enrollments for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_installments on installments for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_audit on audit_logs for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));
create policy staff_select_chat_sessions on chat_sessions for select to authenticated using ((select public.staff_role()) = 'admin');
create policy staff_select_chat_messages on chat_messages for select to authenticated using ((select public.staff_role()) = 'admin');
create policy staff_select_payments on installment_payments for select to authenticated using ((select public.staff_role()) in ('secretaria','colecturia','admin'));

-- Escritura: secretaría gestiona admisiones y matrículas
create policy sec_write_guardians on guardians for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_students on students for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_applications on applications for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_insert_status_events on application_status_events for insert to authenticated with check ((select public.staff_role()) in ('secretaria','admin'));
create policy sec_write_enrollments on enrollments for all to authenticated using ((select public.staff_role()) in ('secretaria','admin')) with check ((select public.staff_role()) in ('secretaria','admin'));

-- Escritura: colecturía gestiona cuotas
create policy col_write_installments on installments for all to authenticated using ((select public.staff_role()) in ('colecturia','admin')) with check ((select public.staff_role()) in ('colecturia','admin'));

-- Bitácora: solo inserción (sin update/delete para nadie vía API; además hay triggers que lo impiden)
create policy staff_insert_audit on audit_logs for insert to authenticated with check ((select public.staff_role()) in ('secretaria','colecturia','admin'));
revoke update, delete on audit_logs, application_status_events, installment_payments from authenticated, anon;

-- Sin políticas para anon: no hay acceso público directo a ninguna tabla.
-- Futuro portal de familias (ejemplo):
--   create policy guardian_select_own_students on students for select to authenticated
--     using (guardian_id = (select id from guardians where auth_user_id = auth.uid()));
