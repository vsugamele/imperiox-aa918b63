-- Migration: Conversão Avançada & Operacional Intelligence
-- 1. Objeções Vetoriais
ALTER TABLE public.imphq_wa_objections ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE OR REPLACE FUNCTION public.match_wa_objections(
  query_embedding vector(768),
  p_project_id text,
  match_count int DEFAULT 1,
  min_similarity float DEFAULT 0.72
)
RETURNS TABLE (
  id uuid,
  objecao text,
  resposta_padrao text,
  contexto_produto text,
  similarity float
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.objecao,
    o.resposta_padrao,
    o.contexto_produto,
    1 - (o.embedding <=> query_embedding) AS similarity
  FROM public.imphq_wa_objections o
  WHERE o.projeto_id = p_project_id
    AND o.status = 'ativa'
    AND o.embedding IS NOT NULL
    AND 1 - (o.embedding <=> query_embedding) >= min_similarity
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 2. Testes A/B para Copy
CREATE TABLE IF NOT EXISTS public.imphq_wa_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text REFERENCES public.imphq_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_stage text NOT NULL,
  active boolean DEFAULT true,
  winner_variant_id uuid,
  min_sample_size int DEFAULT 100,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.imphq_wa_ab_test_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES public.imphq_wa_ab_tests(id) ON DELETE CASCADE,
  name text NOT NULL,
  message_template text NOT NULL,
  sent_count int DEFAULT 0,
  reply_count int DEFAULT 0,
  conversion_count int DEFAULT 0,
  traffic_percentage int DEFAULT 50,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.imphq_wa_ab_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES public.imphq_wa_ab_tests(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.imphq_wa_ab_test_variants(id) ON DELETE CASCADE,
  lead_id text REFERENCES public.imphq_leads(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  replied boolean DEFAULT false,
  converted boolean DEFAULT false,
  converted_at timestamp with time zone
);

ALTER TABLE public.imphq_wa_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_wa_ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imphq_wa_ab_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated ab_tests" ON public.imphq_wa_ab_tests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated ab_variants" ON public.imphq_wa_ab_test_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated ab_logs" ON public.imphq_wa_ab_test_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ML Lead Scoring (Naive Bayes em PL/pgSQL)
CREATE OR REPLACE FUNCTION public.clamp(val float, min_val float, max_val float)
RETURNS float AS $$
BEGIN
  RETURN least(greatest(val, min_val), max_val);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.imphq_train_lead_scoring_model()
RETURNS jsonb AS $$
DECLARE
  v_total_leads int;
  v_total_converted int;
  v_total_non_converted int;
  v_prior_conv_odds float;
  v_prior_non_conv_odds float;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_total_leads FROM public.imphq_leads;
  
  SELECT count(DISTINCT l.id) INTO v_total_converted 
  FROM public.imphq_leads l
  JOIN public.imphq_vendas v ON v.lead_id = l.id
  WHERE v.status IN ('aprovado', 'approved', 'paid', 'completed', 'Aprovada', 'aprovada', 'Aprovado');
  
  IF v_total_leads IS NULL OR v_total_leads = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem leads suficientes para treinar.');
  END IF;
  
  v_total_non_converted := v_total_leads - v_total_converted;
  
  IF v_total_non_converted = 0 THEN
    v_total_non_converted := 1;
  END IF;
  
  IF v_total_converted = 0 THEN
    v_total_converted := 1;
  END IF;

  v_prior_conv_odds := v_total_converted::float / v_total_leads::float;
  v_prior_non_conv_odds := v_total_non_converted::float / v_total_leads::float;

  CREATE TEMP TABLE temp_platform_stats AS
  WITH platform_conv AS (
    SELECT l.plataforma, count(*) as conv_count
    FROM public.imphq_leads l
    JOIN public.imphq_vendas v ON v.lead_id = l.id
    WHERE v.status IN ('aprovado', 'approved', 'paid', 'completed', 'Aprovada', 'aprovada', 'Aprovado')
    GROUP BY l.plataforma
  ),
  platform_total AS (
    SELECT l.plataforma, count(*) as total_count
    FROM public.imphq_leads l
    GROUP BY l.plataforma
  )
  SELECT 
    t.plataforma,
    coalesce(c.conv_count, 0) as conv_count,
    (t.total_count - coalesce(c.conv_count, 0)) as non_conv_count
  FROM platform_total t
  LEFT JOIN platform_conv c ON c.plataforma = t.plataforma;

  CREATE TEMP TABLE temp_tag_stats AS
  WITH tag_conv AS (
    SELECT t as tag, count(*) as conv_count
    FROM public.imphq_leads l
    CROSS JOIN unnest(l.tags) t
    JOIN public.imphq_vendas v ON v.lead_id = l.id
    WHERE v.status IN ('aprovado', 'approved', 'paid', 'completed', 'Aprovada', 'aprovada', 'Aprovado')
    GROUP BY t
  ),
  tag_total AS (
    SELECT t as tag, count(*) as total_count
    FROM public.imphq_leads l
    CROSS JOIN unnest(l.tags) t
    GROUP BY t
  )
  SELECT 
    t.tag,
    coalesce(c.conv_count, 0) as conv_count,
    (t.total_count - coalesce(c.conv_count, 0)) as non_conv_count
  FROM tag_total t
  LEFT JOIN tag_conv c ON c.tag = t.tag;

  CREATE TEMP TABLE temp_utm_source_stats AS
  WITH src_conv AS (
    SELECT coalesce(l.data->'utms'->>'utm_source', l.data->>'utm_source', '') as utm_source, count(*) as conv_count
    FROM public.imphq_leads l
    JOIN public.imphq_vendas v ON v.lead_id = l.id
    WHERE v.status IN ('aprovado', 'approved', 'paid', 'completed', 'Aprovada', 'aprovada', 'Aprovado')
    GROUP BY 1
  ),
  src_total AS (
    SELECT coalesce(l.data->'utms'->>'utm_source', l.data->>'utm_source', '') as utm_source, count(*) as total_count
    FROM public.imphq_leads l
    GROUP BY 1
  )
  SELECT 
    t.utm_source,
    coalesce(c.conv_count, 0) as conv_count,
    (t.total_count - coalesce(c.conv_count, 0)) as non_conv_count
  FROM src_total t
  LEFT JOIN src_conv c ON c.utm_source = t.utm_source;

  WITH lead_features AS (
    SELECT 
      l.id,
      l.plataforma,
      coalesce(l.data->'utms'->>'utm_source', l.data->>'utm_source', '') as utm_source,
      l.tags
    FROM public.imphq_leads l
  ),
  lead_odds AS (
    SELECT 
      lf.id,
      ln(v_prior_conv_odds / v_prior_non_conv_odds) +
      ln( (coalesce(ps.conv_count, 0)::float + 1.0) / (v_total_converted::float + 2.0) / 
          ((coalesce(ps.non_conv_count, 0)::float + 1.0) / (v_total_non_converted::float + 2.0)) ) +
      ln( (coalesce(ss.conv_count, 0)::float + 1.0) / (v_total_converted::float + 2.0) / 
          ((coalesce(ss.non_conv_count, 0)::float + 1.0) / (v_total_non_converted::float + 2.0)) ) +
      coalesce((
        SELECT sum(ln(
          ((coalesce(ts.conv_count, 0)::float + 1.0) / (v_total_converted::float + 2.0)) /
          ((coalesce(ts.non_conv_count, 0)::float + 1.0) / (v_total_non_converted::float + 2.0))
        ))
        FROM unnest(lf.tags) t
        LEFT JOIN temp_tag_stats ts ON ts.tag = t
      ), 0.0) as log_odds
    FROM lead_features lf
    LEFT JOIN temp_platform_stats ps ON ps.plataforma = lf.plataforma
    LEFT JOIN temp_utm_source_stats ss ON ss.utm_source = lf.utm_source
  ),
  lead_probs AS (
    SELECT 
      id,
      (1.0 / (1.0 + exp(-public.clamp(log_odds, -12.0, 12.0)))) as prob
    FROM lead_odds
  )
  UPDATE public.imphq_leads l
  SET score = round(p.prob * 100)::integer
  FROM lead_probs p
  WHERE p.id = l.id;

  DROP TABLE temp_platform_stats;
  DROP TABLE temp_tag_stats;
  DROP TABLE temp_utm_source_stats;

  v_result := jsonb_build_object(
    'success', true,
    'total_leads', v_total_leads,
    'converted', v_total_converted,
    'non_converted', v_total_non_converted
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4. Replay de Funil por Sessão
CREATE TABLE IF NOT EXISTS public.imphq_lead_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text REFERENCES public.imphq_leads(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  url text,
  user_agent text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.imphq_lead_session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated session_events" ON public.imphq_lead_session_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow insertions for anon session_events" ON public.imphq_lead_session_events FOR INSERT TO anon WITH CHECK (true);

-- 5. Helper functions for A/B variant counters
CREATE OR REPLACE FUNCTION public.increment_ab_variant_sent(p_variant_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.imphq_wa_ab_test_variants
  SET sent_count = sent_count + 1
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_ab_variant_reply(p_variant_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.imphq_wa_ab_test_variants
  SET reply_count = reply_count + 1
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_ab_variant_conversion(p_variant_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.imphq_wa_ab_test_variants
  SET conversion_count = conversion_count + 1
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql;
