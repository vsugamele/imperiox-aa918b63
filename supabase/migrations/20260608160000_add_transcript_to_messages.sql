-- Add transcript column to imphq_wa_messages
ALTER TABLE imphq_wa_messages ADD COLUMN IF NOT EXISTS transcript TEXT;
