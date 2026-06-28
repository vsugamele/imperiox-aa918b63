// wa-ai-resume-check — Detecta conversas onde humano respondeu mas lead voltou a perguntar
// e a IA ficou parada. Se passou >30min do último humano sem novo outgoing, retoma a IA
// (limpa ai_paused_until) e dispara wa-ai-reply para responder a última msg do lead.
// Cron: a cada 3min.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESUME_AFTER_MIN = 30; // se humano respondeu há >30min e lead reengajou, IA volta
const LOOKBACK_HOURS = 6;    // janela para detectar reengajamento

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
  const humanCutoff = new Date(Date.now() - RESUME_AFTER_MIN * 60_000).toISOString();

  // Busca conversas com atividade recente
  const { data: convs, error } = await supabase
    .from("imphq_wa_conversations")
    .select("id, project_id, phone, provider_id, ai_paused_until, ia_ativa, last_message_at")
    .gte("last_message_at", since)
    .eq("ia_ativa", true)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[wa-ai-resume-check] query error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const conv of convs || []) {
    // Última msg incoming e última outgoing
    const { data: msgs } = await supabase
      .from("imphq_wa_messages")
      .select("direction, content, created_at, sent_by")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!msgs || msgs.length === 0) continue;

    const lastIncoming = msgs.find((m: any) => m.direction === "incoming");
    const lastOutgoing = msgs.find((m: any) => m.direction === "outgoing");

    if (!lastIncoming) continue;

    // Só age se a ÚLTIMA mensagem é do lead (ele está esperando)
    if (msgs[0].direction !== "incoming") continue;

    // Outgoing humano > 30min atrás OU sem outgoing há tempo
    if (lastOutgoing && lastOutgoing.created_at > humanCutoff) {
      results.push({ id: conv.id, action: "human_too_recent" });
      continue;
    }

    // Lead respondeu DEPOIS do último outgoing? (reengajamento)
    if (lastOutgoing && lastIncoming.created_at <= lastOutgoing.created_at) {
      continue;
    }

    // Tudo certo: libera pausa + dispara reply
    if (conv.ai_paused_until) {
      await supabase
        .from("imphq_wa_conversations")
        .update({ ai_paused_until: null })
        .eq("id", conv.id);
    }

    try {
      const r = await supabase.functions.invoke("wa-ai-reply", {
        body: {
          conversation_id: conv.id,
          project_id: conv.project_id,
          phone: conv.phone,
          message: lastIncoming.content,
          triggered_by: "auto_resume",
        },
      });
      results.push({ id: conv.id, action: "resumed", ok: !r.error });
    } catch (e: any) {
      results.push({ id: conv.id, action: "resume_failed", error: String(e?.message || e) });
    }
  }

  console.log(`[wa-ai-resume-check] processed=${results.length}`);
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
