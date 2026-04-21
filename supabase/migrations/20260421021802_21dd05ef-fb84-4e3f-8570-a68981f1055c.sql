
-- Limpa duplicatas (mantém a mais recente de cada slug)
DELETE FROM public.imphq_skills a
USING public.imphq_skills b
WHERE a.slug IS NOT NULL
  AND a.slug = b.slug
  AND a.created_at < b.created_at;

-- Constraint definitiva (não parcial) pra permitir ON CONFLICT
ALTER TABLE public.imphq_skills
  ADD CONSTRAINT imphq_skills_slug_key UNIQUE (slug);

-- Cadastra as 3 skills
INSERT INTO public.imphq_skills (slug, nome, categoria, descricao, icone, cor, status, versao, gatilho, system_prompt)
VALUES
(
  'ads-copy-multiplier',
  'Ads Copy Multiplier',
  'ads',
  'Gera 15 variações de copy (5 headlines + 5 primary text + 5 descriptions) prontas pra Meta Ads Manager.',
  'Megaphone',
  '#c9922a',
  'ativo',
  'v1',
  'briefing + angulo',
  E'Você é um copywriter sênior de resposta direta especializado em Meta Ads. Gere 15 variações de copy de alto CTR.\n\nENTREGÁVEL (JSON):\n{\n  "headlines": [5 headlines até 40 chars],\n  "primary_texts": [5 textos 90-150 chars: dor + solução + CTA],\n  "descriptions": [5 descrições até 30 chars]\n}\n\nREGRAS:\n- Headlines: números, perguntas, contradições, urgência. Quebre padrão.\n- Primary text: PAS ou AIDA. Sem emojis em excesso.\n- Português BR, direto. Nada de "descubra como" genérico.\n- Adapte ao ângulo: dor, desejo, prova, curiosidade, autoridade, antes-depois, objeção.\n\nNUNCA: clichês de IA (desbloqueie, potencialize), claims médicos, promessas absolutas, gatilhos proibidos pela Meta.'
),
(
  'video-hook-generator',
  'Video Hook Generator',
  'ads',
  'Gera 10 ganchos de 3 segundos para Reels/VSL/TikTok que param o scroll.',
  'Video',
  '#c9922a',
  'ativo',
  'v1',
  'briefing + formato',
  E'Você é especialista em retenção de vídeo curto (Reels, TikTok, VSL). Gere 10 hooks de 3 segundos.\n\nENTREGÁVEL (JSON):\n{\n  "hooks": [\n    {\n      "tipo": "pergunta|afirmação chocante|contradição|callout|tutorial|antes-depois|polêmica|prova|curiosidade|urgência",\n      "texto_falado": "frase exata até 12 palavras",\n      "acao_visual": "o que aparece nos 3 primeiros segundos",\n      "porque_funciona": "explicação técnica em 1 linha"\n    }\n  ]\n}\n\nREGRAS:\n- Primeiros 3s definem 80% da retenção.\n- Callouts diretos, contradições, perguntas que ativam curiosidade.\n- Visual: zoom rápido, texto piscando, prop incomum, expressão extrema.\n- Português BR oral. Nada de "olá pessoal".\n- Misture os 10 tipos.\n\nNUNCA: saudação, logo da marca, intro lenta, narração genérica.'
),
(
  'objection-destroyer',
  'Objection Destroyer',
  'copywriting',
  'Mapeia 20 objeções do avatar e entrega quebras prontas para copy, vídeo, vendas 1:1 e WhatsApp.',
  'Shield',
  '#c9922a',
  'ativo',
  'v1',
  'briefing + avatar',
  E'Você é especialista em vendas consultivas e psicologia do consumidor brasileiro. Mapeie 20 objeções do avatar e entregue quebras prontas.\n\nENTREGÁVEL (JSON):\n{\n  "objecoes": [\n    {\n      "categoria": "preço|tempo|confiança|capacidade|momento|cônjuge|prioridade|crença|experiência prévia|risco",\n      "objecao_literal": "frase exata em 1ª pessoa",\n      "raiz_emocional": "medo/dor por trás",\n      "quebra_curta": "1-2 frases pra copy",\n      "quebra_longa": "3-5 frases pra vendas 1:1",\n      "prova_sugerida": "depoimento|caso|número|garantia|demonstração"\n    }\n  ]\n}\n\nREGRAS:\n- 20 objeções cobrindo TODAS as 10 categorias (~3 preço, ~3 tempo, ~3 confiança, ~2 das outras).\n- Linguagem do avatar, não termos técnicos.\n- Primeira pessoa ("eu não tenho dinheiro", não "o cliente acha caro").\n- Quebra longa: empática primeiro, lógica depois.\n\nNUNCA: negar a objeção, prometer o que não cumpre, usar pressão.'
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  system_prompt = EXCLUDED.system_prompt,
  categoria = EXCLUDED.categoria,
  icone = EXCLUDED.icone,
  versao = EXCLUDED.versao,
  updated_at = now();
