-- Elenco (OPS1.5): os avatares de cada projeto, nos dois sentidos — quem APARECE na arte (elenco visual) e para quem a
-- copy FALA (persona do público). Reaproveita imphq_avatar_studio_projects (Avatar Studio) com colunas novas, todas
-- opcionais: o que a aba Avatar Studio já faz continua igual.
alter table public.imphq_avatar_studio_projects
  add column if not exists tipo text check (tipo in ('especialista', 'profissional', 'cliente', 'apresentadora', 'publico')),
  add column if not exists papel text not null default 'elenco' check (papel in ('elenco', 'publico', 'ambos')),
  add column if not exists ficha jsonb not null default '{}'::jsonb,
  add column if not exists ativo boolean not null default true,
  add column if not exists origem text not null default 'manual' check (origem in ('manual', 'ia'));

create index if not exists imphq_avatar_studio_projects_project_idx on public.imphq_avatar_studio_projects (project_id) where ativo;

-- Qual avatar aparece em cada criativo de teste: o placar passa a responder "qual rosto vende".
alter table public.imphq_test_variants
  add column if not exists avatar_id uuid references public.imphq_avatar_studio_projects(id) on delete set null;

comment on column public.imphq_avatar_studio_projects.papel is 'elenco = aparece nas artes; publico = persona para quem a copy fala; ambos.';
comment on column public.imphq_avatar_studio_projects.ficha is 'idade, aparencia, cenario, frase, dores, desejos, objecoes, linguagem (palavras dela).';
comment on column public.imphq_test_variants.avatar_id is 'Avatar do elenco que aparece no criativo.';
