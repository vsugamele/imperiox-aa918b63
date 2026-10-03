-- Rodadas da Esteira de Escala DTC (STR1.9): números lançados na etapa do mapa (P1–P4) com o veredito do momento.
-- `data` usa o mesmo formato do MCP evaluate_scale (concepts, dias, checkpoint, conjuntos, verba, gasto_ontem, lances, angulos);
-- `resultado` guarda o veredito calculado por _shared/scale-ladder.ts quando a rodada foi salva (histórico e aprendizado do projeto).

create table if not exists public.imphq_scale_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  node_id uuid references public.imphq_company_map_nodes(id) on delete set null,
  fase text not null check (fase in ('parametros', 'p1', 'p2', 'p3', 'p4')),
  rodada text,
  params jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  resultado jsonb,
  resumo text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists imphq_scale_rounds_project_fase_idx on public.imphq_scale_rounds (project_id, fase, updated_at desc);
create index if not exists imphq_scale_rounds_node_idx on public.imphq_scale_rounds (node_id);

alter table public.imphq_scale_rounds enable row level security;
drop policy if exists "auth manage scale rounds" on public.imphq_scale_rounds;
create policy "auth manage scale rounds" on public.imphq_scale_rounds for all to authenticated using (true) with check (true);
