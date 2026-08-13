do $$
declare
  v_flow_id text := '2266ddbd-cdd0-41b4-acae-428da8f324f6';
  v_checkout text := 'https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377';
  v_acoes jsonb := $flow$
[
  {
    "tipo": "adicionar_tag",
    "template": "Single script starts. Internal tag only.",
    "tag": "linfaflow-care-script-started",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 0
  },
  {
    "tipo": "quick_reply",
    "template": "1. Intake - primary pain",
    "question": "Before I personalize this, what bothers you the most right now?",
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
    "template": "2. Personalization - name",
    "question": "What should I call you while I review this?",
    "capture_variable": "first_name",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 360
  },
  {
    "tipo": "quick_reply",
    "template": "3. Pattern - timing",
    "question": "When does it usually show up the most?",
    "options": [
      { "label": "After standing/walking", "value": "standing" },
      { "label": "End of the day", "value": "end_of_day" },
      { "label": "Warm weather", "value": "warm_weather" },
      { "label": "Most mornings", "value": "morning" }
    ],
    "capture_variable": "timing_pattern",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 540
  },
  {
    "tipo": "quick_reply",
    "template": "4. Reality - what she already tried",
    "question": "What have you already tried?",
    "options": [
      { "label": "Compression socks", "value": "compression" },
      { "label": "Elevation or massage", "value": "elevation_massage" },
      { "label": "Creams/cooling gels", "value": "creams" },
      { "label": "Nothing consistently", "value": "nothing" }
    ],
    "capture_variable": "tried_before",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 720
  },
  {
    "tipo": "quick_reply",
    "template": "5. Identity impact",
    "question": "What does this change in your day-to-day life?",
    "options": [
      { "label": "Shoes or socks feel tight", "value": "tight_shoes" },
      { "label": "I avoid photos/clothes", "value": "avoid_photos" },
      { "label": "I feel uncomfortable by evening", "value": "evening_discomfort" },
      { "label": "I just want the pattern to make sense", "value": "needs_explanation" }
    ],
    "capture_variable": "daily_impact",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 900
  },
  {
    "tipo": "quick_reply",
    "template": "6. Optional media - photo/audio",
    "question": "If you can, you may send a photo or short voice note so I can understand the context better. If not, your answers are enough.",
    "options": [
      { "label": "I can send a photo", "value": "photo_yes" },
      { "label": "I can send audio", "value": "audio_yes" },
      { "label": "Not now", "value": "media_no" }
    ],
    "capture_variable": "media_permission",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1080
  },
  {
    "tipo": "quick_reply",
    "template": "7. Safety screen before selling",
    "question": "Quick safety check: is this sudden, painful, one-sided, hot/red, or linked to shortness of breath, pregnancy, medication, or a diagnosed condition?",
    "options": [
      { "label": "No, none of those", "value": "no_red_flags" },
      { "label": "Yes, one of those", "value": "red_flag" },
      { "label": "Not sure", "value": "unsure" }
    ],
    "capture_variable": "safety_signal",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1260
  },
  {
    "tipo": "condicao_lead",
    "template": "Branch: red flag or unsure pauses sales.",
    "condition_field": "safety_signal",
    "condition_operator": "in",
    "condition_value": "red_flag,unsure",
    "condition_jump_steps": 1,
    "condition_else_jump_steps": 4,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1440
  },
  {
    "tipo": "notify_operator",
    "template": "Safety handoff inside the same flow.",
    "operator_name": "LinfaFlow Care",
    "text": "Review {{nome}} before any product pitch. Possible safety signal: {{safety_signal}}.",
    "delay_min": 0,
    "position_x": -300,
    "position_y": 1620
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, based on that answer, I do not want to treat this as a normal wellness case. This is not a medical diagnosis, but sudden, painful, one-sided swelling or breathing symptoms should be checked by a qualified professional before we talk about a supplement.",
    "delay_min": 0,
    "position_x": -300,
    "position_y": 1800
  },
  {
    "tipo": "audio",
    "template": "{{first_name}}, I want to be careful here. If swelling is sudden, one-sided, painful, red or hot, connected with chest symptoms, pregnancy, wounds, medication, or a diagnosed condition, this should be checked with a healthcare professional before thinking about any wellness routine.",
    "voice_provider": "elevenlabs",
    "voice_id": "personalized_safety",
    "delay_min": 0,
    "position_x": -300,
    "position_y": 1980
  },
  {
    "tipo": "stop_on_event",
    "template": "Stop sales after safety handoff.",
    "stop_event_type": "safety_handoff",
    "delay_min": 0,
    "position_x": -300,
    "position_y": 2160
  },
  {
    "tipo": "ia_message",
    "template": "8. Doctor-style wellness assessment. Use lead answers, photo/audio if present, and persuasion profile. Mirror the real-life pattern before teaching. If the lead goes off-script, answer briefly and route back to the next script beat. Do not sell yet.",
    "personality": "calm_clinical_consultative",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "ia_vision": true,
    "ia_voice_response": false,
    "ia_routes": [
      { "name": "off_script_question", "jump_steps": 1 },
      { "name": "ready_for_reality", "jump_steps": 2 },
      { "name": "red_flag", "jump_steps": -5 }
    ],
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1620
  },
  {
    "tipo": "wait_reply",
    "template": "Let her respond. AI handles off-script questions, then returns to script.",
    "timeout_min": 20,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1800
  },
  {
    "tipo": "ia_message",
    "template": "9. Reality mirror. Use one 'how did you know?' line based on avatar: normal tests, external fixes, standing all day, photos/clothes, bloating, or mysterious swelling. Make it feel personal, not generic.",
    "personality": "deep_recognition",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 1980
  },
  {
    "tipo": "audio",
    "template": "{{first_name}}, I read what you shared. I am looking at where it shows up, when it feels worst, what seems to trigger it, what you already tried, and what it affects day to day. That is what lets me make this feel specific instead of generic.",
    "voice_provider": "elevenlabs",
    "voice_id": "personalized_reality_mirror",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2160
  },
  {
    "tipo": "whatsapp",
    "template": "Here is the pattern I am checking: repeated puffiness/heaviness, when it appears, what triggers it, what you already tried, and whether it affects shoes, clothes, photos, comfort, or confidence. That is the difference between a generic answer and a real recommendation.",
    "delay_min": 1,
    "position_x": 0,
    "position_y": 2340
  },
  {
    "tipo": "whatsapp",
    "template": "A lot of people in this situation try outside-in fixes first: compression, elevation, massage, creams, cooling gels. Those can help for a window, but the same pattern can come back when the day starts again.",
    "delay_min": 1,
    "position_x": 0,
    "position_y": 2520
  },
  {
    "tipo": "audio",
    "template": "Compression, elevation, and drainage can help for a short window, but they work mostly from the outside. Once the day starts again, the same pattern can come back. That is why this review looks at timing, triggers, sock marks, and daily consistency before recommending anything.",
    "voice_provider": "elevenlabs",
    "voice_id": "cached_outside_in",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2700
  },
  {
    "tipo": "ia_message",
    "template": "10. Mechanism reframe. Explain internal drainage support using compliant language. Never say drain/eliminate/cure/treat. Lead with Cleavers, then Stillingia, Prickly Ash, Red Clover. Keep it clear.",
    "personality": "mechanism_teacher",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 2880
  },
  {
    "tipo": "audio",
    "template": "The key idea is simple: your swelling, heaviness, and puffiness may not be separate daily annoyances. They can be part of the same slow-drainage pattern. LinfaFlow is positioned as a liquid wellness ritual led by Cleavers, with Stillingia, Prickly Ash, and Red Clover as complementary botanicals.",
    "voice_provider": "elevenlabs",
    "voice_id": "cached_mechanism_cleavers",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3060
  },
  {
    "tipo": "whatsapp",
    "template": "LinfaFlow is not a diuretic, not a medication, and not a harsh cleanse. The routine is simple: 1 mL twice daily as a 30-day liquid wellness ritual. The goal is daily support and consistency, not a one-time quick fix.",
    "delay_min": 1,
    "position_x": 0,
    "position_y": 3240
  },
  {
    "tipo": "quick_reply",
    "template": "11. Objection discovery before pitch.",
    "question": "Before I show the recommendation, what would you need to feel comfortable trying this?",
    "options": [
      { "label": "I need proof it makes sense", "value": "proof" },
      { "label": "I worry it will not work for me", "value": "skepticism" },
      { "label": "I want ingredients/safety clear", "value": "ingredients_safety" },
      { "label": "I want to know how to take it", "value": "usage" }
    ],
    "capture_variable": "main_objection",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3420
  },
  {
    "tipo": "semantic_router",
    "template": "Route objection and let IA answer if lead goes off-script.",
    "router_definition_a": "proof|skepticism|ingredients|safety|usage|price|fit",
    "router_definition_b": "ready|buy|order|checkout",
    "jump_steps": 3,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3600
  },
  {
    "tipo": "ia_message",
    "template": "12. Objection handling. Answer the selected objection with the persuasion profile. Use compliant proof, not fake testimonials. Then ask if she wants the personalized recommendation.",
    "personality": "objection_handler",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 3780
  },
  {
    "tipo": "audio",
    "template": "I understand the skepticism. If you already tried compression, elevation, massage, or random supplements, the point is not to pretend those efforts were wrong. The point is that outside-in fixes can feel temporary. LinfaFlow is framed as a simple 30-day routine test, not a miracle and not a medical treatment.",
    "voice_provider": "elevenlabs",
    "voice_id": "cached_objection_skepticism",
    "delay_min": 0,
    "position_x": -280,
    "position_y": 3960
  },
  {
    "tipo": "wait_reply",
    "template": "Wait for objection response. If off-script, IA answers and returns to pitch.",
    "timeout_min": 20,
    "delay_min": 0,
    "position_x": -280,
    "position_y": 4140
  },
  {
    "tipo": "qualify_lead",
    "template": "Internal only: ready for recommendation. Do not show score to lead.",
    "lead_score": 88,
    "lead_tags": "linfaflow-care-recommendation-ready,linfaflow-care-script-pitch",
    "lead_stage": "recommendation_ready",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3780
  },
  {
    "tipo": "ia_message",
    "template": "13. Personalized pitch. Summarize pattern, timing, tried-before, impact, avatar, objection. Recommend the simplest first step: one 30-day LinfaFlow bottle. Include why it fits, safety boundary, and checkout.",
    "personality": "calm_close",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 3960
  },
  {
    "tipo": "audio",
    "template": "{{first_name}}, based on what you shared, I would start simple: one 30-day LinfaFlow routine. Track three things: sock marks, end-of-day heaviness, and how your shoes feel. LinfaFlow is not a diagnosis, cure, medication, or water pill. It is a liquid daily wellness ritual that supports lymphatic flow, healthy circulation, and fluid balance. If you take medication or have a diagnosed condition, review the ingredients with your doctor or pharmacist first.",
    "voice_provider": "elevenlabs",
    "voice_id": "personalized_pitch",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4140
  },
  {
    "tipo": "whatsapp",
    "template": "{{first_name}}, based on your answers, the simplest first step is one 30-day LinfaFlow routine: {{link_checkout}}\n\nUse it as directed on checkout/product instructions. The important part is consistency. Review ingredients and checkout terms first, and ask a doctor/pharmacist if you take medication or have a diagnosed condition.",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4320
  },
  {
    "tipo": "wait_event",
    "template": "14. Wait for purchase, checkout click, or reply.",
    "event_names": "checkout_click,compra_aprovada,whatsapp_reply",
    "timeout_min": 15,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4500
  },
  {
    "tipo": "condicao",
    "template": "If purchased, stop. If not, continue same-script follow-up.",
    "condicao_tipo": "compra_aprovada",
    "condicao_tempo_min": 15,
    "condition_jump_steps": 1,
    "condition_else_jump_steps": 2,
    "delay_min": 0,
    "position_x": 0,
    "position_y": 4680
  },
  {
    "tipo": "stop_on_event",
    "template": "Stop on approved purchase.",
    "stop_event_type": "compra_aprovada",
    "delay_min": 0,
    "position_x": 280,
    "position_y": 4860
  },
  {
    "tipo": "aguardar",
    "template": "Follow-up 1: 15 minutes after pitch if no purchase/reply.",
    "delay_min": 15,
    "position_x": 0,
    "position_y": 4860
  },
  {
    "tipo": "ia_message",
    "template": "15. Follow-up 1. Do not restart. Continue from her profile and ask what felt unclear: ingredients, routine, fit, checkout, price. Keep it short.",
    "personality": "gentle_rescue",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 5040
  },
  {
    "tipo": "aguardar",
    "template": "Follow-up 2: 3 hours after pitch.",
    "delay_min": 180,
    "position_x": 0,
    "position_y": 5220
  },
  {
    "tipo": "audio",
    "template": "Personalized 3-hour follow-up: say her name, summarize the exact pattern, and explain that the recommendation was based on her answers, not a generic pitch. End with a simple choice: continue reviewing or start the 30-day routine.",
    "voice_provider": "elevenlabs",
    "voice_id": "personalized_3h_followup",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 5400
  },
  {
    "tipo": "aguardar",
    "template": "Follow-up 3: 24 hours after pitch.",
    "delay_min": 1440,
    "position_x": 0,
    "position_y": 5580
  },
  {
    "tipo": "ia_message",
    "template": "16. Final same-script follow-up. Remind her of the cost of staying in the same cycle without shame. Re-state the 30-day routine and checkout. No fake urgency.",
    "personality": "final_close_no_hype",
    "ia_model": "openrouter:google/gemini-3-flash-preview",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 5760
  },
  {
    "tipo": "notify_operator",
    "template": "Internal: high-intent unresolved after full script.",
    "operator_name": "LinfaFlow Care",
    "text": "{{nome}} completed the LinfaFlow Care script but did not purchase. Review profile, objection and transcript for manual follow-up.",
    "delay_min": 0,
    "position_x": 0,
    "position_y": 5940
  }
]
$flow$::jsonb;
begin
  delete from public.imphq_automacoes
  where nome ilike 'LinfaFlow Care Recovery - %';

  update public.imphq_automacoes
  set
    nome = 'LinfaFlow Care - Single Script AI Consult [EN-US]',
    project_id = 'lipo',
    trigger_tipo = 'lead_novo',
    produto = 'LinfaFlow',
    ativo = false,
    prioridade = 9,
    tag_filtro = null,
    dedupe_hours = 24,
    quiet_start = 22,
    quiet_end = 8,
    link_checkout = v_checkout,
    flow_objective = 'One continuous conversion script: intake, safety, AI off-script handling, reality mirror, proof, human audio, objection handling, personalized pitch, checkout and follow-up.',
    trigger_config = jsonb_build_object(
      'source', 'linfaflow-care',
      'mode', 'single_script_blueprint',
      'public_route', '/linfaflow-care',
      'dashboard_route', '/linfaflow-care-dashboard',
      'ai_role', 'answer off-script and return to script',
      'activation_note', 'inactive until reviewed'
    ),
    acoes = v_acoes
  where id = v_flow_id;
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
where id = '2266ddbd-cdd0-41b4-acae-428da8f324f6'
   or nome ilike 'LinfaFlow Care Recovery - %'
order by nome;
