ALTER TABLE public.imphq_automacoes 
ADD COLUMN IF NOT EXISTS exit_conditions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stats_cache JSONB DEFAULT '{"success_rate": 0, "revenue": 0, "executions": 0}'::jsonb;

COMMENT ON COLUMN public.imphq_automacoes.exit_conditions IS 'Lista de condições que fazem o lead sair do fluxo imediatamente (ex: evento de compra).';
COMMENT ON COLUMN public.imphq_automacoes.stats_cache IS 'Cache de métricas de performance para exibição nos cards da listagem.';