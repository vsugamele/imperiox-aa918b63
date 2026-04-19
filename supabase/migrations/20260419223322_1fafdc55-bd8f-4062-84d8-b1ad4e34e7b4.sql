
-- Add new notification preference toggles for sales + hot leads
ALTER TABLE public.imphq_notification_preferences
  ADD COLUMN IF NOT EXISTS venda_aprovada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS venda_recusada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reembolso_solicitado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_diaria_atingida boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hot_lead boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lead_inativo_voltou boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expert_marcou_done boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expert_subiu_video boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expert_mensagem boolean NOT NULL DEFAULT true;

-- Add user role for project owners to receive notifications (used by edge functions to find recipients)
-- Add a daily revenue goal column on imphq_projects (used by meta_diaria_atingida)
ALTER TABLE public.imphq_projects
  ADD COLUMN IF NOT EXISTS daily_revenue_goal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meta_diaria_notified_date date DEFAULT NULL;
