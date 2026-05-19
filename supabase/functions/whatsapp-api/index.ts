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

    // Also check body for action (supabase.functions.invoke sends in body)
    if (!action && req.method === "POST") {
      try {
        const cloned = req.clone();
        const bodyJson = await cloned.json();
        if (bodyJson?.action) action = bodyJson.action;
      } catch (_) { /* ignore parse errors */ }
    }

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
        .maybeSingle();

      if (existing) return existing;

      // Upsert (race-safe): if another concurrent request created it, return the existing row
      const { data: created, error } = await supabase
        .from("imphq_wa_conversations")
        .upsert({
          phone: cleanPhone,
          contact_name: contactName || null,
          session: `session-${Date.now()}`,
          project_id: projectId,
          status: "active",
          provider_id: providerId,
          message_count: 0,
        }, { onConflict: "project_id,phone", ignoreDuplicates: false })
        .select()
        .single();

      if (error) {
        // Fallback: another request won the race — fetch it
        const { data: raced } = await supabase
          .from("imphq_wa_conversations")
          .select("*")
          .eq("phone", cleanPhone)
          .eq("project_id", projectId)
          .maybeSingle();
        if (raced) return raced;
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

    // ── Helper: detect transient connection errors from Evolution ──
    function isTransientConnError(payload: string): boolean {
      const s = payload.toLowerCase();
      return s.includes("connection closed") || s.includes("connection lost")
        || s.includes("connection replaced") || s.includes("timed out")
        || s.includes("timeout") || s.includes("socket") || s.includes("econnreset");
    }

    // ── Helper: try to wake up Evolution instance (soft reconnect) ──
    async function tryReconnectInstance(provider: any): Promise<boolean> {
      try {
        const inst = encodeURIComponent(provider.instance_name);
        const url = `${provider.api_url}/instance/connect/${inst}`;
        const res = await fetch(url, { method: "GET", headers: { apikey: provider.api_key } });
        console.log("[tryReconnectInstance] status:", res.status);
        return res.ok;
      } catch (e) {
        console.warn("[tryReconnectInstance] failed:", (e as Error).message);
        return false;
      }
    }

    // ── Helper: sleep ──
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // ── Helper: send via Evolution API (text) with retry + auto-reconnect ──
    async function sendEvolution(provider: any, phone: string, text: string) {
      const inst = encodeURIComponent(provider.instance_name);
      const apiUrl = `${provider.api_url}/message/sendText/${inst}`;
      console.log("[sendEvolution] URL:", apiUrl, "phone:", phone, "textLen:", text.length);

      const MAX_ATTEMPTS = 3;
      let lastErr: string = "";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({ number: phone, text }),
        });
        const data = await res.json().catch(() => ({}));
        console.log(`[sendEvolution] attempt=${attempt} status=${res.status}`, JSON.stringify(data).slice(0, 300));

        if (res.ok) return data;

        const msgs = data?.response?.message;
        if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
          return { ok: false, error: "invalid_number", details: msgs };
        }

        const payload = JSON.stringify(data);
        lastErr = `Evolution error [${res.status}]: ${payload}`;

        // Only retry transient connection errors
        if (!isTransientConnError(payload) && res.status !== 408 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
          throw new Error(lastErr);
        }

        if (attempt < MAX_ATTEMPTS) {
          // Try waking the instance up before next attempt
          await tryReconnectInstance(provider);
          await sleep(800 * attempt); // 800ms, 1600ms backoff
        }
      }
      throw new Error(lastErr || "Evolution: falha após múltiplas tentativas");
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

    // ── Helper: normalize BR phone (ensure 55 prefix) ──
    function normalizeBRPhone(raw: string): string {
      const digits = raw.replace(/\D/g, "");
      // Already has country code 55
      if (digits.startsWith("55") && digits.length >= 12) return digits;
      // Has only DDD + number (10 or 11 digits)
      if (digits.length === 10 || digits.length === 11) return "55" + digits;
      return digits;
    }

    // ── ACTION: send_message ──
    if (action === "send_message") {
      const body = await req.json();
      const { provider_id, phone: rawPhone, content, conversation_id, project_id, media_url, media_type, _no_failover } = body;
      const phone = normalizeBRPhone(rawPhone || "");
      let provider = await getProvider(provider_id);
      let usedFailover = false;
      let originalProviderName: string | null = null;

      // Helper to actually send via given provider
      async function attemptSend(p: any) {
        if (media_url && p.provider === "evolution") {
          return await sendEvolutionMedia(p, phone, media_url, media_type || "image", content || undefined);
        } else if (p.provider === "evolution") {
          return await sendEvolution(p, phone, content);
        } else {
          return await sendTwilio(p, phone, content);
        }
      }

      // Send via provider (media or text)
      let result;
      try {
        result = await attemptSend(provider);
      } catch (sendErr: any) {
        console.error("[send_message] provider error:", sendErr.message);
        const isConnectionClosed = isTransientConnError(sendErr.message || "");

        // ── AUTO FAILOVER ── try sibling providers in same project (if not disabled)
        if (!_no_failover && project_id) {
          const { data: siblings } = await supabase
            .from("imphq_wa_providers")
            .select("*")
            .eq("project_id", project_id || provider.project_id)
            .eq("is_active", true)
            .neq("id", provider.id)
            .order("last_seen_at", { ascending: false, nullsFirst: false });

          for (const sib of (siblings || [])) {
            try {
              if (sib.api_url) sib.api_url = sib.api_url.replace(/\/+$/, "");
              const r = await attemptSend(sib);
              if (r && r.ok !== false) {
                console.log(`[send_message] failover success: ${provider.instance_name} → ${sib.instance_name}`);
                originalProviderName = provider.instance_name || provider.id;
                provider = sib;
                result = r;
                usedFailover = true;
                break;
              }
            } catch (e: any) {
              console.warn(`[send_message] failover attempt failed on ${sib.instance_name}:`, e.message);
            }
          }
        }

        if (!result) {
          if (isConnectionClosed) {
            await supabase.from("imphq_events").insert({
              type: "wa_session_disconnected",
              entity_type: "wa_provider",
              entity_id: provider.id,
              metadata: { instance: provider.instance_name, error: sendErr.message?.slice(0, 300) },
            }).then(() => {}, () => {});
          }
          return new Response(JSON.stringify({
            success: false,
            error: isConnectionClosed
              ? "Sessão WhatsApp desconectada e nenhum chip alternativo disponível. Reconecte via QR Code."
              : `Falha ao enviar: ${sendErr.message}`,
            fallback: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

      // Mark provider as healthy
      await supabase.from("imphq_wa_providers")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", provider.id).then(() => {}, () => {});

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
      if (usedFailover) {
        msgPayload.metadata = { failover_from: originalProviderName, sent_via: provider.instance_name };
      }

      const { error: msgError } = await supabase.from("imphq_wa_messages").insert(msgPayload);

      if (msgError) {
        console.error("[send_message] DB save error:", msgError.message);
        throw new Error("Mensagem enviada mas falhou ao salvar: " + msgError.message);
      }

      // Update conversation metadata
      await updateConversationAfterMessage(conv.id, content || "📎 Mídia", conv.message_count || 0);

      return new Response(JSON.stringify({
        success: true,
        result,
        conversation_id: conv.id,
        failover: usedFailover,
        sent_via: usedFailover ? provider.instance_name : undefined,
        original_provider: usedFailover ? originalProviderName : undefined,
      }), {
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

    // ── ACTION: restart_instance (Evolution — força reconexão) ──
    if (action === "restart_instance") {
      const body = await req.json().catch(() => ({}));
      const providerId = body.provider_id || url.searchParams.get("provider_id");
      if (!providerId) throw new Error("provider_id required");
      const provider = await getProvider(providerId);
      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "Apenas Evolution" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Tenta logout (encerra sessão WA) e depois connect (gera novo QR)
      try {
        await fetch(`${provider.api_url}/instance/logout/${encodeURIComponent(provider.instance_name)}`, { method: "DELETE", headers: { apikey: provider.api_key } });
      } catch (e) { console.warn("[restart] logout fail:", e); }
      let connectData: any = null;
      try {
        const res = await fetch(`${provider.api_url}/instance/connect/${encodeURIComponent(provider.instance_name)}`, { headers: { apikey: provider.api_key } });
        connectData = await res.json();
      } catch (e) { console.warn("[restart] connect fail:", e); }
      return new Response(JSON.stringify({ success: true, data: connectData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: delete_instance (Evolution — apaga instância remota + provider local) ──
    if (action === "delete_instance") {
      const body = await req.json().catch(() => ({}));
      const providerId = body.provider_id || url.searchParams.get("provider_id");
      if (!providerId) throw new Error("provider_id required");
      const provider = await getProvider(providerId);
      if (provider.provider === "evolution") {
        try {
          await fetch(`${provider.api_url}/instance/logout/${encodeURIComponent(provider.instance_name)}`, { method: "DELETE", headers: { apikey: provider.api_key } });
        } catch {}
        try {
          await fetch(`${provider.api_url}/instance/delete/${encodeURIComponent(provider.instance_name)}`, { method: "DELETE", headers: { apikey: provider.api_key } });
        } catch (e) { console.warn("[delete_instance] remote fail:", e); }
      }
      // Cascade: remove dependentes antes do provider (FK restrict)
      const { data: convs } = await supabase.from("imphq_wa_conversations").select("id").eq("provider_id", providerId);
      const convIds = (convs || []).map((c: any) => c.id);
      if (convIds.length) {
        await supabase.from("imphq_wa_messages").delete().in("conversation_id", convIds);
      }
      await supabase.from("imphq_wa_conversations").delete().eq("provider_id", providerId);
      await supabase.from("imphq_wa_instances").delete().eq("provider_id", providerId).then(() => {}, () => {});
      const { error } = await supabase.from("imphq_wa_providers").delete().eq("id", providerId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
            const { error } = await supabase.from("imphq_wa_conversations").upsert(batch, { onConflict: "project_id,phone", ignoreDuplicates: true });
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

          // ── Fire-and-forget triagem IA ──
          try {
            const { data: leadRow } = await supabase
              .from("imphq_leads")
              .select("id")
              .eq("telefone", phone)
              .eq("projeto_id", projectId)
              .maybeSingle();
            supabase.functions.invoke("wa-ai-triage", {
              body: {
                message: content,
                conversation_id: conv.id,
                lead_id: leadRow?.id || null,
                projeto_id: projectId,
              },
            }).catch((e: any) => console.warn("[webhook] triagem invoke error:", e?.message));
          } catch (tErr: any) {
            console.warn("[webhook] triagem skip:", tErr?.message);
          }

          // ── Auto-reply by command ──
          let matched: any = null;
          try {
            const lowerContent = content.toLowerCase().trim();
            const { data: commands } = await supabase
              .from("imphq_wa_commands")
              .select("*")
              .eq("project_id", projectId)
              .eq("is_active", true);

            if (commands && commands.length > 0) {
              matched = commands.find((cmd: any) =>
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

          // ── AI Autoresponder (com trava anti-loop + debounce) ──
          try {
            if (!matched && phone && content && projectId && providerId) {
              const { data: aiConfig } = await supabase
                .from("imphq_wa_ai_config")
                .select("*")
                .eq("project_id", projectId)
                .eq("enabled", true)
                .maybeSingle();

              const cooldownSec = (aiConfig as any)?.cooldown_seconds ?? 15;
              const debounceSec = (aiConfig as any)?.debounce_seconds ?? 6;

              // Cooldown pós-resposta: se IA respondeu há <Ns, ignora
              const { data: convState } = await supabase
                .from("imphq_wa_conversations")
                .select("ai_last_reply_at")
                .eq("id", conv.id)
                .maybeSingle();
              if ((convState as any)?.ai_last_reply_at) {
                const last = new Date((convState as any).ai_last_reply_at).getTime();
                if (Date.now() - last < cooldownSec * 1000) {
                  console.log(`[webhook] AI cooldown active (${cooldownSec}s), skip ${phone}`);
                  return new Response(JSON.stringify({ success: true, skipped: "cooldown" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }

              // Trava atômica (CAS): só 1 webhook por conversa entra ao mesmo tempo
              if (aiConfig) {
                const lockUntilIso = new Date(Date.now() + (debounceSec + 20) * 1000).toISOString();
                const { data: lockRow } = await supabase
                  .from("imphq_wa_conversations")
                  .update({ ai_lock_until: lockUntilIso })
                  .eq("id", conv.id)
                  .or(`ai_lock_until.is.null,ai_lock_until.lt.${new Date().toISOString()}`)
                  .select("id")
                  .maybeSingle();
                if (!lockRow) {
                  console.log(`[webhook] AI lock held by other webhook, skip ${phone}`);
                  return new Response(JSON.stringify({ success: true, skipped: "locked" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }

                // Debounce: aguarda Ns e verifica se chegou msg mais nova → se sim, aborta
                if (debounceSec > 0) {
                  await new Promise(r => setTimeout(r, debounceSec * 1000));
                  const { data: newer } = await supabase
                    .from("imphq_wa_messages")
                    .select("created_at")
                    .eq("conversation_id", conv.id)
                    .eq("direction", "incoming")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (newer && (newer as any).created_at && new Date((newer as any).created_at).getTime() > incomingAt + 1000) {
                    console.log(`[webhook] Newer incoming msg arrived during debounce, skip ${phone}`);
                    await supabase.from("imphq_wa_conversations").update({ ai_lock_until: null }).eq("id", conv.id);
                    return new Response(JSON.stringify({ success: true, skipped: "debounced" }), {
                      headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                  }
                }
              }

              if (aiConfig) {
                // Check business hours
                let withinHours = true;
                if (aiConfig.business_hours_only) {
                  const now = new Date();
                  const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                  const currentHour = brTime.getHours() * 100 + brTime.getMinutes();
                  const [sh, sm] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
                  const [eh, em] = (aiConfig.business_hours_end || "20:00").split(":").map(Number);
                  const startNum = sh * 100 + sm;
                  const endNum = eh * 100 + em;
                  withinHours = currentHour >= startNum && currentHour <= endNum;
                }

                // Check escalation keywords
                const lc = content.toLowerCase();
                const isEscalation = (aiConfig.escalation_keywords || []).some((kw: string) =>
                  lc.includes(kw.toLowerCase())
                );

                if (withinHours && !isEscalation) {
                  // Build context from project
                  let projectContext = "";
                  const { data: project } = await supabase
                    .from("imphq_projects")
                    .select("name, data, avatar, brand_kit")
                    .eq("id", projectId)
                    .single();

                  if (project) {
                    const sources = aiConfig.context_sources || [];
                    const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
                    if (sources.includes("briefing") && d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 600)}\n`;
                    if (sources.includes("produtos") && d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 600)}\n`;
                    if (sources.includes("avatar") && project.avatar) projectContext += `Avatar: ${JSON.stringify(project.avatar).slice(0, 400)}\n`;
                    if (sources.includes("branding") && project.brand_kit) projectContext += `Branding: ${JSON.stringify(project.brand_kit).slice(0, 400)}\n`;
                    if (sources.includes("copy_arsenal")) {
                      const ca = d.copy_arsenal || (d.produtos?.[0]?.copy_arsenal);
                      if (ca) projectContext += `Copy Arsenal: ${JSON.stringify(ca).slice(0, 400)}\n`;
                    }
                  }

                  // Get recent conversation history for context
                  const { data: recentMsgs } = await supabase
                    .from("imphq_wa_messages")
                    .select("direction, content")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(10);

                  const chatHistory = (recentMsgs || []).reverse().map((m: any) =>
                    `${m.direction === "incoming" ? "Lead" : "Você"}: ${m.content}`
                  ).join("\n");

                  const personalityPrompts: Record<string, string> = {
                    assistente: "Você é um assistente virtual cordial e prestativo.",
                    vendedor: "Você é um closer de vendas persuasivo mas não agressivo. Foque em entender a dor e apresentar a solução.",
                    suporte: "Você é um agente de suporte técnico eficiente e empático.",
                    consultor: "Você é um consultor especialista. Fale com autoridade e dê recomendações valiosas.",
                  };

                  const toneInstructions: Record<string, string> = {
                    profissional: "Tom profissional e direto.",
                    casual: "Tom casual e descontraído, use emojis moderadamente.",
                    amigavel: "Tom amigável e acolhedor, use emojis.",
                    formal: "Tom formal e respeitoso.",
                    urgente: "Tom de urgência e escassez.",
                  };

                  const systemPrompt = `${personalityPrompts[aiConfig.personality] || personalityPrompts.assistente}
${toneInstructions[aiConfig.tone] || toneInstructions.profissional}
Você está respondendo via WhatsApp para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${aiConfig.welcome_message ? `\nMensagem de boas-vindas padrão: ${aiConfig.welcome_message}` : ""}
REGRAS:
- Responda em português brasileiro
- Seja CONCISO (máx 2-3 parágrafos curtos)
- Use WhatsApp formatting: *negrito*, _itálico_
- NUNCA invente informações sobre produtos/preços que não estejam no contexto
- Se não souber a resposta, diga que vai encaminhar para um atendente humano
- Se o lead pedir para falar com humano, diga que está encaminhando`;

                  const messages = [
                    { role: "system", content: systemPrompt },
                  ];

                  if (chatHistory) {
                    messages.push({ role: "user", content: `Histórico recente:\n${chatHistory}\n\nNova mensagem do lead: ${content}` });
                  } else {
                    messages.push({ role: "user", content: content });
                  }

                  // Call AI Gateway
                  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
                  if (LOVABLE_API_KEY) {
                    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        model: "google/gemini-3-flash-preview",
                        messages,
                        max_tokens: aiConfig.max_tokens || 300,
                      }),
                    });

                    if (aiRes.ok) {
                      const aiData = await aiRes.json();
                      const aiReply = aiData.choices?.[0]?.message?.content || "";

                      if (aiReply.trim()) {
                        // Delay before sending
                        const delay = (aiConfig.response_delay_seconds || 3) * 1000;
                        if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay, 10000)));

                        // Send via Evolution
                        const { data: provAI } = await supabase
                          .from("imphq_wa_providers")
                          .select("api_url, api_key, instance_name, provider")
                          .eq("id", providerId)
                          .single();

                        if (provAI && provAI.provider === "evolution") {
                          const aiApiBase = provAI.api_url.replace(/\/+$/, "");
                          const aiInst = encodeURIComponent(provAI.instance_name);
                          await fetch(`${aiApiBase}/message/sendText/${aiInst}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", apikey: provAI.api_key },
                            body: JSON.stringify({ number: phone + "@s.whatsapp.net", text: aiReply }),
                          });

                          // Save AI response to DB
                          await supabase.from("imphq_wa_messages").insert({
                            conversation_id: conv.id,
                            direction: "outgoing",
                            phone,
                            content: aiReply,
                            message_type: "text",
                            project_id: projectId,
                            provider: "evolution",
                            status: "sent",
                          });

                          await updateConversationAfterMessage(conv.id, aiReply, (conv.message_count || 0) + 1);
                          console.log(`[webhook] AI auto-reply sent to ${phone} (${aiReply.length} chars)`);
                        }
                      }
                    } else {
                      const errText = await aiRes.text();
                      console.warn(`[webhook] AI gateway error ${aiRes.status}:`, errText.slice(0, 200));
                    }
                  }
                } else if (isEscalation) {
                  console.log(`[webhook] Escalation keyword detected from ${phone}, skipping AI`);
                }
              }
            }
          } catch (aiErr: any) {
            console.warn("[webhook] AI autoresponder error:", aiErr.message);
          }
        } else {
          console.log(`[webhook] Skipped: phone=${phone} content=${!!content} project=${projectId}`);
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

      // Process in parallel with per-request timeout to avoid 150s edge timeout
      const batch = phones.slice(0, 15);
      await Promise.allSettled(batch.map(async (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, "");
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
          const res = await fetch(`${provider.api_url}/chat/fetchProfilePictureUrl/${inst}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify({ number: cleanPhone }),
            signal: ctrl.signal,
          });
          const data = await res.json().catch(() => ({}));
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
          console.warn("[fetch_avatars_batch] Error for", phone, (e as Error).message);
          results[cleanPhone] = null;
        } finally {
          clearTimeout(t);
        }
      }));


      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: fetch_groups (Evolution — list groups) ──
    if (action === "fetch_groups") {
      const body = await req.json();
      const { provider_id } = body;
      if (!provider_id) throw new Error("provider_id required");
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "fetch_groups only for Evolution API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const inst = encodeURIComponent(provider.instance_name);
      const res = await fetch(
        `${provider.api_url}/group/fetchAllGroups/${inst}?getParticipants=false`,
        { headers: { apikey: provider.api_key } }
      );
      const data = await res.json();
      const groups = (Array.isArray(data) ? data : []).map((g: any) => ({
        id: g.id || g.jid,
        subject: g.subject || g.name || g.id,
      }));

      return new Response(JSON.stringify({ success: true, groups }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: sync_messages — import histórico do chip ──
    if (action === "sync_messages") {
      const body = await req.json();
      const { provider_id, days = 30 } = body;
      const provider = await getProvider(provider_id);
      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "sync_messages só disponível para Evolution" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiBase = provider.api_url.replace(/\/+$/, "");
      const inst = encodeURIComponent(provider.instance_name);
      const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

      // Evolution: POST /chat/findMessages/{instance} retorna paginado
      let imported = 0;
      let skipped = 0;
      let convsCreated = 0;
      let page = 1;
      const pageSize = 100;
      const maxPages = 50; // ceiling 5000 msgs por chip

      while (page <= maxPages) {
        let msgs: any[] = [];
        try {
          const res = await fetch(`${apiBase}/chat/findMessages/${inst}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify({ where: {}, page, offset: pageSize }),
          });
          if (!res.ok) {
            console.warn(`[sync_messages] page ${page} status ${res.status}`);
            break;
          }
          const data = await res.json();
          // Evolution pode retornar array direto OU { messages: { records: [...] } }
          if (Array.isArray(data)) msgs = data;
          else if (Array.isArray(data?.messages)) msgs = data.messages;
          else if (Array.isArray(data?.messages?.records)) msgs = data.messages.records;
          else msgs = [];
        } catch (e: any) {
          console.warn(`[sync_messages] fetch page ${page} error:`, e?.message);
          break;
        }

        if (msgs.length === 0) break;

        // Cache de conversations por phone pra evitar lookup repetido
        const convCache = new Map<string, string>();

        for (const m of msgs) {
          try {
            const key = m.key || {};
            const remoteJid = key.remoteJid || m.remoteJid || "";
            if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
              skipped++; continue;
            }
            const phone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            if (!phone) { skipped++; continue; }
            const providerMsgId = key.id || m.id || "";
            if (!providerMsgId) { skipped++; continue; }

            // Timestamp em segundos ou ms
            const tsRaw = m.messageTimestamp || m.timestamp || 0;
            const tsMs = tsRaw > 1e12 ? tsRaw : tsRaw * 1000;
            if (tsMs && tsMs < sinceTs) { skipped++; continue; }

            const msg = m.message || {};
            let content = ""; let messageType = "text";
            if (msg.conversation) content = msg.conversation;
            else if (msg.extendedTextMessage?.text) content = msg.extendedTextMessage.text;
            else if (msg.imageMessage) { content = msg.imageMessage.caption || "📷 Imagem"; messageType = "image"; }
            else if (msg.audioMessage) { content = msg.audioMessage.ptt ? "🎤 Áudio" : "🔊 Áudio"; messageType = "audio"; }
            else if (msg.videoMessage) { content = msg.videoMessage.caption || "🎬 Vídeo"; messageType = "video"; }
            else if (msg.documentMessage) { content = `📎 ${msg.documentMessage.fileName || "arquivo"}`; messageType = "document"; }
            else if (msg.stickerMessage) { content = "🏷️ Sticker"; messageType = "sticker"; }
            else if (msg.locationMessage) { content = "📍 Localização"; messageType = "location"; }
            else { skipped++; continue; }

            if (!content) { skipped++; continue; }

            // Conversation: lookup ou create
            let convId = convCache.get(phone);
            if (!convId) {
              const { data: existConv } = await supabase
                .from("imphq_wa_conversations")
                .select("id")
                .eq("project_id", provider.project_id)
                .eq("phone", phone)
                .eq("provider_id", provider.id)
                .maybeSingle();
              if (existConv) {
                convId = existConv.id;
              } else {
                const { data: newConv, error: cErr } = await supabase
                  .from("imphq_wa_conversations")
                  .upsert({
                    phone,
                    contact_name: m.pushName || null,
                    session: `evo-import-${Date.now()}`,
                    project_id: provider.project_id,
                    provider_id: provider.id,
                    status: "active",
                    message_count: 0,
                  }, { onConflict: "project_id,phone", ignoreDuplicates: false })
                  .select("id")
                  .single();
                if (cErr || !newConv) {
                  // Race: fetch existing
                  const { data: raced } = await supabase
                    .from("imphq_wa_conversations")
                    .select("id")
                    .eq("project_id", provider.project_id)
                    .eq("phone", phone)
                    .maybeSingle();
                  if (raced) { convId = raced.id; }
                  else { skipped++; continue; }
                } else {
                  convId = newConv.id;
                }
                convsCreated++;
              }
              convCache.set(phone, convId!);
            }

            // Insert message (dedup via unique index em provider_message_id)
            const { error: insErr } = await supabase.from("imphq_wa_messages").insert({
              conversation_id: convId,
              direction: key.fromMe ? "outgoing" : "incoming",
              phone,
              content: content.slice(0, 4000),
              message_type: messageType,
              project_id: provider.project_id,
              provider: "evolution",
              provider_message_id: providerMsgId,
              status: key.fromMe ? "sent" : "received",
              created_at: tsMs ? new Date(tsMs).toISOString() : new Date().toISOString(),
            });
            if (insErr) {
              if (insErr.code === "23505") skipped++;
              else { console.warn("[sync_messages] insert err:", insErr.message); skipped++; }
            } else {
              imported++;
            }
          } catch (mErr: any) {
            console.warn("[sync_messages] msg error:", mErr?.message);
            skipped++;
          }
        }

        if (msgs.length < pageSize) break;
        page++;
      }

      console.log(`[sync_messages] done provider=${provider.instance_name} imported=${imported} skipped=${skipped} convs=${convsCreated}`);
      return new Response(
        JSON.stringify({ success: true, imported, skipped, conversations_created: convsCreated, pages: page }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
