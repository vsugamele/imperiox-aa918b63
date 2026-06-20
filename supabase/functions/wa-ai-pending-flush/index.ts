// wa-ai-pending-flush — Processa conversas com ai_pending_since marcado.
// Se agora está dentro do horário comercial do project, invoca wa-ai-reply
// com a última mensagem incoming do lead. Se o lead já foi respondido
// manualmente (última msg outgoing), limpa o pending. TTL: 24h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isWithinHours(start: string, end: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  const now = h * 100 + m;
  const [sh, sm] = (start || "08:00").split(":").map(Number);
  const [eh, em] = (end || "22:00").split(":").map(Number);
  return now >= sh * 100 + sm && now <= eh * 100 + em;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const TTL_HOURS = 24;
  const cutoff = new Date(Date.now() - TTL_HOURS * 3600_000).toISOString();

  const { data: conversations, error } = await supabase
    .from("imphq_wa_conversations")
    .select("id, project_id, phone, provider_id, ai_pending_since")
    .not("ai_pending_since", "is", null)
    .order("ai_pending_since", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const conv of conversations || []) {
    // TTL — descarta muito antigos
    if (conv.ai_pending_since && conv.ai_pending_since < cutoff) {
      await supabase.from("imphq_wa_conversations").update({ ai_pending_since: null }).eq("id", conv.id);
      results.push({ id: conv.id, action: "expired" });
      continue;
    }

    // Carrega config de horário comercial do project
    const { data: cfg } = await supabase
      .from("imphq_wa_ai_config")
      .select("business_hours_only, business_hours_start, business_hours_end")
      .eq("project_id", conv.project_id)
      .maybeSingle();

    if (cfg?.business_hours_only) {
      if (!isWithinHours(cfg.business_hours_start || "08:00", cfg.business_hours_end || "22:00")) {
        results.push({ id: conv.id, action: "still_out_of_hours" });
        continue;
      }
    }

    // Última mensagem da conversa
    const { data: lastMsg } = await supabase
      .from("imphq_wa_messages")
      .select("direction, content, message_id, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastMsg) {
      await supabase.from("imphq_wa_conversations").update({ ai_pending_since: null }).eq("id", conv.id);
      results.push({ id: conv.id, action: "no_message" });
      continue;
    }

    // Lead já foi respondido por humano/IA
    if (lastMsg.direction === "outgoing") {
      await supabase.from("imphq_wa_conversations").update({ ai_pending_since: null }).eq("id", conv.id);
      results.push({ id: conv.id, action: "already_replied" });
      continue;
    }

    // Limpa pending ANTES de invocar (wa-ai-reply marca de novo se ainda fora do horário)
    await supabase.from("imphq_wa_conversations").update({ ai_pending_since: null }).eq("id", conv.id);

    // Invoca wa-ai-reply
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-ai-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({
          conversation_id: conv.id,
          project_id: conv.project_id,
          provider_id: conv.provider_id,
          phone: conv.phone,
          message: lastMsg.content || "",
          message_id: lastMsg.message_id,
          from_flush: true,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      results.push({ id: conv.id, action: "invoked", status: resp.status, response: json });
    } catch (e: any) {
      results.push({ id: conv.id, action: "error", error: e?.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
