import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FB_API_VERSION = "v19.0";
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all projects with facebook credentials configured
    const { data: allProjects, error: pErr } = await supabase
      .from("imphq_projects")
      .select("id, name, data")
      .not("data", "is", null);

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configuredProjects = (allProjects || []).filter((p: any) => {
      const d = p.data;
      return d?.facebook_ad_account_id && (d?.facebook_marketing_token || d?.facebook_access_token);
    });

    if (configuredProjects.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "Nenhum projeto com Facebook Ads configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const dfrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dto = now.toISOString().split("T")[0];

    const results: { project_id: string; name: string; imported: number; errors: number; creatives: number }[] = [];

    for (const proj of configuredProjects) {
      try {
        const rawToken = proj.data?.facebook_marketing_token || proj.data?.facebook_access_token || "";
        const accessToken = rawToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
        const adAccountId = proj.data?.facebook_ad_account_id;
        const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

        // Fetch insights
        const insightsUrl = `${FB_BASE}/${actId}/insights?fields=campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,ctr,frequency,actions&time_range={"since":"${dfrom}","until":"${dto}"}&level=ad&time_increment=1&limit=500&access_token=${accessToken}`;
        const insightsRes = await fetch(insightsUrl);
        if (!insightsRes.ok) {
          results.push({ project_id: proj.id, name: proj.name, imported: 0, errors: 1, creatives: 0 });
          continue;
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

          const record = {
            project_id: proj.id,
            plataforma: "Facebook",
            campanha: row.campaign_name || null,
            conjunto_anuncios: row.adset_name || null,
            anuncio: row.ad_name || null,
            data_ref: row.date_start,
            valor: spend,
            impressoes: parseInt(row.impressions || "0"),
            alcance: parseInt(row.reach || "0"),
            cliques: parseInt(row.clicks || "0"),
            leads,
            compras,
            custo_por_compra: compras > 0 ? spend / compras : null,
            hook_rate: null,
            ctr: parseFloat(row.ctr || "0"),
            frequencia: parseFloat(row.frequency || "0"),
            moeda: "BRL",
          };

          const { data: existing } = await supabase
            .from("imphq_ads_spend")
            .select("id")
            .eq("project_id", proj.id)
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
          if (opError) errors++;
          else imported++;
        }

        // Fetch creatives
        let creativesCount = 0;
        try {
          const adsUrl = `${FB_BASE}/${actId}/ads?fields=name,effective_status,creative{id,name,thumbnail_url,image_url,body,title}&limit=200&access_token=${accessToken}`;
          const adsRes = await fetch(adsUrl);
          if (adsRes.ok) {
            const adsData = await adsRes.json();
            const adItems = adsData.data || [];
            const creatives = adItems
              .filter((ad: any) => ad.creative)
              .map((ad: any) => ({
                name: ad.creative.name || ad.name,
                thumbnail_url: ad.creative.thumbnail_url,
                image_url: ad.creative.image_url,
                body: ad.creative.body,
                title: ad.creative.title,
                status: ad.effective_status,
                ad_name: ad.name,
              }));
            const uniqueCreatives = Array.from(
              new Map(creatives.map((c: any) => [c.name + (c.image_url || c.thumbnail_url || ""), c])).values()
            );
            creativesCount = uniqueCreatives.length;
            const newData = { ...proj.data, facebook_creatives: uniqueCreatives, facebook_last_sync: new Date().toISOString() };
            await supabase.from("imphq_projects").update({ data: newData }).eq("id", proj.id);
          }
        } catch (_) { /* creatives optional */ }

        // Update last sync even if no creatives
        if (creativesCount === 0) {
          const newData = { ...proj.data, facebook_last_sync: new Date().toISOString() };
          await supabase.from("imphq_projects").update({ data: newData }).eq("id", proj.id);
        }

        results.push({ project_id: proj.id, name: proj.name, imported, errors, creatives: creativesCount });
      } catch (e) {
        results.push({ project_id: proj.id, name: proj.name, imported: 0, errors: 1, creatives: 0 });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced: results.length,
      results,
      period: { from: dfrom, to: dto },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
