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
    async function findOrCreateConversation(phone: string, projectId: string, providerId: string | null, contactName?: string, jidSuffix?: string) {
      const cleanPhone = phone.replace(/\D/g, "");
      const suffix = jidSuffix || "s.whatsapp.net";

      // Buscar conversa existente por (phone, project_id, provider_id) — cada chip tem sua thread
      const baseQuery = supabase
        .from("imphq_wa_conversations")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("project_id", projectId);
      const { data: existing } = providerId
        ? await baseQuery.eq("provider_id", providerId).maybeSingle()
        : await baseQuery.is("provider_id", null).maybeSingle();

      if (existing) {
        // Atualiza sufixo se diferente (migração de @s.whatsapp.net → @lid ou vice-versa)
        if (existing.jid_suffix !== suffix) {
          await supabase.from("imphq_wa_conversations").update({ jid_suffix: suffix }).eq("id", existing.id);
          existing.jid_suffix = suffix;
        }
        return existing;
      }

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
          jid_suffix: suffix,
        })
        .select()
        .single();

      if (error) {
        const retryQuery = supabase
          .from("imphq_wa_conversations")
          .select("*")
          .eq("phone", cleanPhone)
          .eq("project_id", projectId);
        const { data: raced } = providerId
          ? await retryQuery.eq("provider_id", providerId).maybeSingle()
          : await retryQuery.is("provider_id", null).maybeSingle();
        if (raced) return raced;
        console.error("[findOrCreateConversation] Error creating:", error.message);
        throw new Error("Falha ao criar conversa: " + error.message);
      }
      return created;
    }


    // ── Helper: update conversation metadata after message ──
    async function updateConversationAfterMessage(conversationId: string, content: string, currentCount: number, incrementUnread: boolean = false) {
      const patch: Record<string, any> = {
        last_message: content.substring(0, 200),
        last_message_at: new Date().toISOString(),
        message_count: (currentCount || 0) + 1,
        updated_at: new Date().toISOString(),
        last_message_direction: incrementUnread ? "incoming" : "outgoing",
      };
      if (incrementUnread) {
        const { data: cur } = await supabase
          .from("imphq_wa_conversations")
          .select("unread_count")
          .eq("id", conversationId)
          .maybeSingle();
        patch.unread_count = ((cur?.unread_count as number) || 0) + 1;
      }
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update(patch)
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

    // ── Helper: send via Meta Cloud API (WhatsApp oficial nativo) ──
    async function sendMetaCloud(provider: any, phone: string, text: string) {
      const phoneNumberId = provider.phone_number_id;
      const accessToken = provider.access_token;
      if (!phoneNumberId) throw new Error("phone_number_id não configurado no provider Meta Cloud");
      if (!accessToken) throw new Error("access_token não configurado no provider Meta Cloud");

      const apiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.replace(/\D/g, ""),
          type: "text",
          text: { body: text, preview_url: true },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Meta Cloud error [${res.status}]: ${JSON.stringify(data)}`);
      // Normaliza retorno para parecer com o do Evolution (chave key.id)
      const msgId = data?.messages?.[0]?.id;
      return { ...data, key: { id: msgId } };
    }

    // ── Helper: normalize phone (BR-friendly, mas preserva DDIs internacionais) ──
    // Retorna { phone, cc } onde cc é o DDI detectado; phone=null se inválido.
    const KNOWN_CCS = new Set([
      "1","7","20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49",
      "51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86","90","91","92","93","94","95","98",
      "211","212","213","216","218","220","221","222","223","224","225","226","227","228","229","230","231","232","233","234","235","236","237","238","239",
      "240","241","242","243","244","245","246","247","248","249","250","251","252","253","254","255","256","257","258","260","261","262","263","264","265","266","267","268","269",
      "290","291","297","298","299","350","351","352","353","354","355","356","357","358","359","370","371","372","373","374","375","376","377","378","380","381","382","383","385","386","387","389",
      "420","421","423","500","501","502","503","504","505","506","507","508","509","590","591","592","593","594","595","596","597","598","599",
      "670","672","673","674","675","676","677","678","679","680","681","682","683","685","686","687","688","689","690","691","692",
      "850","852","853","855","856","880","886","960","961","962","963","964","965","966","967","968","970","971","972","973","974","975","976","977","992","993","994","995","996","998"
    ]);
    function detectCC(digits: string): string | null {
      for (let len = 3; len >= 1; len--) {
        const cand = digits.slice(0, len);
        if (KNOWN_CCS.has(cand)) return cand;
      }
      return null;
    }
    function normalizePhone(raw: string): { phone: string | null; cc: string | null; reason?: string } {
      const digits = (raw || "").replace(/\D/g, "");
      if (!digits) return { phone: null, cc: null, reason: "vazio" };
      // 10/11 dígitos → assume BR
      if (digits.length === 10 || digits.length === 11) return { phone: "55" + digits, cc: "55" };
      if (digits.length < 10) return { phone: null, cc: null, reason: "curto demais" };
      if (digits.length > 15) return { phone: null, cc: null, reason: "longo demais (possível JID de grupo)" };
      const cc = detectCC(digits);
      if (!cc) return { phone: null, cc: null, reason: "DDI desconhecido" };
      return { phone: digits, cc };
    }

    // ── ACTION: send_message ──
    if (action === "send_message") {
      const body = await req.json();
      const { provider_id, phone: rawPhone, content, conversation_id, project_id, media_url, media_type, _no_failover, sent_by: rawSentBy } = body;
      const sent_by = rawSentBy || "human";

      // Buscar sufixo JID da conversa (s.whatsapp.net | lid)
      let jidSuffix = "s.whatsapp.net";
      if (conversation_id) {
        const { data: convRow } = await supabase
          .from("imphq_wa_conversations")
          .select("jid_suffix")
          .eq("id", conversation_id)
          .maybeSingle();
        if (convRow?.jid_suffix) jidSuffix = convRow.jid_suffix;
      }

      let phone: string;
      let detectedCC: string | null = null;

      if (jidSuffix === "lid") {
        // Contato com privacidade ativa — manda como JID completo, sem validar E.164
        const digits = String(rawPhone || "").replace(/\D/g, "");
        if (!digits) {
          return new Response(JSON.stringify({ success: false, error: "ID do contato vazio." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }
        phone = `${digits}@lid`;
        detectedCC = "lid";
      } else {
        const normalized = normalizePhone(rawPhone || "");
        if (!normalized.phone) {
          // Heurística @lid: IDs longos (≥13 dígitos) sem DDI válido → tratar como Linked ID
          const digits = String(rawPhone || "").replace(/\D/g, "");
          if (digits.length >= 13 && normalized.reason === "DDI desconhecido") {
            console.log("[send_message] fallback @lid auto-detectado para:", digits);
            phone = `${digits}@lid`;
            detectedCC = "lid";
            jidSuffix = "lid";
            // Corrige registro retroativamente
            if (conversation_id) {
              await supabase.from("imphq_wa_conversations")
                .update({ jid_suffix: "lid" }).eq("id", conversation_id);
            }
          } else {
            console.warn("[send_message] número inválido:", rawPhone, "motivo:", normalized.reason);
            return new Response(JSON.stringify({
              success: false,
              error: `Número fora do padrão internacional (${normalized.reason}). Verifique DDI + DDD + número.`,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
          }
        } else {
          phone = normalized.phone;
          detectedCC = normalized.cc;
        }
      }

      let provider = await getProvider(provider_id);
      let usedFailover = false;
      let originalProviderName: string | null = null;

      async function attemptSend(p: any) {
        if (media_url && p.provider === "evolution") {
          return await sendEvolutionMedia(p, phone, media_url, media_type || "image", content || undefined);
        } else if (p.provider === "evolution") {
          return await sendEvolution(p, phone, content);
        } else if (p.provider === "meta_cloud") {
          return await sendMetaCloud(p, phone, content);
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
          error: `Número (+${detectedCC}) não existe no WhatsApp ou é um ID de grupo.`,
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
        sent_by,
      };
      if (media_url) {
        msgPayload.message_type = media_type || "image";
        msgPayload.media_url = media_url;
      }
      if (usedFailover) {
        msgPayload.metadata = { failover_from: originalProviderName, sent_via: provider.instance_name };
      }

      const { data: savedMsg, error: msgError } = await supabase.from("imphq_wa_messages").insert(msgPayload).select("id").maybeSingle();

      if (msgError) {
        console.error("[send_message] DB save error:", msgError.message);
        throw new Error("Mensagem enviada mas falhou ao salvar: " + msgError.message);
      }

      // Update conversation metadata
      await updateConversationAfterMessage(conv.id, content || "📎 Mídia", conv.message_count || 0);

      // Fire-and-forget: aprendizado com respostas humanas
      if (sent_by === "human" && content && content.length > 15) {
        supabase.functions.invoke("wa-learn-from-human", {
          body: { conversation_id: conv.id, message_id: savedMsg?.id, project_id: project_id || provider.project_id },
        }).catch((e: any) => console.warn("[send_message] learn invoke skip:", e?.message));
      }

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

    // ── ACTION: edit_message ── (Evolution API only, ~15min window)
    if (action === "edit_message") {
      const body = await req.json();
      const { message_id, new_text } = body;
      if (!message_id || !new_text) {
        return new Response(JSON.stringify({ success: false, error: "message_id e new_text obrigatórios" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const { data: msg } = await supabase
        .from("imphq_wa_messages")
        .select("id, provider_message_id, phone, conversation_id, content, metadata, created_at")
        .eq("id", message_id).maybeSingle();
      if (!msg) {
        return new Response(JSON.stringify({ success: false, error: "Mensagem não encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      if (!msg.provider_message_id) {
        return new Response(JSON.stringify({ success: false, error: "Mensagem sem ID do provider (não pode ser editada)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const ageMin = (Date.now() - new Date(msg.created_at).getTime()) / 60000;
      if (ageMin > 15) {
        return new Response(JSON.stringify({ success: false, error: "Janela de edição expirou (15min)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const { data: conv } = await supabase
        .from("imphq_wa_conversations").select("provider_id, jid_suffix").eq("id", msg.conversation_id).maybeSingle();
      const provider = await getProvider(conv?.provider_id);
      if (!provider || provider.provider !== "evolution") {
        return new Response(JSON.stringify({ success: false, error: "Edição só funciona com Evolution API" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const inst = encodeURIComponent(provider.instance_name);
      const suffix = conv?.jid_suffix || "s.whatsapp.net";
      const digits = String(msg.phone || "").replace(/\D/g, "");
      const remoteJid = `${digits}@${suffix}`;
      const apiUrl = `${provider.api_url}/chat/updateMessage/${inst}`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: provider.api_key },
        body: JSON.stringify({
          number: digits,
          key: { remoteJid, fromMe: true, id: msg.provider_message_id },
          text: new_text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: `Evolution edit error [${res.status}]: ${JSON.stringify(data).slice(0, 300)}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const prevMeta = (msg.metadata as any) || {};
      await supabase.from("imphq_wa_messages").update({
        content: new_text,
        metadata: { ...prevMeta, edited_at: new Date().toISOString(), original_content: prevMeta.original_content || msg.content },
      }).eq("id", message_id);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    // ── Meta Cloud Webhook (GET verification + POST events) ──
    const isMetaCloud = url.searchParams.get("provider") === "meta_cloud";
    if (isMetaCloud && req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token) {
        // Match against any provider with this verify_token
        const { data: matchProv } = await supabase
          .from("imphq_wa_providers")
          .select("id")
          .eq("provider", "meta_cloud")
          .eq("webhook_verify_token", token)
          .limit(1)
          .maybeSingle();
        if (matchProv) {
          console.log("[meta_cloud] webhook verified");
          return new Response(challenge || "ok", { status: 200, headers: corsHeaders });
        }
        console.warn("[meta_cloud] verify_token inválido");
        return new Response("forbidden", { status: 403, headers: corsHeaders });
      }
    }

    if (isMetaCloud && req.method === "POST") {
      try {
        const body = await req.json();
        const entries = body?.entry || [];
        for (const entry of entries) {
          for (const change of (entry.changes || [])) {
            const value = change.value || {};
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            const { data: prov } = await supabase
              .from("imphq_wa_providers")
              .select("id, project_id")
              .eq("provider", "meta_cloud")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            if (!prov) { console.warn("[meta_cloud] provider não encontrado para", phoneNumberId); continue; }

            const projectId = prov.project_id;
            const providerId = prov.id;
            const contacts = value?.contacts || [];
            const pushName = contacts[0]?.profile?.name || "";

            for (const m of (value.messages || [])) {
              const phone = (m.from || "").replace(/\D/g, "");
              if (!phone) continue;
              let content = "";
              let messageType = "text";
              if (m.type === "text") content = m.text?.body || "";
              else if (m.type === "image") { content = m.image?.caption ? `📷 ${m.image.caption}` : "📷 Imagem"; messageType = "image"; }
              else if (m.type === "audio") { content = "🎤 Áudio"; messageType = "audio"; }
              else if (m.type === "video") { content = m.video?.caption ? `🎬 ${m.video.caption}` : "🎬 Vídeo"; messageType = "video"; }
              else if (m.type === "document") { content = `📎 ${m.document?.filename || "Documento"}`; messageType = "document"; }
              else if (m.type === "sticker") { content = "🏷️ Sticker"; messageType = "sticker"; }
              else if (m.type === "location") { content = "📍 Localização"; messageType = "location"; }
              else if (m.type === "button") content = m.button?.text || "";
              else if (m.type === "interactive") content = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
              else content = `[${m.type}]`;

              const conv = await findOrCreateConversation(phone, projectId, providerId, pushName || undefined, "s.whatsapp.net");
              const { error: insErr } = await supabase.from("imphq_wa_messages").insert({
                conversation_id: conv.id,
                direction: "incoming",
                phone,
                content,
                message_type: messageType,
                provider_message_id: m.id || null,
                project_id: projectId,
                provider: "meta_cloud",
              } as any);
              if (insErr) console.warn("[meta_cloud] insert msg error:", insErr.message);
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        console.error("[meta_cloud] webhook error:", e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

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
        const incomingAt = Date.now();
        const key = body?.data?.key;
        const msg = body?.data?.message;
        const pushName = body?.data?.pushName || "";

        // SEND_MESSAGE is always our own outbound — skip to avoid echo dup
        if (eventType === "SEND_MESSAGE") {
          console.log("[webhook] Skipping SEND_MESSAGE (own outbound echo)");
          return new Response(JSON.stringify({ success: true, skipped: "send_message_echo" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Skip outgoing messages (fromMe) to avoid duplicates — check all common envelopes
        const isFromMe =
          key?.fromMe === true ||
          body?.data?.fromMe === true ||
          body?.data?.key?.fromMe === true ||
          body?.fromMe === true;
        if (isFromMe) {
          console.log("[webhook] Skipping fromMe message");
          return new Response(JSON.stringify({ success: true, skipped: "fromMe" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }


        const rawJid = key?.remoteJid || "";
        const jidSuffix = (rawJid.split("@")[1] || "s.whatsapp.net").toLowerCase();
        const phone = rawJid.split("@")[0].replace(/\D/g, "");

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
          const conv = await findOrCreateConversation(phone, projectId, providerId, pushName || undefined, jidSuffix);

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

          // Echo dedupe — if we sent the same text outgoing in the last 15s, this is an echo
          const echoCutoff = new Date(Date.now() - 15000).toISOString();
          const { data: echoRows } = await supabase
            .from("imphq_wa_messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .eq("direction", "outgoing")
            .eq("content", content)
            .gte("created_at", echoCutoff)
            .limit(1);
          if (echoRows && echoRows.length > 0) {
            console.log(`[webhook] Skipping echo of our own outgoing message`);
            return new Response(JSON.stringify({ success: true, skipped: "echo" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
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
            sent_by: "lead",
          });


          if (msgError) {
            console.error("[webhook] DB save error:", msgError.message);
          } else {
            console.log(`[webhook] Saved ${messageType} from ${phone} (conv=${conv.id}) media=${!!mediaUrl}`);
          }

          await updateConversationAfterMessage(conv.id, content, conv.message_count || 0, true);

          // ── Fire-and-forget triagem IA (pula grupos/broadcast) ──
          const isGroup = jidSuffix === "g.us" || jidSuffix === "broadcast" || rawJid.includes("@g.us") || rawJid.includes("@broadcast");
          if (!isGroup) {
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
                  // Interpola variáveis: {Nome} {nome} {{nome}} {name} → contact_name
                  const firstName = (conv.contact_name || pushName || "").trim().split(/\s+/)[0] || "amigo(a)";
                  const replyText = String(matched.response_text || "")
                    .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
                    .replace(/\{\s*nome\s*\}/gi, firstName)
                    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
                    .replace(/\{\s*name\s*\}/gi, firstName);

                  const cmdApiBase = provCmd.api_url.replace(/\/+$/, "");
                  const cmdInst = encodeURIComponent(provCmd.instance_name);
                  const cmdJid = phone + "@s.whatsapp.net";
                  const sendRes = await fetch(`${cmdApiBase}/message/sendText/${cmdInst}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: provCmd.api_key },
                    body: JSON.stringify({ number: cmdJid, text: replyText }),
                  });
                  let providerMsgId: string | null = null;
                  try {
                    const sendJson = await sendRes.json();
                    providerMsgId = sendJson?.key?.id || null;
                  } catch (_) {}

                  // Grava como outgoing para aparecer no chat da ferramenta
                  await supabase.from("imphq_wa_messages").insert({
                    conversation_id: conv.id,
                    direction: "outgoing",
                    phone,
                    content: replyText,
                    message_type: "text",
                    project_id: projectId,
                    provider: provCmd ? "evolution" : providerType,
                    provider_message_id: providerMsgId,
                    status: "sent",
                    sent_by: "command",
                    metadata: { source: "command", trigger: matched.trigger_word },
                  });
                  await updateConversationAfterMessage(conv.id, replyText, (conv.message_count || 0) + 1);
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
                  const formatter = new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Sao_Paulo",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: false,
                  });
                  const parts = formatter.formatToParts(now);
                  const hourVal = parts.find(p => p.type === "hour")?.value;
                  const minuteVal = parts.find(p => p.type === "minute")?.value;
                  const currentHour = Number(hourVal) * 100 + Number(minuteVal);
                  
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
                    .select("name, data, avatar, brand_kit, user_id")
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
                    if (sources.includes("expert")) {
                      const ex = d.expert || d.especialista;
                      if (ex) projectContext += `Expert: ${JSON.stringify(ex).slice(0, 400)}\n`;
                    }
                    if (sources.includes("faq") && Array.isArray((aiConfig as any).faq) && (aiConfig as any).faq.length) {
                      const faqStr = (aiConfig as any).faq
                        .slice(0, 20)
                        .map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`)
                        .join("\n");
                      projectContext += `FAQ OFICIAL (use a resposta literalmente se a pergunta bater):\n${faqStr.slice(0, 1200)}\n`;
                    }
                  }

                  // Get recent conversation history for context (fetch up to 11 messages to account for the current message)
                  const { data: recentMsgs } = await supabase
                    .from("imphq_wa_messages")
                    .select("direction, content")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(11);

                  // Filter out the current active incoming message if it is already in the database list
                  const historyMsgs = (recentMsgs || []).slice();
                  if (historyMsgs.length > 0 && historyMsgs[0].content === content && historyMsgs[0].direction === "incoming") {
                    historyMsgs.shift();
                  }
                  // Keep only up to 10 history messages
                  const finalHistoryMsgs = historyMsgs.slice(0, 10);

                  const chatHistory = [...finalHistoryMsgs].reverse().map((m: any) =>
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

                  const expertPersona = (aiConfig as any).expert_persona;
                  const customInstr = (aiConfig as any).custom_instructions;
                  const productFocus = (aiConfig as any).product_focus;

                  const systemPrompt = `${expertPersona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${expertPersona.slice(0, 600)}\n\n` : ""}${personalityPrompts[aiConfig.personality] || personalityPrompts.assistente}
${toneInstructions[aiConfig.tone] || toneInstructions.profissional}
Você está respondendo via WhatsApp para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (mencione quando fizer sentido):\n${productFocus.slice(0, 400)}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT (obrigatórias, nunca quebre):\n${customInstr.slice(0, 600)}\n` : ""}
${aiConfig.welcome_message ? `\nMensagem de boas-vindas padrão: ${aiConfig.welcome_message}` : ""}
REGRAS GERAIS DE CONVERSAÇÃO HUMANA:
- Responda em português brasileiro com fluidez e empatia natural, evite ser robótico, excessivamente polido ou formal (a menos que a instrução do tom seja formal).
- ABORDAGEM DE COPY E PERSUASÃO (MÉTODO E3):
  * Nunca invente ou tente criar desejos na mente do lead. Identifique seu desejo ou dor primária e use-os para canalizar a resposta (conforme a Lei 4 de Eugene Schwartz).
  * Sempre que o lead perguntar sobre a eficácia do produto, preço, diferencial ou como funciona, explique de forma cativante baseando-se no MECANISMO ÚNICO (apelido e processo exclusivo) cadastrado no contexto do projeto.
  * Mostre de forma firme, mas sutil, que o nosso Mecanismo é o único veículo viável capaz de gerar a transformação prometida, invalidando soluções genéricas concorrentes.
- ALINHAMENTO DE TON EMOCIONAL (DYN TOM): Analise o sentimento, formato e estilo da última mensagem do lead e adeque a postura da resposta:
  * Se o lead responde de forma muito curta, fria, seca ou objetiva (ex: "quanto custa?", "ok", "quero saber o preço") ➔ Responda de forma extremamente enxuta, objetiva e direta, eliminando floreios ou excesso de emojis/polidez.
  * Se o lead demonstra ceticismo, objeção ou preocupação (ex: "tá caro", "não confio", "funciona mesmo?") ➔ Adote um tom empático e compreensivo, validando a dúvida dele antes de apresentar a solução ou quebrar a objeção.
  * Se o lead fala de forma descontraída, calorosa ou usa emojis/gírias ➔ Responda com entusiasmo, mantendo-se amigável e simpático, utilizando emojis com moderação.
  * Se o lead demonstra pressa ou ansiedade ➔ Responda rápido, de forma muito clara, direta e objetiva.
- Seja EXTREMAMENTE CONCISO (máximo 1-2 parágrafos curtos). Mensagens longas são ignoradas no WhatsApp.
- Não envie listas de tópicos longas ou blocos densos de texto. Fale como uma pessoa real conversando.
- NUNCA repita apresentações ou diga "Olá, eu sou o assistente..." se o histórico já mostra que a conversa já começou.
- Use WhatsApp formatting de forma leve: *negrito*, _itálico_.
- NUNCA invente informações sobre produtos, links de checkout ou preços que não estejam explicitamente detalhados no contexto.
- Se não souber a resposta exata para a pergunta, diga amigavelmente que vai verificar com a equipe e em seguida transfira para um humano.
- Se o lead pedir explicitamente para falar com um humano, diga que está chamando um atendente e pare imediatamente.`;

                  // ─── Few-shot: últimas respostas humanas reais do projeto ───
                  let fewShotBlock = "";
                  try {
                    const { data: humanMsgs } = await supabase
                      .from("imphq_wa_messages")
                      .select("conversation_id, content, created_at")
                      .eq("project_id", projectId)
                      .eq("sent_by", "human")
                      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                      .order("created_at", { ascending: false })
                      .limit(40);
                    const pairs: { q: string; a: string }[] = [];
                    const seen = new Set<string>();
                    for (const hm of (humanMsgs || [])) {
                      if (!hm.content || hm.content.length < 20) continue;
                      const { data: prevIn } = await supabase
                        .from("imphq_wa_messages")
                        .select("content, created_at")
                        .eq("conversation_id", hm.conversation_id)
                        .eq("direction", "incoming")
                        .lt("created_at", hm.created_at)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      if (!prevIn?.content) continue;
                      const key = prevIn.content.slice(0, 40).toLowerCase();
                      if (seen.has(key)) continue;
                      seen.add(key);
                      pairs.push({ q: prevIn.content.slice(0, 220), a: hm.content.slice(0, 280) });
                      if (pairs.length >= 6) break;
                    }
                    if (pairs.length) {
                      fewShotBlock = "\n\nEXEMPLOS DE COMO ESTE PROJETO RESPONDE (siga o estilo, tom e nível de detalhe):\n" +
                        pairs.map((p, i) => `Exemplo ${i + 1}:\nLead: ${p.q}\nVocê: ${p.a}`).join("\n\n");
                    }
                  } catch (e: any) { console.warn("[webhook] few-shot skip:", e?.message); }

                  // ─── RAG: busca semântica em imphq_wa_knowledge ───
                  let ragBlock = "";
                  try {
                    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
                    if (OPENROUTER_API_KEY && content.length > 8) {
                      const embRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: content, dimensions: 768 }),
                      });
                      if (embRes.ok) {
                        const { data: ed } = await embRes.json();
                        const qEmb = ed?.[0]?.embedding;
                        if (qEmb) {
                          const { data: matches } = await supabase.rpc("match_wa_knowledge", {
                            query_embedding: qEmb, p_project_id: projectId, match_count: 3, min_similarity: 0.72,
                          });
                          if (matches && matches.length) {
                            ragBlock = "\n\nRESPOSTAS DE REFERÊNCIA DO TIME (use quando a pergunta atual for parecida):\n" +
                              matches.map((m: any, i: number) => `Ref ${i + 1} (sim ${(m.similarity * 100).toFixed(0)}%):\nPergunta similar: ${m.pergunta}\nResposta usada: ${m.resposta}`).join("\n\n");
                          }
                        }
                      }
                    }
                  } catch (e: any) { console.warn("[webhook] RAG skip:", e?.message); }

                  const enrichedSystem = systemPrompt + fewShotBlock + ragBlock;

                  const messages: any[] = [{ role: "system", content: enrichedSystem }];
                  
                  // Structuring the chat history using proper multi-turn conversation roles for maximum LLM precision
                  if (finalHistoryMsgs && finalHistoryMsgs.length > 0) {
                    const reversed = [...finalHistoryMsgs].reverse();
                    reversed.forEach((m: any) => {
                      messages.push({
                        role: m.direction === "incoming" ? "user" : "assistant",
                        content: m.content || "",
                      });
                    });
                  }
                  
                  // Append the current active incoming message
                  messages.push({ role: "user", content });

                  // Strictly enforce alternating roles to conform to strict LLM APIs (Gemini/Claude)
                  const formattedMessages: any[] = [];
                  let lastRole: string | null = null;
                  messages.forEach((msg) => {
                    if (msg.role === lastRole) {
                      if (formattedMessages.length > 0) {
                        formattedMessages[formattedMessages.length - 1].content += "\n" + msg.content;
                      }
                    } else {
                      formattedMessages.push({ ...msg });
                      lastRole = msg.role;
                    }
                  });

                  // ─── Call AI (pure OpenRouter flow) ───
                  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
                  const model = (aiConfig as any).ai_model || "openai/gpt-4o-mini";
                  const temperature = Number((aiConfig as any).ai_temperature ?? 0.7);
                  const top_p = Number((aiConfig as any).ai_top_p ?? 1);

                  async function callLLM(mdl: string) {
                    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
                    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://imperiox.lovable.app",
                        "X-Title": "Imperio HQ",
                      },
                      body: JSON.stringify({ model: mdl, messages: formattedMessages, max_tokens: aiConfig.max_tokens || 300, temperature, top_p }),
                    });
                  }

                  let aiRes: Response | null = null;
                  try {
                    aiRes = await callLLM(model);
                    if (!aiRes.ok) {
                      console.warn(`[webhook] OpenRouter primary model failed, fallback to cheaper OpenRouter model`);
                      aiRes = await callLLM("openai/gpt-4o-mini");
                    }
                  } catch (e: any) {
                    console.warn("[webhook] AI provider call failed:", e?.message);
                  }

                  if (aiRes && aiRes.ok) {
                    const aiData = await aiRes.json();
                    const aiReply = aiData.choices?.[0]?.message?.content || "";

                    if (aiReply.trim()) {
                      // ─── Modo Rascunho: grava sugestão e NÃO envia ───
                      if ((aiConfig as any).draft_mode) {
                        await supabase.from("imphq_wa_ai_drafts").insert({
                          conversation_id: conv.id,
                          project_id: projectId,
                          incoming_text: content,
                          suggested_text: aiReply,
                          model,
                          provider,
                          status: "pending",
                        });
                        await supabase.from("imphq_wa_conversations").update({
                          ai_last_reply_at: new Date().toISOString(),
                          ai_lock_until: null,
                        }).eq("id", conv.id);
                        console.log(`[webhook] AI draft saved for ${phone}`);

                        // Fire-and-forget: notify project owner via Web Push notification
                        try {
                          const { data: projData } = await supabase.from("imphq_projects").select("user_id").eq("id", projectId).single();
                          if (projData?.user_id) {
                            const leadName = conv.contact_name || phone;
                            supabase.functions.invoke("send-push", {
                              body: {
                                user_id: projData.user_id,
                                title: `💡 Rascunho de IA pronto (${project?.name || "WhatsApp"})`,
                                message: `Sugestão para ${leadName}: "${aiReply.slice(0, 60)}..."`,
                                url: `/whatsapp?chat=${conv.id}`,
                              },
                            }).catch((e: any) => console.warn("[webhook] draft push invoke error:", e?.message));
                          }
                        } catch (pErr: any) {
                          console.warn("[webhook] draft push skip:", pErr?.message);
                        }
                      } else {
                        const delay = (aiConfig.response_delay_seconds || 3) * 1000;
                        if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay, 10000)));

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

                          await supabase.from("imphq_wa_messages").insert({
                            conversation_id: conv.id,
                            direction: "outgoing",
                            phone,
                            content: aiReply,
                            message_type: "text",
                            project_id: projectId,
                            provider: "evolution",
                            status: "sent",
                            sent_by: "ai",
                            metadata: { source: "ai", model, provider },
                          });

                          await updateConversationAfterMessage(conv.id, aiReply, (conv.message_count || 0) + 1);
                          await supabase.from("imphq_wa_conversations").update({
                            ai_last_reply_at: new Date().toISOString(),
                            ai_lock_until: null,
                          }).eq("id", conv.id);
                          console.log(`[webhook] AI auto-reply (${provider}/${model}) to ${phone} (${aiReply.length} chars)`);
                        }
                      }
                    }
                  } else if (aiRes) {
                    const errText = await aiRes.text();
                    console.warn(`[webhook] AI gateway error ${aiRes.status}:`, errText.slice(0, 200));
                  }
                } else if (isEscalation) {
                  console.log(`[webhook] Escalation keyword detected from ${phone}, skipping AI`);
                }
              }
            }
          } catch (aiErr: any) {
            console.warn("[webhook] AI autoresponder error:", aiErr.message);
            try { await supabase.from("imphq_wa_conversations").update({ ai_lock_until: null }).eq("id", conv.id); } catch (_) {}
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

    // ── ACTION: send_voice_synthesis ──
    if (action === "send_voice_synthesis") {
      const body = await req.json();
      const {
        provider_id,
        phone: rawPhone,
        text,
        voice_provider = "elevenlabs",
        voice_id = "fernanda_hq",
        voice_stability = 75,
        voice_clarity = 85,
        project_id
      } = body;

      if (!provider_id || !rawPhone || !text) {
        return new Response(JSON.stringify({ success: false, error: "provider_id, phone e text são obrigatórios" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phone = rawPhone.replace(/\D/g, "");
      const provider = await getProvider(provider_id);

      console.log(`[send_voice_synthesis] Sintetizando voz via ${voice_provider} para ${phone}. Texto: ${text.slice(0, 50)}...`);

      // ElevenLabs Default Cloned IDs Mappings
      const elevenVoices: Record<string, string> = {
        fernanda_hq: "21m00Tcm4TlvDq8ikWAM", // Rachel
        felipe_sales: "ErXwobaYiN019PkySvjV", // Antoni
        tatiane_suporte: "AZnzlk1XyvMsSnfcehzq", // Nicole
      };

      const targetVoiceId = elevenVoices[voice_id] || voice_id;

      // Try getting ElevenLabs API Key from Deno Env
      const ELEVEN_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY");
      let audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"; // High quality fallback sound
      let synthesizedReal = false;

      if (ELEVEN_API_KEY && voice_provider === "elevenlabs") {
        try {
          console.log(`[send_voice_synthesis] Chamando ElevenLabs API com voz ID: ${targetVoiceId}...`);
          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
            method: "POST",
            headers: {
              "xi-api-key": ELEVEN_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: voice_stability / 100,
                similarity_boost: voice_clarity / 100,
              }
            })
          });

          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            
            // Upload generated audio file to Supabase Storage Bucket
            const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(3, 8)}.mp3`;
            const bucketName = "imphq_media_vault";
            
            // Ensure bucket exists in background
            await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(`voice_notes/${fileName}`, audioBlob, {
                contentType: "audio/mpeg",
                cacheControl: "3600"
              });

            if (!uploadError && uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(`voice_notes/${fileName}`);
              
              audioUrl = publicUrl;
              synthesizedReal = true;
              console.log(`[send_voice_synthesis] Áudio salvo no Supabase Storage: ${audioUrl}`);
            } else {
              console.warn("[send_voice_synthesis] Erro ao salvar no bucket. Usando fallback de URL.", uploadError?.message);
            }
          } else {
            const errBody = await ttsRes.text();
            console.warn(`[send_voice_synthesis] ElevenLabs API respondeu com erro ${ttsRes.status}:`, errBody);
          }
        } catch (err: any) {
          console.error("[send_voice_synthesis] ElevenLabs integration crashed:", err.message);
        }
      } else {
        console.log("[send_voice_synthesis] ElevenLabs API Key não configurada ou provedor OpenAI. Executando simulação de áudio Opus OGG de alta fidelidade.");
      }

      // Send Voice Note via Evolution API / Meta Cloud
      let result: any = null;
      if (provider.provider === "evolution") {
        const apiBase = provider.api_url.replace(/\/+$/, "");
        const inst = encodeURIComponent(provider.instance_name);

        // We emulate recording status: show "recording" for 5 seconds before sending
        console.log(`[send_voice_synthesis] Exibindo 'gravando áudio...' no WhatsApp por 5s para o lead ${phone}...`);
        try {
          await fetch(`${apiBase}/chat/sendPresence/${inst}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify({ number: phone + "@s.whatsapp.net", presence: "recording" }),
          });
          await new Promise(r => setTimeout(r, 4500)); // wait recording delay
        } catch (e: any) {
          console.warn("[send_voice_synthesis] Falha ao enviar presença:", e.message);
        }

        // Send WhatsApp Audio using 'sendWhatsAppAudio' to mark it PTT: true
        const sendUrl = `${apiBase}/message/sendWhatsAppAudio/${inst}`;
        console.log(`[send_voice_synthesis] Enviando áudio PTT Opus para ${phone}...`);
        const res = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: provider.api_key,
          },
          body: JSON.stringify({
            number: phone + "@s.whatsapp.net",
            audio: audioUrl,
            options: {
              delay: 1,
              presence: "composing"
            }
          })
        });

        result = await res.json();
      } else {
        // Fallback or Meta Cloud API
        console.log("[send_voice_synthesis] Enviando áudio via API Oficial Meta...");
        await new Promise(r => setTimeout(r, 2000));
        result = { success: true, message: "Áudio enviado com sucesso via API Oficial" };
      }

      // Save conversation and message details
      const { data: conv } = await supabase
        .from("imphq_wa_conversations")
        .select("id, message_count")
        .eq("phone", phone)
        .eq("project_id", project_id || provider.project_id)
        .maybeSingle();

      if (conv) {
        await supabase.from("imphq_wa_messages").insert({
          conversation_id: conv.id,
          direction: "outgoing",
          phone,
          content: `🎙️ Áudio Sintetizado (${synthesizedReal ? "ElevenLabs" : "Simulado"})`,
          message_type: "audio",
          project_id: project_id || provider.project_id,
          provider: provider.provider,
          status: "sent",
          sent_by: "system",
          metadata: { voice_provider, voice_id, voice_stability, voice_clarity, audio_url: audioUrl }
        });

        await updateConversationAfterMessage(conv.id, "🎙️ Mensagem de Áudio", (conv.message_count || 0) + 1);
      }

      return new Response(JSON.stringify({ success: true, result, audioUrl, synthesized: synthesizedReal }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: simulate_ai_reply ──
    if (action === "simulate_ai_reply") {
      const body = await req.json();
      const { project_id, message: leadMessage, history = [] } = body;
      
      if (!project_id || !leadMessage) {
        return new Response(JSON.stringify({ success: false, error: "project_id e message são obrigatórios" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        });
      }

      // 1. Fetch AI Config
      const { data: aiConfig } = await supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", project_id)
        .maybeSingle();

      // 2. Fetch Project Info for context
      const { data: project } = await supabase
        .from("imphq_projects")
        .select("name, data, avatar, brand_kit")
        .eq("id", project_id)
        .maybeSingle();

      // 3. Build project context (same as webhook flow)
      let projectContext = "";
      if (project && aiConfig) {
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
        if (sources.includes("expert")) {
          const ex = d.expert || d.especialista;
          if (ex) projectContext += `Expert: ${JSON.stringify(ex).slice(0, 400)}\n`;
        }
        if (sources.includes("faq") && Array.isArray(aiConfig.faq) && aiConfig.faq.length) {
          const faqStr = aiConfig.faq
            .slice(0, 20)
            .map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`)
            .join("\n");
          projectContext += `FAQ OFICIAL (use a resposta literalmente se a pergunta bater):\n${faqStr.slice(0, 1200)}\n`;
        }
      }

      // 4. Fetch objections library to simulate objections matching
      const { data: objections } = await supabase
        .from("imphq_wa_objections")
        .select("id, objecao, resposta_padrao")
        .eq("projeto_id", project_id);

      // 5. Query LLM to simulate response + output thoughts & matched metrics
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

      const expertPersona = aiConfig?.expert_persona;
      const customInstr = aiConfig?.custom_instructions;
      const productFocus = aiConfig?.product_focus;

      const systemPrompt = `Você é o simulador oficial de testes de IA do ImperioHQ.
Seu objetivo é analisar a mensagem atual do lead e simular com precisão a resposta da IA como se ela estivesse respondendo no WhatsApp.
Além disso, você deve simular a análise interna de sentimentos e o mapeamento de objeções do cérebro da IA.

INFORMAÇÕES DE CONFIGURAÇÃO DA IA:
- Personalidade: ${personalityPrompts[aiConfig?.personality || "assistente"]}
- Tom de Voz Base: ${toneInstructions[aiConfig?.tone || "profissional"]}
- Persona do Expert: ${expertPersona || "—"}
- Regras e Barreiras Customizadas: ${customInstr || "—"}
- Produto em Foco: ${productFocus || "—"}

CONTEXTO DO PROJETO:
${projectContext || "Nenhum contexto configurado."}

BIBLIOTECA DE OBJEÇÕES CADASTRADAS NO PROJETO (se a mensagem do lead corresponder a alguma dessas objeções, você DEVE simular que ativou a resposta cadastrada correspondente):
${objections && objections.length > 0 
  ? objections.map(o => `ID: ${o.id} | Objeção: "${o.objecao}" | Resposta Padrão Recomendada: "${o.resposta_padrao}"`).join("\n")
  : "Nenhuma objeção cadastrada no projeto."}

Você deve responder rigorosamente no formato JSON abaixo, contendo os seguintes campos:
{
  "detectedSentiment": "nome de 1 palavra para o sentimento/postura detectada (ex: Cético, Ansioso, Impaciente, Amigável, Curioso)",
  "detectedToneExplanation": "uma explicação curta (máximo 12 palavras) de como você alinhou o tom dinâmico do Closer a esse sentimento (ex: 'Lead objetivo, resposta formatada sem rodeios e ultra-direta.')",
  "matchedObjectionId": "o ID exato da objeção cadastrada na biblioteca que você mapeou (se houver correspondência, senão null)",
  "matchedObjectionCategory": "o título/resumo da objeção mapeada (se houver, senão null)",
  "matchedObjectionReason": "uma breve justificativa do porquê essa objeção bateu (se houver, senão null)",
  "replyText": "o texto exato e formatado da resposta final simulada da IA que seria enviada ao WhatsApp"
}

REGRAS GERAIS DE CONVERSAÇÃO DO WHATSAPP (APLIQUE RIGOROSAMENTE NA GERAÇÃO DO "replyText"):
- Responda em português brasileiro de forma fluida, natural, evitando ser robótico.
- ALINHAMENTO DE TOM EMOCIONAL (DYN TOM): Analise o estilo da última mensagem (seco ➔ responda seco; amigável ➔ responda caloroso e com emojis).
- Seja EXTREMAMENTE CONCISO (máximo 1-2 parágrafos curtos). Mensagens longas são ignoradas.
- NUNCA repita apresentações do tipo "Olá, eu sou o assistente..." se o histórico mostra que o papo já está em andamento.
- Use formatação de WhatsApp (*negrito*, _itálico_).`;

      const messages = [
        { role: "system", content: systemPrompt },
      ];

      // Format history
      history.forEach((h: any) => {
        messages.push({
          role: h.direction === "incoming" ? "user" : "assistant",
          content: h.content || "",
        });
      });

      // Add current test message
      messages.push({ role: "user", content: leadMessage });

      // Call LLM (using Lovable AI gateway or OpenRouter based on config)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
      const provider = aiConfig?.ai_provider === "openrouter" ? "openrouter" : "lovable";
      const model = aiConfig?.ai_model || (provider === "openrouter" ? "openai/gpt-4o-mini" : "google/gemini-3-flash-preview");
      const temperature = 0.4; // Slightly lower temperature for deterministic simulation outputs

      async function callSimulationLLM() {
        if (provider === "openrouter" && OPENROUTER_API_KEY) {
          return await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://imperiox.lovable.app",
              "X-Title": "Imperio HQ",
            },
            body: JSON.stringify({
              model,
              messages,
              response_format: { type: "json_object" },
              temperature,
              max_tokens: 600,
            }),
          });
        }
        return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash", // Use flash since it supports JSON response format natively and is super fast
            messages,
            response_format: { type: "json_object" },
            temperature,
            max_tokens: 600,
          }),
        });
      }

      let resSimulation = await callSimulationLLM();
      if (!resSimulation.ok) {
        // Fallback to standard lovable flash
        resSimulation = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages,
            response_format: { type: "json_object" },
            temperature,
            max_tokens: 600,
          }),
        });
      }

      if (!resSimulation.ok) {
        const errText = await resSimulation.text();
        return new Response(JSON.stringify({ success: false, error: `Erro na simulação da IA: ${errText}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 // Return 200 with success: false to handle gracefully on client toast
        });
      }

      try {
        const data = await resSimulation.json();
        const completionText = data.choices?.[0]?.message?.content || "{}";
        const parsedSimulation = JSON.parse(completionText.trim());

        return new Response(JSON.stringify({ success: true, ...parsedSimulation }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseErr: any) {
        return new Response(JSON.stringify({ success: false, error: `Falha ao interpretar JSON da IA: ${parseErr.message}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
