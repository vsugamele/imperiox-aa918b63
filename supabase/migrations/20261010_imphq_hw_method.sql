-- Método H&W (MHW1.1/1.2/1.5): as réguas que explicam por que um criativo vence ou morre, a revisão antes de subir e a
-- família de um campeão (Molde Vencedor). Só colunas novas, todas opcionais: nada muda no que já roda.
alter table public.imphq_test_variants
  add column if not exists ponto_rota smallint check (ponto_rota between 1 and 5),
  add column if not exists carga text check (carga in ('objeto_estranho', 'rosto_emocao', 'cena_vida', 'contradicao', 'bloco')),
  add column if not exists porta text check (porta in ('direta', 'voz_dela', 'quebra_crenca', 'narrativa', 'descoberta')),
  add column if not exists pouso text check (pouso in ('pousou', 'bateu', 'tombou', 'apagou')),
  add column if not exists molde_campeao_id uuid references public.imphq_test_variants(id) on delete set null,
  add column if not exists molde_variacao text check (molde_variacao in ('V00', 'V01', 'V02', 'V03', 'V04', 'V05')),
  add column if not exists molde_dimensao text check (molde_dimensao in ('quem_fala', 'onde', 'tom_visual', 'pessoa_cenario')),
  -- Confiança de cada etiqueta e quem etiquetou (jev / humano).
  add column if not exists taxonomia jsonb,
  -- Resultado do Revisor: aprovado, nota, itens, reprovações, avisos, correções permitidas.
  add column if not exists revisao jsonb;

create index if not exists imphq_test_variants_molde_idx on public.imphq_test_variants (molde_campeao_id) where molde_campeao_id is not null;

comment on column public.imphq_test_variants.ponto_rota is 'Método H&W: ponto da rota (1 não vê o problema … 5 pronta para comprar). No frio só 1 e 2.';
comment on column public.imphq_test_variants.carga is 'Método H&W: o que o primeiro quadro usa para parar o dedo; bloco = só produto/preço/logo.';
comment on column public.imphq_test_variants.porta is 'Método H&W: papel do hook (direta, voz dela, quebra de crença, narrativa, descoberta).';
comment on column public.imphq_test_variants.pouso is 'Método H&W: a frase de aterrissagem (pousou, bateu, tombou, apagou).';
comment on column public.imphq_test_variants.molde_variacao is 'Método H&W: posição na fila do Molde Vencedor (V00 desmontar … V05 tom visual).';
