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
    const { project_id, template_id, to_email } = await req.json();

    if (!project_id || !template_id || !to_email) {
      return new Response(JSON.stringify({ error: "project_id, template_id e to_email são obrigatórios" }), {
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

    // Try email_config first, fallback to checklist.resend
    const emailConfig = (project.data as any)?.email_config || {};
    const briefingResend = (project.data as any)?.checklist?.resend || {};
    const resendApiKey = emailConfig.resend_api_key || briefingResend.resend_api_key;
    const fromEmail = emailConfig.from_email || briefingResend.from_email;
    const fromName = emailConfig.from_name || briefingResend.from_name || "";
    const replyTo = emailConfig.reply_to || briefingResend.reply_to || "";

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend API Key não configurada neste projeto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templates = emailConfig.templates || [];
    const template = templates.find((t: any) => t.id === template_id);
    if (!template) {
      return new Response(JSON.stringify({ error: "Template não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const eventData: any = {
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
      data: eventData,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
