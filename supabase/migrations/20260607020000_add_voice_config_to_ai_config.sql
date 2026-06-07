-- Migration: add voice configurations to imphq_wa_ai_config
ALTER TABLE imphq_wa_ai_config 
ADD COLUMN IF NOT EXISTS voice_reply_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_provider text DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS voice_stability numeric DEFAULT 75,
ADD COLUMN IF NOT EXISTS voice_clarity numeric DEFAULT 85;

-- Note: voice_name already exists in some references, let's ensure it can store ElevenLabs ID.
-- If voice_name does not exist, let's create it.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='imphq_wa_ai_config' AND column_name='voice_name') THEN
        ALTER TABLE imphq_wa_ai_config ADD COLUMN voice_name text DEFAULT 'alloy';
    END IF;
END $$;
