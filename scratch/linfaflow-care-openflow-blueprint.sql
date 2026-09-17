do $$
declare
  v_flow_id uuid;
  v_acoes jsonb := $flow$
[
  {
    "tipo": "adicionar_tag",
    "template": "Internal: tag lead as linfaflow-care-intake-started when the web quiz begins.",
    "tag": "linfaflow-care-intake-started",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 0
  },
  {
    "tipo": "quick_reply",
    "template": "Quiz Q1 - main concern",
    "question": "Before I personalize this for you, what are you hoping to improve first?",
    "options": [
      { "label": "Puffy ankles or legs", "value": "puffy_ankles" },
      { "label": "Heavy legs or tight shoes", "value": "heavy_legs" },
      { "label": "Morning puffiness or bloating", "value": "morning_puffiness" },
      { "label": "Low energy / sluggish feeling", "value": "low_energy" }
    ],
    "capture_variable": "main_concern",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 180
  },
  {
    "tipo": "input_capture",
    "template": "Capture name for personalized consult.",
    "question": "What should I call you?",
    "capture_variable": "first_name",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 360
  },
  {
    "tipo": "quick_reply",
    "template": "Quiz Q2 - timing pattern",
    "question": "When do you notice it the most?",
    "options": [
      { "label": "After standing or walking", "value": "standing" },
      { "label": "At the end of the day", "value": "end_of_day" },
      { "label": "When it is warm", "value": "warm_weather" },
      { "label": "Most mornings", "value": "morning" }
    ],
    "capture_variable": "timing_pattern",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 540
  },
  {
    "tipo": "quick_reply",
    "template": "Quiz Q3 - what she tried",
    "question": "Have you already tried any outside-in fixes?",
    "options": [
      { "label": "Compression socks", "value": "compression" },
      { "label": "Elevation or massage", "value": "elevation_massage" },
      { "label": "Creams or cooling gels", "value": "creams" },
      { "label": "Nothing consistently", "value": "nothing" }
    ],
    "capture_variable": "tried_before",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 720
  },
  {
    "tipo": "quick_reply",
    "template": "Quiz Q4 - optional photo/audio permission",
    "question": "If you can, you may send a photo or short voice note so I can understand your situation better. If not, your answers are enough.",
    "options": [
      { "label": "I can send a photo", "value": "photo_yes" },
      { "label": "I can send audio", "value": "audio_yes" },
      { "label": "Not now", "value": "media_no" }
    ],
    "capture_variable": "media_permission",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 900
  },
  {
    "tipo": "quick_reply",
    "template": "Safety screen - red flags",
    "question": "Quick safety check: is this sudden, painful, one-sided, or linked to shortness of breath?",
    "options": [
      { "label": "No, none of those", "value": "no_red_flags" },
      { "label": "Yes, one of those", "value": "red_flag" },
      { "label": "Not sure", "value": "unsure" }
    ],
    "capture_variable": "safety_signal",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1080
  },
  {
    "tipo": "condicao_lead",
    "template": "Branch: safety_signal is red_flag or unsure.",
    "condition_field": "safety_signal",
    "condition_operator": "in",
    "condition_value": "red_flag,unsure",
    "condition_jump_steps": 1,
    "condition_else_jump_steps": 3,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1260
  },
  {
    "tipo": "notify_operator",
    "template": "Safety/handoff: lead indicated a possible red flag. Pause sales and ask for qualified human review.",
    "operator_name": "LinfaFlow Care",
    "text": "Possible safety red flag from {{first_name}}. Review before continuing: {{safety_signal}}.",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 1440
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, based on that answer, I do not want to treat this as a normal wellness case. This is not a medical diagnosis, but sudden, painful, one-sided swelling or breathing symptoms should be checked by a qualified professional before we talk about a supplement.",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 1620
  },
  {
    "tipo": "stop_on_event",
    "template": "Stop sales path after red-flag handoff.",
    "stop_event_type": "safety_handoff",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 1800
  },
  {
    "tipo": "ia_message",
    "template": "Personalized doctor-style wellness assessment. Mention name, main concern, timing, what she tried, and whether photo/audio was provided. Explain the internal drainage mechanism without disease claims. Do not diagnose. Ask one smart follow-up before selling unless the lead is already high intent.",
    "personality": "calm_clinical_consultative",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "ia_vision": true,
    "ia_voice_response": false,
    "ia_routes": [
      { "name": "needs_more_context", "jump_steps": 1 },
      { "name": "ready_for_mechanism", "jump_steps": 2 },
      { "name": "high_intent_close", "jump_steps": 6 }
    ],
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1440
  },
  {
    "tipo": "wait_reply",
    "template": "Wait for lead to answer the consult follow-up.",
    "timeout_min": 30,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1620
  },
  {
    "tipo": "update_memory",
    "template": "Save consult context: concern, timing, tried_before, media_permission, safety_signal, latest_reply.",
    "memory_key": "linfaflow_care_profile",
    "memory_value": "{\"main_concern\":\"{{main_concern}}\",\"timing\":\"{{timing_pattern}}\",\"tried\":\"{{tried_before}}\",\"media\":\"{{media_permission}}\",\"safety\":\"{{safety_signal}}\"}",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1800
  },
  {
    "tipo": "audio",
    "template": "{{first_name}}, what you described is exactly why outside-in fixes can feel temporary. LinfaFlow is positioned as a daily liquid wellness support for the internal drainage system, not as a diuretic and not as a medical treatment.",
    "voice_provider": "elevenlabs",
    "voice_id": "default",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1980
  },
  {
    "tipo": "whatsapp",
    "template": "The simple idea is this: if the internal drainage system is sluggish, fluids can feel like they are pooling by the end of the day. Socks, elevation and creams work from the outside. LinfaFlow is built to support the inside routine with a 1 mL serving twice daily.",
    "delay_min": 1,
    "position_x": 0,
    "position_y": 2160
  },
  {
    "tipo": "whatsapp",
    "template": "The formula is centered around Cleavers, with Stillingia, Prickly Ash and Red Clover. I am not saying this diagnoses or treats a condition. The goal is daily drainage-support consistency, especially for people who recognize the pattern you described.",
    "delay_min": 1,
    "position_x": 0,
    "position_y": 2340
  },
  {
    "tipo": "quick_reply",
    "template": "Objection discovery before offer.",
    "question": "What would you need to feel comfortable trying this?",
    "options": [
      { "label": "I need proof it makes sense", "value": "proof" },
      { "label": "I worry it will not work for me", "value": "skepticism" },
      { "label": "I want to know how to take it", "value": "usage" },
      { "label": "I am ready to see the option", "value": "ready" }
    ],
    "capture_variable": "main_objection",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2520
  },
  {
    "tipo": "semantic_router",
    "template": "Route objection: proof, skepticism, usage, ready.",
    "router_definition_a": "proof|skepticism|usage",
    "router_definition_b": "ready|price|checkout|buy",
    "jump_steps": 2,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2700
  },
  {
    "tipo": "audio",
    "template": "Short cached objection answer. Reinforce that the recommendation is based on her pattern, not a generic pitch. Use proof as mechanism clarity and routine fit, not fake medical claims.",
    "voice_provider": "elevenlabs",
    "voice_id": "cached_objection_skepticism_v1",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 2880
  },
  {
    "tipo": "ia_message",
    "template": "Answer the specific objection using the stored profile. Keep it short, empathetic, and consultative. Then bridge to the personalized recommendation.",
    "personality": "direct_response_clinical",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 3060
  },
  {
    "tipo": "qualify_lead",
    "template": "Internal score only. Do not show this score to the lead.",
    "lead_score": 86,
    "lead_tags": "linfaflow-care-qualified,personalized-recommendation-ready",
    "lead_stage": "recommendation_ready",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2880
  },
  {
    "tipo": "ia_message",
    "template": "Personalized recommendation: summarize her concern, timing and failed outside-in fixes. Recommend LinfaFlow as a 30-day daily drainage-support routine. Do not overpromise. Include why 1 mL twice daily fits her pattern.",
    "personality": "calm_close",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3060
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, based on your answers, this is the option I would look at first: {{link_checkout}}\n\nStart with the 30-day bottle, 1 mL twice daily. The important part is consistency, because this is a daily support routine, not a one-time quick fix.",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3240
  },
  {
    "tipo": "wait_event",
    "template": "Wait for checkout click, purchase, or lead reply.",
    "event_names": "checkout_click,compra_aprovada,whatsapp_reply",
    "timeout_min": 15,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3420
  },
  {
    "tipo": "condicao",
    "template": "If purchase approved, stop. If no purchase, enter follow-up recovery.",
    "condicao_tipo": "compra_aprovada",
    "condicao_tempo_min": 15,
    "condition_jump_steps": 1,
    "condition_else_jump_steps": 2,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3600
  },
  {
    "tipo": "stop_on_event",
    "template": "Stop on purchase approved.",
    "stop_event_type": "compra_aprovada",
    "delay_min": 0,
    "position_x": 260,
    "position_y": 3780
  },
  {
    "tipo": "aguardar",
    "template": "Wait 15 minutes before first rescue.",
    "delay_min": 15,
    "position_x": 0,
    "position_y": 3780
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, quick check: did anything about the recommendation feel unclear? I can explain the routine, the ingredients, or help you decide if this is the right next step for your situation.",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3960
  },
  {
    "tipo": "aguardar",
    "template": "Wait 3 hours before second rescue.",
    "delay_min": 180,
    "position_x": 0,
    "position_y": 4140
  },
  {
    "tipo": "audio",
    "template": "Personalized follow-up voice note using first name and main concern. Keep it human, short, and focused on why her pattern matched the recommendation.",
    "voice_provider": "elevenlabs",
    "voice_id": "personalized_followup",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4320
  },
  {
    "tipo": "aguardar",
    "template": "Wait 24 hours before final gentle follow-up.",
    "delay_min": 1440,
    "position_x": 0,
    "position_y": 4500
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, I am closing your wellness consult for now. If the ankle/leg heaviness pattern is still bothering you, the personalized LinfaFlow option is still here: {{link_checkout}}",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4680
  },
  {
    "tipo": "notify_operator",
    "template": "High intent no-purchase: review transcript and decide manual follow-up.",
    "operator_name": "LinfaFlow Care",
    "text": "{{first_name}} reached recommendation/checkout but did not purchase. Review objection: {{main_objection}}.",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4860
  }
]
$flow$::jsonb;
begin
  update public.imphq_automacoes
  set
    project_id = 'lipo',
    trigger_tipo = 'lead_novo',
    produto = 'LinfaFlow',
    ativo = false,
    prioridade = 8,
    dedupe_hours = 24,
    quiet_start = 22,
    quiet_end = 8,
    link_checkout = 'https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377',
    flow_objective = 'Convert LinfaFlow web leads through a personalized doctor-style wellness intake, compliant consult, media-aware AI conversation, proof/mechanism education, recommendation, checkout and follow-up.',
    trigger_config = jsonb_build_object(
      'source', 'linfaflow-care',
      'mode', 'visual_blueprint',
      'public_route', '/linfaflow-care',
      'dashboard_route', '/linfaflow-care-dashboard'
    ),
    acoes = v_acoes
  where nome = 'LinfaFlow Care - Web Intake + AI Consult [EN-US]'
  returning id into v_flow_id;

  if v_flow_id is null then
    insert into public.imphq_automacoes (
      id,
      project_id,
      nome,
      trigger_tipo,
      produto,
      ativo,
      prioridade,
      dedupe_hours,
      quiet_start,
      quiet_end,
      link_checkout,
      flow_objective,
      trigger_config,
      acoes
    )
    values (
      gen_random_uuid(),
      'lipo',
      'LinfaFlow Care - Web Intake + AI Consult [EN-US]',
      'lead_novo',
      'LinfaFlow',
      false,
      8,
      24,
      22,
      8,
      'https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377',
      'Convert LinfaFlow web leads through a personalized doctor-style wellness intake, compliant consult, media-aware AI conversation, proof/mechanism education, recommendation, checkout and follow-up.',
      jsonb_build_object(
        'source', 'linfaflow-care',
        'mode', 'visual_blueprint',
        'public_route', '/linfaflow-care',
        'dashboard_route', '/linfaflow-care-dashboard'
      ),
      v_acoes
    )
    returning id into v_flow_id;
  end if;

  raise notice 'LinfaFlow Care OpenFlow blueprint id: %', v_flow_id;
end $$;

select
  id,
  nome,
  ativo,
  project_id,
  trigger_tipo,
  produto,
  prioridade,
  jsonb_array_length(acoes) as passos,
  '/openflow?automacao=' || id::text as openflow_path
from public.imphq_automacoes
where nome = 'LinfaFlow Care - Web Intake + AI Consult [EN-US]';
