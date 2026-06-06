-- Add Instagram specific AI configuration fields
ALTER TABLE imphq_wa_ai_config 
ADD COLUMN IF NOT EXISTS instagram_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_comments_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_comments_behavior text DEFAULT 'reply_and_dm',
ADD COLUMN IF NOT EXISTS instagram_comments_custom_dm text;
