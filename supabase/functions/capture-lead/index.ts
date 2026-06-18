import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pushNotifyByPref, resolveProjectRecipients } from "../_shared/push-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendCapiLead(opts: {
  pixelId: string; token: string; testCode?: string;
  email: string; name?: string; phone?: string;
  eventId: string; campaignName?: string; productName?: string;
  sourceUrl?: string; clientIp?: string; userAgent?: string; fbc?: string; fbp?: string;
}) {
  const ud: any = {};
  if (opts.email) ud.em = [await sha256(opts.email.toLowerCase())];
  if (opts.name) ud.fn = [await sha256(opts.name.toLowerCase().split(" ")[0])];
  if (opts.phone) ud.ph = [await sha256(opts.phone.replace(/\D/g, ""))];
  if (opts.clientIp) ud.client_ip_address = opts.clientIp;
  if (opts.userAgent) ud.client_user_agent = opts.userAgent;
  if (opts.fbc) ud.fbc = opts.fbc;
  if (opts.fbp) ud.fbp = opts.fbp;

  const payload: any = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.eventId,
      action_source: "website",
      event_source_url: opts.sourceUrl || undefined,
      user_data: ud,
      custom_data: {
        campaign_name: opts.campaignName || undefined,
        content_name: opts.productName || undefined,
      },
    }],
  };
  if (opts.testCode) payload.test_event_code = opts.testCode;

  const r = await fetch(`https://graph.facebook.com/v18.0/${opts.pixelId}/events?access_token=${opts.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await r.json().catch(() => ({}));
}


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
      const s = (formConfig.settings || {}) as Record<string, any>;
      formMeta.form_id = body.form_id;
      formMeta.form_name = formConfig.nome || formConfig.name || null;
      formMeta.captura_form_step = step || null;
      if (s.form_type) formMeta.form_type = s.form_type;
      if (s.campaign_name) formMeta.campaign_name = s.campaign_name;
      if (s.campaign_id) formMeta.campaign_id = s.campaign_id;
      if (s.product_name) formMeta.ultimo_produto = s.product_name;
      if (s.tag) formMeta.form_tag = s.tag;
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
      // Resolver tag → projeto SEMPRE que houver tags (override mesmo se veio project_id)
      if (tags.length) {
        const { data: allRules } = await supabase
          .from("imphq_tag_project_rules")
          .select("project_id, priority, tag, tags_all, origem, plataforma")
          .order("priority", { ascending: true });
        const match = (allRules || []).find((r: any) => {
          const needed: string[] = (r.tags_all && r.tags_all.length > 0) ? r.tags_all : (r.tag ? [r.tag] : []);
          if (needed.length === 0) return false;
          if (!needed.every((t: string) => tags.includes(t))) return false;
          if (r.plataforma && r.plataforma !== source) return false;
          if (r.origem && r.origem !== source) return false;
          return true;
        });
        if (match?.project_id) projectId = match.project_id;
      }

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

      // Push notification — novo lead capturado
      try {
        const recipients = await resolveProjectRecipients(supabase, projectId);
        await pushNotifyByPref({
          supabase,
          prefKey: "novo_lead",
          title: "🎯 Novo lead capturado",
          message: `${name || email} — ${source || "captação"}`,
          user_ids: recipients.length > 0 ? recipients : undefined,
        });
      } catch (e) {
        console.error("[capture-lead] push novo_lead error:", e);
      }
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

    // --- Auto-enroll em sequência de nutrição (default da campanha) ---
    try {
      const campaignId = (formConfig?.settings as any)?.campaign_id;
      if (campaignId) {
        const { data: camp } = await supabase.from("imphq_campaigns").select("data").eq("id", campaignId).maybeSingle();
        const seqId = (camp?.data as any)?.default_sequence_id;
        if (seqId) {
          // Checar filter_tags da sequência
          const { data: seq } = await supabase
            .from("imphq_nurture_sequences")
            .select("filter_tags, filter_tags_mode")
            .eq("id", seqId)
            .maybeSingle();
          const ft: string[] = ((seq as any)?.filter_tags || []) as string[];
          const mode = ((seq as any)?.filter_tags_mode || "any") as string;
          let allowed = true;
          if (ft.length) {
            allowed = mode === "all"
              ? ft.every(t => tags.includes(t))
              : ft.some(t => tags.includes(t));
          }
          if (allowed) {
            const { data: already } = await supabase
              .from("imphq_lead_sequence_enrollments")
              .select("id").eq("lead_id", leadId).eq("sequence_id", seqId).maybeSingle();
            if (!already) {
              await supabase.from("imphq_lead_sequence_enrollments").insert({
                lead_id: leadId,
                sequence_id: seqId,
                status: "ativo",
                data_inicio: new Date().toISOString(),
                dia_atual: 0,
                proximo_envio_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              } as any);
            }
          }
        }

      }
    } catch (e) {
      console.warn("[capture-lead] Auto-enroll nutrição falhou:", e);
    }

    // --- CAPI Lead (server-side) com dedup via event_id ---
    try {
      if (projectId) {
        const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
        const pd: any = proj?.data || {};
        const fbToken = (pd.facebook_access_token || "").replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
        const fbPixel = pd.facebook_pixel_id;
        if (fbToken && fbPixel) {
          const eventId = `lead_${leadId}_${Date.now()}`;
          const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
          const userAgent = req.headers.get("user-agent") || undefined;
          await sendCapiLead({
            pixelId: fbPixel,
            token: fbToken,
            testCode: pd.facebook_test_event_code,
            email, name, phone,
            eventId,
            campaignName: (formConfig?.settings as any)?.campaign_name || body.utm_campaign,
            productName: (formConfig?.settings as any)?.product_name,
            sourceUrl: body.page_url,
            clientIp, userAgent,
            fbc: body.fbc, fbp: body.fbp,
          });
        }
      }
    } catch (e) {
      console.warn("[capture-lead] CAPI Lead falhou:", e);
    }

    // If redirect specified, do 302
    if (body.redirect_url) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: body.redirect_url },
      });
    }

    // ── Dispara webhook de saída lead.created ──
    if (!existing) {
      try {
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-webhook-dispatcher`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            event: "lead.created",
            project_id: projectId,
            payload: { lead_id: leadId, nome: name, email, telefone: phone, project_id: projectId },
          }),
        }).catch(() => {});
      } catch (_) {}
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
