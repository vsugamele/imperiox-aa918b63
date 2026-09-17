do $$
declare
  v_checkout text := 'https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377';
begin
  insert into public.imphq_automacoes (
    id, project_id, nome, trigger_tipo, produto, ativo, prioridade, tag_filtro, dedupe_hours, quiet_start, quiet_end, link_checkout, flow_objective, trigger_config, acoes
  ) values
  (
    gen_random_uuid(),
    'lipo',
    'LinfaFlow Care Recovery - Safety Review [EN-US]',
    'tag_adicionada',
    'LinfaFlow',
    false,
    10,
    'linfaflow-care-safety-review',
    72,
    22,
    8,
    v_checkout,
    'Pause sales and notify human operator when the Care intake indicates a possible safety signal.',
    jsonb_build_object('source','linfaflow-care','mode','inactive_recovery','tag','linfaflow-care-safety-review'),
    '[
      {"tipo":"notify_operator","delay_min":0,"operator_name":"LinfaFlow Care","template":"Safety review needed before any sale.","text":"Review {{nome}} before continuing. Possible safety signal in LinfaFlow Care intake."},
      {"tipo":"whatsapp","delay_min":0,"template":"{{primeiro_nome}}, based on your answers, I do not want to treat this as a normal wellness case. This is not a medical diagnosis, but your notes deserve qualified review before any supplement decision."},
      {"tipo":"stop_on_event","delay_min":0,"stop_event_type":"safety_handoff","template":"Stop sales path until reviewed."}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'lipo',
    'LinfaFlow Care Recovery - Offer Seen No Click [EN-US]',
    'tag_adicionada',
    'LinfaFlow',
    false,
    8,
    'linfaflow-care-offer-seen',
    24,
    22,
    8,
    v_checkout,
    'Recover qualified leads who saw the personalized recommendation but did not click checkout.',
    jsonb_build_object('source','linfaflow-care','mode','inactive_recovery','tag','linfaflow-care-offer-seen'),
    '[
      {"tipo":"aguardar","delay_min":15,"template":"Wait 15 minutes after offer is shown."},
      {"tipo":"wait_event","delay_min":0,"event_names":"checkout_click,compra_aprovada,whatsapp_reply","timeout_min":1,"template":"If she clicked, bought, or replied, do not send generic rescue."},
      {"tipo":"whatsapp","delay_min":0,"template":"{{primeiro_nome}}, quick check: did anything about the LinfaFlow recommendation feel unclear? I can explain the routine, ingredients, or why I connected it to what you shared."},
      {"tipo":"aguardar","delay_min":180,"template":"Wait 3 hours before second rescue."},
      {"tipo":"audio","delay_min":0,"voice_provider":"elevenlabs","voice_id":"personalized_followup","template":"Personalized voice note: use her first name, summarize the pattern, and invite a simple 30-day decision without pressure."}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'lipo',
    'LinfaFlow Care Recovery - High Intent No Purchase [EN-US]',
    'tag_adicionada',
    'LinfaFlow',
    false,
    9,
    'linfaflow-care-high-intent-no-purchase',
    24,
    22,
    8,
    v_checkout,
    'Prioritize hot leads who reached offer stage but have not purchased yet.',
    jsonb_build_object('source','linfaflow-care','mode','inactive_recovery','tag','linfaflow-care-high-intent-no-purchase'),
    '[
      {"tipo":"aguardar","delay_min":30,"template":"Wait 30 minutes to avoid over-follow-up."},
      {"tipo":"notify_operator","delay_min":0,"operator_name":"LinfaFlow Care","template":"Hot lead no purchase.","text":"{{nome}} is high intent and reached recommendation. Review conversation and objection before manual follow-up."},
      {"tipo":"ia_message","delay_min":0,"ia_model":"openrouter:google/gemini-3-flash-preview","personality":"calm_close","template":"Write a concise personalized follow-up based on lead_memory.linfaflow_care_profile. Do not diagnose. Mention her pattern, one likely objection, and the secure checkout only if appropriate."}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'lipo',
    'LinfaFlow Care Recovery - Checkout Clicked Assist [EN-US]',
    'tag_adicionada',
    'LinfaFlow',
    false,
    9,
    'linfaflow-care-checkout-clicked',
    12,
    22,
    8,
    v_checkout,
    'Assist checkout clickers who may have doubts before payment completion.',
    jsonb_build_object('source','linfaflow-care','mode','inactive_recovery','tag','linfaflow-care-checkout-clicked'),
    '[
      {"tipo":"aguardar","delay_min":10,"template":"Wait 10 minutes after checkout click."},
      {"tipo":"wait_event","delay_min":0,"event_names":"compra_aprovada,whatsapp_reply","timeout_min":1,"template":"Skip if purchased or replied."},
      {"tipo":"whatsapp","delay_min":0,"template":"{{primeiro_nome}}, were you able to finish the secure checkout? If anything got confusing, I can help with the next step or resend the link: {{link_checkout}}"},
      {"tipo":"notify_operator","delay_min":60,"operator_name":"LinfaFlow Care","template":"Checkout clicked, no purchase confirmation yet.","text":"Check {{nome}} checkout status. Lead clicked checkout but no approved purchase event was seen."}
    ]'::jsonb
  ),
  (
    gen_random_uuid(),
    'lipo',
    'LinfaFlow Care Recovery - Objection Or Proof [EN-US]',
    'tag_adicionada',
    'LinfaFlow',
    false,
    7,
    'linfaflow-care-objection-or-proof',
    24,
    22,
    8,
    v_checkout,
    'Continue education for leads who reached mechanism/proof/objection stage but did not close.',
    jsonb_build_object('source','linfaflow-care','mode','inactive_recovery','tag','linfaflow-care-objection-or-proof'),
    '[
      {"tipo":"aguardar","delay_min":120,"template":"Wait 2 hours before education follow-up."},
      {"tipo":"audio","delay_min":0,"voice_provider":"elevenlabs","voice_id":"cached_mechanism_cleavers_v1","template":"Cached audio: explain Cleavers-led internal drainage support, not a diuretic and not a medical treatment."},
      {"tipo":"whatsapp","delay_min":1,"template":"The reason I mentioned LinfaFlow is not because you need another outside-in fix. Your pattern sounded like something where a simple daily internal-support ritual may fit better than repeating socks/elevation/creams."},
      {"tipo":"quick_reply","delay_min":0,"question":"What is the main thing you still want clear?","capture_variable":"main_objection","options":[{"label":"How to take it","value":"usage"},{"label":"Why it fits me","value":"fit"},{"label":"Ingredients","value":"ingredients"},{"label":"Checkout","value":"checkout"}],"template":"Route the next answer by objection."}
    ]'::jsonb
  )
  on conflict do nothing;
end $$;

select
  id,
  nome,
  ativo,
  trigger_tipo,
  tag_filtro,
  jsonb_array_length(acoes) as passos,
  '/openflow?automacao=' || id::text as openflow_path
from public.imphq_automacoes
where nome ilike 'LinfaFlow Care Recovery%'
   or nome ilike 'LinfaFlow Care Handoff%'
order by prioridade desc, nome;
