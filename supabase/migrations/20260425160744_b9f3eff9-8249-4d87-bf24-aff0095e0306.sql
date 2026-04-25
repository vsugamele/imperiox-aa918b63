ALTER TABLE public.imphq_wa_campaigns
  ADD COLUMN IF NOT EXISTS send_window_start TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS send_window_end TIME NOT NULL DEFAULT '22:00';

ALTER TABLE public.imphq_wa_campaign_steps
  ADD COLUMN IF NOT EXISTS content_b TEXT;