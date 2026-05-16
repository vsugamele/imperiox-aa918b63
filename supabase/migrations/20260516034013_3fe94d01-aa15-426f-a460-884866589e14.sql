
ALTER TABLE public.imphq_wa_campaigns
  ADD COLUMN IF NOT EXISTS fallback_provider_id uuid REFERENCES public.imphq_wa_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_fallback boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pause_on_failure boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.imphq_wa_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  produto text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  import_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_templates_slug ON public.imphq_wa_campaign_templates(slug);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_templates_author ON public.imphq_wa_campaign_templates(author_id);

ALTER TABLE public.imphq_wa_campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public templates are viewable by everyone"
  ON public.imphq_wa_campaign_templates FOR SELECT
  USING (is_public = true OR author_id = auth.uid());

CREATE POLICY "Authenticated users can create templates"
  ON public.imphq_wa_campaign_templates FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update their templates"
  ON public.imphq_wa_campaign_templates FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Authors can delete their templates"
  ON public.imphq_wa_campaign_templates FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER trg_wa_campaign_templates_updated_at
  BEFORE UPDATE ON public.imphq_wa_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
