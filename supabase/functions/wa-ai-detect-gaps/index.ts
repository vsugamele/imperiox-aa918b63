// wa-ai-detect-gaps
// Cron a cada 2h — analisa últimas N respostas da IA e classifica como:
//   - solid (resposta firme e específica) → score 0.7-1.0
//   - gap (resposta vaga / hesitante / genérica / não respondeu a pergunta) → score 0.0-0.5
// Quando detecta gap, cria entrada em imphq_wa_knowledge com source='ai_detected_gap'
// pra aparecer na seção "Dúvidas Pendentes" da config IA e o operador preencher
// a resposta certa.
//
// Diferente do mecanismo atual que só captura quando a IA admite incerteza,
// este detector PROATIVAMENTE percebe respostas mornas/genéricas e marca como gap.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const MAX_MSGS_PER_RUN = 50;
const GAP_THRESHOLD = 0.5;
const MIN_CONTENT_LEN = 20;

async function classifyResponse(leadQuestion: string, aiResponse: string): Promise<{ score: number; reason: string } | null> {
  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = "google/gemini-2.5-flash";

  const prompt = `Classifique a qualidade da resposta de uma IA de vendas. Retorne JSON.

PERGUNTA DO LEAD:
"${leadQuestion.slice(0, 500)}"

RESPOSTA DA IA:
"${aiResponse.slice(0, 800)}"

Critérios:
- score 0.0-0.3: resposta VAGA/GENÉRICA (ex: "vou verificar", "deixa eu confirmar", "te aviso já") ou que NÃO responde a pergunta diretamente
- score 0.4-0.6: resposta morna — responde parcialmente mas é genérica, sem dados concretos, ou hesitante
- score 0.7-1.0: resposta FIRME e ESPECÍFICA com dado concreto (preço, link, prazo, condição)

Retorne EXATAMENTE este JSON:
{"score": 0.0-1.0, "reason": "frase curta explicando"}`;

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
    const score = Number(parsed.score);
    if (isNaN(score) || score < 0 || score > 1) return null;
    return { score, reason: String(parsed.reason || "").slice(0, 200) };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sinceHours = Number(body.since_hours || 2);
    const dryRun = body.dry_run === true;

    // Pega mensagens outgoing AI das últimas N horas ainda não analisadas
    const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    const { data: aiMsgs } = await supa
      .from("imphq_wa_messages")
      .select("id, conversation_id, content, created_at")
      .eq("gap_analyzed", false)
      .eq("direction", "outgoing")
      .eq("sent_by", "ai")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_MSGS_PER_RUN);

    if (!aiMsgs || aiMsgs.length === 0) {
      return new Response(JSON.stringify({ ok: true, analyzed: 0, reason: "no_pending_msgs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[detect-gaps] ${aiMsgs.length} respostas IA para analisar`);
    const gapsCreated: any[] = [];
    let analyzed = 0;

    for (const aiMsg of aiMsgs) {
      const content = String(aiMsg.content || "").trim();
      if (content.length < MIN_CONTENT_LEN) {
        if (!dryRun) await supa.from("imphq_wa_messages").update({ gap_analyzed: true, gap_score: 0.7 }).eq("id", aiMsg.id);
        continue;
      }

      // Pergunta do lead = última msg incoming antes da resposta IA
      const { data: prevIn } = await supa
        .from("imphq_wa_messages")
        .select("content, phone")
        .eq("conversation_id", aiMsg.conversation_id)
        .eq("direction", "incoming")
        .lt("created_at", aiMsg.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!prevIn?.content || String(prevIn.content).length < 4) {
        if (!dryRun) await supa.from("imphq_wa_messages").update({ gap_analyzed: true }).eq("id", aiMsg.id);
        continue;
      }

      const classification = await classifyResponse(String(prevIn.content), content);
      if (!classification) continue;

      analyzed++;
      const { score, reason } = classification;

      if (!dryRun) {
        await supa.from("imphq_wa_messages").update({ gap_analyzed: true, gap_score: score }).eq("id", aiMsg.id);
      }

      if (score < GAP_THRESHOLD) {
        // Pega project_id via conversa
        const { data: conv } = await supa
          .from("imphq_wa_conversations")
          .select("project_id")
          .eq("id", aiMsg.conversation_id)
          .maybeSingle();

        const projectId = conv?.project_id;
        if (!projectId) continue;

        // Dedup: se já existe knowledge entry para pergunta similar não-aprovada, skip
        const embedding = await getCachedEmbedding(supa, String(prevIn.content));
        let isDup = false;
        if (embedding) {
          const { data: sims } = await supa.rpc("match_wa_knowledge", {
            query_embedding: embedding,
            p_project_id: projectId,
            match_count: 1,
            min_similarity: 0.88,
          });
          if (sims && sims.length > 0 && sims[0].aprovada === false) isDup = true;
        }

        if (!isDup && !dryRun) {
          await supa.from("imphq_wa_knowledge").insert({
            project_id: projectId,
            pergunta: String(prevIn.content).slice(0, 500),
            resposta: "",
            aprovada: false,
            answered: false,
            source: "ai_detected_gap",
            embedding,
          });
          gapsCreated.push({ msg_id: aiMsg.id, score, reason });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      analyzed,
      gaps_created: gapsCreated.length,
      sample: gapsCreated.slice(0, 5),
      dry_run: dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-ai-detect-gaps] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
