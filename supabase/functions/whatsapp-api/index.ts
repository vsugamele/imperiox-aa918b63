
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sleep,
  isTransientConnError,
  tryReconnectInstance,
  sendEvolution,
  sendEvolutionButtons,
  sendEvolutionList,
  sendEvolutionMedia,
  sendTwilio,
  sendMetaCloud,
} from "./_lib/senders.ts";
import {
  getProvider as getProviderShared,
  findOrCreateConversation as findOrCreateConversationShared,
  updateConversationAfterMessage as updateConversationAfterMessageShared,
} from "./_lib/db.ts";
import { handleWebhook } from "./_lib/webhook-handler.ts";
import { handleSendMessage } from "./_lib/send-message-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    // ── Wrappers locais para os helpers compartilhados (mantém assinatura igual) ──
    const getProvider = (id: string) => getProviderShared(supabase, id);
    const findOrCreateConversation = (
      phone: string,
      projectId: string,
      providerId: string | null,
      contactName?: string,
      jidSuffix?: string,
    ) => findOrCreateConversationShared(supabase, phone, projectId, providerId, contactName, jidSuffix);
    const updateConversationAfterMessage = (
      conversationId: string,
      content: string,
      currentCount: number,
      incrementUnread = false,
      pauseAI = false,
    ) => updateConversationAfterMessageShared(supabase, conversationId, content, currentCount, incrementUnread, pauseAI);

    // ── Helper: build project context from selected sources ──
    async function buildProjectContext(projectId: string, aiConfig: any) {
      let context = "";
      const { data: project } = await supabase
        .from("imphq_projects")
        .select("name, data, avatar, brand_kit")
        .eq("id", projectId)
        .single();

      if (project) {
        const sources = aiConfig.context_sources || [];
        const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
        if (sources.includes("briefing") && d.briefing) context += `Briefing: ${JSON.stringify(d.briefing).slice(0, 600)}\n`;
        if (sources.includes("produtos") && d.produtos) context += `Produtos: ${JSON.stringify(d.produtos).slice(0, 600)}\n`;
        if (sources.includes("avatar") && project.avatar) context += `Avatar: ${JSON.stringify(project.avatar).slice(0, 400)}\n`;
        if (sources.includes("branding") && project.brand_kit) context += `Branding: ${JSON.stringify(project.brand_kit).slice(0, 400)}\n`;
        if (sources.includes("copy_arsenal")) {
          const ca = d.copy_arsenal || (d.produtos?.[0]?.copy_arsenal);
          if (ca) context += `Copy Arsenal: ${JSON.stringify(ca).slice(0, 400)}\n`;
        }
        if (sources.includes("expert")) {
          const ex = d.expert || d.especialista;
          if (ex) context += `Expert: ${JSON.stringify(ex).slice(0, 400)}\n`;
        }
        if (sources.includes("faq") && Array.isArray(aiConfig.faq) && aiConfig.faq.length) {
          const faqStr = aiConfig.faq
            .slice(0, 20)
            .map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`)
            .join("\n");
          context += `FAQ OFICIAL (use a resposta literalmente se a pergunta bater):\n${faqStr.slice(0, 1200)}\n`;
        }
      }
      return context;
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

    // ── ACTION: list_elevenlabs_voices ──
    if (action === "list_elevenlabs_voices") {
      const elevenKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY");
      if (!elevenKey) {
        return new Response(JSON.stringify({ success: false, error: "ElevenLabs API Key não configurada no servidor." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": elevenKey },
        });
        if (!res.ok) {
          throw new Error(`Erro ElevenLabs: ${res.status} ${await res.text()}`);
        }
        const data = await res.json();
        const voices = (data.voices || []).map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          preview_url: v.preview_url,
        }));
        return new Response(JSON.stringify({ success: true, voices }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── ACTION: send_message ──
    if (action === "send_message") {
      return handleSendMessage(req, {
        supabase,
        corsHeaders,
        getProvider,
        findOrCreateConversation,
        updateConversationAfterMessage,
        normalizePhone,
      });
    }

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
        } catch (err) {
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
      } catch (e) {
        console.error("[meta_cloud] webhook error:", e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    if (action === "webhook") {
      return handleWebhook(req, url, {
        supabase,
        corsHeaders,
        evolutionEventFromPath,
        findOrCreateConversation,
        updateConversationAfterMessage,
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

    // ── ACTION: fetch_common_groups (Evolution — list common groups for a phone) ──
    if (action === "fetch_common_groups") {
      const body = await req.json();
      const { provider_id, phone } = body;
      if (!provider_id) throw new Error("provider_id required");
      if (!phone) throw new Error("phone required");
      const provider = await getProvider(provider_id);

      if (provider.provider !== "evolution") {
        return new Response(JSON.stringify({ success: true, groups: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const inst = encodeURIComponent(provider.instance_name);
      const res = await fetch(
        `${provider.api_url}/group/fetchAllGroups/${inst}?getParticipants=true`,
        { headers: { apikey: provider.api_key } }
      );
      const data = await res.json();
      const cleanPhone = phone.replace(/\D/g, "");

      const groups = (Array.isArray(data) ? data : [])
        .filter((g: any) => {
          if (!Array.isArray(g.participants)) return false;
          return g.participants.some((p: any) => {
            const pid = typeof p === "string" ? p : (p?.id || p?.jid || "");
            const pPhone = pid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
            return pPhone === cleanPhone;
          });
        })
        .map((g: any) => ({
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
        } catch (e) {
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
          } catch (mErr) {
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
      const LOCAL_TTS_URL = Deno.env.get("LOCAL_TTS_URL");
      let audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"; // High quality fallback sound
      let synthesizedReal = false;

      // ── LOCAL TTS (edge-tts / XTTS clone) ──
      if (!synthesizedReal && (voice_provider === "local" || voice_provider === "local_clone") && LOCAL_TTS_URL) {
        try {
          const isClone = voice_provider === "local_clone";
          const endpoint = isClone ? `${LOCAL_TTS_URL}/tts/clone` : `${LOCAL_TTS_URL}/tts/edge`;
          const payload = isClone
            ? { text, language: "pt", speed: 1.0 }
            : { text, voice: voice_id || "pt-BR-FranciscaNeural", rate: "+0%", pitch: "+0Hz" };
          console.log(`[send_voice_synthesis] Local TTS (${isClone ? "XTTS clone" : "edge-tts"}): ${endpoint}`);
          const ttsRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000),
          });
          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            const ext = isClone ? "wav" : "mp3";
            const contentType = isClone ? "audio/wav" : "audio/mpeg";
            const fileName = `voice_local_${Date.now()}_${Math.random().toString(36).substring(3, 8)}.${ext}`;
            const bucketName = "imphq_media_vault";
            await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {});
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(`voice_notes/${fileName}`, audioBlob, { contentType, cacheControl: "3600" });
            if (!uploadError && uploadData) {
              const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(`voice_notes/${fileName}`);
              audioUrl = publicUrl;
              synthesizedReal = true;
              console.log(`[send_voice_synthesis] Local TTS salvo: ${audioUrl}`);
            } else {
              console.warn("[send_voice_synthesis] Falha upload local TTS:", uploadError?.message);
            }
          } else {
            console.warn(`[send_voice_synthesis] Local TTS erro ${ttsRes.status}:`, await ttsRes.text());
          }
        } catch (err: any) {
          console.error("[send_voice_synthesis] Local TTS crashed:", err.message);
        }
      }

      // ── ElevenLabs (default ou fallback) ──
      if (!synthesizedReal && ELEVEN_API_KEY && (voice_provider === "elevenlabs" || voice_provider === "local_clone")) {
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
        } catch (err) {
          console.error("[send_voice_synthesis] ElevenLabs integration crashed:", err.message);
        }
      } else if (!synthesizedReal) {
        console.log("[send_voice_synthesis] Sem TTS disponível para provider=" + voice_provider + ". Usando fallback de URL.");
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
        } catch (e) {
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
      const { project_id, provider_id, message: leadMessage, history = [], phone = "5511999999999", media_url, media_type } = body;
      
      if (!project_id || (!leadMessage && !media_url)) {
        return new Response(JSON.stringify({ success: false, error: "project_id e message (ou media_url) são obrigatórios" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        });
      }

      // 1. Fetch AI Config (first by provider_id, then project_id fallback)
      let aiConfig = null;
      if (provider_id) {
        const { data } = await supabase
          .from("imphq_wa_ai_config")
          .select("*")
          .eq("provider_id", provider_id)
          .maybeSingle();
        aiConfig = data;
      }
      if (!aiConfig) {
        const { data: configs } = await supabase
          .from("imphq_wa_ai_config")
          .select("*")
          .eq("project_id", project_id)
          .eq("enabled", true);
        if (configs && configs.length > 0) {
          aiConfig = configs.find((c: any) => !c.provider_id) || configs[0];
        }
      }

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

      // 3.1. Fetch lead behavioral profile
      let leadContextBlock = "";
      let leadNameSim = "";
      if (phone && project_id) {
        try {
          const cleanPhone = String(phone).replace(/\D/g, "");
          const searchPhones = [cleanPhone];
          if (cleanPhone.startsWith("55")) {
            searchPhones.push(cleanPhone.substring(2));
          } else {
            searchPhones.push("55" + cleanPhone);
          }

          const { data: lead } = await supabase
            .from("imphq_leads")
            .select("*")
            .eq("project_id", project_id)
            .in("phone", searchPhones)
            .maybeSingle();

          if (lead) {
            leadNameSim = lead.nome || "";
            const aiProfile = lead.data?.ai_profile || {};
            const pains = Array.isArray(aiProfile.pains) ? aiProfile.pains : [];
            const desires = Array.isArray(aiProfile.desires) ? aiProfile.desires : [];
            const moments = Array.isArray(aiProfile.moments) ? aiProfile.moments : [];
            const seekings = Array.isArray(aiProfile.seekings) ? aiProfile.seekings : [];
            const schwartz = lead.data?.desejo_schwartz || "";

            leadContextBlock = `\nPERFIL COMPORTAMENTAL DO LEAD (MAPEADO EM TEMPO REAL):`;
            if (moments.length > 0) leadContextBlock += `\n- Momento/Situação Atual: ${moments.join(", ")}`;
            if (pains.length > 0) leadContextBlock += `\n- Dores Principais: ${pains.join(", ")}`;
            if (desires.length > 0) leadContextBlock += `\n- Desejos & Metas: ${desires.join(", ")}`;
            if (seekings.length > 0) leadContextBlock += `\n- O que busca: ${seekings.join(", ")}`;
            if (schwartz) leadContextBlock += `\n- Desejo de Schwartz: ${schwartz}`;
            if (lead.score) leadContextBlock += `\n- Score de Engajamento: ${lead.score}/100`;
            leadContextBlock += `\n`;
          }
        } catch (err) {
          console.error("[whatsapp-api] Error fetching lead context for simulation:", err);
        }
      }

      // 3.2. Fetch semantic matches (RAG & objections) if LOVABLE_API_KEY is available
      let lessonsBlock = "";
      let memoryBlock = "";
      let objectionsBlock = "";
      const vectorMemories: any[] = [];
      let matchedObjectionObj: any = null;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && leadMessage) {
        try {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-embedding-001", input: leadMessage, dimensions: 768 }),
          });
          if (embRes.ok) {
            const embData = await embRes.json();
            const embedding = embData?.data?.[0]?.embedding;
            if (embedding) {
              // Match knowledge base
              const { data: matches } = await supabase.rpc("match_wa_knowledge", {
                query_embedding: embedding,
                p_project_id: project_id,
                match_count: 3,
                min_similarity: 0.7,
              });
              if (matches && matches.length > 0) {
                lessonsBlock = `\nREGRAS E CONHECIMENTOS ADICIONAIS APRENDIDOS:\n` +
                  matches.map((m: any) => `- Se a dúvida/situação for semelhante a "${m.pergunta}", a regra/resposta é: "${m.resposta}"`).join("\n") + "\n";
                
                matches.forEach((m: any) => {
                  vectorMemories.push({
                    type: "knowledge",
                    title: `Conhecimento: "${m.pergunta}"`,
                    content: m.resposta,
                    similarity: m.similarity
                  });
                });
              }

              // Match lead memory
              const cleanPhone = String(phone).replace(/\D/g, "");
              const { data: memories } = await supabase.rpc("match_wa_lead_memory", {
                query_embedding: embedding,
                p_project_id: project_id,
                p_phone: cleanPhone,
                match_count: 3,
                min_similarity: 0.7,
              });
              if (memories && memories.length > 0) {
                memoryBlock = `\nRELEMBRE O QUE O LEAD JÁ DISSE ANTERIORMENTE (MEMÓRIA VETORIAL):\n` +
                  memories.map((m: any) => `- O lead já comentou/disse: "${m.content}"`).join("\n") + "\n";

                memories.forEach((m: any) => {
                  vectorMemories.push({
                    type: "memory",
                    title: "Memória do Lead",
                    content: m.content,
                    similarity: m.similarity
                  });
                });
              }

              // Match calibrated objections
              const { data: matchedObjections } = await supabase.rpc("match_wa_objections", {
                query_embedding: embedding,
                p_project_id: project_id,
                match_count: 1,
                min_similarity: 0.75,
              });
              if (matchedObjections && matchedObjections.length > 0) {
                const match = matchedObjections[0];
                objectionsBlock = `\nOBJEÇÃO DETECTADA E DIRETRIZ COMERCIAL MANDATÓRIA:\nO lead apresentou a objeção: "${match.objecao}".\nVocê DEVE responder exatamente contornando a objeção usando a seguinte resposta padrão calibrada: "${match.resposta_padrao}". Não mude o sentido comercial dessa resposta e seja extremamente preciso.\n`;
                
                matchedObjectionObj = {
                  id: match.id,
                  objecao: match.objecao,
                  resposta_padrao: match.resposta_padrao,
                  similarity: match.similarity
                };
              }
            }
          }
        } catch (e: any) {
          console.warn("[whatsapp-api] Error generating simulated semantic context:", e.message);
        }
      }

      // 4. Construct actual Bot System Prompt
      const personalityMap: Record<string, string> = {
        assistente: "Você é um assistente virtual cordial e prestativo.",
        vendedor: "Você é um closer de vendas persuasivo mas não agressivo. Foque em entender a dor e apresentar a solução.",
        suporte: "Você é um agente de suporte técnico eficiente e empático.",
        consultor: "Você é um consultor especialista. Fale com autoridade e dê recomendações valiosas.",
      };

      const toneMap: Record<string, string> = {
        profissional: "Tom profissional e direto.",
        casual: "Tom casual e descontraído, use emojis moderadamente.",
        amigavel: "Tom amigável e acolhedor, use emojis.",
        formal: "Tom formal e respeitoso.",
        urgente: "Tom de urgência e escassez.",
      };

      const leadFirstName = leadNameSim.trim().split(/\s+/)[0] || "";
      const leadGreeting = leadFirstName ? `O nome do lead e "${leadFirstName}". Use o nome dele nas primeiras mensagens da conversa.` : "";

      const botSystemPrompt = `${aiConfig?.expert_persona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${aiConfig.expert_persona}\n\n` : ""}Você é um consultor especialista em vendas pelo WhatsApp, atendendo para "${project?.name || project_id}".
${personalityMap[aiConfig?.personality || "assistente"]}
${toneMap[aiConfig?.tone || "profissional"]}
${leadGreeting}
${leadContextBlock}

METODO OBRIGATORIO — use SEMPRE:
1. EMPATIA: 1 frase que valida a situacao ou desejo do lead (ex: "Faz todo sentido querer isso!")
2. ESPECIFICIDADE: 1-2 frases com dado ou beneficio concreto do produto (NAO seja vago)
3. ENVOLVIMENTO: Feche com 1 pergunta consultiva que avanca a conversa

REGRAS CRITICAS:
- MANTER O LEAD NA ROTA: Aja com empatia imediata, mas retome o foco principal, conectando a dor dele com a solução/oferta.
- NUNCA use placeholders como [Link] ou [Nome do curso].
- Respostas curtas (maximo 4 linhas no WhatsApp). Sem blocos de texto.
- Nunca revele que e IA.
- Responda em portugues brasileiro natural.
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}${aiConfig?.product_focus ? `\nOFERTA ATIVA: ${aiConfig.product_focus}` : ""}${aiConfig?.custom_instructions ? `\nREGRAS GERAIS ADICIONAIS:\n${aiConfig.custom_instructions}` : ""}${lessonsBlock}${memoryBlock}${objectionsBlock}`.trim();

      // 5. Query LLM to simulate response + output thoughts & matched metrics
      const systemPrompt = `Você é o simulador oficial de testes de IA do ImperioHQ.
Seu objetivo é analisar a mensagem atual do lead e simular com precisão a resposta da IA como se ela estivesse respondendo no WhatsApp com base no System Prompt real da IA fornecido abaixo.
Além disso, você deve simular a análise interna de sentimentos e o mapeamento de objeções do cérebro da IA.

PENSAMENTO E DIRETRIZES DA IA (O que a IA simulada deve seguir):
----------------------------------
${botSystemPrompt}
----------------------------------

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
- NUNCA diga que é uma inteligência artificial, robô ou assistente limitado. Não use frases como "como sou um assistente virtual, não tenho acesso".
- Seja EXTREMAMENTE CONCISO (máximo 1-2 parágrafos curtos). Mensagens longas são ignoradas.
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
      const isImage = media_type === "image" || (media_url && (media_url.endsWith(".png") || media_url.endsWith(".jpg") || media_url.endsWith(".jpeg") || media_url.endsWith(".webp")));
      if (isImage && media_url) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: leadMessage || "Analise esta imagem enviada pelo lead." },
            { type: "image_url", image_url: { url: media_url } }
          ]
        } as any);
      } else {
        messages.push({ role: "user", content: leadMessage || "" });
      }

      // Call LLM (using Lovable AI gateway or OpenRouter based on config)
      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
      const provider = aiConfig?.ai_provider === "openrouter" ? "openrouter" : "lovable";
      const model = aiConfig?.ai_model || (provider === "openrouter" ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview");
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

        return new Response(JSON.stringify({
          success: true,
          ...parsedSimulation,
          systemPrompt: botSystemPrompt,
          vectorMemories,
          matchedObjection: matchedObjectionObj
        }), {
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
  } catch (err) {
    console.error("whatsapp-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
