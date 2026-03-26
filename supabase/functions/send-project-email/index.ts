import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const emailConfig = (project.data as any)?.email_config;
    if (!emailConfig?.resend_api_key) {
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
        "Authorization": `Bearer ${emailConfig.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailConfig.from_name
          ? `${emailConfig.from_name} <${emailConfig.from_email}>`
          : emailConfig.from_email,
        to: [to_email],
        subject: template.subject,
        html: template.html_body,
        reply_to: emailConfig.reply_to || undefined,
      }),
    });

    const resendData = await resendRes.json();

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
