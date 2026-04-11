import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    // ── Detect Evolution "Webhook by Events" paths ──
    // Evolution appends event names to URL path: /whatsapp-api/MESSAGES_UPSERT
    const EVOLUTION_EVENTS = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE", "CONTACTS_UPSERT", "CONTACTS_UPDATE", "PRESENCE_UPDATE", "CHATS_UPSERT", "CHATS_UPDATE", "CHATS_DELETE", "GROUPS_UPSERT", "GROUPS_UPDATE", "CALL", "TYPEBOT_START", "TYPEBOT_CHANGE_STATUS"];
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || "";
    const evolutionEventFromPath = EVOLUTION_EVENTS.includes(lastSegment) ? lastSegment : null;

    // If we detected an Evolution event in the path, treat as webhook
    if (evolutionEventFromPath && !action) {
      action = "webhook";
    }

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

    // ── Helper: send via Evolution API (text) ──
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
        const msgs = data?.response?.message;
        if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
          return { ok: false, error: "invalid_number", details: msgs };
        }
        throw new Error(`Evolution error [${res.status}]: ${JSON.stringify(data)}`);
      }
      return data;
    }

    // ── Helper: send media via Evolution API ──
    async function sendEvolutionMedia(provider: any, phone: string, mediaUrl: string, mediaType: string, caption?: string) {
      const inst = encodeURIComponent(provider.instance_name);
      const endpoint = mediaType === "audio" ? "sendWhatsAppAudio" : "sendMedia";
      const apiUrl = `${provider.api_url}/message/${endpoint}/${inst}`;
      console.log("[sendEvolutionMedia] URL:", apiUrl, "phone:", phone, "mediaType:", mediaType);
      
      const body: any = { number: phone, mediatype: mediaType, media: mediaUrl };
      if (caption) body.caption = caption;
      if (mediaType === "document") body.fileName = caption || "document";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: provider.api_key },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log("[sendEvolutionMedia] status:", res.status, "response:", JSON.stringify(data).slice(0, 500));
      if (!res.ok) {
        const msgs = data?.response?.message;
        if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
          return { ok: false, error: "invalid_number", details: msgs };
        }
        throw new Error(`Evolution media error [${res.status}]: ${JSON.stringify(data)}`);
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
      const { provider_id, phone, content, conversation_id, project_id, media_url, media_type } = body;
      const provider = await getProvider(provider_id);

      // Send via provider (media or text)
      let result;
      if (media_url && provider.provider === "evolution") {
        result = await sendEvolutionMedia(provider, phone, media_url, media_type || "image", content || undefined);
      } else if (provider.provider === "evolution") {
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
      const msgPayload: any = {
        conversation_id: conv.id,
        direction: "outgoing",
        phone,
        content: content || (media_url ? "Mídia" : ""),
        project_id: project_id || provider.project_id,
        provider: provider.provider,
        provider_message_id: result?.key?.id || result?.sid || null,
        status: "sent",
      };
      if (media_url) {
        msgPayload.message_type = media_type || "image";
        msgPayload.media_url = media_url;
      }

      const { error: msgError } = await supabase.from("imphq_wa_messages").insert(msgPayload);

      if (msgError) {
        console.error("[send_message] DB save error:", msgError.message);
        throw new Error("Mensagem enviada mas falhou ao salvar: " + msgError.message);
      }

      // Update conversation metadata
      await updateConversationAfterMessage(conv.id, content || "📎 Mídia", conv.message_count || 0);

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
        // Filter valid individual chats and limit to 50 per batch (rate limiting)
        const validChats: { phone: string; contactName: string | null }[] = [];
        for (const chat of chats) {
          if (validChats.length >= 50) break;
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

    // ── ACTION: webhook (receive messages, status updates, connection events) ──
    if (action === "webhook") {
      const body = await req.json();
      // Normalize providerType — extract just "evolution" or "twilio" (strip path segments like "evolution/messages-upsert")
      const rawProvider = url.searchParams.get("provider") || "evolution";
      const providerType = rawProvider.split("/")[0].toLowerCase();

      // Normalize eventType — map "messages.upsert" → "MESSAGES_UPSERT"
      const rawEventType = evolutionEventFromPath || body?.event || "MESSAGES_UPSERT";
      const eventType = rawEventType.toUpperCase().replace(/[.\-]/g, "_");
      const instanceName = body?.instance || "";

      console.log(`[webhook] event=${eventType} instance=${instanceName} provider=${providerType}`);

      // ── MESSAGES_UPSERT — incoming message ──
      if (providerType === "evolution" && (eventType === "MESSAGES_UPSERT" || eventType === "SEND_MESSAGE")) {
        const key = body?.data?.key;
        const msg = body?.data?.message;
        const pushName = body?.data?.pushName || "";

        // Skip outgoing messages (fromMe) to avoid duplicates
        if (key?.fromMe && eventType === "MESSAGES_UPSERT") {
          console.log("[webhook] Skipping fromMe message");
          return new Response(JSON.stringify({ success: true, skipped: "fromMe" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const phone = (key?.remoteJid || "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
        const providerMsgId = key?.id || "";

        // Extract content from various message types
        let content = "";
        let messageType = "text";

        if (msg?.conversation) {
          content = msg.conversation;
        } else if (msg?.extendedTextMessage?.text) {
          content = msg.extendedTextMessage.text;
        } else if (msg?.imageMessage) {
          content = msg.imageMessage.caption ? `📷 ${msg.imageMessage.caption}` : "📷 Imagem";
          messageType = "image";
        } else if (msg?.audioMessage) {
          const duration = msg.audioMessage.seconds ? ` (${msg.audioMessage.seconds}s)` : "";
          content = msg.audioMessage.ptt ? `🎤 Áudio${duration}` : `🔊 Áudio${duration}`;
          messageType = "audio";
        } else if (msg?.videoMessage) {
          content = msg.videoMessage.caption ? `🎬 ${msg.videoMessage.caption}` : "🎬 Vídeo";
          messageType = "video";
        } else if (msg?.documentMessage) {
          const fileName = msg.documentMessage.fileName || "arquivo";
          content = `📎 ${fileName}`;
          messageType = "document";
        } else if (msg?.stickerMessage) {
          content = "🏷️ Sticker";
          messageType = "sticker";
        } else if (msg?.contactMessage) {
          content = `👤 Contato: ${msg.contactMessage.displayName || ""}`;
          messageType = "contact";
        } else if (msg?.locationMessage) {
          content = `📍 Localização`;
          messageType = "location";
        }

        // Look up provider
        const { data: prov } = await supabase
          .from("imphq_wa_providers")
          .select("id, project_id")
          .eq("instance_name", instanceName)
          .single();
        const projectId = prov?.project_id || "";
        const providerId = prov?.id || null;

        if (phone && content && projectId) {
          const conv = await findOrCreateConversation(phone, projectId, providerId, pushName || undefined);

          // Try to download media and upload to Supabase Storage
          let mediaUrl: string | null = null;
          if (messageType !== "text" && messageType !== "contact" && messageType !== "location" && messageType !== "sticker") {
            try {
              const { data: provData } = await supabase
                .from("imphq_wa_providers")
                .select("api_url, api_key, instance_name")
                .eq("id", providerId)
                .single();

              if (provData?.api_url && provData?.api_key) {
                const apiBase = provData.api_url.replace(/\/+$/, "");
                const inst = encodeURIComponent(provData.instance_name);
                const mediaRes = await fetch(`${apiBase}/chat/getBase64FromMediaMessage/${inst}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: provData.api_key },
                  body: JSON.stringify({ message: { key, message: msg } }),
                });
                
                if (mediaRes.ok) {
                  const mediaData = await mediaRes.json();
                  const base64 = mediaData?.base64 || mediaData?.data;
                  const mimetype = mediaData?.mimetype || "application/octet-stream";
                  
                  if (base64) {
                    const extMap: Record<string, string> = {
                      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
                      "video/mp4": "mp4", "application/pdf": "pdf",
                    };
                    const ext = extMap[mimetype] || mimetype.split("/")[1] || "bin";
                    const filePath = `${projectId}/${conv.id}/${providerMsgId || Date.now()}.${ext}`;
                    
                    const binaryStr = atob(base64);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                    
                    const { error: uploadError } = await supabase.storage
                      .from("whatsapp-media")
                      .upload(filePath, bytes, { contentType: mimetype, upsert: true });
                    
                    if (!uploadError) {
                      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
                      mediaUrl = urlData?.publicUrl || null;
                      console.log(`[webhook] Media uploaded: ${mediaUrl}`);
                    } else {
                      console.warn("[webhook] Media upload error:", uploadError.message);
                    }
                  }
                } else {
                  console.warn("[webhook] Failed to fetch media base64:", mediaRes.status);
                }
              }
            } catch (mediaErr: any) {
              console.warn("[webhook] Media download error:", mediaErr.message);
            }
          }

          const { error: msgError } = await supabase.from("imphq_wa_messages").insert({
            conversation_id: conv.id,
            direction: "incoming",
            phone,
            content,
            message_type: messageType,
            media_url: mediaUrl,
            project_id: projectId,
            provider: providerType,
            provider_message_id: providerMsgId,
            status: "received",
          });

          if (msgError) {
            console.error("[webhook] DB save error:", msgError.message);
          } else {
            console.log(`[webhook] Saved ${messageType} from ${phone} (conv=${conv.id}) media=${!!mediaUrl}`);
          }

          await updateConversationAfterMessage(conv.id, content, conv.message_count || 0);
        } else {
          console.log(`[webhook] Skipped: phone=${phone} content=${!!content} project=${projectId}`);
        }

          // ── Auto-reply by command ──
          try {
            const lowerContent = content.toLowerCase().trim();
            const { data: commands } = await supabase
              .from("imphq_wa_commands")
              .select("*")
              .eq("project_id", projectId)
              .eq("is_active", true);

            if (commands && commands.length > 0) {
              const matched = commands.find((cmd: any) =>
                lowerContent === cmd.trigger_word.toLowerCase() ||
                lowerContent.startsWith(cmd.trigger_word.toLowerCase() + " ")
              );
              if (matched && providerId) {
                const { data: provCmd } = await supabase
                  .from("imphq_wa_providers")
                  .select("api_url, api_key, instance_name")
                  .eq("id", providerId)
                  .single();
                if (provCmd) {
                  const cmdApiBase = provCmd.api_url.replace(/\/+$/, "");
                  const cmdInst = encodeURIComponent(provCmd.instance_name);
                  const cmdJid = phone + "@s.whatsapp.net";
                  await fetch(`${cmdApiBase}/message/sendText/${cmdInst}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: provCmd.api_key },
                    body: JSON.stringify({ number: cmdJid, text: matched.response_text || "" }),
                  });
                  console.log(`[webhook] Command auto-reply: "${matched.trigger_word}" → ${phone}`);
                }
              }
            }
          } catch (cmdErr: any) {
            console.warn("[webhook] Command auto-reply error:", cmdErr.message);
          }

        return new Response(JSON.stringify({ success: true, event: eventType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── MESSAGES_UPDATE — delivery/read status ──
      if (providerType === "evolution" && eventType === "MESSAGES_UPDATE") {
        const msgId = body?.data?.key?.id || body?.data?.keyId || "";
        const status = body?.data?.status || "";

        // Map Evolution numeric status to readable
        const statusMap: Record<string, string> = {
          "0": "error", "1": "pending", "2": "sent", "3": "delivered", "4": "read", "5": "played",
          "ERROR": "error", "PENDING": "pending", "SERVER_ACK": "sent",
          "DELIVERY_ACK": "delivered", "READ": "read", "PLAYED": "played",
        };
        const mappedStatus = statusMap[String(status)] || String(status);

        if (msgId && mappedStatus) {
          const { error, count } = await supabase
            .from("imphq_wa_messages")
            .update({ status: mappedStatus })
            .eq("provider_message_id", msgId);

          console.log(`[webhook] MESSAGES_UPDATE msgId=${msgId} status=${mappedStatus} updated=${count ?? "?"} err=${error?.message || "none"}`);
        }

        return new Response(JSON.stringify({ success: true, event: "MESSAGES_UPDATE" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── CONNECTION_UPDATE — session status changed ──
      if (providerType === "evolution" && eventType === "CONNECTION_UPDATE") {
        const state = body?.data?.state || body?.data?.status || "";
        // state can be: "open", "close", "connecting", "refused"

        if (instanceName && state) {
          const dbStatus = state === "open" ? "connected" : state === "close" ? "disconnected" : state;

          const { error } = await supabase
            .from("imphq_wa_providers")
            .update({ status: dbStatus, updated_at: new Date().toISOString() })
            .eq("instance_name", instanceName);

          console.log(`[webhook] CONNECTION_UPDATE instance=${instanceName} state=${state} dbStatus=${dbStatus} err=${error?.message || "none"}`);
        }

        return new Response(JSON.stringify({ success: true, event: "CONNECTION_UPDATE" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Twilio inbound ──
      if (providerType === "twilio") {
        const phone = (body?.From || "").replace("whatsapp:+", "");
        const content = body?.Body || "";
        const providerMsgId = body?.MessageSid || "";

        if (phone && content) {
          console.log(`[webhook] Twilio inbound from ${phone}`);
          // Twilio doesn't send instance, so we need project_id from query or lookup
        }

        return new Response(JSON.stringify({ success: true, event: "twilio_inbound" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── GROUP_PARTICIPANTS_UPDATE — detect exits ──
      if (providerType === "evolution" && eventType === "GROUP_PARTICIPANTS_UPDATE") {
        const participants = body?.data?.participants || body?.data?.affect || [];
        const action2 = body?.data?.action || "";
        const groupJid = body?.data?.id || body?.data?.jid || "";

        if (action2 === "remove" && groupJid && Array.isArray(participants)) {
          for (const p of participants) {
            const exitPhone = String(p).replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (!exitPhone) continue;

            // Save exit record
            await supabase.from("imphq_wa_group_exits").insert({
              group_jid: groupJid,
              phone: exitPhone,
              provider_id: null,
            });

            // Check if any campaign has exit_message for this group
            const { data: exitCampaigns } = await supabase
              .from("imphq_wa_campaigns")
              .select("id, exit_message, provider_id")
              .eq("status", "active")
              .not("exit_message", "is", null);

            if (exitCampaigns) {
              for (const ec of exitCampaigns) {
                const groups: string[] = (ec as any).groups || [];
                if (!groups.includes(groupJid)) continue;
                if (!ec.exit_message || !ec.provider_id) continue;

                // Send DM
                const { data: exitProv } = await supabase
                  .from("imphq_wa_providers")
                  .select("api_url, api_key, instance_name")
                  .eq("id", ec.provider_id)
                  .single();

                if (exitProv) {
                  const exitApi = exitProv.api_url.replace(/\/+$/, "");
                  const exitInst = encodeURIComponent(exitProv.instance_name);
                  try {
                    await fetch(`${exitApi}/message/sendText/${exitInst}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", apikey: exitProv.api_key },
                      body: JSON.stringify({ number: exitPhone + "@s.whatsapp.net", text: ec.exit_message }),
                    });
                    await supabase.from("imphq_wa_group_exits")
                      .update({ message_sent: true, campaign_id: ec.id })
                      .eq("phone", exitPhone)
                      .eq("group_jid", groupJid)
                      .eq("message_sent", false);
                    console.log(`[webhook] Exit DM sent to ${exitPhone} from campaign ${ec.id}`);
                  } catch (dmErr: any) {
                    console.warn(`[webhook] Exit DM error: ${dmErr.message}`);
                  }
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, event: "GROUP_PARTICIPANTS_UPDATE" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Other Evolution events — just log and acknowledge ──
      console.log(`[webhook] Unhandled event=${eventType} instance=${instanceName}`);
      return new Response(JSON.stringify({ success: true, event: eventType, handled: false }), {
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

      // Process in small batches to avoid timeouts and rate limits (max 15)
      const batch = phones.slice(0, 15);
      for (let idx = 0; idx < batch.length; idx++) {
        const phone = batch[idx];
        try {
          // Rate limit: 200ms delay between API calls
          if (idx > 0) await new Promise(r => setTimeout(r, 200));
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
