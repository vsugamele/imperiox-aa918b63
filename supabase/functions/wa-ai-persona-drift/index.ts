// wa-ai-persona-drift
// Cron semanal — IA avalia se ela mesma está fiel à expert_persona configurada.
//
// Como funciona:
// 1. Pega 25 respostas recentes da IA (últimos 7 dias)
// 2. Compara com expert_persona configurada
// 3. LLM "juiz" dá um score 0-100 de aderência e identifica deriva
// 4. Se score < threshold:
//    - Loga em drift_history
//    - Cria proposta de reforço da persona ou alerta operador
//    - Se auto_tune_apply=true → injeta lembrete de persona no custom_instructions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const SAMPLE_SIZE = 25;
const DRIFT_THRESHOLD = 60; // < 60 → drift detectado

async function judgePersonaAdherence(persona: string, responses: string[]): Promise<{
  score: number;
  drift_observed: string;
  recommended_reinforcement: string;
  examples: string[];
} | null> {
  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = "google/gemini-2.5-flash";

  const responsesBlock = responses.slice(0, SAMPLE_SIZE).map((r, i) => `${i + 1}. ${r.slice(0, 250)}`).join("\n");

  const prompt = `Você é o juiz de persona de uma IA de vendas. Avalie se as respostas reais que a IA enviou estão fiéis à persona configurada.

PERSONA CONFIGURADA (target):
${persona.slice(0, 800)}

AMOSTRAS DE RESPOSTAS REAIS DA IA (últimos 7 dias):
${responsesBlock}

Avalie:
- Score 0-100 de aderência à persona
- Que tipo de drift está acontecendo (formal demais? genérica? agressiva demais? perdeu identidade?)
- Como reforçar a persona em uma frase curta acionável
- 2-3 exemplos concretos de respostas que destoam mais da persona

Retorne EXATAMENTE este JSON:
{
  "score": 0-100,
  "drift_observed": "1 linha descrevendo o tipo de drift detectado (ou 'nenhum drift relevante')",
  "recommended_reinforcement": "frase curta para reforçar a persona (ou null se score >= 75)",
  "examples": ["trecho exemplo 1", "trecho exemplo 2"]
}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
    return {
      score: Number(parsed.score) || 0,
      drift_observed: String(parsed.drift_observed || "").slice(0, 300),
      recommended_reinforcement: String(parsed.recommended_reinforcement || "").slice(0, 250),
      examples: Array.isArray(parsed.examples) ? parsed.examples.slice(0, 3).map((s: any) => String(s).slice(0, 200)) : [],
    };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const onlyProjectId = body.project_id || null;

    let cfgQuery = supa
      .from("imphq_wa_ai_config")
      .select("id, project_id, expert_persona, custom_instructions, auto_tune_apply, drift_history")
      .eq("enabled", true)
      .eq("auto_drift_enabled", true);
    if (onlyProjectId) cfgQuery = cfgQuery.eq("project_id", onlyProjectId);

    const { data: configs } = await cfgQuery;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_enabled_configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: any[] = [];
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    for (const cfg of configs) {
      if (!cfg.expert_persona || String(cfg.expert_persona).length < 30) {
        report.push({ project_id: cfg.project_id, skipped: "no_persona" });
        continue;
      }

      const { data: aiMsgs } = await supa
        .from("imphq_wa_messages")
        .select("content")
        .eq("sent_by", "ai")
        .eq("direction", "outgoing")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(SAMPLE_SIZE * 3);

      const responses = (aiMsgs || [])
        .map((m: any) => String(m.content || "").trim())
        .filter((c: string) => c.length >= 30 && c.length < 800)
        .slice(0, SAMPLE_SIZE);

      if (responses.length < 8) {
        report.push({ project_id: cfg.project_id, skipped: "small_sample", sample: responses.length });
        continue;
      }

      const judgment = await judgePersonaAdherence(String(cfg.expert_persona), responses);
      if (!judgment) continue;

      const driftLog = {
        timestamp: new Date().toISOString(),
        score: judgment.score,
        drift_observed: judgment.drift_observed,
        recommended_reinforcement: judgment.recommended_reinforcement,
        examples: judgment.examples,
        sample_size: responses.length,
        applied: false,
      };

      const shouldApplyReinforcement = !dryRun
        && judgment.score < DRIFT_THRESHOLD
        && cfg.auto_tune_apply === true
        && judgment.recommended_reinforcement
        && judgment.recommended_reinforcement.length > 5;

      const history = Array.isArray(cfg.drift_history) ? cfg.drift_history : [];
      const updates: any = {
        last_drift_at: new Date().toISOString(),
        drift_score: judgment.score,
        drift_history: [driftLog, ...history].slice(0, 20),
      };

      if (shouldApplyReinforcement) {
        const currentInstr = String(cfg.custom_instructions || "").trim();
        const newBlock = `\n# Reforço de persona ${new Date().toLocaleDateString("pt-BR")} (drift score=${judgment.score})\n- ${judgment.recommended_reinforcement}`;
        updates.custom_instructions = (currentInstr + newBlock).slice(0, 4000);
        driftLog.applied = true;
        updates.drift_history = [driftLog, ...history].slice(0, 20);
      }

      if (!dryRun) {
        await supa.from("imphq_wa_ai_config").update(updates).eq("id", cfg.id);

        if (judgment.score < DRIFT_THRESHOLD) {
          await supa.from("imphq_ai_actions").insert({
            projeto_id: cfg.project_id,
            kind: shouldApplyReinforcement ? "persona_drift_applied" : "persona_drift_alert",
            risk_level: judgment.score < 40 ? "high" : "medium",
            status: shouldApplyReinforcement ? "completed" : "pending_review",
            title: `🎭 Drift de persona detectado (score ${judgment.score})`,
            reason: judgment.drift_observed,
            confidence: 0.85,
            source: "wa-ai-persona-drift",
            payload: driftLog,
          });
        }
      }

      report.push({
        project_id: cfg.project_id,
        score: judgment.score,
        drift: judgment.drift_observed,
        applied: shouldApplyReinforcement,
      });
    }

    return new Response(JSON.stringify({ ok: true, configs_processed: configs.length, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-ai-persona-drift] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
