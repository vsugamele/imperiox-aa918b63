
ALTER TABLE public.imphq_ig_comment_triggers
  ADD COLUMN IF NOT EXISTS like_comment BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.imphq_ig_trigger_executions
  ADD COLUMN IF NOT EXISTS like_status TEXT,
  ADD COLUMN IF NOT EXISTS reply_status TEXT,
  ADD COLUMN IF NOT EXISTS dm_status TEXT;
