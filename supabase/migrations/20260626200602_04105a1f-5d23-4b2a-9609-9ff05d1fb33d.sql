
CREATE TABLE IF NOT EXISTS public.imphq_flow_wa_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  produto_id text,
  produto_nome text,
  blueprint_id uuid NOT NULL REFERENCES public.imphq_flow_blueprints(id) ON DELETE CASCADE,
  provider_id uuid,
  keywords text[] NOT NULL DEFAULT '{}',
  pitch_link text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  times_matched integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_flow_wa_triggers TO authenticated;
GRANT ALL ON public.imphq_flow_wa_triggers TO service_role;

ALTER TABLE public.imphq_flow_wa_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read flow wa triggers" ON public.imphq_flow_wa_triggers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage flow wa triggers" ON public.imphq_flow_wa_triggers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_flow_wa_triggers_project ON public.imphq_flow_wa_triggers(project_id, active);
CREATE INDEX IF NOT EXISTS idx_flow_wa_triggers_blueprint ON public.imphq_flow_wa_triggers(blueprint_id);
