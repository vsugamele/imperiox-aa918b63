// wa-ai-decide-escalation
// Cron a cada 20 min — IA decide sozinha quando passar conversa pra humano,
// SEM depender de keyword. Análise semântica detecta:
//   - Frustração crescente do lead
//   - Loop sem progresso (mesmo argumento repetido)
//   - Lead esfriando após 2+ ofertas/perguntas
//   - Objeção crítica não resolvida há tempo
//   - Tom hostil/desistente
//
// Quando decide escalar:
//   - Seta status='needs_human' na conversa
//   - Marca escalation_reason e escalation_confidence
//   - Cria entrada em imphq_ai_actions
//   - (futuro) notifica via push/email

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const MAX_CONVS_PER_RUN = 40;
const MIN_MSGS_TO_ANALYZE = 4;
const ESCALATE_THRESHOLD = 0.72;

async function decideEscalation(digest: string, persona: string): Promise<{ escalate: boolean; reason: string; confidence: number } | null> {
  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = "google/gemini-2.5-flash";

  const prompt = `Você é o decisor de escalation de uma IA de vendas pelo WhatsApp. Analise esta conversa em andamento e decida se DEVE passar pra um atendente humano AGORA.

PERSONA DA IA: ${persona.slice(0, 300) || "(genérica)"}

HISTÓRICO RECENTE:
${digest.slice(0, 3500)}

Critérios para escalar (qualquer um):
1. FRUSTRAÇÃO: lead demonstra irritação, desânimo, hostilidade ("não tô entendendo", "que confusão", "deixa pra lá")
2. LOOP: lead repete a mesma dúvida/objeção 2+ vezes e a IA não está conseguindo destravar
3. ESFRIAMENTO: lead respondendo cada vez mais curto/desinteressado após 2+ ofertas
4. OBJEÇÃO CRÍTICA: lead falou de problema sério (financeiro, técnico, jurídico) que IA não tem dado pra resolver
5. PEDIDO IMPLÍCITO: lead pediu humano mesmo sem palavra-chave ("alguém pode me ajudar", "tem um atendente?")
6. EMOÇÃO COMPLEXA: lead em situação delicada (perda, depressão, urgência médica/financeira)

NÃO escalar se:
- Lead engajado fazendo perguntas normais de descoberta
- IA está respondendo bem e lead avançando no funil
- Conversa rotineira

Retorne EXATAMENTE este JSON:
{
  "escalate": true|false,
  "reason": "1 linha explicando POR QUE (critério detectado) ou null se não escalar",
  "confidence": 0.0-1.0
}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content || "{}");
    return {
      escalate: parsed.escalate === true,
      reason: String(parsed.reason || "").slice(0, 300),
      confidence: Number(parsed.confidence) || 0,
    };
  } catch (_) { return null; }
}

function buildDigest(messages: any[]): string {
  return messages
    .slice(-12)
    .map((m: any) => {
      const speaker = m.direction === "incoming" ? "LEAD" : (m.sent_by === "ai" ? "IA" : "HUM");
      return `[${speaker}]: ${String(m.content || "").slice(0, 250)}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const onlyProjectId = body.project_id || null;

    // Configs com auto_escalation_enabled
    let cfgQuery = supa
      .from("imphq_wa_ai_config")
      .select("project_id, expert_persona, auto_escalation_enabled")
      .eq("enabled", true)
      .eq("auto_escalation_enabled", true);
    if (onlyProjectId) cfgQuery = cfgQuery.eq("project_id", onlyProjectId);
    const { data: configs } = await cfgQuery;

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_enabled_configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enabledProjects = new Set(configs.map((c: any) => c.project_id));
    const personaByProject = new Map(configs.map((c: any) => [c.project_id, String(c.expert_persona || "")]));

    // Conversas ativas com 4+ trocas recentes que ainda não foram escaladas
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: candConvs } = await supa
      .from("imphq_wa_conversations")
      .select("id, project_id, message_count, status, last_message_at, last_message_direction, ia_ativa")
      .in("project_id", Array.from(enabledProjects))
      .neq("status", "needs_human")
      .is("escalation_decided_at", null)
      .gte("last_message_at", since)
      .eq("ia_ativa", true)
      .gte("message_count", MIN_MSGS_TO_ANALYZE)
      .order("last_message_at", { ascending: false })
      .limit(MAX_CONVS_PER_RUN);

    if (!candConvs || candConvs.length === 0) {
      return new Response(JSON.stringify({ ok: true, analyzed: 0, escalated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let analyzed = 0;
    const escalated: any[] = [];

    for (const conv of candConvs) {
      const { data: msgs } = await supa
        .from("imphq_wa_messages")
        .select("direction, sent_by, content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(30);

      if (!msgs || msgs.length < MIN_MSGS_TO_ANALYZE) continue;
      if (!msgs.some((m: any) => m.sent_by === "ai")) continue;

      const digest = buildDigest(msgs);
      const persona = personaByProject.get(conv.project_id) || "";
      const decision = await decideEscalation(digest, persona);
      if (!decision) continue;
      analyzed++;

      if (decision.escalate && decision.confidence >= ESCALATE_THRESHOLD) {
        if (!dryRun) {
          await supa.from("imphq_wa_conversations").update({
            status: "needs_human",
            escalation_reason: decision.reason,
            escalation_decided_at: new Date().toISOString(),
            escalation_confidence: decision.confidence,
            ai_paused_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          }).eq("id", conv.id);

          await supa.from("imphq_ai_actions").insert({
            projeto_id: conv.project_id,
            kind: "auto_escalation",
            risk_level: "medium",
            status: "completed",
            title: `🚨 Auto-escalation: ${decision.reason.slice(0, 80)}`,
            reason: decision.reason,
            confidence: decision.confidence,
            source: "wa-ai-decide-escalation",
            payload: { conversation_id: conv.id, message_count: conv.message_count },
          });
        }
        escalated.push({ conv_id: conv.id, reason: decision.reason, confidence: decision.confidence });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      analyzed,
      escalated: escalated.length,
      sample: escalated.slice(0, 5),
      dry_run: dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-ai-decide-escalation] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
