-- Suporte a horas fracionarias nos delays de pitch follow-up (ex: 0.35h = 21min)
ALTER TABLE public.imphq_wa_ai_config 
  ALTER COLUMN pitch_followup_delays_hours TYPE numeric[] USING pitch_followup_delays_hours::numeric[];
