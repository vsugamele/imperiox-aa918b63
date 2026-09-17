
CREATE INDEX IF NOT EXISTS idx_imphq_notifications_user_created
  ON public.imphq_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imphq_notifications_user_unread
  ON public.imphq_notifications (user_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_imphq_leads_project_updated
  ON public.imphq_leads (project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_imphq_leads_project_status
  ON public.imphq_leads (project_id, status);

CREATE INDEX IF NOT EXISTS idx_imphq_vendas_project_created
  ON public.imphq_vendas (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imphq_vendas_project_status
  ON public.imphq_vendas (project_id, status);

CREATE INDEX IF NOT EXISTS idx_imphq_wa_messages_conv_created
  ON public.imphq_wa_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imphq_ads_spend_project_date
  ON public.imphq_ads_spend (project_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_imphq_funnel_events_project_created
  ON public.imphq_funnel_events (project_id, created_at DESC);
