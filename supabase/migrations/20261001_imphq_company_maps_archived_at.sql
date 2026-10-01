-- Arquivar mapa = esconder da lista sem apagar nada (etapas, conexões e anotações ficam intactas).
alter table public.imphq_company_maps add column if not exists archived_at timestamptz;
comment on column public.imphq_company_maps.archived_at is 'Quando preenchido, o mapa some da lista do canvas; para voltar, limpar o campo.';
