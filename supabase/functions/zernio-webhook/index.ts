import { z } from "https://esm.sh/zod@3.25.76";
// Webhook do Zernio — recebe DMs/comentários do Zernio, traduz para Meta e encaminha para instagram-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runCommentTrigger, runDmTrigger } from "../_shared/ig-trigger-match.ts";

function makeClient(url: string, key: string) { return createClient(url, key); }
function errorMessage(value: unknown): string | undefined { if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message; return undefined; }
const Text = z.string().nullish();
const Story = z.object({ id: Text }).passthrough();
const Profile = z.object({ username: Text, displayName: Text, profilePicture: Text, isFollower: z.boolean().nullish(), isFollowing: z.boolean().nullish(), followerCount: z.number().nullish(), isVerified: z.boolean().nullish() }).passthrough();
const Person = z.object({ id: Text, contactId: Text, platformId: Text, username: Text, name: Text, avatar: Text, profilePicture: Text, role: Text, type: Text, instagramProfile: Profile.nullish() }).passthrough();
const Attachment = z.object({ originalType: Text, type: Text, url: Text, payload: z.object({ url: Text }).passthrough().nullish() }).passthrough();
const Reply = z.object({ story: Story.nullish() }).passthrough();
const Message = z.object({ id: Text, messageId: Text, text: Text, content: Text, body: Text, sender: Person.nullish(), recipient: Person.nullish(), attachments: z.array(Attachment).nullish(), storyId: Text, story_id: Text, replyTo: Reply.nullish(), reply_to: Reply.nullish(), context: z.object({ story: z.union([Story, z.string()]).nullish() }).passthrough().nullish(), messageType: Text, type: Text, contextType: Text, sentAt: Text }).passthrough();
const Conversation = z.object({ id: Text, conversationId: Text, participants: z.array(Person).nullish(), participantId: Text, platformConversationId: Text, participantUsername: Text, participantName: Text, participantPicture: Text, storyId: Text, story_id: Text, replyTo: Reply.nullish() }).passthrough();
const Comment = z.object({ id: Text, commentId: Text, mediaId: Text, media: Story.nullish(), text: Text, message: Text, from: Person.nullish(), userId: Text, username: Text, parentId: Text, parent_id: Text, createdAt: Text, timestamp: Text, adContext: z.unknown() }).passthrough();
const Media = z.object({ id: Text, ig_id: Text, igMediaId: Text, media_id: Text, mediaId: Text, mediaType: Text, media_type: Text, type: Text, mediaProductType: Text, media_product_type: Text, caption: Text, text: Text, permalink: Text, link: Text, thumbnailUrl: Text, thumbnail_url: Text, mediaUrl: Text, media_url: Text, timestamp: Text, publishedAt: Text, createdAt: Text, insights: z.record(z.unknown()).nullish(), metrics: z.record(z.unknown()).nullish(), stats: z.record(z.unknown()).nullish() }).passthrough();
const EventData = z.object({ commentId: Text, mediaId: Text, message: z.union([Message, z.string()]).nullish(), conversation: Conversation.nullish(), account: z.object({ id: Text, platformUserId: Text, instagramScopedId: Text }).passthrough().nullish(), accountId: Text, account_id: Text, comment: Comment.nullish(), post: Media.nullish(), media: Media.nullish(), messageId: Text, conversationId: Text, text: Text, sender: Person.nullish(), recipientId: Text, contactId: Text, senderId: Text, participantUsername: Text, participantName: Text, participantPicture: Text, igUserId: Text, storyId: Text, story_id: Text, timestamp: z.union([z.string(), z.number()]).nullish() }).passthrough();
const WebhookPayload = EventData.extend({ event: Text, id: Text, eventId: Text, data: EventData.nullish() });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function persistIgMedia(supa: ReturnType<typeof makeClient>, remoteUrl: string | null | undefined, projectId: string, key: string): Promise<string | null> {
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
  } catch (e) {
    console.warn("[ig-media] fetch err:", errorMessage(e) || e);
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

  let payload: z.infer<typeof WebhookPayload>;
  // Guardado fora do try para o catch atualizar o log por id (evita varredura
  // completa da tabela com filtro em payload->>id, que não é indexado)
  let logRowId: string | null = null;
  try {
    payload = WebhookPayload.parse(await req.json());
    console.log(`[zernio-webhook] Received event: ${payload.event} for project: ${projectId}`);

    // Dedupe idempotente — extrai messageId cedo
    const earlyDataMessage = typeof payload.data?.message === "object" ? payload.data.message : null;
    const earlyRootMessage = typeof payload.message === "object" ? payload.message : null;
    const earlyMessageId = earlyDataMessage?.id
      || earlyDataMessage?.messageId
      || payload?.data?.messageId
      || earlyRootMessage?.id
      || earlyRootMessage?.messageId
      || null;

    if (earlyMessageId) {
      // Usa índices de expressão em payload->data->message->>id e payload->message->>id.
      // Uma query por caminho (o .or misto não usa índice) + janela de 2 dias.
      const since = new Date(Date.now() - 2 * 86400_000).toISOString();
      const dupQuery = (path: string) =>
        supa
          .from("imphq_ig_webhook_logs")
          .select("id")
          .eq(path, earlyMessageId)
          .eq("processed", true)
          .gte("created_at", since)
          .limit(1)
          .maybeSingle();

      const [d1, d2] = await Promise.all([
        dupQuery("payload->data->message->>id"),
        dupQuery("payload->message->>id"),
      ]);
      const dup = d1.data || d2.data;
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
    logRowId = logEntry?.id ?? null;

    // === COMMENT EVENTS (comment.received etc) ===
    if (typeof payload.event === "string" && payload.event.startsWith("comment.")) {
      const d = payload.data || payload;
      const c = Comment.parse(d.comment || d);
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
      } catch (e) {
        console.warn(`[zernio-webhook] runCommentTrigger err: ${errorMessage(e) || e}`);
      }
      return new Response("OK", { status: 200 });
    }

    // === POST / MEDIA EVENTS (post.created, post.updated, post.metrics, media.*) ===
    if (
      typeof payload.event === "string" &&
      (payload.event.startsWith("post.") || payload.event.startsWith("media."))
    ) {
      const d = payload.data || payload;
      const p = Media.parse(d.post || d.media || d);
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
      const num = (...v: unknown[]) => { for (const x of v) { const n = Number(x); if (Number.isFinite(n) && n > 0) return n; } return 0; };
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
    const message = Message.parse(data.message || {});
    const conversation = data.conversation;
    const account = data.account;

    // Extração robusta — cobre múltiplas estruturas de payload do Zernio
    const messageId      = message?.id || message?.messageId || data.messageId;
    const conversationId = conversation?.id || conversation?.conversationId || data.conversationId;
    const text           = message?.text || message?.content || message?.body || data.text || "";
    const attachments    = Array.isArray(message?.attachments)
      ? message.attachments.map((att) => ({
          type: att.originalType || att.type || "file",
          payload: { url: att.payload?.url || att.url || null },
        }))
      : [];

    // Para outbound, o "lead" (counterpart) está em conversation.participantId.
    // Para inbound, o sender já é o próprio lead.
    const sender       = isOutbound
      ? {}
      : (message?.sender || data.sender || conversation?.participants?.find((p) => p.role === "customer" || p.type === "customer") || {});
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

    // Detecta story reply / story mention vindo do Zernio (campos variam bastante)
    const rawStoryId = message?.storyId
      || message?.story_id
      || conversation?.storyId
      || conversation?.story_id
      || data?.storyId
      || data?.story_id
      || null;
    const replyToStory = message?.replyTo?.story
      || message?.reply_to?.story
      || conversation?.replyTo?.story
      || (message?.context?.story ? { id: typeof message.context.story === "string" ? message.context.story : message.context.story.id } : null)
      || (rawStoryId ? { id: String(rawStoryId) } : null)
      || null;
    const msgType = String(message?.messageType || message?.type || message?.contextType || "").toLowerCase();
    const looksLikeStoryReply = /story[_-]?reply|reply[_-]?to[_-]?story/.test(msgType);
    const looksLikeStoryMention = /story[_-]?mention|mention[_-]?story/.test(msgType);
    const attachmentHasStory = attachments.some((a) => {
      const t = String(a?.type || "").toLowerCase();
      const u = String(a?.payload?.url || "").toLowerCase();
      return t === "story_mention" || t === "story" || t === "ig_story" || u.includes("/stories/");
    });
    const hasStoryAttachment = attachmentHasStory || looksLikeStoryMention;
    const msgPayload: { mid: string; text: string; attachments: { type: string; payload: { url: string | null } }[]; reply_to?: { story: z.infer<typeof Story> } } = { mid: messageId, text, attachments };
    const finalReplyToStory = replyToStory || (looksLikeStoryReply && rawStoryId ? { id: String(rawStoryId) } : null);
    if (finalReplyToStory) msgPayload.reply_to = { story: finalReplyToStory };
    if (hasStoryAttachment) {
      if (attachments[0]) {
        attachments[0].type = attachments[0].type === "story" ? "story_mention" : (attachments[0].type || "story_mention");
      } else {
        attachments.push({ type: "story_mention", payload: { url: null } });
        msgPayload.attachments = attachments;
      }
    }

    const metaEnvelope = {
      object: "instagram",
      entry: [{
        id: igUserId,
        messaging: [{
          sender: envelopeSender,
          recipient: envelopeRecipient,
          timestamp: new Date(message?.sentAt || data.timestamp || payload.timestamp || Date.now()).getTime(),
          message: msgPayload,
        }],
      }],
    };

    console.log(`[zernio-webhook] Forwarding ${isOutbound ? "OUTBOUND" : "inbound"} to instagram-webhook (lead: ${senderId}, name: ${senderName})`);
    const forwardUrl = `${url.origin}/functions/v1/instagram-webhook?project=${projectId}`;
    // Service role para invocação função→função (anon key passou a ser rejeitada como Forbidden)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (serviceKey) {
      forwardHeaders.Authorization = `Bearer ${serviceKey}`;
      forwardHeaders.apikey = serviceKey;
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
    } catch (forwardErr) {
      console.error(`[zernio-webhook] Erro ao encaminhar. Persistindo direto...`, errorMessage(forwardErr) || forwardErr);
      if (logEntry) await supa.from("imphq_ig_webhook_logs").update({ error: errorMessage(forwardErr) || "forward failed" }).eq("id", logEntry.id);
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
        .update({ updated_at: new Date().toISOString() })
        .eq("id", dbAccId);
    }

    // 🔥 Dispara automação de DM/Story (story_reply, story_mention ou DM normal)
    if (!isOutbound && dbAccId && senderId) {
      try {
        const evt: "dm" | "story" | "story_mention" = hasStoryAttachment
          ? "story_mention"
          : (finalReplyToStory ? "story" : "dm");
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
      } catch (e) {
        console.warn(`[zernio-webhook] runDmTrigger err: ${errorMessage(e) || e}`);
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
      const updates: { ig_thread_id?: string; participant_name?: string; participant_username?: string; participant_avatar?: string; ig_profile_data?: { isFollower: boolean | null; isFollowing: boolean | null; followerCount: number | null; isVerified: boolean | null; updatedAt: string }; updated_at?: string } = {};

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
  } catch (err) {
    console.error("[zernio-webhook] Error processing webhook:", err);
    // Write error to log row if it exists
    try {
      const supaForErr = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      if (logRowId) {
        await supaForErr.from("imphq_ig_webhook_logs").update({ error: errorMessage(err) || "Internal Error" }).eq("id", logRowId);
      }
    } catch (dbErr) {
      console.error("[zernio-webhook] Error updating error log in DB:", errorMessage(dbErr));
    }
    return new Response(errorMessage(err) || "Internal Error", { status: 500 });
  }
});
