-- Frases proibidas customizadas por projeto/provider — injetadas no prompt da IA
-- como "NUNCA use exatamente estas frases". Permite ao operador bloquear vícios da IA
-- sem precisar mexer no código (ex: "Faz todo sentido", "Imagina!", clichês de bot).
ALTER TABLE public.imphq_wa_ai_config
  ADD COLUMN IF NOT EXISTS banned_phrases text[] DEFAULT '{}'::text[];
