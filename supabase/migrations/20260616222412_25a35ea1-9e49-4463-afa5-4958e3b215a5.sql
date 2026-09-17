ALTER TABLE public.imphq_notification_preferences
ADD COLUMN IF NOT EXISTS checkout_abandonado boolean NOT NULL DEFAULT true;