ALTER TABLE public.imphq_webchat_widgets
  ADD COLUMN IF NOT EXISTS tema text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS subtitulo text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS som boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS texto_digitando text NOT NULL DEFAULT 'digitando...',
  ADD COLUMN IF NOT EXISTS texto_gravando text NOT NULL DEFAULT 'gravando audio...';