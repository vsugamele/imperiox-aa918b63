// Webhook do Zernio — recebe DMs/comentários do Zernio, traduz para Meta e encaminha para instagram-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project");

  if (!projectId) {
    console.error("[zernio-webhook] project_id ausente na query params");
    return new Response("Missing project", { status: 400 });
  }

  try {
    const payload = await req.json();
    console.log(`[zernio-webhook] Received event: ${payload.event} for project: ${projectId}`);
    
    // Log do evento recebido para auditoria
    await supa.from("imphq_ig_webhook_logs").insert({
      event_type: `zernio_${payload.event || "unknown"}`,
      payload,
      processed: false,
    });

    // Nós só processamos mensagens recebidas do cliente (inbound)
    if (payload.event !== "message.received") {
      console.log(`[zernio-webhook] Ignoring event type: ${payload.event}`);
      return new Response("OK", { status: 200 });
    }

    const data = payload.data || payload;
    const message = data.message;
    const conversation = data.conversation;
    const account = data.account;

    // Campos extraídos de forma altamente flexível e robusta
    const messageId = message?.id || message?.messageId || data.messageId;
    const conversationId = conversation?.id || conversation?.conversationId || data.conversationId;
    const text = message?.text || message?.content || message?.body || data.text || "";
    const senderId = message?.sender?.id || message?.sender?.contactId || data.contactId || data.senderId;
    const senderUsername = message?.sender?.username || message?.sender?.instagramProfile?.username || message?.sender?.name || "cliente_instagram";
    const senderName = message?.sender?.name || message?.sender?.instagramProfile?.displayName || senderUsername;
    const senderAvatar = message?.sender?.avatar || message?.sender?.instagramProfile?.profilePicture || null;
    
    // igUserId é o ID da nossa própria conta comercial (obtido do account context do Zernio)
    const igUserId = account?.platformUserId || data.accountId || data.igUserId || account?.instagramScopedId;

    if (!messageId || !conversationId || !senderId || !igUserId) {
      console.error("[zernio-webhook] Campos obrigatórios ausentes no payload:", { messageId, conversationId, senderId, igUserId });
      return new Response("Invalid payload structure", { status: 400 });
    }

    // Reconstrói o envelope no formato do Meta Webhook
    const metaEnvelope = {
      object: "instagram",
      entry: [
        {
          id: igUserId,
          messaging: [
            {
              sender: {
                id: senderId,
                username: senderUsername,
                name: senderName,
                avatar: senderAvatar
              },
              recipient: {
                id: igUserId
              },
              timestamp: Date.now(),
              message: {
                mid: messageId,
                text: text,
                attachments: []
              }
            }
          ]
        }
      ]
    };

    console.log(`[zernio-webhook] Forwarding Meta envelope to instagram-webhook...`);
    const forwardUrl = `${url.origin}/functions/v1/instagram-webhook?project=${projectId}`;
    const forwardRes = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("Authorization") || "",
      },
      body: JSON.stringify(metaEnvelope),
    });

    if (!forwardRes.ok) {
      const errText = await forwardRes.text();
      console.error(`[zernio-webhook] Failed to forward to instagram-webhook: ${errText}`);
      return new Response(`Error forwarding: ${errText}`, { status: 500 });
    }

    console.log(`[zernio-webhook] Handled successfully by instagram-webhook.`);

    // AGORA ATUALIZAMOS O CONVERSATION ID DO ZERNIO NO BANCO DE DADOS
    // A função instagram-webhook cria/atualiza a conversa associada ao senderId (participant_id).
    // Buscamos essa conversa e salvamos o conversationId do Zernio em ig_thread_id.
    const { data: conv } = await supa
      .from("imphq_ig_conversations")
      .select("id, ig_thread_id")
      .eq("participant_id", senderId)
      .maybeSingle();

    if (conv) {
      if (conv.ig_thread_id !== conversationId) {
        await supa
          .from("imphq_ig_conversations")
          .update({ ig_thread_id: conversationId, updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        console.log(`[zernio-webhook] Updated ig_thread_id to Zernio conversation ID: ${conversationId}`);
      }
    } else {
      console.warn(`[zernio-webhook] Conversation not found for participant: ${senderId}`);
    }

    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err: any) {
    console.error("[zernio-webhook] Error processing webhook:", err);
    return new Response(err.message || "Internal Error", { status: 500 });
  }
});
