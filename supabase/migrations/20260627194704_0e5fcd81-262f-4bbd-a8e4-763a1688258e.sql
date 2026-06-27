
-- 1. WA briefing preferences
ALTER TABLE public.imphq_notification_preferences
  ADD COLUMN IF NOT EXISTS wa_briefing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_briefing_phone text,
  ADD COLUMN IF NOT EXISTS wa_briefing_hour integer NOT NULL DEFAULT 8;

-- 2. Copies por nó de funil
CREATE TABLE IF NOT EXISTS public.imphq_funnel_node_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id text NOT NULL,
  node_id text NOT NULL,
  asset_kind text,
  produto_id text,
  copies jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_idx integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, node_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_funnel_node_copies TO authenticated;
GRANT ALL ON public.imphq_funnel_node_copies TO service_role;

ALTER TABLE public.imphq_funnel_node_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read funnel copies"
  ON public.imphq_funnel_node_copies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write funnel copies"
  ON public.imphq_funnel_node_copies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update funnel copies"
  ON public.imphq_funnel_node_copies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete funnel copies"
  ON public.imphq_funnel_node_copies FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_funnel_node_copies_updated_at
  BEFORE UPDATE ON public.imphq_funnel_node_copies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
