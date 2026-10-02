-- Biblioteca de estratégias (playbooks): X1, ads direto, webinar, lançamentos, canal orgânico, SEO.
-- Um playbook é uma sequência de etapas com contrato, executor, skill, métrica e checklist que pode ser
-- desenhada no mapa de operação de qualquer projeto (scripts/MCP/tela usam _shared/playbooks.ts).
-- Diferente de imphq_funnel_templates (esqueletos de 5 passos do editor de funis), que fica como está.

create table if not exists public.imphq_playbooks (
  id text primary key,                         -- slug: x1-conversa, ads-direto-dtc, webinar, ...
  nome text not null,
  familia text not null check (familia in ('x1_ads', 'webinar_lancamento', 'organico', 'seo')),
  resumo text not null,
  quando_usar text,
  quando_evitar text,
  horizonte text,                              -- ex.: "7 a 14 dias para o primeiro veredito"
  north_star text,                             -- chave de métrica principal (ver _shared/metric-keys.ts)
  kpis jsonb not null default '[]'::jsonb,     -- [{ key, label, meta, unidade }]
  riscos text[] not null default '{}',
  fonte text,                                  -- de onde veio (ex.: imphq_funnel_templates:webinar-evergreen)
  ativo boolean not null default true,
  versao integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imphq_playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id text not null references public.imphq_playbooks(id) on delete cascade,
  ordem integer not null,
  secao text not null,                         -- linha do mapa: Preparação, Aquisição, Conversão, ...
  label text not null,
  kind text not null,                          -- tipo de elemento do mapa (_shared/map-elements.ts)
  executor_type text not null default 'HUMAN_OPERATOR',
  skill text,                                  -- slug em imphq_skills
  contrato jsonb not null default '{}'::jsonb, -- { o, e, s, p, m, d, f, x } = O QUÊ … SE FALHAR
  metrica jsonb,                               -- { key, meta, unidade }
  checklist text[] not null default '{}',
  depende_de integer[] not null default '{}',  -- ordens das etapas que vêm antes (vira seta no mapa)
  unique (playbook_id, ordem)
);
create index if not exists imphq_playbook_steps_playbook_idx on public.imphq_playbook_steps (playbook_id, ordem);

-- Onde cada playbook foi aplicado: base para medir resultado e comparar estratégias entre projetos.
create table if not exists public.imphq_playbook_applications (
  id uuid primary key default gen_random_uuid(),
  playbook_id text not null references public.imphq_playbooks(id),
  project_id text not null,
  map_id uuid not null,
  node_ids uuid[] not null default '{}',       -- etapas criadas ou ligadas no mapa
  params jsonb not null default '{}'::jsonb,   -- ex.: { plataforma, conta, link_bio }
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'encerrado')),
  aplicado_por text,
  created_at timestamptz not null default now()
);
create index if not exists imphq_playbook_applications_project_idx on public.imphq_playbook_applications (project_id, created_at desc);

alter table public.imphq_playbooks enable row level security;
alter table public.imphq_playbook_steps enable row level security;
alter table public.imphq_playbook_applications enable row level security;
drop policy if exists "auth manage playbooks" on public.imphq_playbooks;
create policy "auth manage playbooks" on public.imphq_playbooks for all to authenticated using (true) with check (true);
drop policy if exists "auth manage playbook steps" on public.imphq_playbook_steps;
create policy "auth manage playbook steps" on public.imphq_playbook_steps for all to authenticated using (true) with check (true);
drop policy if exists "auth manage playbook applications" on public.imphq_playbook_applications;
create policy "auth manage playbook applications" on public.imphq_playbook_applications for all to authenticated using (true) with check (true);
