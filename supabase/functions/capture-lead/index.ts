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

    // Build form metadata to persist in lead.data
    const formMeta: Record<string, any> = {};
    if (body.form_id && formConfig) {
      formMeta.form_id = body.form_id;
      formMeta.form_name = formConfig.nome || formConfig.name || null;
      formMeta.captura_form_step = step || null;
    }

    if (existing) {
      leadId = existing.id;
      const updates: any = {};
      if (name) updates.nome = name;
      if (phone) updates.phone = phone;
      if (tags.length) updates.tags = tags;
      if (step) updates.status = step;
      const { data: currentLead } = await supabase.from("imphq_leads").select("data").eq("id", leadId).maybeSingle();
      const currentData = currentLead?.data || {};
      updates.data = { ...currentData, visitor_id: currentData.visitor_id || leadId, ...formMeta };
      await supabase.from("imphq_leads").update(updates).eq("id", leadId);
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
          ...formMeta,
        },
      });
    }

    // --- Save extra responses if form_id exists ---
    if (body.form_id && formConfig) {
      // Build field_key → label map from form config
      const fieldLabelMap: Record<string, string> = {};
      const campos = formConfig.campos || formConfig.fields || [];
      if (Array.isArray(campos)) {
        campos.forEach((campo: any) => {
          const key = campo.name || campo.key || campo.id;
          const label = campo.label || campo.question || campo.placeholder || key;
          if (key) fieldLabelMap[key] = label;
        });
      }

      // Only exclude meta-fields; save ALL user-submitted data (including name, email, phone) as responses
      const standardKeys = new Set([
        "form_id", "redirect_url", "page_url",
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
            question: fieldLabelMap[key] || key,
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

    // --- Lead scoring on capture ---
    try {
      const scoreRows: any[] = [];
      scoreRows.push({ lead_id: leadId, acao: "lead_capturado", pontos: 10 });
      if (body.form_id) scoreRows.push({ lead_id: leadId, acao: "form_preenchido", pontos: 5 });
      if (phone) scoreRows.push({ lead_id: leadId, acao: "telefone_informado", pontos: 5 });
      await supabase.from("imphq_lead_scores_log").insert(scoreRows);
    } catch (e) {
      console.warn("[capture-lead] Erro ao registrar score:", e);
    }

    // --- Accumulate interaction in lead.data.interacoes ---
    try {
      const { data: currentLeadData } = await supabase.from("imphq_leads").select("data").eq("id", leadId).maybeSingle();
      const ld = (currentLeadData?.data as Record<string, any>) || {};
      const interacoes: any[] = ld.interacoes || [];
      interacoes.push({
        evento: "lead_capturado",
        data: new Date().toISOString(),
        form_id: body.form_id || null,
        plataforma: source,
        utms: { utm_source: body.utm_source, utm_medium: body.utm_medium, utm_campaign: body.utm_campaign },
      });
      await supabase.from("imphq_leads").update({
        data: { ...ld, interacoes, ultimo_evento: "lead_capturado" },
      }).eq("id", leadId);
    } catch (e) {
      console.warn("[capture-lead] Erro ao acumular interação:", e);
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
