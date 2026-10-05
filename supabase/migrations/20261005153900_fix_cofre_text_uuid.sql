-- Fix: imphq_empresa.id é text, mas as funções do Cofre comparavam com uuid
-- ("operator does not exist: text = uuid"). Só adiciona o cast; nada muda nos dados.

CREATE OR REPLACE FUNCTION public.imphq_reveal_account_secret(p_account_id uuid, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare
  v_ref uuid;
  v_secret text;
begin
  if auth.uid() is null then raise exception 'login obrigatório'; end if;
  select nullif(extra ->> (p_kind || '_ref'), '')::uuid into v_ref from imphq_empresa where id = p_account_id::text;
  if v_ref is null then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_ref;
  insert into imphq_secret_access_log (account_id, kind, user_id) values (p_account_id, p_kind, auth.uid());
  return v_secret;
end;
$function$;

CREATE OR REPLACE FUNCTION public.imphq_set_account_secret(p_account_id uuid, p_kind text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare
  v_extra jsonb;
  v_ref uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'login obrigatório'; end if;
  if p_kind not in ('senha', 'proxy_pass') then raise exception 'tipo de segredo inválido: %', p_kind; end if;
  select coalesce(extra, '{}'::jsonb) into v_extra from imphq_empresa where id = p_account_id::text for update;
  if not found then raise exception 'conta não encontrada'; end if;
  v_ref := nullif(v_extra ->> (p_kind || '_ref'), '')::uuid;

  if coalesce(p_value, '') = '' then
    if v_ref is not null then delete from vault.secrets where id = v_ref; end if;
    update imphq_empresa set extra = (v_extra - p_kind) - (p_kind || '_ref') where id = p_account_id::text;
    return;
  end if;

  if v_ref is not null and exists (select 1 from vault.secrets where id = v_ref) then
    perform vault.update_secret(v_ref, p_value);
  else
    v_ref := vault.create_secret(p_value, 'imphq_empresa:' || p_account_id || ':' || p_kind, 'Senha de conta da Empresa');
  end if;
  update imphq_empresa set extra = (v_extra - p_kind) || jsonb_build_object(p_kind || '_ref', v_ref) where id = p_account_id::text;
end;
$function$;
