
-- 1. Create lead scores log table
CREATE TABLE IF NOT EXISTS public.imphq_lead_scores_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.imphq_lead_scores_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead scores" ON public.imphq_lead_scores_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_lead_scores_log_lead_id ON public.imphq_lead_scores_log(lead_id);

-- 2. Create push subscriptions table
CREATE TABLE IF NOT EXISTS public.imphq_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.imphq_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.imphq_push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Trigger to recalculate lead score from log
CREATE OR REPLACE FUNCTION public.fn_recalc_lead_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(pontos), 0) INTO v_total
  FROM public.imphq_lead_scores_log
  WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  UPDATE public.imphq_leads
  SET score = LEAST(v_total, 100),
      updated_at = NOW()
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_lead_score
AFTER INSERT OR DELETE ON public.imphq_lead_scores_log
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_lead_score();
