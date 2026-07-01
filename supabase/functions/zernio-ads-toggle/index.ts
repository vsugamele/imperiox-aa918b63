// Toggle/edit Meta Ads via Zernio API (PUT).
// Routes confirmed:
//   PUT /api/v1/ads/campaigns/{id}   body: { status?, name?, dailyBudget? }
//   PUT /api/v1/ads/adsets/{id}      body: { status?, name?, dailyBudget? }
//   PUT /api/v1/ads/{id}             body: { status?, name? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type EntityType = "campaign" | "adset" | "ad";
type Action = "ACTIVE" | "PAUSED" | "UPDATE_BUDGET" | "RENAME";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();
  let body: any = {};
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders });
  }

  const {
    project_id, entity_type, entity_id, entity_name,
    action, previous_status, daily_budget, previous_budget,
    new_name, previous_name,
  } = body as {
    project_id?: string; entity_type?: EntityType; entity_id?: string; entity_name?: string;
    action?: Action; previous_status?: string; daily_budget?: number; previous_budget?: number;
    new_name?: string; previous_name?: string;
  };

  if (!project_id || !entity_type || !entity_id || !action) {
    return new Response(JSON.stringify({ error: "Missing/invalid params" }), { status: 400, headers: jsonHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: creds } = await supabase
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", project_id)
    .eq("provider", "instagram")
    .maybeSingle();

  const apiKey = creds?.credentials?.zernio_api_key;
  const zernioAccountId = creds?.credentials?.zernio_account_id;
  const adAccountId = creds?.credentials?.zernio_ad_account_id;

  const acaoLabel =
    action === "ACTIVE" ? "ativou" :
    action === "PAUSED" ? "pausou" :
    action === "UPDATE_BUDGET" ? "editou_orcamento" : "renomeou";

  const valorAnterior =
    action === "UPDATE_BUDGET" ? (previous_budget != null ? String(previous_budget) : null) :
    action === "RENAME" ? (previous_name ?? null) :
    previous_status ?? null;

  const valorNovo =
    action === "UPDATE_BUDGET" ? (daily_budget != null ? String(daily_budget) : null) :
    action === "RENAME" ? (new_name ?? null) :
    action;

  const logAction = async (resultado: "ok" | "erro", erro_msg?: string) => {
    await supabase.from("imphq_ads_actions").insert({
      project_id,
      plataforma: "Facebook",
      source: "zernio",
      tipo: entity_type,
      entidade_id: entity_id,
      entidade_nome: entity_name ?? null,
      acao: acaoLabel,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      resultado,
      erro_msg: erro_msg ?? null,
      duracao_ms: Date.now() - startedAt,
    });
  };

  if (!apiKey || !zernioAccountId) {
    await logAction("erro", "Zernio não configurado.");
    return new Response(JSON.stringify({ error: "Zernio não configurado" }), { status: 400, headers: jsonHeaders });
  }

  // Build URL + payload
  const pathPart =
    entity_type === "campaign" ? `ads/campaigns/${encodeURIComponent(entity_id)}` :
    entity_type === "adset" ? `ads/adsets/${encodeURIComponent(entity_id)}` :
    `ads/${encodeURIComponent(entity_id)}`;

  const qs = new URLSearchParams({ accountId: zernioAccountId });
  if (adAccountId) qs.set("adAccountId", adAccountId);
  const url = `https://zernio.com/api/v1/${pathPart}?${qs.toString()}`;

  const payload: Record<string, unknown> = {};
  if (action === "ACTIVE" || action === "PAUSED") {
    payload.status = action;
  } else if (action === "UPDATE_BUDGET") {
    if (daily_budget == null || isNaN(Number(daily_budget)) || Number(daily_budget) <= 0) {
      await logAction("erro", "Orçamento inválido");
      return new Response(JSON.stringify({ error: "Orçamento inválido" }), { status: 400, headers: jsonHeaders });
    }
    payload.dailyBudget = Math.round(Number(daily_budget) * 100); // centavos
  } else if (action === "RENAME") {
    if (!new_name?.trim()) {
      await logAction("erro", "Nome inválido");
      return new Response(JSON.stringify({ error: "Nome inválido" }), { status: 400, headers: jsonHeaders });
    }
    payload.name = new_name.trim();
  }

  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const respBody = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = respBody?.error || `HTTP ${r.status}`;
      await logAction("erro", msg);
      return new Response(JSON.stringify({ error: msg, zernio: respBody }), { status: 502, headers: jsonHeaders });
    }

    // Update local state
    const idCol = entity_type === "campaign" ? "campaign_id" : entity_type === "adset" ? "adset_id" : "ad_id";
    if (action === "ACTIVE" || action === "PAUSED") {
      await supabase.from("imphq_ads_spend").update({ effective_status: action })
        .eq("project_id", project_id).eq("source", "zernio").eq(idCol, entity_id);
    } else if (action === "UPDATE_BUDGET") {
      await supabase.from("imphq_ads_spend").update({ daily_budget: Number(daily_budget) })
        .eq("project_id", project_id).eq("source", "zernio").eq(idCol, entity_id);
    } else if (action === "RENAME") {
      const nameCol = entity_type === "campaign" ? "campanha" : entity_type === "adset" ? "conjunto_anuncios" : "anuncio";
      await supabase.from("imphq_ads_spend").update({ [nameCol]: new_name!.trim() })
        .eq("project_id", project_id).eq("source", "zernio").eq(idCol, entity_id);
    }

    await logAction("ok");
    return new Response(JSON.stringify({ success: true, zernio: respBody }), { headers: jsonHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logAction("erro", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: jsonHeaders });
  }
});
