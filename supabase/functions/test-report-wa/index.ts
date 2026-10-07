// Relatório dos testes de criativos no ar para o grupo Imperio X (TST1.3). Roda às 10h e 19h BRT pelo pg_cron.
// Lê o gasto por anúncio do Zernio (imphq_ads_spend) e as vendas reais por UTM; não altera nada na Meta.
// Anti-spam: no máximo um relatório por teste a cada 2h (a não ser com force) e para após 3 falhas seguidas de envio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { lastSync, liveReadings, testReportText, type LiveOrder, type LiveVariant, type SaleRow, type SpendRow } from "../_shared/test-live.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPERIO_X_JID = "120363409438175766@g.us";
const MIN_GAP_MS = 2 * 3600_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const force = url.searchParams.get("force") === "true" || body?.force === true;
    const onlyOrder: string | undefined = body?.order_id || url.searchParams.get("order_id") || undefined;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();

    let q = sb.from("imphq_test_orders").select("*").eq("status", "no_ar");
    if (onlyOrder) q = q.eq("id", onlyOrder);
    const { data: orders, error } = await q;
    if (error) throw error;
    if (!orders?.length) return json({ ok: true, enviados: 0, motivo: "Nenhum teste no ar." });

    const { data: provider } = await sb.from("imphq_wa_providers").select("*").eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();

    const results: Array<Record<string, unknown>> = [];
    let falhas = 0;
    for (const order of orders) {
      if (falhas >= 3) { results.push({ order_id: order.id, erro: "parou após 3 falhas seguidas de envio" }); break; }
      const { data: variants } = await sb.from("imphq_test_variants").select("ordem, angulo, hipotese, status, utm_content, meta_ad_id").eq("order_id", order.id).order("ordem");
      const adIds = (variants ?? []).map((v) => v.meta_ad_id).filter(Boolean) as string[];
      const since = String(order.ativado_em ?? order.created_at).slice(0, 10);
      const [{ data: spend }, { data: sales }] = await Promise.all([
        adIds.length
          ? sb.from("imphq_ads_spend").select("ad_id, spend, init_checkout, link_clicks, impressoes, purchases, effective_status, created_at").in("ad_id", adIds).gte("date", since)
          : Promise.resolve({ data: [] as SpendRow[] }),
        sb.from("imphq_vendas").select("utm_campaign, utm_content, status, valor, valor_liquido, tipo_venda").eq("project_id", order.project_id).eq("utm_campaign", order.utm_campaign),
      ]);
      const vs = (variants ?? []) as LiveVariant[];
      const readings = liveReadings(order as LiveOrder, vs, (spend ?? []) as SpendRow[], (sales ?? []) as SaleRow[]);
      const text = testReportText(order as LiveOrder, vs, readings, lastSync((spend ?? []) as SpendRow[]), now);

      if (dryRun) { results.push({ order_id: order.id, preview: text }); continue; }

      const { data: last } = await sb.from("imphq_activity_log").select("created_at").eq("action", "test_report_wa").eq("entity_id", order.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!force && last?.created_at && now.getTime() - Date.parse(last.created_at) < MIN_GAP_MS) {
        results.push({ order_id: order.id, pulado: `relatório já enviado às ${last.created_at}` });
        continue;
      }
      if (!provider?.instance_name) { results.push({ order_id: order.id, erro: "Nenhum provider WA ativo" }); falhas++; continue; }

      try {
        const sendRes = await fetch(`${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({ number: IMPERIO_X_JID, text }),
        });
        if (!sendRes.ok) { falhas++; results.push({ order_id: order.id, erro: `envio ${sendRes.status}`, detalhe: (await sendRes.text()).slice(0, 200) }); continue; }
        falhas = 0;
        await sb.from("imphq_activity_log").insert({
          action: "test_report_wa", entity_type: "test_order", entity_id: order.id, entity_name: order.nome, project_id: order.project_id,
          actor: "sistema", source: "test-report-wa", details: { destino: "Imperio X", vendas: readings.reduce((s, r) => s + r.vendas, 0), gasto: readings.reduce((s, r) => s + r.gasto, 0) },
        });
        results.push({ order_id: order.id, enviado: true });
      } catch (e) {
        falhas++;
        results.push({ order_id: order.id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, dry_run: dryRun, results });
  } catch (e) {
    console.error("[test-report-wa]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
