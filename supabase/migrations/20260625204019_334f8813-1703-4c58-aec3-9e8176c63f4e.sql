ALTER TABLE public.imphq_referencias
  ADD COLUMN IF NOT EXISTS transcricao TEXT,
  ADD COLUMN IF NOT EXISTS transcribe_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS transcribe_error TEXT,
  ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ;