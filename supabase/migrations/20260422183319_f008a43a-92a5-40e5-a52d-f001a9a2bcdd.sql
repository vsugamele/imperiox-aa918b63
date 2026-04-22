CREATE INDEX IF NOT EXISTS idx_nurture_emails_aberto ON public.imphq_nurture_emails(aberto_em) WHERE aberto_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nurture_emails_clicado ON public.imphq_nurture_emails(clicado_em) WHERE clicado_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nurture_emails_enrollment ON public.imphq_nurture_emails(enrollment_id);