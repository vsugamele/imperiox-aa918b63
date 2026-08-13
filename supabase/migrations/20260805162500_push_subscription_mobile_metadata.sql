ALTER TABLE public.imphq_push_subscriptions
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_last_seen
  ON public.imphq_push_subscriptions(user_id, last_seen_at DESC);
