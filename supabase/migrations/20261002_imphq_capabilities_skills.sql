-- Skills que usam cada ferramenta do catálogo (slugs de imphq_skills).
-- No project-mcp, uma etapa com skill X sugere primeiro as ferramentas ligadas a X e depois as do tipo da etapa.
alter table public.imphq_capabilities add column if not exists skills text[] not null default '{}';

create index if not exists imphq_capabilities_skills_idx on public.imphq_capabilities using gin (skills);
