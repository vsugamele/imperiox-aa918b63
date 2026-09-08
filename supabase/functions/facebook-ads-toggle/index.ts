import { z } from "https://esm.sh/zod@3.25.76";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_API_VERSION = "v19.0";
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

type EntityType = "campaign" | "adset" | "ad";
type Action = "ACTIVE" | "PAUSED" | "UPDATE_BUDGET" | "DUPLICATE_CAMPAIGN" | "RENAME";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const checked = z.object({project_id:z.string().nullish(),entity_type:z.enum(["campaign","adset","ad"]).optional(),entity_id:z.string().nullish(),entity_name:z.string().nullish(),action:z.enum(["ACTIVE","PAUSED","UPDATE_BUDGET","DUPLICATE_CAMPAIGN","RENAME"]).optional(),previous_status:z.string().nullish(),daily_budget:z.union([z.number(),z.string()]).nullish(),previous_budget:z.union([z.number(),z.string()]).nullish(),new_name:z.string().nullish(),previous_name:z.string().nullish()}).passthrough().safeParse(rawBody);
  if (!checked.success) return new Response(JSON.stringify({error:"Missing/invalid params"}), {status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const body = checked.data;
  const project_id = body.project_id;
  const entity_type = body.entity_type;
  const entity_id = body.entity_id;
  const entity_name = body.entity_name;
  const action = body.action;
  const previous_status = body.previous_status;
  const daily_budget_brl = body.daily_budget; // em reais
  const previous_budget = body.previous_budget;
  const new_name = body.new_name;
  const previous_name = body.previous_name;

  if (!project_id || !entity_type || !entity_id || !action) {
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

  const acaoLabel =
    action === "ACTIVE" ? "ativou" :
    action === "PAUSED" ? "pausou" :
    action === "UPDATE_BUDGET" ? "editou_orcamento" :
    action === "RENAME" ? "renomeou" :
    "duplicou";

  const valorAnterior =
    action === "UPDATE_BUDGET" ? (previous_budget != null ? String(previous_budget) : null) :
    action === "RENAME" ? (previous_name ?? null) :
    previous_status ?? null;

  const valorNovo =
    action === "UPDATE_BUDGET" ? (daily_budget_brl != null ? String(daily_budget_brl) : null) :
    action === "RENAME" ? (new_name ?? null) :
    action;

  const logAction = async (resultado: "ok" | "erro", erro_msg?: string) => {
    const duracao_ms = Date.now() - startedAt;
    await supabase.from("imphq_ads_actions").insert({
      project_id,
      plataforma: "Facebook",
      tipo: entity_type,
      entidade_id: entity_id,
      entidade_nome: entity_name ?? null,
      acao: acaoLabel,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
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
    let url = `${FB_BASE}/${entity_id}?access_token=${accessToken}`;
    let payload: Record<string, unknown> = {};
    const method = "POST" as const;

    if (action === "ACTIVE" || action === "PAUSED") {
      payload = { status: action };
    } else if (action === "UPDATE_BUDGET") {
      if (daily_budget_brl == null || isNaN(Number(daily_budget_brl)) || Number(daily_budget_brl) <= 0) {
        await logAction("erro", "Orçamento inválido");
        return new Response(JSON.stringify({ error: "Orçamento inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cents = Math.round(Number(daily_budget_brl) * 100);
      payload = { daily_budget: cents };
    } else if (action === "DUPLICATE_CAMPAIGN") {
      url = `${FB_BASE}/${entity_id}/copies?access_token=${accessToken}`;
      payload = { deep_copy: true, status_option: "PAUSED" };
    } else if (action === "RENAME") {
      if (!new_name || !new_name.trim()) {
        await logAction("erro", "Nome inválido");
        return new Response(JSON.stringify({ error: "Nome inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payload = { name: new_name.trim() };
    }

    const fbRes = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

    // Atualiza estado local em imphq_ads_spend
    const idColumn =
      entity_type === "campaign" ? "campaign_id" : entity_type === "adset" ? "adset_id" : "ad_id";

    if (action === "ACTIVE" || action === "PAUSED") {
      await supabase
        .from("imphq_ads_spend")
        .update({ effective_status: action })
        .eq("project_id", project_id)
        .eq(idColumn, entity_id);
    } else if (action === "UPDATE_BUDGET") {
      await supabase
        .from("imphq_ads_spend")
        .update({ daily_budget: Number(daily_budget_brl) })
        .eq("project_id", project_id)
        .eq(idColumn, entity_id);
    } else if (action === "RENAME") {
      const nameColumn =
        entity_type === "campaign" ? "campanha" : entity_type === "adset" ? "conjunto_anuncios" : "anuncio";
      await supabase
        .from("imphq_ads_spend")
        .update({ [nameColumn]: new_name!.trim() })
        .eq("project_id", project_id)
        .eq(idColumn, entity_id);
    }
    // Para DUPLICATE_CAMPAIGN, dependemos do próximo sync para popular os novos registros.

    await logAction("ok");

    return new Response(JSON.stringify({ success: true, fb: fbBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
    await logAction("erro", eMessage || String(e));
    return new Response(JSON.stringify({ error: eMessage || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
