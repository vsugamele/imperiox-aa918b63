-- Visão "Caminho" do mapa (Story MAP2.3): o caminho principal é calculado pelas setas até a venda;
-- path_role é o ajuste manual por etapa (null = automático). Decisão do Vinicius em 03/10/2026.
alter table public.imphq_company_map_nodes
  add column if not exists path_role text check (path_role in ('principal', 'alternativa'));
