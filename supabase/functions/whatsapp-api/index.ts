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

    // ── Helper: get provider config ──
    async function getProvider(providerId: string) {
      const { data, error } = await supabase
        .from("imphq_wa_providers")
        .select("*")
        .eq("id", providerId)
        .single();
      if (error || !data) throw new Error("Provider não encontrado: " + (error?.message || ""));
      return data;
    }

    // ── Helper: send via Evolution API ──
    async function sendEvolution(provider: any, phone: string, text: string) {
      const res = await fetch(`${provider.api_url}/message/sendText/${provider.instance_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: provider.api_key,
        },
        body: JSON.stringify({ number: phone, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Evolution error [${res.status}]: ${JSON.stringify(data)}`);
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

      let result;
      if (provider.provider === "evolution") {
        result = await sendEvolution(provider, phone, content);
      } else {
        result = await sendTwilio(provider, phone, content);
      }

      // Save message
      await supabase.from("imphq_wa_messages").insert({
        conversation_id: conversation_id || phone,
        project_id: project_id || provider.project_id,
        direction: "outgoing",
        phone,
        content,
        provider: provider.provider,
        provider_message_id: result?.key?.id || result?.sid || null,
        status: "sent",
      });

      // Update conversation message count
      if (conversation_id) {
        const { data: conv } = await supabase
          .from("imphq_wa_conversations")
          .select("message_count")
          .eq("id", conversation_id)
          .single();
        if (conv) {
          await supabase
            .from("imphq_wa_conversations")
            .update({ message_count: (conv.message_count || 0) + 1 })
            .eq("id", conversation_id);
        }
      }

      return new Response(JSON.stringify({ success: true, result }), {
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

          if (provider.provider === "evolution") {
            await sendEvolution(provider, contact.phone, text);
          } else {
            await sendTwilio(provider, contact.phone, text);
          }

          await supabase.from("imphq_wa_messages").insert({
            conversation_id: contact.phone,
            project_id: project_id || provider.project_id,
            direction: "outgoing",
            phone: contact.phone,
            content: text,
            provider: provider.provider,
            status: "sent",
          });

          results.push({ phone: contact.phone, status: "sent" });

          // Anti-ban delay
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

      const res = await fetch(`${provider.api_url}/instance/connect/${provider.instance_name}`, {
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
        `${provider.api_url}/instance/connectionState/${provider.instance_name}`,
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

    // ── ACTION: webhook (receive messages) ──
    if (action === "webhook") {
      const body = await req.json();
      const providerType = url.searchParams.get("provider") || "evolution";

      let phone = "";
      let content = "";
      let projectId = "";
      let providerMsgId = "";

      if (providerType === "evolution") {
        // Evolution webhook payload
        phone = body?.data?.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
        content = body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || "";
        providerMsgId = body?.data?.key?.id || "";
        // Try to find project from instance
        const instanceName = body?.instance || "";
        const { data: prov } = await supabase
          .from("imphq_wa_providers")
          .select("project_id")
          .eq("instance_name", instanceName)
          .single();
        projectId = prov?.project_id || "";
      } else if (providerType === "twilio") {
        phone = (body?.From || "").replace("whatsapp:+", "");
        content = body?.Body || "";
        providerMsgId = body?.MessageSid || "";
      }

      if (phone && content) {
        await supabase.from("imphq_wa_messages").insert({
          conversation_id: phone,
          project_id: projectId,
          direction: "incoming",
          phone,
          content,
          provider: providerType,
          provider_message_id: providerMsgId,
          status: "received",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
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
