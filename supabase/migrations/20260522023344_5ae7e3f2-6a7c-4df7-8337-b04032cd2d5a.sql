
create extension if not exists vector;

alter table public.imphq_wa_ai_config
  add column if not exists ai_provider text not null default 'lovable',
  add column if not exists ai_model text,
  add column if not exists ai_temperature numeric not null default 0.7,
  add column if not exists ai_top_p numeric not null default 1,
  add column if not exists learning_mode boolean not null default true,
  add column if not exists draft_mode boolean not null default false;

alter table public.imphq_wa_messages
  add column if not exists sent_by text,
  add column if not exists metadata jsonb;

update public.imphq_wa_messages
   set sent_by = case
     when direction = 'incoming' then 'lead'
     when direction = 'outgoing' then 'human'
     else 'system'
   end
 where sent_by is null;

create index if not exists idx_wa_messages_sent_by on public.imphq_wa_messages(sent_by);
create index if not exists idx_wa_messages_proj_sent_created on public.imphq_wa_messages(project_id, sent_by, created_at desc);

create table if not exists public.imphq_wa_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  pergunta text not null,
  resposta text not null,
  embedding extensions.vector(768),
  source text not null default 'human_reply',
  score_uso int not null default 0,
  aprovada boolean not null default false,
  conversation_id uuid,
  lead_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.imphq_wa_knowledge enable row level security;
drop policy if exists "wa_knowledge_auth_all" on public.imphq_wa_knowledge;
create policy "wa_knowledge_auth_all"
  on public.imphq_wa_knowledge for all to authenticated using (true) with check (true);

create index if not exists idx_wa_knowledge_project on public.imphq_wa_knowledge(project_id);
create index if not exists idx_wa_knowledge_embedding on public.imphq_wa_knowledge using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

create or replace function public.match_wa_knowledge(
  query_embedding extensions.vector(768),
  p_project_id text,
  match_count int default 3,
  min_similarity float default 0.7
)
returns table (id uuid, pergunta text, resposta text, similarity float)
language sql stable security definer set search_path = public, extensions
as $$
  select k.id, k.pergunta, k.resposta, 1 - (k.embedding <=> query_embedding) as similarity
  from public.imphq_wa_knowledge k
  where k.project_id = p_project_id
    and k.embedding is not null
    and (1 - (k.embedding <=> query_embedding)) >= min_similarity
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists public.imphq_wa_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  project_id text not null,
  incoming_message_id uuid,
  incoming_text text,
  suggested_text text not null,
  final_text text,
  diff_ratio numeric,
  model text,
  provider text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.imphq_wa_ai_drafts enable row level security;
drop policy if exists "wa_drafts_auth_all" on public.imphq_wa_ai_drafts;
create policy "wa_drafts_auth_all"
  on public.imphq_wa_ai_drafts for all to authenticated using (true) with check (true);

create index if not exists idx_wa_drafts_conv_status on public.imphq_wa_ai_drafts(conversation_id, status, created_at desc);
