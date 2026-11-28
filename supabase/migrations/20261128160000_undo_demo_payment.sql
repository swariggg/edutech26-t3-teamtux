-- Demostración del récord de puntualidad: la familia puede deshacer un pago de DEMO (referencia «DEMO-…»)
-- de una pensión para volver a «sin pagar». Los pagos reales (colecturía, n8n, dataset) no se pueden deshacer.
-- No borra movimientos (installment_payments es de solo inserción).

create or replace function public.undo_demo_payment(p_installment_id uuid, p_actor text, p_now timestamptz default now())
returns public.installments
language plpgsql set search_path = '' as $$
declare
  v public.installments;
begin
  select * into v from public.installments i where i.id = p_installment_id for update;
  if not found then
    raise exception 'installment_not_found' using errcode = 'P0002';
  end if;
  if v.concept <> 'pension' or v.reference is null or v.reference not like 'DEMO-%' then
    raise exception 'not_demo_payment' using errcode = 'P0001';
  end if;

  -- installment_payments es de solo inserción: el movimiento original se conserva como historial y la
  -- reversión queda en la bitácora.
  update public.installments i
     set amount_paid = 0, status = 'pendiente', paid_at = null, method = null, reference = null, updated_at = p_now
   where i.id = v.id
  returning * into v;

  insert into public.audit_logs (at, actor, action, entity, entity_id, details)
  values (p_now, p_actor, 'payment.demo_reverted', 'installment', v.id::text, jsonb_build_object('period', v.period));
  return v;
end $$;

revoke execute on function public.undo_demo_payment(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.undo_demo_payment(uuid, text, timestamptz) to service_role;
