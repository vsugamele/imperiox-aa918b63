import { z } from "https://esm.sh/zod@3.25.76";
const templateSchema = z.object({ id: z.string().optional(), name: z.string().nullish(), subject: z.string().nullish(), html_body: z.string().nullish() }).passthrough();
const emailConfigSchema = z.object({ resend_api_key: z.string().nullish(), from_email: z.string().nullish(), from_name: z.string().nullish(), reply_to: z.string().nullish(), templates: z.array(templateSchema).nullish() }).passthrough();
const projectMailSchema = z.object({ email_config: emailConfigSchema.nullish(), checklist: z.object({ resend: emailConfigSchema.nullish() }).passthrough().nullish() }).passthrough();
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, template_id, to_email, inline } = await req.json();

    if (!project_id || !to_email || (!template_id && !inline)) {
      return new Response(JSON.stringify({ error: "project_id, to_email e (template_id ou inline) são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch project
    const { data: project, error: projErr } = await supabase
      .from("imphq_projects")
      .select("data")
      .eq("id", project_id)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try secure credentials table first
    let resendApiKey = "";
    let fromEmail = "";
    let fromName = "";
    let replyTo = "";

    const { data: creds } = await supabase
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("project_id", project_id)
      .eq("provider", "resend")
      .maybeSingle();

    if (creds?.credentials) {
      resendApiKey = creds.credentials.api_key || "";
      fromEmail = creds.credentials.from_email || "";
      fromName = creds.credentials.from_name || "";
      replyTo = creds.credentials.reply_to || "";
    }

    // Fallback to legacy JSONB storage
    const projectMail = projectMailSchema.parse(project.data || {});
    const emailConfig = projectMail.email_config || {};
    const briefingResend = projectMail.checklist?.resend || {};
    if (!resendApiKey) {
      resendApiKey = emailConfig.resend_api_key || briefingResend.resend_api_key || "";
      fromEmail = fromEmail || emailConfig.from_email || briefingResend.from_email || "";
      fromName = fromName || emailConfig.from_name || briefingResend.from_name || "";
      replyTo = replyTo || emailConfig.reply_to || briefingResend.reply_to || "";
    }

    console.log("[send-project-email] project_id:", project_id, "template_id:", template_id, "to:", to_email);
    console.log("[send-project-email] resendApiKey set:", !!resendApiKey, "fromEmail:", fromEmail);

    if (!resendApiKey) {
      console.error("[send-project-email] Resend API Key não configurada");
      return new Response(JSON.stringify({ error: "Resend API Key não configurada neste projeto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let template: z.infer<typeof templateSchema> | undefined;
    if (inline) {
      template = { name: inline.name || "inline", subject: inline.subject, html_body: inline.html_body };
    } else {
      const templates = emailConfig.templates || [];
      console.log("[send-project-email] Templates disponíveis:", templates.map((t) => ({ id: t.id, name: t.name })));
      template = templates.find((t) => t.id === template_id);
      if (!template) {
        return new Response(JSON.stringify({ error: "Template não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to_email],
        subject: template.subject,
        html: template.html_body,
        reply_to: replyTo || undefined,
      }),
    });

    const resendData = await resendRes.json();

    // Log the email event in imphq_events
    const eventData = {
      to_email,
      template_name: template.name,
      template_id,
      resend_id: resendData.id || null,
      status: resendRes.ok ? "sent" : "error",
      error: resendRes.ok ? null : (resendData.message || "Unknown error"),
    };

    await supabase.from("imphq_events").insert({
      project_id,
      event_name: "email_sent",
      page_url: "",
      event_data: eventData,
    });

    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: resendData.message || "Erro no Resend", details: resendData }), {
        status: resendRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
