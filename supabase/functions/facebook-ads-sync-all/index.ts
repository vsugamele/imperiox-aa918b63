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

    // BRT helper — avoids UTC off-by-one (Brazil = UTC-3)
    const brtDateStr = (d: Date = new Date()) =>
      d.toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(",")[0];
    const todayBRT = brtDateStr();
    // Janela de 7 dias: a Meta ainda ajusta spend de D-3/D-2 por atribuição.
    const sevenDaysAgoBRT = brtDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const dfrom = sevenDaysAgoBRT;
    const dto = todayBRT;

    const results: { project_id: string; name: string; imported: number; errors: number; creatives: number }[] = [];

    for (const proj of configuredProjects) {
      try {
        // Try secure credentials table first, fallback to JSONB
        let rawToken = "";
        let adAccountIdVal = "";
        const { data: creds } = await supabase
          .from("imphq_integration_credentials")
          .select("credentials")
          .eq("project_id", proj.id)
          .eq("provider", "facebook")
          .maybeSingle();

        if (creds?.credentials) {
          rawToken = creds.credentials.access_token || creds.credentials.marketing_token || "";
          adAccountIdVal = creds.credentials.ad_account_id || "";
        }
        if (!rawToken) rawToken = proj.data?.facebook_marketing_token || proj.data?.facebook_access_token || "";
        if (!adAccountIdVal) adAccountIdVal = proj.data?.facebook_ad_account_id || "";
        const accessToken = rawToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
        const adAccountId = adAccountIdVal;
        const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

        // Fetch insights — full funnel (video + checkout + LP views) in BRT
        // Includes campaign_id, adset_id, ad_id for the Gerenciador (toggle ATIVO/PAUSADO)
        const fields = [
          "campaign_id", "adset_id", "ad_id",
          "campaign_name", "adset_name", "ad_name",
          "spend", "impressions", "reach", "clicks", "ctr", "frequency",
          "actions", "inline_link_clicks",
          "video_play_actions", "video_thruplay_watched_actions",
        ].join(",");
        const insightsUrl = `${FB_BASE}/${actId}/insights?fields=${fields}&time_range={"since":"${dfrom}","until":"${dto}"}&time_increment=1&level=ad&limit=500&access_token=${accessToken}`;
        const insightsRes = await fetch(insightsUrl);
        if (!insightsRes.ok) {
          const errBody = await insightsRes.text();
          console.error(`[FB Sync] ${proj.name} insights failed (${insightsRes.status}):`, errBody.slice(0, 500));
          // Persist error state for dashboard alert
          let parsedErr: any = {};
          try { parsedErr = JSON.parse(errBody)?.error || {}; } catch (_) {}
          const errData = {
            ...proj.data,
            facebook_sync_status: "error",
            facebook_sync_error: {
              status: insightsRes.status,
              code: parsedErr.code || null,
              subcode: parsedErr.error_subcode || null,
              message: (parsedErr.message || errBody.slice(0, 300)),
              at: new Date().toISOString(),
            },
          };
          await supabase.from("imphq_projects").update({ data: errData }).eq("id", proj.id);
          results.push({ project_id: proj.id, name: proj.name, imported: 0, errors: 1, creatives: 0 });
          continue;
        }

        const insightsData = await insightsRes.json();
        const rows = insightsData.data || [];
        console.log(`[FB Sync] ${proj.name} act=${actId} range=${dfrom}..${dto} rows=${rows.length}`);

        // Fetch campaigns metadata (status + daily_budget) — keyed by campaign_id
        const campaignMeta = new Map<string, { status: string; daily_budget: number | null }>();
        try {
          const campUrl = `${FB_BASE}/${actId}/campaigns?fields=id,effective_status,daily_budget&limit=500&access_token=${accessToken}`;
          const cRes = await fetch(campUrl);
          if (cRes.ok) {
            const cJson = await cRes.json();
            for (const c of cJson.data || []) {
              campaignMeta.set(c.id, {
                status: c.effective_status,
                daily_budget: c.daily_budget != null ? Number(c.daily_budget) / 100 : null, // FB retorna em centavos
              });
            }
          }
        } catch (_) { /* opcional */ }


        let imported = 0;
        let errors = 0;

        for (const row of rows) {
          const actions = row.actions || [];
          const getAction = (type: string) => {
            const a = actions.find((x: any) => x.action_type === type);
            return a ? parseInt(a.value) : 0;
          };
          const getActionList = (list: any[]) => Array.isArray(list) && list[0] ? parseInt(list[0].value) : 0;

          const leads = getAction("lead") + getAction("offsite_conversion.fb_pixel_lead");
          const compras = getAction("offsite_conversion.fb_pixel_purchase") + getAction("purchase");
          const initCheckout = getAction("initiate_checkout") + getAction("offsite_conversion.fb_pixel_initiate_checkout");
          const addToCart = getAction("add_to_cart") + getAction("offsite_conversion.fb_pixel_add_to_cart");
          const lpViews = getAction("landing_page_view");
          const video3s = getActionList(row.video_play_actions);
          const videoThruplay = getActionList(row.video_thruplay_watched_actions);
          const linkClicks = parseInt(row.inline_link_clicks || "0");
          const spend = parseFloat(row.spend || "0");

          const record = {
            project_id: proj.id,
            plataforma: "Facebook",
            campaign_id: row.campaign_id || null,
            adset_id: row.adset_id || null,
            ad_id: row.ad_id || null,
            effective_status: row.campaign_id ? campaignMeta.get(row.campaign_id)?.status ?? null : null,
            daily_budget: row.campaign_id ? campaignMeta.get(row.campaign_id)?.daily_budget ?? null : null,
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
            init_checkout: initCheckout,
            add_to_cart: addToCart,
            landing_page_views: lpViews,
            video_3s_views: video3s,
            video_thruplay: videoThruplay,
            link_clicks: linkClicks,
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

        const summary = { range: { from: dfrom, to: dto }, rows: rows.length, imported, errors, account_id: actId };
        console.log(`[FB Sync] ${proj.name} summary`, JSON.stringify(summary));

        // Status: "empty" se Meta não retornou nenhuma linha — sinaliza conta errada/sem gasto
        const syncStatus = rows.length === 0 ? "empty" : "ok";
        const syncError = rows.length === 0
          ? { reason: "no_insights", account_id: actId, range: { from: dfrom, to: dto }, at: new Date().toISOString() }
          : null;

        const baseUpdate = {
          ...proj.data,
          facebook_last_sync: new Date().toISOString(),
          facebook_sync_status: syncStatus,
          facebook_sync_error: syncError,
          facebook_last_sync_summary: summary,
        };

        if (creativesCount === 0) {
          await supabase.from("imphq_projects").update({ data: baseUpdate }).eq("id", proj.id);
        } else {
          await supabase.from("imphq_projects").update({
            data: { ...baseUpdate, facebook_creatives: proj.data?.facebook_creatives },
          }).eq("id", proj.id);
        }

        results.push({ project_id: proj.id, name: proj.name, imported, errors, creatives: creativesCount });
      } catch (e) {
        console.error(`[FB Sync] ${proj.name} exception`, e);
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
