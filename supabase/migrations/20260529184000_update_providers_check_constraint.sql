-- Update check constraint on imphq_wa_providers to allow meta_cloud provider
ALTER TABLE public.imphq_wa_providers DROP CONSTRAINT IF EXISTS imphq_wa_providers_provider_check;
ALTER TABLE public.imphq_wa_providers ADD CONSTRAINT imphq_wa_providers_provider_check CHECK (provider = ANY (ARRAY['evolution'::text, 'twilio'::text, 'meta_cloud'::text]));
