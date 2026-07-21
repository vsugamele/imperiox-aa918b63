import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ------------ Glossaries (subset — enough for real validation) ------------
const MICRO_BEHAVIORS = new Set([
  'eye_flick_left', 'eye_flick_right', 'eye_downcast', 'blink_asymmetric',
  'lip_press', 'lip_bite', 'lip_corner_twitch', 'mouth_open_pause',
  'nose_exhale', 'audible_inhale', 'swallow', 'throat_clear',
  'brow_raise_left', 'brow_raise_right', 'brow_furrow', 'head_tilt_left',
  'head_tilt_right', 'head_nod_slight', 'shoulder_shrug_micro',
  'hand_to_face', 'hand_to_neck', 'jaw_clench', 'chin_touch',
  'gaze_break_down', 'gaze_break_up', 'sniff', 'sigh',
  'smirk_half', 'smile_reluctant', 'laugh_short', 'hair_touch', 'cheek_puff'
]);
const AGE_BRACKETS = new Set(['18-25','26-35','36-45','46-60','60+']);
const TONES = new Set(['confessional','urgent','casual','expert']);
const LANES = new Set(['pain','desire','curiosity','contrarian']);

// ------------ Gates ------------
function validateScript(j: any): string[] {
  const e: string[] = [];
  if (!j || typeof j !== 'object') return ['script: not an object'];
  if (typeof j.hook !== 'string' || j.hook.split(' ').length > 12) e.push('hook: must be string ≤12 words');
  if (!Array.isArray(j.beats) || j.beats.length < 2) e.push('beats: need ≥2');
  else j.beats.forEach((b: any, i: number) => {
    if (typeof b.t !== 'number') e.push(`beats[${i}].t must be number`);
    if (typeof b.line !== 'string' || !b.line) e.push(`beats[${i}].line required`);
    if (b.behavior && !MICRO_BEHAVIORS.has(b.behavior)) e.push(`beats[${i}].behavior '${b.behavior}' not in glossary`);
  });
  if (!j.cta || typeof j.cta !== 'string') e.push('cta required');
  if (!TONES.has(j.tone)) e.push(`tone must be one of ${[...TONES].join('|')}`);
  if (!LANES.has(j.lane)) e.push(`lane must be one of ${[...LANES].join('|')}`);
  if (!AGE_BRACKETS.has(j.age_bracket)) e.push(`age_bracket must be one of ${[...AGE_BRACKETS].join('|')}`);
  return e;
}

function validateCasting(j: any): string[] {
  const e: string[] = [];
  if (!j || typeof j !== 'object') return ['casting: not an object'];
  for (const f of ['physiology','wardrobe','environment','camera','lighting']) {
    if (!j[f]) e.push(`casting.${f} required`);
  }
  if (!Array.isArray(j.micro_behaviors) || j.micro_behaviors.length < 2) e.push('micro_behaviors: need ≥2');
  else j.micro_behaviors.forEach((b: string, i: number) => {
    if (!MICRO_BEHAVIORS.has(b)) e.push(`micro_behaviors[${i}] '${b}' not in glossary`);
  });
  return e;
}

// ------------ LLM call via Lovable AI Gateway ------------
async function llmJSON(system: string, user: string): Promise<any> {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

const SCRIPT_SYSTEM = `Você é o motor de scripts da Omni UGC Ad Factory. Escreva um script UGC de ~20s (2 clips de 10s) em pt-BR.
Saída OBRIGATÓRIA em JSON com o schema:
{
  "hook": string (≤12 palavras, pattern-interrupt, sem "você sabia"),
  "beats": [{"t": number, "line": string, "behavior": string, "voice_note": string}] (≥2 beats),
  "cta": string,
  "tone": "confessional"|"urgent"|"casual"|"expert",
  "lane": "pain"|"desire"|"curiosity"|"contrarian",
  "age_bracket": "18-25"|"26-35"|"36-45"|"46-60"|"60+",
  "duration_target_s": 20
}
Behaviors permitidos: ${[...MICRO_BEHAVIORS].join(', ')}.
Sem markdown, sem prosa.`;

const CASTING_SYSTEM = `Você é o motor de casting da Omni UGC Ad Factory. Descreva o ator + cena para gerar imagem de referência.
Saída OBRIGATÓRIA em JSON:
{
  "physiology": {...},
  "wardrobe": string,
  "environment": string,
  "camera": string,
  "lighting": string,
  "micro_behaviors": string[] (≥2, do glossário)
}
Priorize realismo: poros visíveis, textura de pele, imperfeições sutis, luz natural.
Behaviors permitidos: ${[...MICRO_BEHAVIORS].join(', ')}.`;

// ------------ Handler ------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const step = url.searchParams.get('step') ?? 'script';
    const body = await req.json().catch(() => ({}));
    const { job_id, produto, actor_ref_url, age_bracket, tone, lane, research_leads } = body;

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!userData?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (step === 'script') {
      const prompt = `Produto: ${produto}
Público idade: ${age_bracket ?? '26-35'}
Tom: ${tone ?? 'confessional'}
Lane: ${lane ?? 'pain'}
Research/insights: ${research_leads ?? '(nenhum)'}
Gere o script.`;
      const script = await llmJSON(SCRIPT_SYSTEM, prompt);
      const errs = validateScript(script);
      if (errs.length) return new Response(JSON.stringify({ error: 'gate_failed', gate: 'script', errors: errs, script }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (job_id) await supabase.from('imphq_ugc_jobs').update({ script_json: script, current_step: 'script_ok' }).eq('id', job_id);
      return new Response(JSON.stringify({ ok: true, script }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (step === 'casting') {
      const { script } = body;
      if (!script) return new Response(JSON.stringify({ error: 'script required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const prompt = `Script: ${JSON.stringify(script)}
Produto: ${produto}
Foto de referência do ator (URL, opcional): ${actor_ref_url ?? '(nenhuma)'}
Gere o casting/cena.`;
      const casting = await llmJSON(CASTING_SYSTEM, prompt);
      const errs = validateCasting(casting);
      if (errs.length) return new Response(JSON.stringify({ error: 'gate_failed', gate: 'casting', errors: errs, casting }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (job_id) await supabase.from('imphq_ugc_jobs').update({ casting_json: casting, current_step: 'casting_ok' }).eq('id', job_id);
      return new Response(JSON.stringify({ ok: true, casting }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PASS steps (clip1, clip2, stitch) — não executam geração de vídeo real ainda;
    // retornam placeholder para o frontend enfileirar via Replicate/Veo em fase seguinte.
    if (['clip1', 'clip2', 'stitch'].includes(step)) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'pass_step_not_implemented',
        step,
        hint: 'Este passo custa créditos de vídeo (Replicate/Veo). Habilite o connector Replicate e implemente a próxima fase.',
      }), { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown step', step }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ugc-pipeline error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
