-- Feed "A IA fez" (IA2.1): a IA age sozinha e o time revisa depois ("tá certo" ou "faria diferente").
-- Uma linha por item revisado; item_kind: resposta_wa, recuperacao_pix, acervo, acao_auto.
create table if not exists public.imphq_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  item_kind text not null check (item_kind in ('resposta_wa', 'recuperacao_pix', 'acervo', 'acao_auto')),
  item_id text not null,
  project_id text,
  verdict text not null check (verdict in ('ok', 'diferente')),
  correcao text,
  actor text,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (item_kind, item_id)
);

create index if not exists imphq_ai_feedback_created_idx on public.imphq_ai_feedback (created_at desc);

alter table public.imphq_ai_feedback enable row level security;
drop policy if exists "ai_feedback_team" on public.imphq_ai_feedback;
create policy "ai_feedback_team" on public.imphq_ai_feedback for all to authenticated using (true) with check (true);
grant select, insert, update on public.imphq_ai_feedback to authenticated;
