
CREATE TABLE public.imphq_lead_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  project_id TEXT,
  conversion_probability INTEGER DEFAULT 0 CHECK (conversion_probability >= 0 AND conversion_probability <= 100),
  churn_risk TEXT DEFAULT 'medium' CHECK (churn_risk IN ('low', 'medium', 'high')),
  predicted_value NUMERIC(12,2) DEFAULT 0,
  recommended_actions TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  scoring_factors JSONB DEFAULT '{}',
  next_best_action TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_predictions_lead ON public.imphq_lead_predictions(lead_id);
CREATE INDEX idx_lead_predictions_project ON public.imphq_lead_predictions(project_id);
CREATE INDEX idx_lead_predictions_expires ON public.imphq_lead_predictions(expires_at);

ALTER TABLE public.imphq_lead_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read predictions"
ON public.imphq_lead_predictions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert predictions"
ON public.imphq_lead_predictions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update predictions"
ON public.imphq_lead_predictions FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_lead_predictions_updated_at
BEFORE UPDATE ON public.imphq_lead_predictions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
