// Backfill: importa conversas e mensagens recentes do Zernio para imphq_ig_conversations + imphq_ig_messages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZERNIO = "https://zernio.com/api/v1";

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { project_id, max_conversations = 50, max_messages = 30 } = await req.json();
    if (!project_id) return json({ error: "project_id obrigatório" }, 400);

    const { data: credRow } = await supa
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("project_id", project_id)
      .eq("provider", "instagram")
      .maybeSingle();
    const creds = credRow?.credentials;
    if (!creds || creds.auth_method !== "zernio" || !creds.zernio_api_key || !creds.zernio_account_id) {
      return json({ error: "Projeto sem conexão Zernio válida" }, 400);
    }

    const { data: acc } = await supa
      .from("imphq_ig_accounts")
      .select("id")
      .eq("project_id", project_id)
      .eq("ig_user_id", creds.ig_user_id)
      .maybeSingle();
    if (!acc) return json({ error: "imphq_ig_accounts não encontrado" }, 400);

    const auth = { "Authorization": `Bearer ${creds.zernio_api_key}` };

    // 1) Lista conversas
    const convRes = await fetch(`${ZERNIO}/inbox/conversations?accountId=${creds.zernio_account_id}&limit=${max_conversations}`, { headers: auth });
    if (!convRes.ok) {
      const t = await convRes.text();
      return json({ error: `Zernio conversations ${convRes.status}: ${t.slice(0, 300)}` }, 400);
    }
    const convData = await convRes.json();
    const conversations: any[] = convData.conversations || convData.data || [];

    let upsertedConvs = 0;
    let upsertedMsgs = 0;

    for (const c of conversations) {
      const threadId = c.id || c._id || c.conversationId;
      const participantId = c.participantId || c.participant?.id || c.userId || c.user?.id;
      const participantUsername = c.participant?.username || c.user?.username || null;
      const participantName = c.participant?.name || c.user?.name || null;
      const participantAvatar = c.participant?.avatarUrl || c.user?.avatarUrl || null;
      if (!threadId || !participantId) continue;

      // upsert conv
      const { data: existing } = await supa
        .from("imphq_ig_conversations")
        .select("id")
        .eq("account_id", acc.id)
        .eq("participant_id", participantId)
        .maybeSingle();

      const convPayload: any = {
        account_id: acc.id,
        ig_thread_id: threadId,
        participant_id: participantId,
        participant_username: participantUsername,
        participant_name: participantName,
        participant_avatar: participantAvatar,
        last_message: c.lastMessage?.text || c.lastMessage || null,
        last_message_at: c.lastMessageAt || c.updatedAt || null,
      };
      let convId: string;
      if (existing) {
        await supa.from("imphq_ig_conversations").update(convPayload).eq("id", existing.id);
        convId = existing.id;
      } else {
        const { data: ins } = await supa.from("imphq_ig_conversations").insert(convPayload).select("id").single();
        convId = ins!.id;
      }
      upsertedConvs++;

      // 2) Mensagens da conversa
      const msgRes = await fetch(`${ZERNIO}/inbox/conversations/${threadId}/messages?limit=${max_messages}`, { headers: auth });
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();
      const messages: any[] = msgData.messages || msgData.data || [];

      for (const m of messages) {
        const mid = m.id || m._id || m.messageId;
        if (!mid) continue;
        const { data: exists } = await supa
          .from("imphq_ig_messages")
          .select("id")
          .eq("mid", `zernio-${mid}`)
          .maybeSingle();
        if (exists) continue;

        const direction = (m.from === "account" || m.outbound || m.sentByMe) ? "out" : "in";
        await supa.from("imphq_ig_messages").insert({
          conversation_id: convId,
          direction,
          type: m.attachments?.length ? (m.attachments[0].type || "media") : "text",
          content: m.text || m.message || m.body || "",
          media_url: m.attachments?.[0]?.url || null,
          mid: `zernio-${mid}`,
          status: direction === "out" ? "delivered" : "received",
          metadata: { backfill: true, provider: "zernio" },
          created_at: m.createdAt || m.timestamp || undefined,
        });
        upsertedMsgs++;
      }
    }

    return json({
      success: true,
      conversations_processed: upsertedConvs,
      messages_imported: upsertedMsgs,
    });
  } catch (e: any) {
    console.error("[ig-zernio-backfill]", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});
