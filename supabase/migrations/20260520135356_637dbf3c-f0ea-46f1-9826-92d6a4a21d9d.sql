INSERT INTO public.imphq_tag_project_rules (tag, project_id, priority, user_id)
VALUES ('asf-mai26', 'tatuagem', 1, '4310966f-2276-44fc-9331-4766c808ac5c')
ON CONFLICT DO NOTHING;

UPDATE public.imphq_leads
SET project_id = 'tatuagem'
WHERE project_id = 'jp_freitas'
  AND 'asf-mai26' = ANY(tags);