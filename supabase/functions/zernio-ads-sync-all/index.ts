// Dispara zernio-ads-sync para todos os projetos com Zernio Ads configurado.
// Chamado por pg_cron diariamente (06h BRT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: rows, error } = await supabase
      .from("imphq_integration_credentials")
      .select("project_id, credentials")
      .eq("provider", "instagram");

    if (error) throw error;

    const eligible = (rows || []).filter((r: any) => {
      const c = r?.credentials || {};
      return c.zernio_api_key && c.zernio_account_id && c.zernio_ad_account_id;
    });

    console.log(`[zernio-ads-sync-all] ${eligible.length} projetos elegíveis`);

    const results: any[] = [];
    for (const r of eligible) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/zernio-ads-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          },
          body: JSON.stringify({ project_id: r.project_id }),
        });
        const body = await resp.json().catch(() => ({}));
        results.push({ project_id: r.project_id, ok: resp.ok, ...body });
        console.log(`[zernio-ads-sync-all] ${r.project_id}: ${resp.ok ? "OK" : "ERR"}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ project_id: r.project_id, ok: false, error: msg });
        console.error(`[zernio-ads-sync-all] ${r.project_id} falhou:`, msg);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { headers: jsonHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[zernio-ads-sync-all] fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
