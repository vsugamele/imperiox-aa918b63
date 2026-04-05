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
    let projectIdFromQuery = url.searchParams.get("project");

    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("form")) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await req.json().catch(() => ({}));
    }

    // --- Resolve form config if form_id is present ---
    let formConfig: any = null;
    let projectId = projectIdFromQuery;
    let step: string | null = null;

    if (body.form_id) {
      const { data: form } = await supabase
        .from("imphq_capture_forms")
        .select("*")
        .eq("id", body.form_id)
        .maybeSingle();

      if (form) {
        formConfig = form;
        projectId = form.project_id || projectId;
        step = form.step || null;
      }
    }

    // --- Extract standard fields ---
    const email = (body.email || "").toString().trim().toLowerCase();
    const name = (body.name || body.nome || "").toString().trim();
    const phone = (body.phone || body.telefone || "").toString().trim();
    const tags = Array.isArray(body.tags) ? body.tags : (body.tags || "").toString().split(",").map((t: string) => t.trim()).filter(Boolean);
    const source = (body.source || body.origem || "formulario").toString().trim();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email é obrigatório" }),
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
      const updates: any = {};
      if (name) updates.nome = name;
      if (phone) updates.phone = phone;
      if (tags.length) updates.tags = tags;
      if (step) updates.status = step;
      // Ensure data.visitor_id is set for timeline
      const { data: currentLead } = await supabase.from("imphq_leads").select("data").eq("id", leadId).maybeSingle();
      const currentData = currentLead?.data || {};
      if (!currentData.visitor_id) {
        updates.data = { ...currentData, visitor_id: leadId };
      }
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
        status: step || "lead",
        tags: tags.length ? tags : null,
        project_id: projectId,
        data: {
          visitor_id: leadId,
          ultimo_evento: "lead_capturado",
          captura_origem: source,
          capturado_em: new Date().toISOString(),
        },
      });
    }

    // --- Save extra responses if form_id exists ---
    if (body.form_id && formConfig) {
      const standardKeys = new Set([
        "form_id", "email", "name", "nome", "phone", "telefone",
        "tags", "source", "origem", "page_url", "redirect_url",
        "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      ]);

      const rows: any[] = [];
      for (const [key, value] of Object.entries(body)) {
        if (!standardKeys.has(key) && value !== undefined && value !== "") {
          rows.push({
            id: crypto.randomUUID(),
            lead_id: leadId,
            project_id: projectId,
            form_id: body.form_id,
            step: step || null,
            field_key: key,
            question: key,
            answer: String(value),
          });
        }
      }

      if (rows.length > 0) {
        const { error: respError } = await supabase.from("imphq_lead_responses").insert(rows);
        if (respError) {
          console.error("[capture-lead] Erro ao salvar respostas:", respError);
        }
      }
    }

    // Log event with visitor_id = leadId
    await supabase.from("imphq_events").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      visitor_id: leadId,
      event_name: "LeadCapture",
      event_data: { email, name, phone, source, tags, form_id: body.form_id || null },
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
      JSON.stringify({ success: true, ok: true, lead_id: leadId, is_new: !existing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[capture-lead] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
