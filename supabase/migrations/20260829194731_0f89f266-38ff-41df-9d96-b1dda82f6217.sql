CREATE INDEX IF NOT EXISTS idx_wa_triage_created_desc ON public.imphq_wa_triage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_knowledge_source_btree ON public.imphq_wa_knowledge (source text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_wa_knowledge_project_source_btree ON public.imphq_wa_knowledge (project_id, source);