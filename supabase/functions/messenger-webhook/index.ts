// Webhook do Messenger via Zernio.
// URL: {SUPABASE_URL}/functions/v1/messenger-webhook?project=PROJECT_ID
// Recebe DMs do Messenger, cria/atualiza sessão de canal e dispara fluxos do OpenFlow (canal = messenger).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { upsertSession } from "../_shared/channel-out.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pick(...vals: any[]) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project");

  // Verificação de webhook (alguns provedores fazem GET de challenge)
  if (req.method === "GET") {
    return new Response(url.searchParams.get("hub.challenge") || "OK", { status: 200, headers: corsHeaders });
  }
  if (!projectId) return new Response("Missing project", { status: 400, headers: corsHeaders });

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const payload = await req.json();
    const event = String(payload?.event || payload?.type || "").toLowerCase();
    const d = payload?.data || payload;
    const m = d?.message || d;

    // Só tratamos mensagens recebidas
    const isIncoming = !event || event.includes("message") || event.includes("dm");
    if (!isIncoming) return new Response("OK (ignored)", { status: 200, headers: corsHeaders });

    const platform = String(pick(d?.platform, m?.platform, "messenger")).toLowerCase();
    if (platform && !platform.includes("messenger") && !platform.includes("facebook")) {
      return new Response("OK (not messenger)", { status: 200, headers: corsHeaders });
    }

    const externalId = String(
      pick(m?.from?.id, m?.senderId, m?.sender?.id, m?.psid, d?.userId, d?.from?.id) || "",
    );
    const text = String(pick(m?.text, m?.message, m?.body, d?.text) || "");
    const messageId = String(pick(m?.id, m?.messageId, d?.messageId) || "");
    if (!externalId) return new Response("OK (no sender)", { status: 200, headers: corsHeaders });

    // Dedupe por messageId
    if (messageId) {
      const { data: dup } = await supa
        .from("imphq_channel_messages")
        .select("id")
        .eq("meta->>message_id", messageId)
        .limit(1)
        .maybeSingle();
      if (dup) return new Response("OK (duplicate)", { status: 200, headers: corsHeaders });
    }

    const session = await upsertSession(supa, {
      canal: "messenger",
      external_id: externalId,
      project_id: projectId,
      nome: pick(m?.from?.name, m?.senderName, d?.from?.name),
      avatar_url: pick(m?.from?.profilePic, m?.from?.avatar, d?.from?.avatar),
      meta: {
        zernio_account_id: pick(d?.account?.id, d?.accountId, d?.account_id) || undefined,
        conversation_id: pick(d?.conversationId, m?.conversationId) || undefined,
      },
    });

    await supa.from("imphq_channel_messages").insert({
      session_id: session.id,
      direction: "in",
      texto: text,
      media_url: pick(m?.mediaUrl, m?.attachmentUrl),
      meta: { message_id: messageId || null, event: payload?.event || null },
    });

    // Dispara fluxos do OpenFlow com canal = messenger
    const triggers = ["messenger_mensagem_recebida", "messenger_palavra_chave"];
    for (const trigger of triggers) {
      await fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          trigger_tipo: trigger,
          project_id: projectId,
          lead_data: {
            canal: "messenger",
            channel_session_id: session.id,
            nome: session.nome || "Lead Messenger",
            message_content: text,
            mensagem_recebida: text,
          },
        }),
      }).catch((e) => console.warn("[messenger-webhook] executor err", e?.message));
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[messenger-webhook]", e);
    return new Response("OK (error logged)", { status: 200, headers: corsHeaders });
  }
});
