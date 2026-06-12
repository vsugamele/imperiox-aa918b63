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

  let payload: any = null;
  try {
    payload = await req.json();
    console.log(`[zernio-webhook] Received event: ${payload.event} for project: ${projectId}`);

    // Dedupe idempotente — extrai messageId cedo
    const earlyMessageId = payload?.data?.message?.id
      || payload?.data?.message?.messageId
      || payload?.data?.messageId
      || payload?.message?.id
      || payload?.message?.messageId
      || null;

    if (earlyMessageId) {
      const { data: dup } = await supa
        .from("imphq_ig_webhook_logs")
        .select("id")
        .eq("event_type", `zernio_${payload.event || "unknown"}`)
        .or(`payload->data->message->>id.eq.${earlyMessageId},payload->message->>id.eq.${earlyMessageId}`)
        .eq("processed", true)
        .limit(1)
        .maybeSingle();
      if (dup) {
        console.log(`[zernio-webhook] Duplicate messageId ${earlyMessageId} — skipping`);
        return new Response("OK (duplicate)", { status: 200 });
      }
    }

    // Log do evento recebido para auditoria
    const { data: logEntry } = await supa.from("imphq_ig_webhook_logs").insert({
      event_type: `zernio_${payload.event || "unknown"}`,
      payload,
      processed: false,
    }).select("id").maybeSingle();

    // Processamos inbound (cliente -> nós) e outbound (nós -> cliente, vindo do app nativo do IG)
    if (payload.event !== "message.received" && payload.event !== "message.sent") {
      console.log(`[zernio-webhook] Ignoring event type: ${payload.event}`);
      if (logEntry) {
        await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      }
      return new Response("OK", { status: 200 });
    }

    const isOutbound = payload.event === "message.sent";
    const data = payload.data || payload;
    const message = data.message;
    const conversation = data.conversation;
    const account = data.account;

    // Extração robusta — cobre múltiplas estruturas de payload do Zernio
    const messageId      = message?.id || message?.messageId || data.messageId;
    const conversationId = conversation?.id || conversation?.conversationId || data.conversationId;
    const text           = message?.text || message?.content || message?.body || data.text || "";
    const attachments    = Array.isArray(message?.attachments)
      ? message.attachments.map((att: any) => ({
          type: att.originalType || att.type || "file",
          payload: { url: att.payload?.url || att.url || null },
        }))
      : [];

    // Para outbound, o "lead" (counterpart) está em conversation.participantId.
    // Para inbound, o sender já é o próprio lead.
    const sender       = isOutbound
      ? {}
      : (message?.sender || data.sender || conversation?.participants?.find((p: any) => p.role === "customer" || p.type === "customer") || {});
    const senderId     = isOutbound
      ? (conversation?.participantId || conversation?.platformConversationId || data.recipientId)
      : (sender.id || sender.contactId || sender.platformId || data.contactId || data.senderId);

    // Nome e foto — cascata de fallbacks para pegar o máximo possível
    const senderUsername = sender.username
      || sender.instagramProfile?.username
      || conversation?.participantUsername
      || data.participantUsername
      || null;

    const senderName = sender.name
      || sender.instagramProfile?.displayName
      || conversation?.participantName
      || data.participantName
      || senderUsername
      || "Lead Instagram";

    const senderAvatar = sender.avatar
      || sender.profilePicture
      || sender.instagramProfile?.profilePicture
      || conversation?.participantPicture
      || data.participantPicture
      || null;

    // Instagram-specific extras (follower info etc)
    const igProfile = sender.instagramProfile || {};
    const isFollower   = igProfile.isFollower   ?? null;
    const isFollowing  = igProfile.isFollowing  ?? null;
    const followerCount= igProfile.followerCount ?? null;
    const isVerified   = igProfile.isVerified   ?? null;

    // igUserId = ID da nossa conta comercial Instagram
    const zernioAccountId = account?.id || data.accountId || data.account_id;
    let igUserId = account?.platformUserId || account?.instagramScopedId || data.igUserId;
    let dbAccId = null;

    if (zernioAccountId) {
      const { data: dbAcc } = await supa
        .from("imphq_ig_accounts")
        .select("id, ig_user_id")
        .eq("project_id", projectId)
        .eq("page_id", zernioAccountId)
        .eq("auth_method", "zernio")
        .maybeSingle();
      if (dbAcc) {
        igUserId = dbAcc.ig_user_id;
        dbAccId = dbAcc.id;
      }
    }

    if (!igUserId) {
      igUserId = message?.recipient?.id || data.recipientId;
    }

    if (!dbAccId && igUserId) {
      const { data: dbAcc } = await supa
        .from("imphq_ig_accounts")
        .select("id")
        .eq("project_id", projectId)
        .eq("ig_user_id", igUserId)
        .maybeSingle();
      if (dbAcc) dbAccId = dbAcc.id;
    }

    if (!messageId || !conversationId || !senderId || !igUserId) {
      console.error("[zernio-webhook] Campos obrigatórios ausentes:", { messageId, conversationId, senderId, igUserId, zernioAccountId });
      return new Response("Invalid payload structure", { status: 400 });
    }

    // Reconstrói envelope no formato Meta para reaproveitarmos o instagram-webhook.
    // Outbound: sender = nossa conta (igUserId), recipient = lead (senderId).
    // Inbound: sender = lead, recipient = nossa conta.
    const envelopeSender = isOutbound
      ? { id: igUserId }
      : { id: senderId, username: senderUsername, name: senderName, avatar: senderAvatar };
    const envelopeRecipient = isOutbound ? { id: senderId } : { id: igUserId };

    const metaEnvelope = {
      object: "instagram",
      entry: [{
        id: igUserId,
        messaging: [{
          sender: envelopeSender,
          recipient: envelopeRecipient,
          timestamp: new Date(message?.sentAt || data.timestamp || payload.timestamp || Date.now()).getTime(),
          message: { mid: messageId, text, attachments },
        }],
      }],
    };

    console.log(`[zernio-webhook] Forwarding ${isOutbound ? "OUTBOUND" : "inbound"} to instagram-webhook (lead: ${senderId}, name: ${senderName})`);
    const forwardUrl = `${url.origin}/functions/v1/instagram-webhook?project=${projectId}`;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (anonKey) {
      forwardHeaders.Authorization = `Bearer ${anonKey}`;
      forwardHeaders.apikey = anonKey;
    }
    let forwarded = false;
    try {
      const forwardRes = await fetch(forwardUrl, {
        method: "POST",
        headers: forwardHeaders,
        body: JSON.stringify(metaEnvelope),
      });

      if (forwardRes.ok) {
        forwarded = true;
      } else {
        const errText = await forwardRes.text();
        console.error(`[zernio-webhook] Falha ao encaminhar: ${errText}. Persistindo direto...`);
        if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ error: errText }).eq("id", logEntry.id);
      }
    } catch (forwardErr: any) {
      console.error(`[zernio-webhook] Erro ao encaminhar. Persistindo direto...`, forwardErr?.message || forwardErr);
      if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ error: forwardErr?.message || "forward failed" }).eq("id", logEntry.id);
    }

    if (!forwarded) {
      if (!dbAccId) {
        console.error("[zernio-webhook] Conta IG não encontrada para persistência direta", { igUserId, zernioAccountId, projectId });
        return new Response("Instagram account not found", { status: 404 });
      }

      const messageAt = new Date(message?.sentAt || data.timestamp || payload.timestamp || Date.now()).toISOString();
      const firstAttachment = attachments[0] || null;
      const { data: directConv, error: convErr } = await supa
        .from("imphq_ig_conversations")
        .upsert({
          account_id: dbAccId,
          participant_id: senderId,
          participant_username: senderUsername,
          participant_name: senderName,
          participant_avatar: senderAvatar,
          ig_thread_id: conversationId,
          last_message: text || (firstAttachment ? "[mídia]" : ""),
          last_message_at: messageAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "account_id,participant_id" })
        .select("id")
        .single();

      if (convErr) throw convErr;

      const { data: existingMsg } = await supa
        .from("imphq_ig_messages")
        .select("id")
        .eq("mid", messageId)
        .maybeSingle();

      if (!existingMsg && directConv) {
        const { error: msgErr } = await supa.from("imphq_ig_messages").insert({
          conversation_id: directConv.id,
          direction: isOutbound ? "out" : "in",
          type: firstAttachment?.type || "text",
          content: text || null,
          media_url: firstAttachment?.payload?.url || null,
          mid: messageId,
          status: isOutbound ? "sent" : "received",
          created_at: messageAt,
          metadata: { source: "zernio-webhook-direct", zernio_conversation_id: conversationId },
        });
        if (msgErr) throw msgErr;
      }
    }

    // Marca conta IG como ativa (heartbeat para card de saúde)
    if (dbAccId) {
      await supa.from("imphq_ig_accounts")
        .update({ updated_at: new Date().toISOString() } as any)
        .eq("id", dbAccId);
    }

    // Atualiza a conversa com o ig_thread_id do Zernio + enriquece perfil do lead
    let convQuery = supa
      .from("imphq_ig_conversations")
      .select("id, ig_thread_id, participant_username, participant_name");
    
    if (dbAccId) {
      convQuery = convQuery.eq("account_id", dbAccId);
    }
    
    const { data: conv } = await convQuery
      .eq("participant_id", senderId)
      .maybeSingle();

    if (conv) {
      const updates: any = {};

      // Sempre atualiza ig_thread_id se mudou
      if (conv.ig_thread_id !== conversationId) updates.ig_thread_id = conversationId;

      // Atualiza perfil apenas se veio dado melhor que o atual
      if (senderName && senderName !== "Lead Instagram" && (!conv.participant_name || conv.participant_name.startsWith("Lead #"))) {
        updates.participant_name = senderName;
      }
      if (senderUsername && (!conv.participant_username || conv.participant_username.startsWith("user_"))) {
        updates.participant_username = senderUsername;
      }
      if (senderAvatar) updates.participant_avatar = senderAvatar;

      // Salva dados do Instagram profile se disponíveis
      if (isFollower !== null || followerCount !== null) {
        updates.ig_profile_data = { isFollower, isFollowing, followerCount, isVerified, updatedAt: new Date().toISOString() };
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supa.from("imphq_ig_conversations").update(updates).eq("id", conv.id);
        console.log(`[zernio-webhook] Perfil atualizado para ${senderId}:`, Object.keys(updates));
      }
    } else {
      console.warn(`[zernio-webhook] Conversa nao encontrada para: ${senderId}`);
    }

    if (logEntry) {
      await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    }

    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err: any) {
    console.error("[zernio-webhook] Error processing webhook:", err);
    // Write error to log row if it exists
    try {
      const supaForErr = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supaForErr.from("imphq_ig_webhook_logs").update({ error: err.message || "Internal Error" }).filter("payload->>id", "eq", payload?.id || "");
    } catch (dbErr: any) {
      console.error("[zernio-webhook] Error updating error log in DB:", dbErr.message);
    }
    return new Response(err.message || "Internal Error", { status: 500 });
  }
});
