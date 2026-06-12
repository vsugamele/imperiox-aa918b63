// wa-ai-conv-scoring
// Cron a cada 4h — pontua conversas que "terminaram" (sem atividade há 24h+)
// e gera postmortem automático para alimentar dashboards e self-tune.
//
// Score 0-100:
//   90-100: Venda confirmada (imphq_vendas status=aprovado)
//   65-89: Lead engajado, intenção alta, sem venda confirmada ainda
//   40-64: Conversa morna, sem avanço claro
//   15-39: Lead respondeu mas esfriou rapidamente
//   0-14:  Lead sumiu após 1 resposta ou nunca respondeu
//
// Para cada score, LLM gera postmortem curto + what_worked / what_failed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const MAX_PER_RUN = 30;
const INACTIVE_HOURS = 24;

async function llmPostmortem(digest: string, hint: { score: number; outcome: string }): Promise<{
  postmortem: string;
  what_worked: string[];
  what_failed: string[];
} | null> {
  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "deepseek/deepseek-chat-v3.1";

  const prompt = `Você é um analista de conversas de vendas. Analise esta conversa concluída e gere postmortem curto.

CONVERSA (${hint.outcome}, score pré-calculado=${hint.score}):
${digest.slice(0, 3500)}

Tarefa:
1. Postmortem em 1-2 linhas: o que aconteceu?
2. 1-3 coisas que FUNCIONARAM (mesmo que parcialmente)
3. 1-3 coisas que FALHARAM ou poderiam ter sido melhores

Retorne EXATAMENTE este JSON:
{
  "postmortem": "1-2 linhas resumindo",
  "what_worked": ["item1", "item2"],
  "what_failed": ["item1", "item2"]
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
      postmortem: String(parsed.postmortem || "").slice(0, 500),
      what_worked: Array.isArray(parsed.what_worked) ? parsed.what_worked.slice(0, 4).map((s: any) => String(s).slice(0, 150)) : [],
      what_failed: Array.isArray(parsed.what_failed) ? parsed.what_failed.slice(0, 4).map((s: any) => String(s).slice(0, 150)) : [],
    };
  } catch (_) { return null; }
}

function buildDigest(messages: any[]): string {
  return messages
    .slice(-25)
    .map((m: any) => {
      const speaker = m.direction === "incoming" ? "LEAD" : (m.sent_by === "ai" ? "IA" : "HUM");
      return `[${speaker}]: ${String(m.content || "").slice(0, 200)}`;
    })
    .join("\n");
}

function computeHeuristicScore(opts: {
  hasApprovedSale: boolean;
  hasPendingSale: boolean;
  leadMsgCount: number;
  aiMsgCount: number;
  hasTransferredHuman: boolean;
  lastDirection: string;
}): { score: number; outcome: string } {
  if (opts.hasApprovedSale) return { score: 95, outcome: "won" };
  if (opts.hasPendingSale && opts.leadMsgCount >= 3) return { score: 72, outcome: "warm_lead_pending_payment" };
  if (opts.hasTransferredHuman) return { score: 55, outcome: "handed_to_human" };

  if (opts.leadMsgCount === 0) return { score: 5, outcome: "no_response" };
  if (opts.leadMsgCount === 1 && opts.lastDirection === "outgoing") return { score: 20, outcome: "lead_ghosted_after_first" };
  if (opts.leadMsgCount >= 6 && opts.lastDirection === "outgoing") return { score: 35, outcome: "engaged_but_cold" };
  if (opts.leadMsgCount >= 4 && opts.leadMsgCount < 6) return { score: 50, outcome: "modest_engagement" };
  if (opts.leadMsgCount >= 6) return { score: 65, outcome: "good_engagement_no_conversion" };
  return { score: 30, outcome: "shallow_engagement" };
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
      .select("project_id")
      .eq("enabled", true)
      .eq("auto_scoring_enabled", true);
    if (onlyProjectId) cfgQuery = cfgQuery.eq("project_id", onlyProjectId);

    const { data: configs } = await cfgQuery;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_enabled_configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enabledProjects = new Set(configs.map((c: any) => c.project_id));
    const cutoff = new Date(Date.now() - INACTIVE_HOURS * 3600 * 1000).toISOString();
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    // Pega conversas: inativas há 24h+, dos últimos 14 dias, ainda não pontuadas
    const { data: candConvs } = await supa
      .from("imphq_wa_conversations")
      .select("id, project_id, phone, message_count, status, last_message_at, last_message_direction, transferred_to_human_at")
      .in("project_id", Array.from(enabledProjects))
      .lte("last_message_at", cutoff)
      .gte("last_message_at", since)
      .gte("message_count", 1)
      .order("last_message_at", { ascending: false })
      .limit(MAX_PER_RUN * 3);

    if (!candConvs || candConvs.length === 0) {
      return new Response(JSON.stringify({ ok: true, scored: 0, reason: "no_candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtra as não pontuadas
    const candIds = candConvs.map((c: any) => c.id);
    const { data: alreadyScored } = await supa
      .from("imphq_wa_conversation_scores")
      .select("conversation_id")
      .in("conversation_id", candIds);
    const scoredSet = new Set((alreadyScored || []).map((s: any) => s.conversation_id));
    const pending = candConvs.filter((c: any) => !scoredSet.has(c.id)).slice(0, MAX_PER_RUN);

    if (pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, scored: 0, reason: "all_scored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pré-carrega vendas por phone para cada projeto
    const phonesByProject = new Map<string, string[]>();
    for (const conv of pending) {
      const arr = phonesByProject.get(conv.project_id) || [];
      arr.push(conv.phone);
      phonesByProject.set(conv.project_id, arr);
    }

    const phoneToSale = new Map<string, { approved: boolean; pending: boolean }>();
    for (const [projectId, phones] of phonesByProject) {
      const { data: leads } = await supa
        .from("imphq_leads")
        .select("id, phone")
        .eq("project_id", projectId)
        .in("phone", phones);
      const leadIds = (leads || []).map((l: any) => l.id);
      if (leadIds.length === 0) continue;
      const { data: vendas } = await supa
        .from("imphq_vendas")
        .select("lead_id, status")
        .in("lead_id", leadIds);
      const leadPhoneMap = new Map((leads || []).map((l: any) => [l.id, l.phone]));
      for (const v of (vendas || [])) {
        const ph = leadPhoneMap.get(v.lead_id);
        if (!ph) continue;
        const cur = phoneToSale.get(ph) || { approved: false, pending: false };
        if (v.status === "aprovado") cur.approved = true;
        if (v.status === "pix_gerado" || v.status === "boleto_gerado") cur.pending = true;
        phoneToSale.set(ph, cur);
      }
    }

    const scored: any[] = [];

    for (const conv of pending) {
      const { data: msgs } = await supa
        .from("imphq_wa_messages")
        .select("direction, sent_by, content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(40);

      const leadMsgCount = (msgs || []).filter((m: any) => m.direction === "incoming").length;
      const aiMsgCount = (msgs || []).filter((m: any) => m.sent_by === "ai").length;
      const sale = phoneToSale.get(conv.phone) || { approved: false, pending: false };

      const { score, outcome } = computeHeuristicScore({
        hasApprovedSale: sale.approved,
        hasPendingSale: sale.pending,
        leadMsgCount,
        aiMsgCount,
        hasTransferredHuman: !!conv.transferred_to_human_at,
        lastDirection: conv.last_message_direction || "outgoing",
      });

      // Só roda LLM postmortem se conversa tem 3+ msgs (vale a pena)
      let postmortem = "";
      let whatWorked: string[] = [];
      let whatFailed: string[] = [];
      if ((msgs?.length || 0) >= 3) {
        const digest = buildDigest(msgs || []);
        const pm = await llmPostmortem(digest, { score, outcome });
        if (pm) {
          postmortem = pm.postmortem;
          whatWorked = pm.what_worked;
          whatFailed = pm.what_failed;
        }
      }

      if (!dryRun) {
        await supa.from("imphq_wa_conversation_scores").upsert({
          conversation_id: conv.id,
          project_id: conv.project_id,
          score,
          outcome,
          postmortem,
          what_worked: whatWorked,
          what_failed: whatFailed,
          metadata: {
            lead_msg_count: leadMsgCount,
            ai_msg_count: aiMsgCount,
            had_approved_sale: sale.approved,
            had_pending_sale: sale.pending,
            transferred_to_human: !!conv.transferred_to_human_at,
            last_message_at: conv.last_message_at,
          },
        }, { onConflict: "conversation_id" });
      }

      scored.push({ conv_id: conv.id, score, outcome });
    }

    return new Response(JSON.stringify({
      ok: true,
      scored: scored.length,
      sample: scored.slice(0, 5),
      dry_run: dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-ai-conv-scoring] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
