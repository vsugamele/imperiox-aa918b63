import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_API_VERSION = "v19.0";
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

type EntityType = "campaign" | "adset" | "ad";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const project_id: string | undefined = body.project_id;
  const entity_type: EntityType = body.entity_type;
  const entity_id: string | undefined = body.entity_id;
  const entity_name: string | undefined = body.entity_name;
  const action: "ACTIVE" | "PAUSED" = body.action;
  const previous_status: string | undefined = body.previous_status;

  if (!project_id || !entity_type || !entity_id || !["ACTIVE", "PAUSED"].includes(action)) {
    return new Response(JSON.stringify({ error: "Missing/invalid params" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Resolve token
  let accessToken = "";
  const { data: creds } = await supabase
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", project_id)
    .eq("provider", "facebook")
    .maybeSingle();
  if (creds?.credentials) {
    accessToken = creds.credentials.access_token || creds.credentials.marketing_token || "";
  }
  if (!accessToken) {
    const { data: proj } = await supabase
      .from("imphq_projects")
      .select("data")
      .eq("id", project_id)
      .maybeSingle();
    accessToken = proj?.data?.facebook_marketing_token || proj?.data?.facebook_access_token || "";
  }
  accessToken = accessToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");

  const logAction = async (resultado: "ok" | "erro", erro_msg?: string) => {
    const duracao_ms = Date.now() - startedAt;
    await supabase.from("imphq_ads_actions").insert({
      project_id,
      plataforma: "Facebook",
      tipo: entity_type,
      entidade_id: entity_id,
      entidade_nome: entity_name ?? null,
      acao: action === "ACTIVE" ? "ativou" : "pausou",
      valor_anterior: previous_status ?? null,
      valor_novo: action,
      resultado,
      erro_msg: erro_msg ?? null,
      duracao_ms,
    });
  };

  if (!accessToken) {
    await logAction("erro", "Token do Facebook não configurado para este projeto.");
    return new Response(JSON.stringify({ error: "Token Facebook ausente" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = `${FB_BASE}/${entity_id}?access_token=${accessToken}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    const fbBody = await fbRes.json();

    if (!fbRes.ok || fbBody.error) {
      const msg = fbBody?.error?.message || `HTTP ${fbRes.status}`;
      await logAction("erro", msg);
      return new Response(JSON.stringify({ error: msg, fb: fbBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualiza effective_status local (todos os registros com esse campaign/adset/ad)
    const idColumn =
      entity_type === "campaign" ? "campaign_id" : entity_type === "adset" ? "adset_id" : "ad_id";
    await supabase
      .from("imphq_ads_spend")
      .update({ effective_status: action })
      .eq("project_id", project_id)
      .eq(idColumn, entity_id);

    await logAction("ok");

    return new Response(JSON.stringify({ success: true, status: action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await logAction("erro", e?.message || String(e));
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
