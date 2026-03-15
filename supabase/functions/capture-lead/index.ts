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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project");

    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("form")) {
      const formData = await req.formData();
      body: any = {};
      body = Object.fromEntries(formData.entries());
    } else {
      body = await req.json().catch(() => ({}));
    }

    const email = (body.email || "").toString().trim().toLowerCase();
    const name = (body.name || body.nome || "").toString().trim();
    const phone = (body.phone || body.telefone || "").toString().trim();
    const tags = Array.isArray(body.tags) ? body.tags : (body.tags || "").toString().split(",").map((t: string) => t.trim()).filter(Boolean);
    const source = (body.source || body.origem || "formulario").toString().trim();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dedup by email
    const { data: existing } = await supabase
      .from("imphq_leads")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    let leadId: string;

    if (existing) {
      leadId = existing.id;
      // Update with new data if provided
      const updates: any = {};
      if (name) updates.nome = name;
      if (phone) updates.phone = phone;
      if (tags.length) updates.tags = tags;
      if (Object.keys(updates).length) {
        await supabase.from("imphq_leads").update(updates).eq("id", leadId);
      }
    } else {
      leadId = crypto.randomUUID();
      await supabase.from("imphq_leads").insert({
        id: leadId,
        nome: name || email,
        email,
        phone: phone || null,
        plataforma: source,
        status: "lead",
        tags: tags.length ? tags : null,
        project_id: projectId,
        data: {
          ultimo_evento: "lead_capturado",
          captura_origem: source,
          capturado_em: new Date().toISOString(),
        },
      });
    }

    // Log event
    await supabase.from("imphq_events").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      event_name: "LeadCapture",
      event_data: { email, name, phone, source, tags },
      page_url: body.page_url || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    });

    // If redirect specified, do 302
    if (body.redirect_url) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: body.redirect_url },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, lead_id: leadId, is_new: !existing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[capture-lead] Erro:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
