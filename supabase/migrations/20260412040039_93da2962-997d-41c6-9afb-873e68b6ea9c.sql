
-- 1. Add automation columns to imphq_wa_campaigns
ALTER TABLE public.imphq_wa_campaigns
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS anti_hack boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mention_all boolean DEFAULT false;

-- 2. Create notification preferences table
CREATE TABLE IF NOT EXISTS public.imphq_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  novo_lead boolean DEFAULT true,
  grupo_capacidade boolean DEFAULT true,
  disparo_concluido boolean DEFAULT true,
  erro_conexao boolean DEFAULT true,
  resposta_ia boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.imphq_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification prefs"
  ON public.imphq_notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification prefs"
  ON public.imphq_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs"
  ON public.imphq_notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_imphq_notification_prefs_updated_at
  BEFORE UPDATE ON public.imphq_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
