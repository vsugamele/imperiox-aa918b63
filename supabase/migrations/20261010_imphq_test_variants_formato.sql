-- OPS1.3: formato de cada criativo de teste (mesmo vocabulário das referências mineradas, _shared/ref-pipeline.ts),
-- para o placar responder "print de conversa vende mais que estático aqui?" e o Estrategista saber o que já foi testado.
alter table public.imphq_test_variants
  add column if not exists formato text check (formato in ('estatico', 'carrossel', 'print_conversa', 'antes_depois', 'depoimento', 'ugc_fala', 'demonstracao', 'narrativa_broll', 'entrevista_podcast', 'produto', 'infografico', 'meme', 'outro'));

comment on column public.imphq_test_variants.formato is 'Formato do criativo (mesmo vocabulário de imphq_referencias.formato).';
