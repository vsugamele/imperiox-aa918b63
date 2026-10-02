-- Etapa do mapa com status, dono e prazo em colunas próprias (UX1.1).
-- Antes o status morava só nas notas ([agent_status:…]). A coluna passa a ser a fonte; as notas continuam
-- recebendo a marcação por compatibilidade. Leitura (_shared/map-contract.ts readStepStatus):
-- coluna → marcação declarada nas notas → "sem status".
-- Dono = alguém do time (imphq_team_members). Etapa de IA ou automação pode ficar sem dono.

alter table public.imphq_company_map_nodes
  add column if not exists step_status text
    check (step_status in ('pending', 'in_progress', 'ready_review', 'done')),
  add column if not exists owner_member_id uuid references public.imphq_team_members(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by text;

create index if not exists imphq_company_map_nodes_owner_idx
  on public.imphq_company_map_nodes (owner_member_id) where owner_member_id is not null;
create index if not exists imphq_company_map_nodes_due_idx
  on public.imphq_company_map_nodes (due_date) where due_date is not null;

comment on column public.imphq_company_map_nodes.step_status is 'Status declarado da etapa (null = não declarado). Checklist não prova execução.';
comment on column public.imphq_company_map_nodes.owner_member_id is 'Responsável pela etapa (imphq_team_members).';
comment on column public.imphq_company_map_nodes.due_date is 'Prazo da etapa.';
comment on column public.imphq_company_map_nodes.status_changed_by is 'Quem mudou o status por último: e-mail, "mcp" ou "playbook".';
