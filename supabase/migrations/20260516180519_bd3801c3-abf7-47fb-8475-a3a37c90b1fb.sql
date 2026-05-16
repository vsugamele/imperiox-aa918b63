DELETE FROM imphq_wa_messages WHERE conversation_id IN (SELECT id FROM imphq_wa_conversations WHERE provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38');
DELETE FROM imphq_wa_conversations WHERE provider_id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38';
DELETE FROM imphq_wa_providers WHERE id = 'cd3bbdb5-059e-4f79-bec6-a978ddb5fa38';