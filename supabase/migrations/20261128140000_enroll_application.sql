-- Matrícula automática al aprobar una solicitud de admisión.
-- Crea, en una sola transacción, la matrícula (MAT-AAAA-XXXXXX, pendiente de pago), la cuota de matrícula
-- y las pensiones del año lectivo. Idempotente: si el estudiante ya tiene matrícula para ese año,
-- la devuelve sin crear nada (aprobar dos veces no duplica cuotas).
-- Los montos y fechas los calcula la app (src/data/enrollment-plan.ts) y llegan en p_installments:
--   [{ "concept": "matricula"|"pension", "period": "2026-09", "description": "…", "amount": 185, "due_date": "2026-09-10" }, …]

create or replace function public.enroll_application(
  p_application_id uuid,
  p_installments jsonb,
  p_actor text,
  p_now timestamptz default now()
) returns table (enrollment_id uuid, code text, created boolean)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  v_app public.applications;
  v_enr public.enrollments;
  v_code text;
  v_year text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select * into v_app from public.applications a where a.id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_app.status <> 'aprobada' then
    raise exception 'application_not_approved' using errcode = 'P0001';
  end if;

  select * into v_enr from public.enrollments e where e.student_id = v_app.student_id and e.academic_year = v_app.academic_year;
  if found then
    return query select v_enr.id, v_enr.code, false;
    return;
  end if;

  v_year := split_part(v_app.academic_year, '-', 1);
  for attempt in 1..5 loop
    v_code := 'MAT-' || v_year || '-' || (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.enrollments (code, student_id, application_id, grade, academic_year, status, enrolled_at, created_at, updated_at)
      values (v_code, v_app.student_id, v_app.id, v_app.grade_applied, v_app.academic_year, 'pendiente_pago', p_now, p_now, p_now)
      returning * into v_enr;
      exit;
    exception when unique_violation then
      -- Otra transacción matriculó al mismo estudiante: devolver esa matrícula.
      select * into v_enr from public.enrollments e where e.student_id = v_app.student_id and e.academic_year = v_app.academic_year;
      if found then
        return query select v_enr.id, v_enr.code, false;
        return;
      end if;
      if attempt = 5 then raise; end if; -- choque de código (muy improbable): reintenta
    end;
  end loop;

  insert into public.installments (enrollment_id, student_id, concept, period, description, amount, due_date, created_at, updated_at)
  select v_enr.id, v_app.student_id, (i->>'concept')::public.installment_concept, i->>'period', i->>'description',
         (i->>'amount')::numeric, (i->>'due_date')::date, p_now, p_now
  from jsonb_array_elements(p_installments) i;

  insert into public.audit_logs (at, actor, action, entity, entity_id, details)
  values (p_now, p_actor, 'enrollment.created', 'enrollment', v_enr.id::text,
          jsonb_build_object('code', v_enr.code, 'trackingCode', v_app.tracking_code, 'installments', jsonb_array_length(p_installments)));

  return query select v_enr.id, v_enr.code, true;
end $$;

revoke execute on function public.enroll_application(uuid, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.enroll_application(uuid, jsonb, text, timestamptz) to service_role;
