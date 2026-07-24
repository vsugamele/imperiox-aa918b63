
-- Studio learning
ALTER TABLE public.imphq_studio_prompts ADD COLUMN IF NOT EXISTS performance_score numeric DEFAULT 0;
ALTER TABLE public.imphq_studio_publications ADD COLUMN IF NOT EXISTS hook_id uuid;
ALTER TABLE public.imphq_studio_publications ADD COLUMN IF NOT EXISTS body_id uuid;
ALTER TABLE public.imphq_studio_publications ADD COLUMN IF NOT EXISTS cta_id uuid;

-- Kanban board config + views
ALTER TABLE public.imphq_kanban_boards ADD COLUMN IF NOT EXISTS columns_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.imphq_kanban_boards ADD COLUMN IF NOT EXISTS saved_views jsonb DEFAULT '[]'::jsonb;

-- Cross-links
ALTER TABLE public.imphq_creative_assets ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE public.imphq_studio_canvas_nodes ADD COLUMN IF NOT EXISTS funnel_node_id uuid;
ALTER TABLE public.imphq_funnel_node_copies ADD COLUMN IF NOT EXISTS card_id uuid;
CREATE INDEX IF NOT EXISTS idx_creative_assets_card ON public.imphq_creative_assets(card_id);
CREATE INDEX IF NOT EXISTS idx_studio_nodes_funnel ON public.imphq_studio_canvas_nodes(funnel_node_id);
CREATE INDEX IF NOT EXISTS idx_funnel_copies_card ON public.imphq_funnel_node_copies(card_id);

-- Funnel templates framework tag
ALTER TABLE public.imphq_funnel_templates ADD COLUMN IF NOT EXISTS framework_tag text;
CREATE INDEX IF NOT EXISTS idx_funnel_templates_framework ON public.imphq_funnel_templates(framework_tag);

-- Skills pipeline + outputs enrichment
ALTER TABLE public.imphq_skills ADD COLUMN IF NOT EXISTS pipeline jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.imphq_skill_outputs ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE public.imphq_skill_outputs ADD COLUMN IF NOT EXISTS funnel_node_id uuid;
ALTER TABLE public.imphq_skill_outputs ADD COLUMN IF NOT EXISTS studio_node_id uuid;
ALTER TABLE public.imphq_skill_outputs ADD COLUMN IF NOT EXISTS outcome_score numeric;
CREATE INDEX IF NOT EXISTS idx_skill_outputs_card ON public.imphq_skill_outputs(card_id);
CREATE INDEX IF NOT EXISTS idx_skill_outputs_studio_node ON public.imphq_skill_outputs(studio_node_id);
