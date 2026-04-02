import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const FB_API_VERSION = "v19.0";
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, date_from, date_to } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get project data
    const { data: project, error: pErr } = await supabase.from("imphq_projects").select("data").eq("id", project_id).single();
    if (pErr || !project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rawToken = project.data?.facebook_access_token || "";
    const accessToken = rawToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
    const adAccountId = project.data?.facebook_ad_account_id;

    if (!accessToken || !adAccountId) {
      return new Response(JSON.stringify({ error: "Configure o Access Token e Ad Account ID nas configurações do projeto" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize ad account ID
    const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    // Date range
    const now = new Date();
    const dfrom = date_from || new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const dto = date_to || now.toISOString().split("T")[0];

    // 1. Fetch insights at ad level, daily
    const insightsUrl = `${FB_BASE}/${actId}/insights?fields=campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,ctr,frequency,actions&time_range={"since":"${dfrom}","until":"${dto}"}&level=ad&time_increment=1&limit=500&access_token=${accessToken}`;

    const insightsRes = await fetch(insightsUrl);
    if (!insightsRes.ok) {
      const err = await insightsRes.json();
      return new Response(JSON.stringify({ error: "Facebook API error", details: err.error?.message || err }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const insightsData = await insightsRes.json();
    const rows = insightsData.data || [];

    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      const actions = row.actions || [];
      const getAction = (type: string) => {
        const a = actions.find((x: any) => x.action_type === type);
        return a ? parseInt(a.value) : 0;
      };

      const leads = getAction("lead") + getAction("offsite_conversion.fb_pixel_lead");
      const compras = getAction("offsite_conversion.fb_pixel_purchase") + getAction("purchase");

      const spend = parseFloat(row.spend || "0");
      const impressoes = parseInt(row.impressions || "0");
      const cliques = parseInt(row.clicks || "0");
      const alcance = parseInt(row.reach || "0");
      const ctr = parseFloat(row.ctr || "0");
      const frequencia = parseFloat(row.frequency || "0");

      const record = {
        project_id,
        plataforma: "Facebook",
        campanha: row.campaign_name || null,
        conjunto_anuncios: row.adset_name || null,
        anuncio: row.ad_name || null,
        data_ref: row.date_start,
        valor: spend,
        impressoes,
        alcance,
        cliques,
        leads,
        compras,
        custo_por_compra: compras > 0 ? spend / compras : null,
        hook_rate: null,
        ctr,
        frequencia,
        moeda: "BRL",
      };

      // Upsert: match on project + campaign + adset + ad + date
      const { data: existing } = await supabase
        .from("imphq_ads_spend")
        .select("id")
        .eq("project_id", project_id)
        .eq("campanha", record.campanha)
        .eq("data_ref", record.data_ref)
        .eq("conjunto_anuncios", record.conjunto_anuncios)
        .eq("anuncio", record.anuncio)
        .maybeSingle();

      let opError;
      if (existing) {
        const { error } = await supabase.from("imphq_ads_spend").update(record).eq("id", existing.id);
        opError = error;
      } else {
        const { error } = await supabase.from("imphq_ads_spend").insert(record);
        opError = error;
      }

      if (opError) { errors++; } else { imported++; }
    }

    // 2. Fetch creatives (save to project data)
    let creativesCount = 0;
    try {
      const creativesUrl = `${FB_BASE}/${actId}/adcreatives?fields=name,thumbnail_url,body,title,image_url&limit=100&access_token=${accessToken}`;
      const creativesRes = await fetch(creativesUrl);
      if (creativesRes.ok) {
        const creativesData = await creativesRes.json();
        const creatives = (creativesData.data || []).map((c: any) => ({
          name: c.name, thumbnail_url: c.thumbnail_url, body: c.body, title: c.title, image_url: c.image_url,
        }));
        creativesCount = creatives.length;

        // Save creatives to project data
        const newData = { ...project.data, facebook_creatives: creatives, facebook_last_sync: new Date().toISOString() };
        await supabase.from("imphq_projects").update({ data: newData }).eq("id", project_id);
      }
    } catch (_) { /* creatives are optional */ }

    return new Response(JSON.stringify({
      success: true,
      imported,
      errors,
      creatives: creativesCount,
      period: { from: dfrom, to: dto },
      total_rows: rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
