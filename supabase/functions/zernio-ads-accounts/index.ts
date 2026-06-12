import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id } = await req.json();
    if (!project_id) return new Response(JSON.stringify({ error: "project_id obrigatório" }), { status: 400, headers: jsonHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: creds } = await supabase
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("project_id", project_id)
      .eq("provider", "instagram")
      .maybeSingle();

    const apiKey = creds?.credentials?.zernio_api_key;
    const zernioAccountId = creds?.credentials?.zernio_account_id;
    if (!apiKey || !zernioAccountId) {
      return new Response(JSON.stringify({ error: "Zernio não configurado neste projeto (instagram provider com zernio)" }), { status: 400, headers: jsonHeaders });
    }

    const url = `https://zernio.com/api/v1/ads/accounts?accountId=${encodeURIComponent(zernioAccountId)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(JSON.stringify({ error: body?.error || `HTTP ${r.status}`, details: body }), { status: r.status, headers: jsonHeaders });
    }
    return new Response(JSON.stringify({ success: true, accounts: body.accounts || [] }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: jsonHeaders });
  }
});
