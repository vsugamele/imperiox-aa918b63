// Webhook do Zernio — recebe DMs/comentários do Zernio, traduz para Meta e encaminha para instagram-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runCommentTrigger, runDmTrigger } from "../_shared/ig-trigger-match.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function persistIgMedia(supa: any, remoteUrl: string | null | undefined, projectId: string, key: string): Promise<string | null> {
  if (!remoteUrl || !projectId || !key) return null;
  try {
    const r = await fetch(remoteUrl);
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "video/mp4": "mp4", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg",
    };
    const ext = extMap[ct] || ct.split("/")[1] || "bin";
    const bytes = new Uint8Array(await r.arrayBuffer());
    const path = `${projectId}/${key}.${ext}`;
    let { error } = await supa.storage.from("ig-media").upload(path, bytes, { contentType: ct, upsert: true });
    if (error?.message?.includes("Bucket not found")) {
      await supa.storage.createBucket("ig-media", { public: true }).catch(() => {});
      ({ error } = await supa.storage.from("ig-media").upload(path, bytes, { contentType: ct, upsert: true }));
    }
    if (error) { console.warn("[ig-media] upload:", error.message); return null; }
    const { data } = supa.storage.from("ig-media").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e: any) {
    console.warn("[ig-media] fetch err:", e?.message || e);
    return null;
  }
}


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

    // === COMMENT EVENTS (comment.received etc) ===
    if (typeof payload.event === "string" && payload.event.startsWith("comment.")) {
      const d = payload.data || payload;
      const c = d.comment || d;
      const commentId = c.id || c.commentId || d.commentId;
      const mediaId = c.mediaId || c.media?.id || d.mediaId;
      const text = c.text || c.message || "";
      const fromUserId = c.from?.id || c.userId || null;
      const fromUsername = c.from?.username || c.username || null;
      const parentId = c.parentId || c.parent_id || null;
      const zernioAccountId = d.account?.id || d.accountId || d.account_id;
      const ts = c.createdAt || c.timestamp || payload.timestamp || new Date().toISOString();

      // dedup por event_id
      const evtId = payload.id || payload.eventId || `${commentId}-${payload.event}`;
      if (evtId) {
        const { data: dupEvt } = await supa.from("imphq_zernio_webhook_events").select("event_id").eq("event_id", evtId).maybeSingle();
        if (dupEvt) {
          console.log(`[zernio-webhook] duplicate comment event ${evtId}`);
          if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
          return new Response("OK (dup)", { status: 200 });
        }
        await supa.from("imphq_zernio_webhook_events").insert({
          event_id: evtId, event_type: payload.event, project_id: projectId, payload,
        });
      }

      // resolve account
      let accId: string | null = null;
      if (zernioAccountId) {
        const { data: acc } = await supa.from("imphq_ig_accounts").select("id")
          .eq("project_id", projectId).eq("page_id", zernioAccountId).maybeSingle();
        if (acc) accId = acc.id;
      }
      if (!accId) {
        const { data: acc } = await supa.from("imphq_ig_accounts").select("id")
          .eq("project_id", projectId).limit(1).maybeSingle();
        if (acc) accId = acc.id;
      }

      if (!commentId || !accId) {
        console.error("[zernio-webhook] comment: campos ausentes", { commentId, accId });
        if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ processed: true, error: "missing fields" }).eq("id", logEntry.id);
        return new Response("OK (skipped)", { status: 200 });
      }

      const { error: upErr } = await supa.from("imphq_ig_comments").upsert({
        account_id: accId,
        media_id: mediaId,
        comment_id: commentId,
        parent_comment_id: parentId,
        from_user_id: fromUserId,
        from_username: fromUsername,
        text,
        created_at: ts,
        ad_context: c.adContext || d.adContext || null,
      }, { onConflict: "comment_id" });

      if (upErr) {
        console.error("[zernio-webhook] comment upsert error", upErr);
        if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ error: upErr.message }).eq("id", logEntry.id);
      } else if (logEntry) {
        await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      }

      // 🔥 Dispara automação de comentário (reply público + DM privado)
      try {
        await runCommentTrigger({
          supa,
          projectId,
          accountId: accId,
          mediaId: mediaId || null,
          commentId,
          commentText: text || "",
          fromUsername,
        });
      } catch (e: any) {
        console.warn(`[zernio-webhook] runCommentTrigger err: ${e?.message || e}`);
      }
      return new Response("OK", { status: 200 });
    }

    // === POST / MEDIA EVENTS (post.created, post.updated, post.metrics, media.*) ===
    if (
      typeof payload.event === "string" &&
      (payload.event.startsWith("post.") || payload.event.startsWith("media."))
    ) {
      const d = payload.data || payload;
      const p = d.post || d.media || d;
      const zernioAccountId = d.account?.id || d.accountId || d.account_id;
      const igMediaId = p.ig_id || p.igMediaId || p.media_id || p.mediaId || p.id;
      if (!igMediaId) {
        if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ processed: true, error: "no media id" }).eq("id", logEntry.id);
        return new Response("OK (skipped)", { status: 200 });
      }

      let accId: string | null = null;
      if (zernioAccountId) {
        const { data: acc } = await supa.from("imphq_ig_accounts").select("id")
          .eq("project_id", projectId).eq("page_id", zernioAccountId).maybeSingle();
        if (acc) accId = acc.id;
      }
      if (!accId) {
        const { data: acc } = await supa.from("imphq_ig_accounts").select("id")
          .eq("project_id", projectId).limit(1).maybeSingle();
        if (acc) accId = acc.id;
      }
      if (!accId) {
        if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ processed: true, error: "no account" }).eq("id", logEntry.id);
        return new Response("OK (skipped)", { status: 200 });
      }

      const { data: mediaRow } = await supa.from("imphq_ig_media").upsert({
        account_id: accId,
        project_id: projectId,
        ig_media_id: String(igMediaId),
        zernio_post_id: p.id || null,
        media_type: p.mediaType || p.media_type || p.type || null,
        media_product_type: p.mediaProductType || p.media_product_type || null,
        caption: p.caption || p.text || null,
        permalink: p.permalink || p.link || null,
        thumbnail_url: p.thumbnailUrl || p.thumbnail_url || null,
        media_url: p.mediaUrl || p.media_url || null,
        posted_at: p.timestamp || p.publishedAt || p.createdAt || null,
        raw: p,
      }, { onConflict: "account_id,ig_media_id" }).select("id").maybeSingle();

      const m = p.insights || p.metrics || p.stats || p;
      const num = (...v: any[]) => { for (const x of v) { const n = Number(x); if (Number.isFinite(n) && n > 0) return n; } return 0; };
      const likes = num(m.likes, m.likeCount, m.like_count, p.likes_count);
      const comments = num(m.comments, m.commentCount, m.comments_count, p.comments_count);
      const saves = num(m.saves, m.saved);
      const shares = num(m.shares);
      const reach = num(m.reach);
      const impressions = num(m.impressions, m.views);
      const videoViews = num(m.videoViews, m.video_views, m.plays);

      if (mediaRow && (likes + comments + saves + shares + reach + impressions + videoViews) > 0) {
        await supa.from("imphq_ig_media_insights").upsert({
          media_id: mediaRow.id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          likes, comments, saves, shares, reach, impressions,
          video_views: videoViews,
          engagement: likes + comments + saves + shares,
          raw: m,
        }, { onConflict: "media_id,snapshot_date" });
      }

      if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      return new Response("OK", { status: 200 });
    }

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
        const remoteMedia = firstAttachment?.payload?.url || null;
        const persistedMedia = remoteMedia
          ? await persistIgMedia(supa, remoteMedia, projectId, `dm/${directConv.id}/${messageId || Date.now()}`)
          : null;
        const { error: msgErr } = await supa.from("imphq_ig_messages").insert({
          conversation_id: directConv.id,
          direction: isOutbound ? "out" : "in",
          type: firstAttachment?.type || "text",
          content: text || null,
          media_url: persistedMedia || remoteMedia,
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

    // 🔥 Dispara automação de DM/Story (story_reply, story_mention ou DM normal)
    if (!isOutbound && dbAccId && senderId) {
      try {
        const att = attachments[0] || null;
        const attType = String(att?.type || "").toLowerCase();
        const isStoryMention = attType === "story_mention" || attType === "story";
        const isStoryReply = !!(message?.replyTo?.story || message?.reply_to?.story || conversation?.replyTo?.story);
        const evt: "dm" | "story" | "story_mention" = isStoryMention
          ? "story_mention"
          : isStoryReply ? "story" : "dm";
        await runDmTrigger({
          supa,
          projectId,
          accountId: dbAccId,
          participantId: senderId,
          content: text || "",
          eventType: evt,
          dedupKey: messageId,
          username: senderUsername,
        });
      } catch (e: any) {
        console.warn(`[zernio-webhook] runDmTrigger err: ${e?.message || e}`);
      }
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
