-- Senhas das contas da Empresa no Cofre (Supabase Vault, criptografado) — Story SEC1.2, aprovada pelo Vinicius em 04/10/2026.
-- Antes: senha e senha do proxy em texto aberto em imphq_empresa.extra (52 contas + 1 proxy).
-- Agora: o segredo fica em vault.secrets; a conta guarda só a referência (extra.senha_ref / extra.proxy_pass_ref).
-- Só usuário logado grava ou revela; cada revelação fica em imphq_secret_access_log. Os valores nunca saem do banco nesta migração.

create table if not exists public.imphq_secret_access_log (
  id bigint generated always as identity primary key,
  account_id uuid not null,
  kind text not null,
  user_id uuid,
  accessed_at timestamptz not null default now()
);
alter table public.imphq_secret_access_log enable row level security;
drop policy if exists "auth read secret log" on public.imphq_secret_access_log;
create policy "auth read secret log" on public.imphq_secret_access_log for select to authenticated using (true);

-- Grava (ou apaga, com valor vazio) a senha de uma conta no Cofre.
create or replace function public.imphq_set_account_secret(p_account_id uuid, p_kind text, p_value text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_extra jsonb;
  v_ref uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'login obrigatório'; end if;
  if p_kind not in ('senha', 'proxy_pass') then raise exception 'tipo de segredo inválido: %', p_kind; end if;
  select coalesce(extra, '{}'::jsonb) into v_extra from imphq_empresa where id = p_account_id for update;
  if not found then raise exception 'conta não encontrada'; end if;
  v_ref := nullif(v_extra ->> (p_kind || '_ref'), '')::uuid;

  if coalesce(p_value, '') = '' then
    if v_ref is not null then delete from vault.secrets where id = v_ref; end if;
    update imphq_empresa set extra = (v_extra - p_kind) - (p_kind || '_ref') where id = p_account_id;
    return;
  end if;

  if v_ref is not null and exists (select 1 from vault.secrets where id = v_ref) then
    perform vault.update_secret(v_ref, p_value);
  else
    v_ref := vault.create_secret(p_value, 'imphq_empresa:' || p_account_id || ':' || p_kind, 'Senha de conta da Empresa');
  end if;
  update imphq_empresa set extra = (v_extra - p_kind) || jsonb_build_object(p_kind || '_ref', v_ref) where id = p_account_id;
end;
$$;

-- Revela a senha para quem está logado e registra o acesso.
create or replace function public.imphq_reveal_account_secret(p_account_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_ref uuid;
  v_secret text;
begin
  if auth.uid() is null then raise exception 'login obrigatório'; end if;
  select nullif(extra ->> (p_kind || '_ref'), '')::uuid into v_ref from imphq_empresa where id = p_account_id;
  if v_ref is null then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_ref;
  insert into imphq_secret_access_log (account_id, kind, user_id) values (p_account_id, p_kind, auth.uid());
  return v_secret;
end;
$$;

revoke all on function public.imphq_set_account_secret(uuid, text, text) from public, anon;
revoke all on function public.imphq_reveal_account_secret(uuid, text) from public, anon;
grant execute on function public.imphq_set_account_secret(uuid, text, text) to authenticated, service_role;
grant execute on function public.imphq_reveal_account_secret(uuid, text) to authenticated;

-- Migração única: move as senhas em texto aberto para o Cofre (dentro do banco).
do $$
declare
  r record;
  k text;
  v_ref uuid;
begin
  for r in select id, extra from imphq_empresa where extra ? 'senha' or extra ? 'proxy_pass' loop
    foreach k in array array['senha', 'proxy_pass'] loop
      if coalesce(r.extra ->> k, '') <> '' and coalesce(r.extra ->> (k || '_ref'), '') = '' then
        v_ref := vault.create_secret(r.extra ->> k, 'imphq_empresa:' || r.id || ':' || k, 'Senha de conta da Empresa');
        update imphq_empresa set extra = (extra - k) || jsonb_build_object(k || '_ref', v_ref) where id = r.id;
      elsif r.extra ? k and coalesce(r.extra ->> k, '') = '' then
        update imphq_empresa set extra = extra - k where id = r.id;
      end if;
    end loop;
  end loop;
end;
$$;
