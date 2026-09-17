// Webhook do Zernio — recebe DMs e comentários (Instagram e Facebook), aplica moderação e encaminha para instagram-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOXIC_KEYWORDS = [
  "golpe", "fraude", "reclame aqui", "mentira", "ladrão", "ladrao",
  "roubo", "não comprem", "nao comprem", "propaganda enganosa",
  "falso", "furada", "estelionato", "picareta", "processo", "enganado"
];

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
    const eventType = String(payload.event || "").toLowerCase();
    console.log(`[zernio-webhook] Received event: ${eventType} for project: ${projectId}`);

    // Log do evento recebido para auditoria
    const { data: logEntry } = await supa.from("imphq_ig_webhook_logs").insert({
      event_type: `zernio_${eventType || "unknown"}`,
      payload,
      processed: false,
    }).select("id").maybeSingle();

    const isMessage = eventType === "message.received" || eventType === "message.created";
    const isComment = eventType === "comment.received" || eventType === "comment.created";

    if (!isMessage && !isComment) {
      console.log(`[zernio-webhook] Ignoring unsupported event type: ${eventType}`);
      if (logEntry) {
        await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      }
      return new Response("OK", { status: 200 });
    }

    const data = payload.data || payload;
    const account = data.account || {};
    const zernioAccountId = account.id || data.accountId || data.account_id;
    const rawPlatform = String(data.platform || payload.platform || account.platform || "instagram").toLowerCase();
    const platform = rawPlatform.includes("facebook") ? "facebook" : "instagram";

    // 1. Localiza conta comercial no banco
    let dbAcc: any = null;
    if (zernioAccountId) {
      const { data: acc } = await supa
        .from("imphq_ig_accounts")
        .select("id, ig_user_id, project_id, page_id")
        .eq("page_id", zernioAccountId)
        .maybeSingle();
      dbAcc = acc;
    }
    if (!dbAcc) {
      const { data: acc } = await supa
        .from("imphq_ig_accounts")
        .select("id, ig_user_id, project_id, page_id")
        .eq("project_id", projectId)
        .maybeSingle();
      dbAcc = acc;
    }

    const igUserId = dbAcc?.ig_user_id || account?.platformUserId || account?.instagramScopedId || data.igUserId || zernioAccountId;

    // ==========================================
    // FLUXO DE COMENTÁRIOS (Facebook e Instagram)
    // ==========================================
    if (isComment) {
      const commentObj = data.comment || data;
      const commentId = String(commentObj.id || commentObj.commentId || data.commentId || data.id || `cmt_${Date.now()}`);
      const postId = String(data.post?.id || data.postId || data.mediaId || commentObj.postId || commentObj.mediaId || "post");
      const commentText = commentObj.text || commentObj.content || commentObj.body || data.text || "";
      const parentId = commentObj.parentId || commentObj.parent_id || data.parentId || null;

      const sender = commentObj.sender || commentObj.author || commentObj.user || data.sender || data.author || {};
      const senderId = String(sender.id || sender.contactId || sender.platformId || data.senderId || data.authorId || `usr_${Date.now()}`);
      const senderUsername = sender.username || sender.name || "usuario";
      const senderName = sender.name || sender.displayName || senderUsername || "Lead";
      const senderAvatar = sender.avatar || sender.profilePicture || null;

      console.log(`[zernio-webhook] Processing comment on ${platform} (${postId}): "${commentText.slice(0, 50)}..." by @${senderUsername}`);

      // Escudo Anti-Hater / Moderação de Comentários em Anúncios de Vídeo
      const textLc = commentText.toLowerCase();
      const isToxic = TOXIC_KEYWORDS.some((kw) => textLc.includes(kw));

      if (isToxic && dbAcc) {
        console.warn(`[zernio-webhook] 🚨 Toxic comment detected on ${platform} video ${postId}: "${commentText}"`);
        // Tenta ocultar na Zernio API imediatamente
        try {
          const { data: credsData } = await supa
            .from("imphq_integration_credentials")
            .select("credentials")
            .eq("project_id", dbAcc.project_id || projectId)
            .eq("provider", "instagram")
            .maybeSingle();

          const zKey = credsData?.credentials?.zernio_api_key;
          const zAcc = credsData?.credentials?.zernio_account_id || zernioAccountId;

          if (zKey && zAcc) {
            const hideRes = await fetch(`https://zernio.com/api/v1/inbox/comments/${postId}/${commentId}/hide`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${zKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ accountId: zAcc }),
            });
            console.log(`[zernio-webhook] Auto-hide via Zernio response: ${hideRes.status}`);
          }
        } catch (hErr: any) {
          console.warn(`[zernio-webhook] Auto-hide failed:`, hErr.message);
        }
      }

      // Upsert no imphq_ig_comments com metadados
      if (dbAcc?.id) {
        await supa.from("imphq_ig_comments").upsert({
          account_id: dbAcc.id,
          media_id: postId,
          post_id: postId,
          comment_id: commentId,
          parent_comment_id: parentId ? String(parentId) : null,
          from_user_id: senderId,
          from_username: senderUsername,
          text: commentText,
          platform,
          is_hidden: isToxic,
          sentiment: isToxic ? "negative" : "neutral",
          ad_context: {
            platform,
            post_id: postId,
            sender_name: senderName,
            sender_avatar: senderAvatar,
          },
        }, { onConflict: "comment_id" });
      }

      // Encaminha para instagram-webhook no envelope padrão Meta
      const metaEnvelope = {
        object: platform === "facebook" ? "page" : "instagram",
        entry: [{
          id: igUserId,
          changes: [{
            field: "comments",
            value: {
              id: commentId,
              text: commentText,
              media: { id: postId },
              from: { id: senderId, username: senderUsername, name: senderName },
              parent_id: parentId ? String(parentId) : null,
            },
          }],
        }],
      };

      const forwardUrl = `${url.origin}/functions/v1/instagram-webhook?project=${projectId}`;
      await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
        body: JSON.stringify(metaEnvelope),
      });

      if (logEntry) {
        await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      }
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // ==========================================
    // FLUXO DE MENSAGENS / DMs (Direct e Messenger)
    // ==========================================
    const message = data.message;
    const conversation = data.conversation;

    const messageId = message?.id || message?.messageId || data.messageId;
    const conversationId = conversation?.id || conversation?.conversationId || data.conversationId;
    const text = message?.text || message?.content || message?.body || data.text || "";

    const sender = message?.sender || data.sender || conversation?.participants?.find((p: any) => p.role === "customer" || p.type === "customer") || {};
    const senderId = sender.id || sender.contactId || sender.platformId || data.contactId || data.senderId;

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
      || (platform === "facebook" ? "Lead Facebook" : "Lead Instagram");

    const senderAvatar = sender.avatar
      || sender.profilePicture
      || sender.instagramProfile?.profilePicture
      || conversation?.participantPicture
      || data.participantPicture
      || null;

    if (!messageId || !conversationId || !senderId || !igUserId) {
      console.error("[zernio-webhook] Campos obrigatórios ausentes:", { messageId, conversationId, senderId, igUserId, zernioAccountId });
      return new Response("Invalid payload structure", { status: 400 });
    }

    // Envelope Meta para encaminhamento
    const metaEnvelope = {
      object: platform === "facebook" ? "page" : "instagram",
      entry: [{
        id: igUserId,
        messaging: [{
          sender: { id: senderId, username: senderUsername, name: senderName, avatar: senderAvatar },
          recipient: { id: igUserId },
          timestamp: Date.now(),
          message: { mid: messageId, text, attachments: [] },
        }],
      }],
    };

    console.log(`[zernio-webhook] Forwarding ${platform} DM to instagram-webhook (sender: ${senderId}, name: ${senderName})`);
    const forwardUrl = `${url.origin}/functions/v1/instagram-webhook?project=${projectId}`;
    const forwardRes = await fetch(forwardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
      body: JSON.stringify(metaEnvelope),
    });

    if (!forwardRes.ok) {
      const errText = await forwardRes.text();
      console.error(`[zernio-webhook] Falha ao encaminhar DM: ${errText}`);
      return new Response(`Error forwarding: ${errText}`, { status: 500 });
    }

    // Salva/Atualiza perfil diretamente no imphq_ig_conversations para evitar perda de avatar e nome
    let convQuery = supa
      .from("imphq_ig_conversations")
      .select("id, ig_thread_id, participant_username, participant_name, participant_avatar");

    if (dbAcc?.id) {
      convQuery = convQuery.eq("account_id", dbAcc.id);
    }

    const { data: conv } = await convQuery
      .eq("participant_id", senderId)
      .maybeSingle();

    if (conv) {
      const updates: any = { platform };
      if (conv.ig_thread_id !== conversationId) updates.ig_thread_id = conversationId;
      if (senderName && senderName !== "Lead Instagram" && senderName !== "Lead Facebook" && (!conv.participant_name || conv.participant_name.startsWith("Lead #"))) {
        updates.participant_name = senderName;
      }
      if (senderUsername && (!conv.participant_username || conv.participant_username.startsWith("user_"))) {
        updates.participant_username = senderUsername;
      }
      if (senderAvatar) updates.participant_avatar = senderAvatar;

      updates.updated_at = new Date().toISOString();
      await supa.from("imphq_ig_conversations").update(updates).eq("id", conv.id);
      console.log(`[zernio-webhook] Perfil atualizado para ${senderId} (${platform}):`, Object.keys(updates));
    }

    if (logEntry) {
      await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    }

    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err: any) {
    console.error("[zernio-webhook] Error processing webhook:", err);
    return new Response(err.message || "Internal Error", { status: 500 });
  }
});
