-- Biblioteca de referências analisadas (Story REF1.1): referências do Centro de Comando trazidas para o Império
-- com a análise completa (anatomia, transcrição, ângulo, consciência, troca de crença, ficha editorial), 6 quadros
-- copiados para o bucket reference-frames e o vídeo apontando para o bucket do Centro (tocado por link temporário).
alter table public.imphq_referencias
  add column if not exists fonte text,
  add column if not exists external_id text,
  add column if not exists lote text,
  add column if not exists duracao numeric,
  add column if not exists quadros jsonb,
  add column if not exists analise jsonb,
  add column if not exists video_ref jsonb;

create unique index if not exists imphq_referencias_external_id_key on public.imphq_referencias (external_id) where external_id is not null;

insert into storage.buckets (id, name, public) values ('reference-frames', 'reference-frames', true)
on conflict (id) do nothing;
