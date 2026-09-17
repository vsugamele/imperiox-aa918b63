-- Add participant_phone and platform to imphq_ig_conversations
ALTER TABLE public.imphq_ig_conversations 
  ADD COLUMN IF NOT EXISTS participant_phone TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram';

-- Add platform, post_id, sentiment to imphq_ig_comments
ALTER TABLE public.imphq_ig_comments
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'instagram',
  ADD COLUMN IF NOT EXISTS post_id TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT;
