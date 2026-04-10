
-- Reassign conversations from old provider to the newer one
UPDATE imphq_wa_conversations 
SET provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38'
WHERE provider_id = 'cf701693-0d86-40ce-bf45-3c7d1d5baff3';

-- Remove the older duplicate provider
DELETE FROM imphq_wa_providers WHERE id = 'cf701693-0d86-40ce-bf45-3c7d1d5baff3';

-- Add unique constraint to prevent future duplicates
ALTER TABLE imphq_wa_providers
ADD CONSTRAINT uq_provider_project_instance UNIQUE (project_id, provider, instance_name);
