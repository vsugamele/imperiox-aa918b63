// Instagram webhook receiver — Meta envia POST com mensagens, comentários, menções
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  // ============ VERIFICAÇÃO (GET handshake) ============
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    // Verify token é parametrizável: passa via ?project=ID e busca no DB
    // OU usa token "imperiohq" universal (mais simples para começar)
    const projectId = url.searchParams.get("project");
    let expected = "imperiohq"; // fallback universal
    if (projectId) {
      const { data } = await supa
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", projectId)
        .eq("provider", "instagram")
        .maybeSingle();
      if (data?.credentials?.webhook_verify_token) expected = data.credentials.webhook_verify_token;
    }
    if (mode === "subscribe" && token === expected) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ============ EVENTOS (POST) ============
  try {
    const payload = await req.json();
    // Loga tudo primeiro (auditoria)
    await supa.from("imphq_ig_webhook_logs").insert({
      event_type: payload.object || "unknown",
      payload,
      processed: false,
    });

    if (payload.object !== "instagram") {
      return new Response("OK", { status: 200 });
    }

    for (const entry of payload.entry || []) {
      const igUserId = entry.id;
      const { data: account } = await supa
        .from("imphq_ig_accounts")
        .select("id, project_id")
        .eq("ig_user_id", igUserId)
        .maybeSingle();
      if (!account) continue;

      // --- MENSAGENS (DMs) ---
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const recipientId = messaging.recipient?.id;
        const isInbound = senderId !== igUserId;
        const participantId = isInbound ? senderId : recipientId;
        if (!participantId) continue;

        // upsert conversation
        const { data: conv } = await supa
          .from("imphq_ig_conversations")
          .upsert({
            account_id: account.id,
            participant_id: participantId,
            last_message: messaging.message?.text || "[mídia]",
            last_message_at: new Date(messaging.timestamp || Date.now()).toISOString(),
          }, { onConflict: "account_id,participant_id" })
          .select("id")
          .single();

        if (conv && messaging.message) {
          await supa.from("imphq_ig_messages").insert({
            conversation_id: conv.id,
            direction: isInbound ? "in" : "out",
            type: messaging.message.attachments?.[0]?.type || "text",
            content: messaging.message.text || null,
            media_url: messaging.message.attachments?.[0]?.payload?.url || null,
            mid: messaging.message.mid,
            status: "received",
          });
        }
      }

      // --- COMENTÁRIOS / MENÇÕES ---
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          const v = change.value || {};
          await supa.from("imphq_ig_comments").upsert({
            account_id: account.id,
            media_id: v.media?.id,
            comment_id: v.id,
            parent_comment_id: v.parent_id || null,
            from_user_id: v.from?.id,
            from_username: v.from?.username,
            text: v.text,
          }, { onConflict: "comment_id" });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("instagram-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
