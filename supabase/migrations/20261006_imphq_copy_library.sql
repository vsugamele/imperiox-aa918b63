-- Biblioteca de copy (ângulos, objeções, provas, mecanismos e o processo de uso) e etiquetas nas variantes de teste
-- para o placar por método e por ângulo (CPY1.1). O conteúdo vem das bibliotecas do @renanmsap e é semeado fora do repositório.

create table if not exists public.imphq_copy_library (
  id text primary key,
  biblioteca text not null check (biblioteca in ('angulo', 'objecao', 'prova', 'mecanismo', 'processo')),
  numero numeric not null default 0,
  categoria text not null,
  nome text not null,
  explicacao text,
  exemplo text,
  como_usar text,
  prompt text,
  extra jsonb not null default '{}'::jsonb,
  fonte text not null default '@renanmsap',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists imphq_copy_library_bib_idx on public.imphq_copy_library (biblioteca, categoria, ordem);

alter table public.imphq_copy_library enable row level security;
drop policy if exists "copy_library_read_team" on public.imphq_copy_library;
create policy "copy_library_read_team" on public.imphq_copy_library for select to authenticated using (true);
grant select on public.imphq_copy_library to authenticated;

-- Etiquetas da variante: quem escreveu (método) e qual ângulo da biblioteca ela usa.
alter table public.imphq_test_variants add column if not exists metodo text;
alter table public.imphq_test_variants add column if not exists copy_lib_id text references public.imphq_copy_library (id) on delete set null;
create index if not exists imphq_test_variants_metodo_idx on public.imphq_test_variants (metodo);
create index if not exists imphq_test_variants_copy_lib_idx on public.imphq_test_variants (copy_lib_id);
