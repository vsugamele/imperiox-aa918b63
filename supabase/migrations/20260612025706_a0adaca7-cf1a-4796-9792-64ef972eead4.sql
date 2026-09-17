CREATE INDEX IF NOT EXISTS idx_imphq_notifications_user_created ON public.imphq_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imphq_notifications_created ON public.imphq_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imphq_ai_actions_status_priority ON public.imphq_ai_actions (status, priority_score DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imphq_ai_actions_executed_at ON public.imphq_ai_actions (executed_at DESC) WHERE executed_at IS NOT NULL;