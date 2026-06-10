-- ── Instagram closer + reengagement + wait_reply support ─────────────────────

-- Coluna para rastrear closer IG independente do WA
ALTER TABLE public.imphq_leads
  ADD COLUMN IF NOT EXISTS ig_participant_id text,
  ADD COLUMN IF NOT EXISTS ig_closer_sent_at timestamptz;

-- Índice para ig-closer-trigger buscar leads hot IG pendentes
CREATE INDEX IF NOT EXISTS idx_leads_ig_closer_pending
  ON public.imphq_leads (closer_triggered_at, ig_closer_sent_at)
  WHERE ig_participant_id IS NOT NULL AND ig_closer_sent_at IS NULL;

-- Campo ai_active nas conversas IG (espelho do ia_ativa do WA)
ALTER TABLE public.imphq_ig_conversations
  ADD COLUMN IF NOT EXISTS ai_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reengagement_sent_at timestamptz;

-- Campo waiting_for nas execuções de flow (para distinguir wait_reply de wait_event)
ALTER TABLE public.imphq_flow_executions
  ADD COLUMN IF NOT EXISTS waiting_for text; -- 'reply' | 'event' | 'time' | null

-- Índice para buscar execuções aguardando resposta de uma conversa específica
CREATE INDEX IF NOT EXISTS idx_flow_executions_wait_reply
  ON public.imphq_flow_executions (status, waiting_for)
  WHERE status = 'waiting' AND waiting_for = 'reply';

-- ── Crons para ig-reengagement e ig-closer-trigger ─────────────────────────

-- ig-reengagement: diariamente às 9h30 (meia hora depois do WA reengagement)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ig-reengagement-daily') THEN
    PERFORM cron.unschedule('ig-reengagement-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'ig-reengagement-daily',
  '30 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ig-reengagement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ig-closer-trigger: a cada hora (mesmo timing do WA closer)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ig-closer-trigger-hourly') THEN
    PERFORM cron.unschedule('ig-closer-trigger-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'ig-closer-trigger-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ig-closer-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
