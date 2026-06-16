// Sync Meta Ads data via Zernio API (read-only).
// Endpoints used:
//   GET /api/v1/ads/accounts?accountId=<zernioAcc>
//   GET /api/v1/ads/campaigns?accountId=<zernioAcc>&adAccountId=<act_xxx>
//   GET /api/v1/ads?accountId=<zernioAcc>&adAccountId=<act_xxx>
//   GET /api/v1/ads/insights?accountId=<zernioAcc>&adId=<zernio_ad_id>&since=&until=
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const ZERNIO_BASE = "https://zernio.com/api/v1";

const brtDateStr = (d: Date = new Date()) =>
  d.toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" }).split(",")[0];

async function zFetch(path: string, apiKey: string) {
  const r = await fetch(`${ZERNIO_BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

function pickAction(actions: any, type: string): number {
  if (!actions) return 0;
  // Zernio's /ads endpoint returns actions as a map: {purchase: 7, lead: 9, ...}
  if (!Array.isArray(actions) && typeof actions === "object") {
    const v = actions[type];
    return v ? parseInt(String(v), 10) || 0 : 0;
  }
  // /insights returns an array: [{action_type, value}, ...]
  if (Array.isArray(actions)) {
    const a = actions.find((x) => x?.action_type === type);
    return a ? parseInt(a.value || "0", 10) : 0;
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let project_id_for_log: string | null = null;
  let supabaseForCatch: any = null;
  let credsForCatch: any = null;
  try {
    const { project_id, ad_account_id, date_from, date_to } = await req.json();
    project_id_for_log = project_id;
    if (!project_id) return new Response(JSON.stringify({ error: "project_id obrigatório" }), { status: 400, headers: jsonHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    supabaseForCatch = supabase;

    const { data: creds } = await supabase
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("project_id", project_id)
      .eq("provider", "instagram")
      .maybeSingle();
    credsForCatch = creds;

    const apiKey = creds?.credentials?.zernio_api_key;
    const zernioAccountId = creds?.credentials?.zernio_account_id;
    const adAccountId = ad_account_id || creds?.credentials?.zernio_ad_account_id;

    if (!apiKey || !zernioAccountId) {
      return new Response(JSON.stringify({ error: "Zernio não configurado (provider=instagram, auth_method=zernio)" }), { status: 400, headers: jsonHeaders });
    }

    if (!adAccountId) {
      return new Response(JSON.stringify({ error: "ad_account_id obrigatório (ou configure zernio_ad_account_id)" }), { status: 400, headers: jsonHeaders });
    }

    const today = brtDateStr();
    const dfrom = date_from || brtDateStr(new Date(Date.now() - 30 * 86400000));
    const dto = date_to || today;

    const debug: any = { variants_tried: [], chosen_variant: null, sample_campaign: null, sample_ad: null };

    // Try different param variants for campaigns until we find one that returns data.
    // Reordered: onlyAdAccount first (known to work for this tenant).
    const allVariants = [
      { name: "onlyAdAccount", qs: `adAccountId=${encodeURIComponent(adAccountId)}` },
      { name: "camelCase+zernioAcc", qs: `accountId=${encodeURIComponent(zernioAccountId)}&adAccountId=${encodeURIComponent(adAccountId)}` },
      { name: "snake_case+zernioAcc", qs: `accountId=${encodeURIComponent(zernioAccountId)}&ad_account_id=${encodeURIComponent(adAccountId)}` },
      { name: "adAccountAsAccountId", qs: `accountId=${encodeURIComponent(adAccountId)}` },
    ];

    // Cache: reuse last successful variant to skip detection and avoid 429s.
    const cachedVariantName: string | null = creds?.credentials?.zernio_ads_chosen_variant || null;
    const variants = cachedVariantName
      ? allVariants.filter((v) => v.name === cachedVariantName).concat(allVariants.filter((v) => v.name !== cachedVariantName))
      : allVariants;

    const campaignsByZId = new Map<string, any>();
    const ads: any[] = [];
    let qBase = variants[0].qs;
    let chosen = variants[0].name;
    let foundVariant = false;

    for (const v of variants) {
      const c = await zFetch(`/ads/campaigns?${v.qs}&page=1&limit=50`, apiKey);
      await new Promise((r) => setTimeout(r, 400));
      const a = await zFetch(`/ads?${v.qs}&page=1&limit=50`, apiKey);
      await new Promise((r) => setTimeout(r, 400));
      const cCount = (c.body?.campaigns || []).length;
      const aCount = (a.body?.ads || []).length;
      debug.variants_tried.push({
        name: v.name,
        campaigns_status: c.status, campaigns_count: cCount, campaigns_keys: Object.keys(c.body || {}),
        ads_status: a.status, ads_count: aCount, ads_keys: Object.keys(a.body || {}),
      });
      console.log(`[zernio-ads-sync] variant=${v.name} campaigns=${cCount} ads=${aCount} status=${c.status}/${a.status}`);
      if (c.status === 429 || a.status === 429) continue; // rate-limited; try next
      if (c.ok && a.ok && (cCount > 0 || aCount > 0)) {
        qBase = v.qs;
        chosen = v.name;
        foundVariant = true;
        break;
      }
    }
    debug.chosen_variant = chosen;
    debug.cached_variant_used = cachedVariantName === chosen;
    console.log(`[zernio-ads-sync] chosen variant: ${chosen} (cached=${cachedVariantName === chosen})`);

    if (!foundVariant) {
      return new Response(JSON.stringify({ error: "Não foi possível detectar variante Zernio válida (todas vazias ou rate-limited). Tente novamente em 30s.", debug }), { status: 502, headers: jsonHeaders });
    }

    // 1. Campaigns (paginated)
    {
      let page = 1;
      while (true) {
        const { ok, status, body } = await zFetch(`/ads/campaigns?${qBase}&page=${page}&limit=50`, apiKey);
        if (!ok) return new Response(JSON.stringify({ error: "Falha ao listar campanhas Zernio", status, details: body, debug }), { status: 502, headers: jsonHeaders });
        for (const c of (body.campaigns || [])) campaignsByZId.set(String(c.id), c);
        if (!debug.sample_campaign && (body.campaigns || []).length > 0) debug.sample_campaign = body.campaigns[0];
        const pages = body?.pagination?.pages || 1;
        if (page >= pages) break;
        page++;
      }
    }

    // 2. Ads (paginated)
    {
      let page = 1;
      while (true) {
        const { ok, status, body } = await zFetch(`/ads?${qBase}&page=${page}&limit=50`, apiKey);
        if (!ok) return new Response(JSON.stringify({ error: "Falha ao listar anúncios Zernio", status, details: body, debug }), { status: 502, headers: jsonHeaders });
        ads.push(...(body.ads || []));
        if (!debug.sample_ad && (body.ads || []).length > 0) debug.sample_ad = body.ads[0];
        const pages = body?.pagination?.pages || 1;
        if (page >= pages) break;
        page++;
      }
    }
    console.log(`[zernio-ads-sync] total campaigns=${campaignsByZId.size} ads=${ads.length}`);

    let imported = 0;
    let errors = 0;
    let insightsFailures = 0;
    let insightsEmpty = 0;
    let usedInlineMetrics = 0;
    let adsUsingInsights = 0;
    let adsFallbackInline = 0;
    let daysImported = 0;
    let campaignPlaceholdersUpserted = 0;
    const campaignAdCount = new Map<string, number>();

    const buildInsightsVariants = (adId: string) => {
      const enc = encodeURIComponent;
      const adIdEnc = enc(String(adId));
      const baseParams = `adId=${adIdEnc}&since=${dfrom}&until=${dto}`;
      return [
        { name: "qBase+timeIncrement", path: `/ads/insights?${qBase}&${baseParams}&timeIncrement=1` },
        { name: "onlyAdAccount+adId", path: `/ads/insights?adAccountId=${enc(adAccountId)}&${baseParams}&timeIncrement=1` },
        { name: "zernioAcc+adId", path: `/ads/insights?accountId=${enc(zernioAccountId)}&${baseParams}&timeIncrement=1` },
        { name: "onlyAdId", path: `/ads/insights?${baseParams}&timeIncrement=1` },
        { name: "qBase", path: `/ads/insights?${qBase}&${baseParams}` },
      ];
    };
    let chosenInsightsVariant: string | null = (creds?.credentials?.zernio_ads_chosen_insights_variant as string | null) || null;

    // === Limpar dados antigos no range para evitar duplicações com data_ref errado ===
    await supabase
      .from("imphq_ads_spend")
      .delete()
      .eq("project_id", project_id)
      .eq("source", "zernio")
      .gte("data_ref", dfrom)
      .lte("data_ref", dto)
      .not("ad_id", "ilike", "CAMP:%");

    // 3. Para cada ad: SEMPRE tentar /insights primeiro (breakdown diário no range).
    //    Fallback: inline metrics se /insights vier vazio mas houver spend.
    let skippedNoId = 0;
    for (const ad of ads) {
      const adId = ad?.id ?? ad?._id ?? ad?.adId ?? ad?.ad_id ?? ad?.platformAdId;
      if (!adId) { skippedNoId++; continue; }

      const campaignId = ad?.campaignId ?? ad?.campaign_id ?? null;
      const adsetId = ad?.adsetId ?? ad?.adset_id ?? null;
      const campaignName = ad?.campaignName ?? ad?.campaign_name ?? (campaignId && campaignsByZId.get(String(campaignId))?.name) ?? null;
      const adsetName = ad?.adsetName ?? ad?.adset_name ?? null;
      const adName = ad?.name ?? ad?.adName ?? null;
      const thumb = ad?.creative?.thumbnailUrl ?? ad?.creative?.thumbnail_url ?? ad?.creative?.imageUrl ?? ad?.creative?.image_url ?? ad?.thumbnail_url ?? null;
      const creativeBody = ad?.creative?.body ?? null;
      const creativeTitle = ad?.creative?.title ?? null;
      const effectiveStatus = ad?.effective_status ?? ad?.effectiveStatus ?? ad?.platformStatus ?? ad?.status ?? null;
      const platformAdId = ad?.platformAdId ?? null;
      const adIdKey = platformAdId ? String(platformAdId) : String(adId);

      if (campaignId) campaignAdCount.set(String(campaignId), (campaignAdCount.get(String(campaignId)) || 0) + 1);

      // === Path A: /insights (preferido — breakdown diário) ===
      let rows: any[] = [];
      let lastStatus: number | null = null;
      let lastBodyKeys: string[] = [];
      const variantsToTry = chosenInsightsVariant
        ? buildInsightsVariants(String(adId)).filter((v) => v.name === chosenInsightsVariant)
        : buildInsightsVariants(String(adId));

      for (const v of variantsToTry) {
        const ins = await zFetch(v.path, apiKey);
        lastStatus = ins.status;
        lastBodyKeys = Object.keys(ins.body || {});
        if (!ins.ok) continue;
        const r = ins.body?.insights || ins.body?.data || [];
        if (r.length > 0) {
          rows = r;
          if (!chosenInsightsVariant) {
            chosenInsightsVariant = v.name;
            debug.chosen_insights_variant = v.name;
            debug.sample_insight_raw = ins.body;
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 150));

      if (rows.length > 0) {
        adsUsingInsights++;
        for (const row of rows) {
          const dateRef = row?.date_start || row?.date || row?.dateStart;
          if (!dateRef) continue;
          const spend = parseFloat(row?.spend ?? "0");
          const impressoes = parseInt(row?.impressions ?? "0", 10);
          const alcance = parseInt(row?.reach ?? "0", 10);
          const cliques = parseInt(row?.clicks ?? "0", 10);
          const ctr = parseFloat(row?.ctr ?? "0");
          const frequencia = parseFloat(row?.frequency ?? "0");
          const linkClicks = parseInt(row?.inline_link_clicks ?? row?.linkClicks ?? "0", 10);
          const actions = row?.actions || [];
          const leads = pickAction(actions, "lead") + pickAction(actions, "offsite_conversion.fb_pixel_lead");
          const compras = pickAction(actions, "purchase") + pickAction(actions, "offsite_conversion.fb_pixel_purchase");
          const initCheckout = pickAction(actions, "initiate_checkout") + pickAction(actions, "offsite_conversion.fb_pixel_initiate_checkout");
          const addToCart = pickAction(actions, "add_to_cart") + pickAction(actions, "offsite_conversion.fb_pixel_add_to_cart");
          const lpViews = pickAction(actions, "landing_page_view");
          const v3 = Array.isArray(row?.video_play_actions) && row.video_play_actions[0] ? parseInt(row.video_play_actions[0].value, 10) : 0;
          const vTru = Array.isArray(row?.video_thruplay_watched_actions) && row.video_thruplay_watched_actions[0] ? parseInt(row.video_thruplay_watched_actions[0].value, 10) : 0;

          const record: Record<string, unknown> = {
            project_id,
            plataforma: "Facebook",
            source: "zernio",
            campanha: campaignName,
            conjunto_anuncios: adsetName,
            anuncio: adName,
            campaign_id: campaignId ? String(campaignId) : null,
            adset_id: adsetId ? String(adsetId) : null,
            ad_id: adIdKey,
            data_ref: dateRef,
            valor: spend,
            impressoes,
            alcance,
            cliques,
            leads,
            compras,
            init_checkout: initCheckout,
            add_to_cart: addToCart,
            landing_page_views: lpViews,
            video_3s_views: v3,
            video_thruplay: vTru,
            link_clicks: linkClicks,
            custo_por_compra: compras > 0 ? spend / compras : null,
            ctr,
            frequencia,
            moeda: row?.currency || "BRL",
            thumbnail_url: thumb,
            creative_body: creativeBody,
            creative_title: creativeTitle,
            effective_status: effectiveStatus,
          };

          const { error } = await supabase.from("imphq_ads_spend").insert(record);
          if (error) errors++; else { imported++; daysImported++; }
        }
        continue;
      }

      // === Path B: fallback inline metrics quando /insights vier vazio ===
      if (lastStatus && lastStatus >= 400) insightsFailures++;
      else insightsEmpty++;
      if (!debug.sample_empty_insight) {
        debug.sample_empty_insight = { adId: String(adId), status: lastStatus, keys: lastBodyKeys };
      }

      const m = ad?.metrics;
      const hasInline = !!m && ((Number(m?.spend) > 0) || (Number(m?.impressions) > 0));
      if (!hasInline) continue;

      adsFallbackInline++;
      const dateRef = (m.lastSyncedAt ? String(m.lastSyncedAt).slice(0, 10) : null) || today;
      const spend = parseFloat(m.spend ?? "0") || 0;
      const impressoes = parseInt(m.impressions ?? "0", 10) || 0;
      const alcance = parseInt(m.reach ?? "0", 10) || 0;
      const cliques = parseInt(m.clicks ?? "0", 10) || 0;
      const ctr = parseFloat(m.ctr ?? "0") || 0;
      const frequencia = parseFloat(m.frequency ?? "0") || 0;
      const linkClicks = parseInt(m.linkClicks ?? m.inline_link_clicks ?? (m.actions?.link_click ?? "0"), 10) || 0;
      const actions = m.actions || {};
      const leads = pickAction(actions, "lead") + pickAction(actions, "offsite_conversion.fb_pixel_lead");
      const compras = pickAction(actions, "purchase") + pickAction(actions, "offsite_conversion.fb_pixel_purchase");
      const initCheckout = pickAction(actions, "initiate_checkout") + pickAction(actions, "offsite_conversion.fb_pixel_initiate_checkout");
      const addToCart = pickAction(actions, "add_to_cart") + pickAction(actions, "offsite_conversion.fb_pixel_add_to_cart");
      const lpViews = pickAction(actions, "landing_page_view");
      const v3 = pickAction(actions, "video_view");
      const vTru = pickAction(actions, "video_thruplay_watched_actions");

      const record: Record<string, unknown> = {
        project_id,
        plataforma: "Facebook",
        source: "zernio",
        campanha: campaignName,
        conjunto_anuncios: adsetName,
        anuncio: adName,
        campaign_id: campaignId ? String(campaignId) : null,
        adset_id: adsetId ? String(adsetId) : null,
        ad_id: adIdKey,
        data_ref: dateRef,
        valor: spend,
        impressoes,
        alcance,
        cliques,
        leads,
        compras,
        init_checkout: initCheckout,
        add_to_cart: addToCart,
        landing_page_views: lpViews,
        video_3s_views: v3,
        video_thruplay: vTru,
        link_clicks: linkClicks,
        custo_por_compra: compras > 0 ? spend / compras : null,
        ctr,
        frequencia,
        moeda: m.currency || ad?.currency || "BRL",
        thumbnail_url: thumb,
        creative_body: creativeBody,
        creative_title: creativeTitle,
        effective_status: effectiveStatus,
      };
      const { error } = await supabase.from("imphq_ads_spend").insert(record);
      if (error) errors++; else { imported++; usedInlineMetrics++; }
    }

    // === Placeholders de campanha: garante que TODAS as 16 campanhas apareçam no Gerenciador ===
    const todayStr = today;
    for (const [zid, camp] of campaignsByZId.entries()) {
      const platformCampId = camp?.platformCampaignId || camp?.platform_campaign_id || camp?.id || zid;
      const placeholderAdId = `CAMP:${platformCampId}`;
      const record: Record<string, unknown> = {
        project_id,
        plataforma: "Facebook",
        source: "zernio",
        campanha: camp?.name || null,
        conjunto_anuncios: null,
        anuncio: null,
        campaign_id: String(platformCampId),
        adset_id: null,
        ad_id: placeholderAdId,
        data_ref: todayStr,
        valor: 0,
        impressoes: 0,
        alcance: 0,
        cliques: 0,
        leads: 0,
        compras: 0,
        moeda: camp?.currency || "BRL",
        effective_status: camp?.effective_status ?? camp?.effectiveStatus ?? camp?.status ?? null,
      };
      const { data: existing } = await supabase
        .from("imphq_ads_spend")
        .select("id")
        .eq("project_id", project_id)
        .eq("source", "zernio")
        .eq("ad_id", placeholderAdId)
        .eq("data_ref", todayStr)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("imphq_ads_spend").update(record).eq("id", existing.id)
        : await supabase.from("imphq_ads_spend").insert(record);
      if (!error) campaignPlaceholdersUpserted++;
    }
    debug.campaigns_detected = Array.from(campaignsByZId.values()).map((c: any) => ({
      id: c?.platformCampaignId || c?.id,
      name: c?.name,
      status: c?.effective_status ?? c?.effectiveStatus ?? c?.status ?? null,
      ads_count: campaignAdCount.get(String(c?.id)) || 0,
    }));
    console.log(`[zernio-ads-sync] imported=${imported} viaInsights=${adsUsingInsights} fallbackInline=${adsFallbackInline} days=${daysImported} campPH=${campaignPlaceholdersUpserted} insightsEmpty=${insightsEmpty} insightsFail=${insightsFailures}`);

    // Persist last sync timestamp + status + debug
    await supabase
      .from("imphq_integration_credentials")
      .update({
        credentials: {
          ...(creds?.credentials || {}),
          zernio_ad_account_id: adAccountId,
          zernio_ads_chosen_variant: chosen,
          zernio_ads_chosen_insights_variant: chosenInsightsVariant,
          zernio_ads_last_sync: new Date().toISOString(),
          zernio_ads_last_sync_status: "success",
          zernio_ads_last_sync_error: null,
          zernio_ads_last_sync_stats: { imported, errors, ads: ads.length, campaigns: campaignsByZId.size, ads_using_insights: adsUsingInsights, ads_fallback_inline: adsFallbackInline, inline_metrics_used: usedInlineMetrics, days_imported: daysImported, campaign_placeholders: campaignPlaceholdersUpserted, insights_failures: insightsFailures, insights_empty: insightsEmpty, skipped_no_id: skippedNoId, chosen_insights_variant: chosenInsightsVariant, period: { from: dfrom, to: dto } },
          zernio_ads_last_sync_debug: debug,
        },
      })
      .eq("project_id", project_id)
      .eq("provider", "instagram");

    return new Response(JSON.stringify({
      success: true,
      imported,
      errors,
      insights_failures: insightsFailures,
      insights_empty: insightsEmpty,
      chosen_insights_variant: chosenInsightsVariant,
      campaigns: campaignsByZId.size,
      ads: ads.length,
      period: { from: dfrom, to: dto },
      ad_account_id: adAccountId,
      debug,
    }), { headers: jsonHeaders });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // Tenta persistir o erro
    try {
      if (supabaseForCatch && project_id_for_log) {
        await supabaseForCatch
          .from("imphq_integration_credentials")
          .update({
            credentials: {
              ...(credsForCatch?.credentials || {}),
              zernio_ads_last_sync: new Date().toISOString(),
              zernio_ads_last_sync_status: "error",
              zernio_ads_last_sync_error: errMsg.slice(0, 500),
            },
          })
          .eq("project_id", project_id_for_log)
          .eq("provider", "instagram");
        await supabaseForCatch.from("imphq_webhook_errors").insert({
          project_id: project_id_for_log,
          plataforma: "zernio",
          evento: "ads_sync",
          erro: errMsg.slice(0, 1000),
          payload: {},
        });


      }
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: jsonHeaders });
  }
});

