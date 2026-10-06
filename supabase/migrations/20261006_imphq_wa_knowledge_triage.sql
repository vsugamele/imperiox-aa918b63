-- Triagem automática do acervo do bot pelo Jev (KB1.1) e limpeza da fila de aprovação.
alter table public.imphq_wa_knowledge add column if not exists triagem jsonb;
alter table public.imphq_wa_knowledge add column if not exists triado_em timestamptz;
create index if not exists imphq_wa_knowledge_pending_idx on public.imphq_wa_knowledge (aprovada, triado_em) where aprovada = false;

-- Material de livro e feedback já entram aprovados: estavam na fila só por answered=false.
update public.imphq_wa_knowledge set answered = true, updated_at = now()
where aprovada = true and coalesce(answered, false) = false;
