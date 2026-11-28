-- Documentos de admisión subidos por la familia + revisión con IA.
-- Los archivos viven en un bucket PRIVADO; la app los sube con enlaces firmados de un solo uso y
-- el personal los ve con enlaces de 60 s. La metadata (ruta, tipo, tamaño) va en applications.documents.

-- Última revisión de documentos con IA (apoyo a la decisión; el personal decide).
alter table public.applications add column if not exists ai_review jsonb;

-- Bucket privado: Supabase rechaza archivos de más de 5 MB o de otro tipo, aunque el enlace sea válido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('admission-docs', 'admission-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Marca un documento como recibido y guarda la metadata del archivo, de forma atómica
-- (si la solicitud no tenía ese documento en la lista, lo agrega).
create or replace function public.attach_document(p_application_id uuid, p_kind text, p_file jsonb, p_now timestamptz default now())
returns void
language plpgsql set search_path = '' as $$
declare
  v_docs jsonb;
begin
  select documents into v_docs from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(v_docs, '[]'::jsonb)) d where d->>'kind' = p_kind) then
    select jsonb_agg(case when d->>'kind' = p_kind then d || jsonb_build_object('received', true, 'file', p_file) else d end)
      into v_docs from jsonb_array_elements(v_docs) d;
  else
    v_docs := coalesce(v_docs, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('kind', p_kind, 'received', true, 'file', p_file));
  end if;
  update public.applications set documents = v_docs, updated_at = p_now where id = p_application_id;
end $$;

revoke execute on function public.attach_document(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.attach_document(uuid, text, jsonb, timestamptz) to service_role;
