-- Reloj de demostración (DEMO_TODAY): la app trabaja con la fecha del dataset ficticio (enero de 2026).
-- Las escrituras aceptan la fecha de la app (p_now) para que solicitudes, pagos, eventos y bitácora
-- queden coherentes con esa fecha. Sin p_now se usa now(), como antes.

-- updated_at: respeta un valor explícito enviado por la app; si no se envía, usa now().
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end $$;

drop function if exists public.create_application(text, text, date, text, text, text, text, text, text, text, public.guardian_relationship, text, text, text, jsonb);
drop function if exists public.register_payment(uuid, numeric, public.payment_method, text, text);

create or replace function public.create_application(
  p_student_name text, p_student_document text, p_birth_date date, p_gender text,
  p_previous_school text, p_special_needs text,
  p_guardian_name text, p_guardian_document text, p_email text, p_phone text,
  p_relationship public.guardian_relationship, p_address text,
  p_grade text, p_academic_year text, p_documents jsonb,
  p_now timestamptz default now()
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
    v_code := 'ADM-' || extract(year from p_now)::int || '-' ||
      (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.applications (tracking_code, student_id, guardian_id, grade_applied, academic_year, status, documents, submitted_at, created_at, updated_at)
      values (v_code, v_student, v_guardian, p_grade, p_academic_year, 'enviada', p_documents, p_now, p_now, p_now)
      returning id into v_app;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'applications_tracking_code_key' or attempt = 6 then
        raise exception 'application_conflict' using errcode = 'P0001';
      end if;
    end;
  end loop;

  insert into public.application_status_events (application_id, status, actor, at) values (v_app, 'enviada', 'familia', p_now);
  return v_app;
exception when unique_violation then
  raise exception 'application_conflict' using errcode = 'P0001';
end $$;

-- Registra un pago con bloqueo de fila. Idempotente por (cuota, referencia): repetir devuelve la cuota sin
-- volver a aplicar. Rechaza cuotas anuladas o ya pagadas. Escribe la bitácora en la misma transacción.
create or replace function public.register_payment(
  p_installment_id uuid, p_amount numeric, p_method public.payment_method, p_reference text, p_actor text,
  p_now timestamptz default now()
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
  insert into public.installment_payments (installment_id, amount, applied_amount, method, reference, actor, created_at)
  values (p_installment_id, p_amount, v_applied, p_method, v_ref, p_actor, p_now);

  update public.installments i set
    amount_paid = v_new,
    status = case when v_new >= v.amount then 'pagada'::public.installment_status else 'parcial'::public.installment_status end,
    paid_at = case when v_new >= v.amount then p_now else null end,
    updated_at = p_now,
    method = p_method,
    reference = coalesce(v_ref, i.reference)
  where i.id = p_installment_id
  returning * into v;

  insert into public.audit_logs (at, actor, action, entity, entity_id, details)
  values (p_now, p_actor, 'payment.received', 'installment', p_installment_id::text,
          jsonb_build_object('amount', v_applied, 'requested', p_amount, 'method', p_method, 'reference', v_ref, 'status', v.status));
  return query select v, true;
end $$;

revoke execute on function public.create_application(text, text, date, text, text, text, text, text, text, text, public.guardian_relationship, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.register_payment(uuid, numeric, public.payment_method, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_application(text, text, date, text, text, text, text, text, text, text, public.guardian_relationship, text, text, text, jsonb, timestamptz) to service_role;
grant execute on function public.register_payment(uuid, numeric, public.payment_method, text, text, timestamptz) to service_role;
