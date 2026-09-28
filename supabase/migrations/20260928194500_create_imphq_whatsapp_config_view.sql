-- Migration: Compatibility view imphq_whatsapp_config -> imphq_wa_providers
-- Fixes payment-recovery and legacy edge functions that queried imphq_whatsapp_config

CREATE OR REPLACE VIEW public.imphq_whatsapp_config AS
SELECT * FROM public.imphq_wa_providers;
