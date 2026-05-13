CREATE TABLE IF NOT EXISTS public.imphq_ads_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  runs_24h INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_ads_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own rules" ON public.imphq_ads_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rules" ON public.imphq_ads_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rules" ON public.imphq_ads_rules
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rules" ON public.imphq_ads_rules
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_imphq_ads_rules_updated_at
  BEFORE UPDATE ON public.imphq_ads_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rules for every existing user
INSERT INTO public.imphq_ads_rules (user_id, rule_type, params, enabled)
SELECT u.id, 'auto_pause_cpa', '{"cpa_multiplier": 1.5, "min_clicks": 50}'::jsonb, true
FROM auth.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.imphq_ads_rules (user_id, rule_type, params, enabled)
SELECT u.id, 'auto_pause_ctr', '{"min_ctr": 0.8, "min_clicks": 100}'::jsonb, true
FROM auth.users u
ON CONFLICT DO NOTHING;

INSERT INTO public.imphq_ads_rules (user_id, rule_type, params, enabled)
SELECT u.id, 'propose_scale_roas', '{"min_roas": 2.5, "max_daily_budget": 500, "scale_pct": 20}'::jsonb, true
FROM auth.users u
ON CONFLICT DO NOTHING;