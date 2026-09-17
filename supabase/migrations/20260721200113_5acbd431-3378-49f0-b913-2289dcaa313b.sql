-- 1. Tabela de jobs do pipeline UGC
CREATE TABLE public.imphq_ugc_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  produto text NOT NULL,
  actor_ref_url text,
  age_bracket text,
  tone text,
  lane text,
  research_leads text,
  script_json jsonb,
  casting_json jsonb,
  clip1_json jsonb,
  clip2_json jsonb,
  casting_image_url text,
  clip1_url text,
  clip2_url text,
  final_916_url text,
  seam_metric numeric,
  status text NOT NULL DEFAULT 'gating',
  current_step text,
  gate_errors jsonb DEFAULT '[]'::jsonb,
  error text,
  cost_usd numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_ugc_jobs TO authenticated;
GRANT ALL ON public.imphq_ugc_jobs TO service_role;

ALTER TABLE public.imphq_ugc_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_jobs_owner_all" ON public.imphq_ugc_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ugc_jobs_project ON public.imphq_ugc_jobs(project_id, created_at DESC);
CREATE INDEX idx_ugc_jobs_status ON public.imphq_ugc_jobs(status) WHERE status NOT IN ('done','failed');

CREATE TRIGGER trg_ugc_jobs_updated
  BEFORE UPDATE ON public.imphq_ugc_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Registra skill /ugc
INSERT INTO public.imphq_skills (slug, nome, descricao, categoria, status, gatilho, system_prompt)
VALUES (
  'ugc',
  'Omni UGC Ad Factory',
  'Pipeline UGC: gates JSON → casting → clip1 → clip2 → stitch 9:16 (~20s).',
  'video',
  'ativo',
  '/ugc',
  E'Você é o motor da Omni UGC Ad Factory — pipeline que transforma produto + foto de referência de ator em um anúncio UGC talking-head de ~20s (dois clips de 10s encadeados como uma tomada só, entregue como MP4 9:16).\n\nFILOSOFIA: A parte difícil não é gerar um talking head — é fazer o espectador acreditar. Isso exige: (1) ator que pareça capturado, não renderizado; (2) script que soe humano, não anúncio; (3) voz que não seja monótona; (4) micro-comportamentos (pausas irregulares, olhar caído, expiração pelo nariz) nos beats certos; (5) dois clips que se juntem sem seam visível.\n\nGATES: Você nunca escreve prompt de geração à mão. Você escreve JSON estruturado. O código valida esse JSON contra glossários (fisiologia de pele por idade, glossário de 32 micro-behaviors, spec de voz de 6 categorias, vocabulário de câmera) e MONTA o prompt no PASS. Prompt que pulou o gate não existe.\n\nO TRUQUE DE ENCADEAMENTO: Omni segura sua imagem de referência nos primeiros frames antes de dissolver na cena gerada. Semeando clip 2 com o último frame do clip 1, o join fica invisível — seam de ~3/255 contra gate rígido de 5/255.\n\nSAÍDA SEMPRE em JSON válido conforme o schema pedido. Zero prosa, zero markdown wrapping. pt-BR na copy, campos técnicos em EN quando o schema exigir.'
) ON CONFLICT (slug) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  descricao = EXCLUDED.descricao,
  status = 'ativo';