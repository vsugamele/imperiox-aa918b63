import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Helper: get provider config (normalizes api_url) ──
    async function getProvider(providerId: string) {
      const { data, error } = await supabase
        .from("imphq_wa_providers")
        .select("*")
        .eq("id", providerId)
        .single();
      if (error || !data) throw new Error("Provider não encontrado: " + (error?.message || ""));
      // Normalize: remove trailing slashes from api_url
      if (data.api_url) data.api_url = data.api_url.replace(/\/+$/, "");
      return data;
    }

    // ── Helper: find or create conversation ──
    async function findOrCreateConversation(phone: string, projectId: string, providerId: string | null, contactName?: string) {
      const cleanPhone = phone.replace(/\D/g, "");
      
      // Try to find existing conversation by phone + project
      const { data: existing } = await supabase
        .from("imphq_wa_conversations")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("project_id", projectId)
        .limit(1)
        .single();

      if (existing) return existing;

      // Create new conversation
      const { data: created, error } = await supabase
        .from("imphq_wa_conversations")
        .insert({
          phone: cleanPhone,
          contact_name: contactName || null,
          session: `session-${Date.now()}`,
          project_id: projectId,
          status: "active",
          provider_id: providerId,
          message_count: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("[findOrCreateConversation] Error creating:", error.message);
        throw new Error("Falha ao criar conversa: " + error.message);
      }
      return created;
    }

    // ── Helper: update conversation metadata after message ──
    async function updateConversationAfterMessage(conversationId: string, content: string, currentCount: number) {
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({
          last_message: content.substring(0, 200),
          last_message_at: new Date().toISOString(),
          message_count: (currentCount || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
      if (error) console.warn("[updateConversation] Error:", error.message);
    }

    // ── Helper: send via Evolution API ──
    async function sendEvolution(provider: any, phone: string, text: string) {
      const inst = encodeURIComponent(provider.instance_name);
      const apiUrl = `${provider.api_url}/message/sendText/${inst}`;
      console.log("[sendEvolution] URL:", apiUrl, "phone:", phone, "textLen:", text.length);
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: provider.api_key,
        },
        body: JSON.stringify({ number: phone, text }),
      });
      const data = await res.json();
      console.log("[sendEvolution] status:", res.status, "response:", JSON.stringify(data).slice(0, 500));
      if (!res.ok) {
        // Check if it's an invalid/non-existent number
        const msgs = data?.response?.message;
        if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
          return { ok: false, error: "invalid_number", details: msgs };
        }
        throw new Error(`Evolution error [${res.status}]: ${JSON.stringify(data)}`);
      }
      return data;
    }

    // ── Helper: send via Twilio ──
    async function sendTwilio(provider: any, phone: string, text: string) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
      if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY not configured");

      const fromNumber = provider.twilio_from || "";
      const res = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: `whatsapp:+${phone.replace(/\D/g, "")}`,
          From: `whatsapp:${fromNumber}`,
          Body: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Twilio error [${res.status}]: ${JSON.stringify(data)}`);
      return data;
    }

    // ── ACTION: send_message ──
    if (action === "send_message") {
      const body = await req.json();
      const { provider_id, phone, content, conversation_id, project_id } = body;
      const provider = await getProvider(provider_id);

      // Send via provider
      let result;
      if (provider.provider === "evolution") {
        result = await sendEvolution(provider, phone, content);
      } else {
        result = await sendTwilio(provider, phone, content);
      }

      // Handle invalid number gracefully
      if (result?.ok === false && result?.error === "invalid_number") {
        return new Response(JSON.stringify({
          success: false,
          error: "Número inválido ou não encontrado no WhatsApp.",
          details: result.details,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find or create conversation
      const conv = conversation_id
        ? (await supabase.from("imphq_wa_conversations").select("*").eq("id", conversation_id).single()).data
        : await findOrCreateConversation(phone, project_id || provider.project_id, provider.id);

      if (!conv) throw new Error("Conversa não encontrada nem criada");

      // Save message with all required fields
      const { error: msgError } = await supabase.from("imphq_wa_messages").insert({
        conversation_id: conv.id,
        direction: "outgoing",
        phone,
        content,
        project_id: project_id || provider.project_id,
        provider: provider.provider,
        provider_message_id: result?.key?.id || result?.sid || null,
        status: "sent",
      });

      if (msgError) {
        console.error("[send_message] DB save error:", msgError.message);
        throw new Error("Mensagem enviada mas falhou ao salvar: " + msgError.message);
      }

      // Update conversation metadata
      await updateConversationAfterMessage(conv.id, content, conv.message_count || 0);

      return new Response(JSON.stringify({ success: true, result, conversation_id: conv.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: send_bulk ──
    if (action === "send_bulk") {
      const body = await req.json();
      const { provider_id, contacts, message_template, project_id, delay_ms } = body;
      const provider = await getProvider(provider_id);
      const results: any[] = [];
      const delayTime = delay_ms || 3000;

      for (const contact of contacts) {
        try {
          const text = (message_template || "")
            .replace(/\{\{nome\}\}/g, contact.name || "")
            .replace(/\{\{telefone\}\}/g, contact.phone || "");

          let sendResult;
          if (provider.provider === "evolution") {
            sendResult = await sendEvolution(provider, contact.phone, text);
          } else {
            sendResult = await sendTwilio(provider, contact.phone, text);
          }

          // Skip DB persistence if number is invalid
          if (sendResult?.ok === false && sendResult?.error === "invalid_number") {
            results.push({ phone: contact.phone, status: "invalid_number", error: "Número não existe no WhatsApp" });
            continue;
          }

          // Find or create conversation for this contact
          const conv = await findOrCreateConversation(
            contact.phone,
            project_id || provider.project_id,
            provider.id,
            contact.name
          );

          await supabase.from("imphq_wa_messages").insert({
            conversation_id: conv.id,
            direction: "outgoing",
            phone: contact.phone,
            content: text,
            project_id: project_id || provider.project_id,
            provider: provider.provider,
            status: "sent",
          });

          await updateConversationAfterMessage(conv.id, text, conv.message_count || 0);

          results.push({ phone: contact.phone, status: "sent" });

          if (delayTime > 0) {
            await new Promise((r) => setTimeout(r, delayTime));
          }
        } catch (err: any) {
          results.push({ phone: contact.phone, status: "error", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: qr_code (Evolution only) ──
    if (action === "qr_code") {
      const providerId = url.searchParams.get("provider_id");
      if (!providerId) throw new Error("provider_id required");
      const provider = await getProvider(providerId);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "QR Code only for Evolution API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${provider.api_url}/instance/connect/${encodeURIComponent(provider.instance_name)}`, {
        headers: { apikey: provider.api_key },
      });
      const data = await res.json();

      return new Response(JSON.stringify({ success: true, qrcode: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: session_status (Evolution only) ──
    if (action === "session_status") {
      const providerId = url.searchParams.get("provider_id");
      if (!providerId) throw new Error("provider_id required");
      const provider = await getProvider(providerId);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ status: "connected", provider: "twilio" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        `${provider.api_url}/instance/connectionState/${encodeURIComponent(provider.instance_name)}`,
        { headers: { apikey: provider.api_key } }
      );
      const data = await res.json();

      return new Response(JSON.stringify({ success: true, state: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: create_instance (Evolution only) ──
    if (action === "create_instance") {
      const body = await req.json();
      const { provider_id } = body;
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "Only for Evolution API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${provider.api_url}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: provider.api_key,
        },
        body: JSON.stringify({
          instanceName: provider.instance_name,
          qrcode: true,
        }),
      });
      const data = await res.json();

      return new Response(JSON.stringify({ success: true, instance: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: instance_info (Evolution — real-time status + number) ──
    if (action === "instance_info") {
      const providerId = url.searchParams.get("provider_id");
      if (!providerId) throw new Error("provider_id required");
      const provider = await getProvider(providerId);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ status: "connected", provider: "twilio", number: provider.twilio_from }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get connection state
      const stateRes = await fetch(
        `${provider.api_url}/instance/connectionState/${encodeURIComponent(provider.instance_name)}`,
        { headers: { apikey: provider.api_key } }
      );
      const stateData = await stateRes.json();

      // Try to get instance info for the connected number
      let ownerNumber = null;
      try {
        const infoRes = await fetch(
          `${provider.api_url}/instance/fetchInstances?instanceName=${encodeURIComponent(provider.instance_name)}`,
          { headers: { apikey: provider.api_key } }
        );
        const infoData = await infoRes.json();
        const inst = Array.isArray(infoData) ? infoData[0] : infoData;
        ownerNumber = inst?.instance?.owner || inst?.owner || null;
      } catch (e) {
        console.warn("[instance_info] Could not fetch instance info:", e);
      }

      return new Response(JSON.stringify({
        success: true,
        status: stateData?.instance?.state || stateData?.state || "unknown",
        number: ownerNumber,
        instance_name: provider.instance_name,
        provider_id: provider.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: sync_contacts (Evolution — import contacts) ──
    if (action === "sync_contacts") {
      const body = await req.json();
      const { provider_id } = body;
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "sync_contacts only for Evolution API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch chats from Evolution
      const chatsRes = await fetch(
        `${provider.api_url}/chat/findChats/${encodeURIComponent(provider.instance_name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({}),
        }
      );
      const chats = await chatsRes.json();
      const total = Array.isArray(chats) ? chats.length : 0;
      console.log("[sync_contacts] chats count:", total);

      let imported = 0;
      let skipped = 0;

      if (Array.isArray(chats)) {
        // Filter valid individual chats and limit to 500
        const validChats: { phone: string; contactName: string | null }[] = [];
        for (const chat of chats) {
          if (validChats.length >= 500) break;
          const remoteJid = chat.id || chat.remoteJid || "";
          if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
            skipped++;
            continue;
          }
          const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
          if (!phone) { skipped++; continue; }
          validChats.push({
            phone,
            contactName: chat.name || chat.pushName || chat.contact?.pushName || null,
          });
        }

        // Get existing phones in one query
        const phones = validChats.map(c => c.phone);
        const { data: existingRows } = await supabase
          .from("imphq_wa_conversations")
          .select("phone")
          .eq("project_id", provider.project_id)
          .in("phone", phones);
        const existingPhones = new Set((existingRows || []).map((r: any) => r.phone));

        // Build batch of new contacts
        const toInsert = validChats
          .filter(c => !existingPhones.has(c.phone))
          .map(c => ({
            phone: c.phone,
            contact_name: c.contactName,
            session: `evo-sync-${Date.now()}`,
            project_id: provider.project_id,
            status: "active",
            provider_id: provider.id,
            message_count: 0,
          }));

        skipped += validChats.length - toInsert.length;

        if (toInsert.length > 0) {
          // Insert in batches of 100
          for (let i = 0; i < toInsert.length; i += 100) {
            const batch = toInsert.slice(i, i + 100);
            const { error } = await supabase.from("imphq_wa_conversations").insert(batch);
            if (error) {
              console.warn("[sync_contacts] Batch insert error:", error.message);
              skipped += batch.length;
            } else {
              imported += batch.length;
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, imported, skipped, total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: webhook (receive messages) ──
    if (action === "webhook") {
      const body = await req.json();
      const providerType = url.searchParams.get("provider") || "evolution";

      let phone = "";
      let content = "";
      let projectId = "";
      let providerMsgId = "";
      let providerId: string | null = null;

      if (providerType === "evolution") {
        phone = body?.data?.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
        content = body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || "";
        providerMsgId = body?.data?.key?.id || "";
        const instanceName = body?.instance || "";
        const { data: prov } = await supabase
          .from("imphq_wa_providers")
          .select("id, project_id")
          .eq("instance_name", instanceName)
          .single();
        projectId = prov?.project_id || "";
        providerId = prov?.id || null;
      } else if (providerType === "twilio") {
        phone = (body?.From || "").replace("whatsapp:+", "");
        content = body?.Body || "";
        providerMsgId = body?.MessageSid || "";
      }

      if (phone && content && projectId) {
        // Find or create conversation
        const conv = await findOrCreateConversation(phone, projectId, providerId);

        const { error: msgError } = await supabase.from("imphq_wa_messages").insert({
          conversation_id: conv.id,
          direction: "incoming",
          phone,
          content,
          project_id: projectId,
          provider: providerType,
          provider_message_id: providerMsgId,
          status: "received",
        });

        if (msgError) {
          console.error("[webhook] DB save error:", msgError.message);
        }

        await updateConversationAfterMessage(conv.id, content, conv.message_count || 0);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: fetch_profile_pic ──
    if (action === "fetch_profile_pic") {
      const body = await req.json();
      const { provider_id, phone } = body;
      if (!provider_id || !phone) throw new Error("provider_id and phone required");
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ success: false, error: "Only Evolution API supports profile pics" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const inst = encodeURIComponent(provider.instance_name);
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`${provider.api_url}/chat/fetchProfilePictureUrl/${inst}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: provider.api_key },
        body: JSON.stringify({ number: cleanPhone }),
      });
      const data = await res.json();
      const picUrl = data?.profilePictureUrl || data?.picture || data?.imgUrl || null;

      // Cache in DB if found
      if (picUrl) {
        await supabase
          .from("imphq_wa_conversations")
          .update({ avatar_url: picUrl })
          .eq("phone", cleanPhone)
          .eq("project_id", provider.project_id);
      }

      return new Response(JSON.stringify({ success: true, avatar_url: picUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: fetch_avatars_batch ──
    if (action === "fetch_avatars_batch") {
      const body = await req.json();
      const { provider_id, phones } = body;
      if (!provider_id || !Array.isArray(phones)) throw new Error("provider_id and phones[] required");
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ success: true, results: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const inst = encodeURIComponent(provider.instance_name);
      const results: Record<string, string | null> = {};

      // Process in small batches to avoid timeouts (max 20)
      const batch = phones.slice(0, 20);
      for (const phone of batch) {
        try {
          const cleanPhone = phone.replace(/\D/g, "");
          const res = await fetch(`${provider.api_url}/chat/fetchProfilePictureUrl/${inst}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify({ number: cleanPhone }),
          });
          const data = await res.json();
          const picUrl = data?.profilePictureUrl || data?.picture || data?.imgUrl || null;
          results[cleanPhone] = picUrl;

          if (picUrl) {
            await supabase
              .from("imphq_wa_conversations")
              .update({ avatar_url: picUrl })
              .eq("phone", cleanPhone)
              .eq("project_id", provider.project_id);
          }
        } catch (e) {
          console.warn("[fetch_avatars_batch] Error for", phone, e);
          results[phone] = null;
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action not found: " + action }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("whatsapp-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
