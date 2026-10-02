-- Esteira de conteúdo (Story OP1.2): contas, peças, postagens e métricas diárias.
-- Começa pelo GeeLark (TikTok/IG em farm) e serve também Facebook e YouTube depois.
-- Regra de aprovação: postagem só sai se a peça estiver "aprovado" (decisão do Vinicius, 02/10/2026).

-- Contas/perfis/páginas onde o conteúdo é postado.
create table if not exists public.imphq_social_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  platform text not null check (platform in ('tiktok', 'instagram', 'facebook', 'youtube')),
  handle text not null,
  provider text not null default 'geelark' check (provider in ('geelark', 'graph', 'youtube_api', 'zernio', 'manual')),
  geelark_env_id text,
  geelark_analytics_id text,
  status text not null default 'aquecendo' check (status in ('aquecendo', 'ativo', 'pausado', 'bloqueado')),
  daily_post_limit integer not null default 1 check (daily_post_limit between 0 and 20),
  link_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle)
);
create index if not exists imphq_social_accounts_project_idx on public.imphq_social_accounts (project_id, platform);

-- Peça de conteúdo: do roteiro ao vídeo aprovado.
create table if not exists public.imphq_content_items (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  title text not null,
  angle text,
  hook text,
  script text,
  caption text,
  cta text,
  skill text,
  format text not null default 'video_9x16',
  media_url text,
  cover_url text,
  drive_url text,
  batch text,
  status text not null default 'roteiro' check (status in ('roteiro', 'gerando', 'pronto', 'aprovado', 'reprovado', 'arquivado')),
  approved_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists imphq_content_items_project_status_idx on public.imphq_content_items (project_id, status);
create index if not exists imphq_content_items_batch_idx on public.imphq_content_items (batch);

-- Postagem: uma peça numa conta. Tentativas limitadas a 3 (regra anti-loop do projeto).
create table if not exists public.imphq_content_posts (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.imphq_content_items(id) on delete restrict,
  account_id uuid not null references public.imphq_social_accounts(id) on delete restrict,
  project_id text not null,
  platform text not null,
  scheduled_at timestamptz not null default now(),
  status text not null default 'agendado' check (status in ('agendado', 'enviando', 'publicando', 'publicado', 'falhou', 'cancelado')),
  provider_task_id text,
  provider_file_url text,
  post_url text,
  utm_content text,
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, account_id)
);
create index if not exists imphq_content_posts_due_idx on public.imphq_content_posts (status, scheduled_at);
create index if not exists imphq_content_posts_account_idx on public.imphq_content_posts (account_id, scheduled_at);

-- Métricas por dia: da conta (post_id nulo) ou de uma postagem; fonte separa GeeLark, coleta pública e funil.
create table if not exists public.imphq_content_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.imphq_social_accounts(id) on delete restrict,
  post_id uuid references public.imphq_content_posts(id) on delete restrict,
  metric_date date not null,
  source text not null check (source in ('geelark_analytics', 'scraper', 'funnel', 'manual')),
  views integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  followers integer,
  clicks integer,
  sessions integer,
  leads integer,
  sales integer,
  revenue numeric(12, 2),
  raw jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists imphq_content_metrics_daily_key
  on public.imphq_content_metrics_daily (account_id, coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_date, source);

alter table public.imphq_social_accounts enable row level security;
alter table public.imphq_content_items enable row level security;
alter table public.imphq_content_posts enable row level security;
alter table public.imphq_content_metrics_daily enable row level security;

drop policy if exists "auth manage social accounts" on public.imphq_social_accounts;
create policy "auth manage social accounts" on public.imphq_social_accounts for all to authenticated using (true) with check (true);
drop policy if exists "auth manage content items" on public.imphq_content_items;
create policy "auth manage content items" on public.imphq_content_items for all to authenticated using (true) with check (true);
drop policy if exists "auth manage content posts" on public.imphq_content_posts;
create policy "auth manage content posts" on public.imphq_content_posts for all to authenticated using (true) with check (true);
drop policy if exists "auth manage content metrics" on public.imphq_content_metrics_daily;
create policy "auth manage content metrics" on public.imphq_content_metrics_daily for all to authenticated using (true) with check (true);

-- Vídeos e capas das peças (público: o GeeLark baixa pela URL).
insert into storage.buckets (id, name, public) values ('content-media', 'content-media', true)
on conflict (id) do nothing;
