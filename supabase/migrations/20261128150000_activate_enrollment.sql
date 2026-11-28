-- Al quedar pagada la cuota de matrícula, la matrícula pasa de «pendiente_pago» a «activa».
-- Es un trigger para que valga sin importar quién registre el pago (colecturía, n8n o la familia en línea).

create or replace function public.activate_enrollment_on_fee_paid() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_code text;
begin
  if new.concept = 'matricula' and new.status = 'pagada' and old.status is distinct from 'pagada' then
    update public.enrollments e set status = 'activa', updated_at = coalesce(new.paid_at, now())
    where e.id = new.enrollment_id and e.status = 'pendiente_pago'
    returning e.code into v_code;
    if v_code is not null then
      insert into public.audit_logs (at, actor, action, entity, entity_id, details)
      values (coalesce(new.paid_at, now()), 'sistema', 'enrollment.activated', 'enrollment', new.enrollment_id::text,
              jsonb_build_object('code', v_code, 'installmentId', new.id));
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.activate_enrollment_on_fee_paid() from public, anon, authenticated;

drop trigger if exists trg_activate_enrollment on public.installments;
create trigger trg_activate_enrollment after update of status on public.installments
for each row execute function public.activate_enrollment_on_fee_paid();
