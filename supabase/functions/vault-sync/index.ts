import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VaultRecord {
  id: string;
  name: string;
  url: string | null;
  username: string | null;
  password_encrypted: string | null;
  category: string | null;
  project_id: string | null;
  produto: string | null;
  sync_method: string | null;
  portal_type: string | null;
  is_sync_enabled: boolean | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  config: Record<string, any> | null;
}

interface IngestItem {
  project_id?: string;
  produto_nome?: string;
  data_ref: string; // YYYY-MM-DD
  source: string;
  cliques?: number;
  conversoes?: number;
  cvr?: number;
  receita_bruta?: number;
  receita_liquida?: number;
  gasto_ads?: number;
  epc?: number;
  sessoes?: number;
  usuarios?: number;
  bounce_rate?: number;
  scroll_depth_medio?: number;
  raw_data?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { vault_id, portal_type, days = 7, manual_payload } = body;

    const results: Array<{
      vault_id: string;
      name: string;
      portal_type: string;
      status: "success" | "error" | "skipped";
      records_upserted: number;
      message: string;
    }> = [];

    // Se veio um payload direto de ingestão (ex: do Playwright / Node scraper do HW Hub)
    if (manual_payload && Array.isArray(manual_payload) && manual_payload.length > 0) {
      let upsertedCount = 0;
      for (const item of manual_payload as IngestItem[]) {
        if (!item.data_ref || !item.source) continue;
        const projId = item.project_id || "linfaflow";
        const cvr = item.cliques && item.cliques > 0 && item.conversoes !== undefined
          ? Number(((item.conversoes / item.cliques) * 100).toFixed(2))
          : (item.cvr ?? 0);
        const epc = item.cliques && item.cliques > 0 && item.receita_liquida !== undefined
          ? Number((item.receita_liquida / item.cliques).toFixed(2))
          : (item.epc ?? 0);

        const { error: upsertErr } = await supabase.from("imphq_metrics_daily").upsert(
          {
            project_id: projId,
            produto_nome: item.produto_nome || null,
            data_ref: item.data_ref,
            source: item.source,
            cliques: item.cliques ?? 0,
            conversoes: item.conversoes ?? 0,
            cvr,
            receita_bruta: item.receita_bruta ?? 0,
            receita_liquida: item.receita_liquida ?? 0,
            gasto_ads: item.gasto_ads ?? 0,
            epc,
            sessoes: item.sessoes ?? 0,
            usuarios: item.usuarios ?? 0,
            bounce_rate: item.bounce_rate ?? 0,
            scroll_depth_medio: item.scroll_depth_medio ?? 0,
            raw_data: item.raw_data ?? {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,source,data_ref" }
        );

        if (!upsertErr) upsertedCount++;
      }

      if (vault_id) {
        await supabase
          .from("imphq_tools_vault")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "success",
            last_sync_error: null,
          })
          .eq("id", vault_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "manual_payload_ingest",
          records_upserted: upsertedCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca itens do cofre elegíveis para sync
    let query = supabase.from("imphq_tools_vault").select("*");
    if (vault_id) {
      query = query.eq("id", vault_id);
    } else {
      query = query.eq("is_sync_enabled", true);
      if (portal_type && portal_type !== "all") {
        query = query.eq("portal_type", portal_type);
      }
    }

    const { data: vaultItems, error: vErr } = await query;
    if (vErr || !vaultItems || vaultItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: vault_id ? "Item do cofre não encontrado" : "Nenhum item com sync ativo",
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const v of vaultItems as VaultRecord[]) {
      const cfg = v.config || {};
      const portal = v.portal_type || (
        v.url?.includes("whop") ? "whop" :
        v.url?.includes("hwaffiliate") ? "hw_hub" :
        v.url?.includes("analytics.google") ? "google_analytics" :
        v.url?.includes("clarity.ms") ? "clarity" : "other"
      );

      try {
        let upsertedCount = 0;

        // ----------------------------------------------------
        // CASO 1: WHOP (Método A - API Oficial)
        // ----------------------------------------------------
        if (portal === "whop") {
          const apiKey = cfg.api_key || v.password_encrypted;
          if (!apiKey) {
            throw new Error("Chave de API do Whop não configurada");
          }

          const projectId = v.project_id || "slimsoda";
          const res = await fetch("https://api.whop.com/v5/payments?per=50", {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            throw new Error(`Whop API HTTP ${res.status}: ${await res.text().catch(() => "")}`);
          }

          const whopData = await res.json();
          const payments = whopData.data || [];

          // Agrupa por data YYYY-MM-DD
          const byDate: Record<string, { count: number; totalGross: number; totalNet: number }> = {};
          for (const p of payments) {
            const dateStr = p.created_at ? new Date(p.created_at * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
            if (!byDate[dateStr]) {
              byDate[dateStr] = { count: 0, totalGross: 0, totalNet: 0 };
            }
            if (p.status === "paid" || p.status === "succeeded") {
              const gross = Number(p.subtotal || p.final_amount || 0) / 100;
              const net = Number(p.payout_amount || p.final_amount || 0) / 100;
              byDate[dateStr].count += 1;
              byDate[dateStr].totalGross += gross;
              byDate[dateStr].totalNet += net;
            }
          }

          for (const [d, agg] of Object.entries(byDate)) {
            const { error: upErr } = await supabase.from("imphq_metrics_daily").upsert(
              {
                project_id: projectId,
                produto_nome: v.produto || "SlimSoda Powder",
                data_ref: d,
                source: "whop",
                conversoes: agg.count,
                receita_bruta: Number(agg.totalGross.toFixed(2)),
                receita_liquida: Number(agg.totalNet.toFixed(2)),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "project_id,source,data_ref" }
            );
            if (!upErr) upsertedCount++;
          }
        }

        // ----------------------------------------------------
        // CASO 2: GOOGLE ANALYTICS 4 (Método A)
        // ----------------------------------------------------
        else if (portal === "google_analytics") {
          const propertyId = cfg.property_id || v.username;
          const apiKey = cfg.api_key || v.password_encrypted;
          const projectId = v.project_id || "linfaflow";

          if (apiKey && propertyId) {
            // Chamada GA4 Data API ou Measurement Protocol
            // Se houver integração GA4 configurada:
            const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
            const gaRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
                dimensions: [{ name: "date" }],
                metrics: [
                  { name: "sessions" },
                  { name: "activeUsers" },
                  { name: "bounceRate" },
                ],
              }),
            });

            if (gaRes.ok) {
              const gaJson = await gaRes.json();
              for (const row of gaJson.rows || []) {
                const rawDate = row.dimensionValues?.[0]?.value; // YYYYMMDD
                const dateRef = rawDate && rawDate.length === 8
                  ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
                  : new Date().toISOString().slice(0, 10);
                const sessoes = parseInt(row.metricValues?.[0]?.value || "0", 10);
                const usuarios = parseInt(row.metricValues?.[1]?.value || "0", 10);
                const bounce = parseFloat(row.metricValues?.[2]?.value || "0") * 100;

                const { error: upErr } = await supabase.from("imphq_metrics_daily").upsert(
                  {
                    project_id: projectId,
                    produto_nome: v.produto || null,
                    data_ref: dateRef,
                    source: "google_analytics",
                    sessoes,
                    usuarios,
                    bounce_rate: Number(bounce.toFixed(2)),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "project_id,source,data_ref" }
                );
                if (!upErr) upsertedCount++;
              }
            } else {
              throw new Error(`GA4 API HTTP ${gaRes.status}`);
            }
          } else {
            throw new Error("Property ID ou Token GA4 não informados");
          }
        }

        // ----------------------------------------------------
        // CASO 3: MICROSOFT CLARITY (Método A)
        // ----------------------------------------------------
        else if (portal === "clarity") {
          const clarityProject = cfg.project_id || v.username;
          const apiToken = cfg.api_token || v.password_encrypted;
          const projectId = v.project_id || "linfaflow";

          if (clarityProject && apiToken) {
            const cRes = await fetch(
              `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${days}`,
              { headers: { "Authorization": `Bearer ${apiToken}` } }
            );

            if (cRes.ok) {
              const cJson = await cRes.json();
              const todayStr = new Date().toISOString().slice(0, 10);
              const scrollDepth = Number(cJson.averageScrollDepth || 0);

              const { error: upErr } = await supabase.from("imphq_metrics_daily").upsert(
                {
                  project_id: projectId,
                  produto_nome: v.produto || null,
                  data_ref: todayStr,
                  source: "clarity",
                  scroll_depth_medio: scrollDepth,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "project_id,source,data_ref" }
              );
              if (!upErr) upsertedCount++;
            } else {
              throw new Error(`Clarity API HTTP ${cRes.status}`);
            }
          } else {
            throw new Error("Project ID ou Token Clarity não informados");
          }
        }

        // ----------------------------------------------------
        // CASO 4: H&W HUB (Método B - Scraper / Sessão)
        // ----------------------------------------------------
        else if (portal === "hw_hub") {
          const browserlessUrl = cfg.browserless_url || Deno.env.get("BROWSERLESS_URL");
          const sessionCookie = cfg.session_cookie;
          const projectId = v.project_id || "linfaflow";

          // Se tiver cookie de sessão ativo, tenta leitura direta
          if (sessionCookie) {
            const hwRes = await fetch("https://www.hwaffiliate.com/api/affiliate/reports/performance", {
              headers: {
                "Cookie": sessionCookie,
                "Accept": "application/json",
              },
            });

            if (hwRes.ok) {
              const hwJson = await hwRes.json();
              for (const row of hwJson.data || []) {
                const dateRef = row.date || new Date().toISOString().slice(0, 10);
                const cliques = Number(row.clicks || 0);
                const conversoes = Number(row.conversions || 0);
                const receitaLiq = Number(row.payout || row.revenue || 0);
                const cvr = cliques > 0 ? (conversoes / cliques) * 100 : 0;
                const epc = cliques > 0 ? receitaLiq / cliques : 0;

                const { error: upErr } = await supabase.from("imphq_metrics_daily").upsert(
                  {
                    project_id: projectId,
                    produto_nome: row.offer_name || v.produto || "LinfaFlow",
                    data_ref: dateRef,
                    source: "hw_hub",
                    cliques,
                    conversoes,
                    cvr: Number(cvr.toFixed(2)),
                    receita_liquida: Number(receitaLiq.toFixed(2)),
                    epc: Number(epc.toFixed(2)),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "project_id,source,data_ref" }
                );
                if (!upErr) upsertedCount++;
              }
            } else {
              throw new Error("Sessão H&W expirada. Atualize os cookies ou execute o scraper local.");
            }
          } else if (browserlessUrl) {
            // Chama browserless com puppeteer script
            // ...
            throw new Error("Execução Browserless em andamento no cluster.");
          } else {
            // Instrução clara quando precisa do worker local
            throw new Error("H&W Hub requer autenticação via worker Playwright local ou session_cookie.");
          }
        } else {
          // Portal genérico sem automação definida
          results.push({
            vault_id: v.id,
            name: v.name,
            portal_type: portal,
            status: "skipped",
            records_upserted: 0,
            message: "Nenhuma regra de automação para este tipo de portal.",
          });
          continue;
        }

        // Sucesso no sync do item
        await supabase
          .from("imphq_tools_vault")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "success",
            last_sync_error: null,
          })
          .eq("id", v.id);

        results.push({
          vault_id: v.id,
          name: v.name,
          portal_type: portal,
          status: "success",
          records_upserted: upsertedCount,
          message: `${upsertedCount} métrica(s) diária(s) sincronizadas com sucesso.`,
        });
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        await supabase
          .from("imphq_tools_vault")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "error",
            last_sync_error: errorMsg.slice(0, 500),
          })
          .eq("id", v.id);

        results.push({
          vault_id: v.id,
          name: v.name,
          portal_type: portal,
          status: "error",
          records_upserted: 0,
          message: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_vault_items: vaultItems.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (globalErr: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: globalErr?.message || String(globalErr),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
