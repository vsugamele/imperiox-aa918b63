-- Projeto pelo domínio da página (LIVE1.3): eventos do tracker chegavam sem project_id (LinfaFlow, JP, SlimSoda…).
-- 1) imphq_project_domains: domínio → projeto (manual ou vindo das URLs das etapas do mapa).
-- 2) Gatilho em imphq_events: sem project_id, resolve pelo domínio de page_url.
-- 3) Retroativo de 90 dias marcado em metadata.project_from_domain (para desfazer:
--    update imphq_events set project_id = null, metadata = metadata - 'project_from_domain' where metadata ? 'project_from_domain').

create table if not exists public.imphq_project_domains (
  host text primary key,
  project_id text not null,
  fonte text not null default 'manual' check (fonte in ('manual', 'mapa')),
  created_at timestamptz not null default now()
);
alter table public.imphq_project_domains enable row level security;
drop policy if exists "auth manage project domains" on public.imphq_project_domains;
create policy "auth manage project domains" on public.imphq_project_domains for all to authenticated using (true) with check (true);

/** Domínio normalizado: minúsculo, sem protocolo, sem www, sem porta e caminho. */
create or replace function public.imphq_url_host(p_url text) returns text language sql immutable as $$
  select nullif(lower(split_part(split_part(regexp_replace(coalesce(p_url, ''), '^[a-z]+://(www\.)?', '', 'i'), '/', 1), ':', 1)), '')
$$;

/** Plataformas compartilhadas: nunca decidem o projeto sozinhas. */
create or replace function public.imphq_is_shared_host(p_host text) returns boolean language sql immutable as $$
  select p_host is null or p_host ~ '(^|\.)(ticto\.app|vturb\.com|vturb\.com\.br|github\.com|google\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|whatsapp\.com|wa\.me|hotmart\.com|kiwify\.com\.br|cartpanda\.com|whop\.com|clickbank\.net|stripe\.com|lovable\.app|lovableproject\.com|localhost)$'
    or p_host in ('central-organico.vercel.app')
$$;

create or replace function public.imphq_resolve_project(p_url text) returns text language sql stable as $$
  with h as (select public.imphq_url_host(p_url) as host)
  select coalesce(
    (select d.project_id from public.imphq_project_domains d, h where d.host = h.host),
    -- Prévia do Lovable tem o id no domínio: só vale se estiver cadastrada à mão (acima).
    (select case when count(distinct n.linked_project_id) = 1 then min(n.linked_project_id) end
       from public.imphq_company_map_nodes n, h
      where not public.imphq_is_shared_host(h.host)
        and n.linked_project_id is not null
        and public.imphq_url_host(n.url) = h.host)
  )
$$;

create or replace function public.imphq_events_fill_project() returns trigger language plpgsql as $$
begin
  if new.project_id is null and new.page_url is not null then
    new.project_id := public.imphq_resolve_project(new.page_url);
    if new.project_id is not null then
      new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('project_from_domain', true);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists imphq_events_fill_project on public.imphq_events;
create trigger imphq_events_fill_project before insert on public.imphq_events
  for each row execute function public.imphq_events_fill_project();

-- Domínios conhecidos que ainda não estão em nenhuma etapa do mapa.
insert into public.imphq_project_domains (host, project_id, fonte) values
  ('go.linfaflow.vip', 'linfaflow', 'manual'),
  ('jphaireducation.com', 'jp_freitas', 'manual'),
  ('jpfreitashaireducation.vercel.app', 'jp_freitas', 'manual'),
  ('codigodoscortesperfeitos.vercel.app', 'jp_freitas', 'manual'),
  ('slimsoda-powder.vercel.app', 'slimsoda', 'manual'),
  ('slim.purelabss.com', 'slimsoda', 'manual'),
  ('linfaflow.vip', 'linfaflow', 'manual'),
  ('jphaireducation.lovable.app', 'jp_freitas', 'manual'),
  ('jpfreitashaireducation.lovable.app', 'jp_freitas', 'manual'),
  ('studioartstattoo.com.br', 'tatuagem', 'manual'),
  ('vigorboost.healiks.com', 'vigor_boost', 'manual'),
  ('leaftide-powder.vercel.app', 'leaftide', 'manual')
on conflict (host) do nothing;

-- Retroativo: últimos 90 dias.
update public.imphq_events e
   set project_id = r.project_id,
       metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('project_from_domain', true)
  from (select id, public.imphq_resolve_project(page_url) as project_id
          from public.imphq_events
         where project_id is null and page_url is not null and created_at > now() - interval '90 days') r
 where e.id = r.id and r.project_id is not null;
