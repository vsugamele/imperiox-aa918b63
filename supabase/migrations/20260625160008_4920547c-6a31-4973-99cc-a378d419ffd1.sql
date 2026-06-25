
ALTER TABLE public.imphq_swipes
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS duration_s integer,
  ADD COLUMN IF NOT EXISTS audio_hash text,
  ADD COLUMN IF NOT EXISTS transcribe_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS transcribe_error text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS thumb_url text;

CREATE INDEX IF NOT EXISTS idx_imphq_swipes_audio_hash ON public.imphq_swipes(user_id, audio_hash) WHERE audio_hash IS NOT NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_swipes;
