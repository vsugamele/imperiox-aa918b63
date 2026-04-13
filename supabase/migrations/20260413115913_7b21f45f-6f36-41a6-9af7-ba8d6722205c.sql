
-- Add slug column
ALTER TABLE public.imphq_skills ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_imphq_skills_slug ON public.imphq_skills(slug);

-- Populate slugs based on existing skill names
UPDATE public.imphq_skills SET slug = 'avatar-architect' WHERE nome = 'Avatar Architect';
UPDATE public.imphq_skills SET slug = 'devastador-copy' WHERE nome = 'Devastador Copy';
UPDATE public.imphq_skills SET slug = 'funnel-hacker' WHERE nome = 'Funnel Hacker';
UPDATE public.imphq_skills SET slug = 'mecanismo-unico' WHERE nome = 'Mecanismo Único Supremo';
UPDATE public.imphq_skills SET slug = 'reposicionamento' WHERE nome = 'Reposicionamento Estratégico';
UPDATE public.imphq_skills SET slug = 'alquimia-escada-valor' WHERE nome = 'Alquimia da Escada de Valor';
UPDATE public.imphq_skills SET slug = 'tripwire-matador' WHERE nome = 'Tripwire Matador';
UPDATE public.imphq_skills SET slug = 'lp-persuasiva' WHERE nome = 'Arquitetura de LP Persuasiva';
UPDATE public.imphq_skills SET slug = 'sales-architect' WHERE nome = 'Sales Architect';
UPDATE public.imphq_skills SET slug = 'sales-closer' WHERE nome = 'Sales Closer';

-- Also add the skills that the frontend references but may be missing
-- dossie-problemas (used by ProblemasTab, DoresTab, VoyerismosTab)
INSERT INTO public.imphq_skills (nome, descricao, categoria, status, slug, system_prompt, icone, cor)
VALUES (
  'Dossiê de Problemas',
  'Mapeia problemas, dores e cenas de voyerismo do avatar',
  'Pesquisa & Avatar',
  'Ativa',
  'dossie-problemas',
  E'Você é um especialista em pesquisa de avatar e copywriting persuasivo. Sua missão é gerar um dossiê completo de problemas do avatar.\n\nPara cada problema identificado, forneça:\n- Nome do problema\n- Descrição detalhada\n- Score de Dor (0-10)\n- Score de Desejo de resolver (0-10)\n- Score de Piora se não resolver (0-10)\n- Score de Velocidade que precisa resolver (0-10)\n- Score de Disposição a Pagar (0-10)\n- Score de Facilidade de Comunicar (0-10)\n- Score de Frequência que sofre (0-10)\n- Cenas de voyerismo: situações reais do dia-a-dia que revelam essa dor\n\nUse o contexto do projeto e avatar fornecidos para gerar respostas ultra-específicas e realistas. Retorne em JSON quando possível.',
  '🔍',
  '#e74c3c'
)
ON CONFLICT DO NOTHING;

-- mapeamento-desejos (used by DesejosTab)
INSERT INTO public.imphq_skills (nome, descricao, categoria, status, slug, system_prompt, icone, cor)
VALUES (
  'Mapeamento de Desejos',
  'Mapeia desejos externos, internos e proibidos do avatar',
  'Pesquisa & Avatar',
  'Ativa',
  'mapeamento-desejos',
  E'Você é um especialista em pesquisa de avatar e psicologia do consumidor. Sua missão é mapear os desejos profundos do avatar.\n\nCategorize em:\n1. Desejos Externos (visíveis, sociais) - score /80\n2. Desejos Internos (emocionais, transformadores) - score /80\n3. Desejos Proibidos (secretos, que não admitem publicamente) - score /80\n\nPara cada desejo forneça:\n- Nome/título\n- Descrição detalhada\n- Score de intensidade\n- Justificativa do score\n- Como usar na copy\n\nUse o contexto do projeto e avatar fornecidos. Retorne em JSON quando possível.',
  '💎',
  '#9b59b6'
)
ON CONFLICT DO NOTHING;

-- market-intel (used by MarketIntel page)
INSERT INTO public.imphq_skills (nome, descricao, categoria, status, slug, system_prompt, icone, cor)
VALUES (
  'Market Intelligence',
  'Pesquisa de mercado e análise competitiva',
  'Pesquisa & Avatar',
  'Ativa',
  'market-intel',
  E'Você é um analista de inteligência de mercado especializado em marketing digital e infoprodutos. Sua missão é realizar pesquisas de mercado profundas.\n\nModo DISCOVERY:\n- Identifique os principais players do nicho\n- Analise ofertas, posicionamento e estratégias\n- Mapeie oportunidades e gaps de mercado\n- Forneça insights acionáveis\n\nUse dados do projeto para contextualizar a análise. Seja específico e baseado em dados reais quando possível.',
  '🔬',
  '#2ecc71'
)
ON CONFLICT DO NOTHING;
