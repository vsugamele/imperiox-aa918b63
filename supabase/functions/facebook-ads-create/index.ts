// supabase/functions/facebook-ads-create/index.ts
// Cria campanha + adset + creative + ad no Meta. Status sempre PAUSED.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_API_VERSION = "v19.0";
const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

const SUPPORTED_OBJECTIVES = new Set([
  "OUTCOME_SALES",
  "OUTCOME_LEADS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
]);

interface CreateBody {
  project_id: string;
  ad_account_id: string;            // "act_xxx" ou "xxx"
  page_id: string;
  campaign: {
    name: string;
    objective: string;
    special_ad_categories?: string[];
  };
  adset: {
    name: string;
    daily_budget_brl: number;       // em R$, convertido p/ centavos
    optimization_goal?: string;     // default conforme objetivo
    billing_event?: string;         // default IMPRESSIONS
    targeting?: {
      age_min?: number;
      age_max?: number;
      genders?: number[];           // [1] M, [2] F, [1,2] todos
      geo_countries?: string[];     // ex: ["BR"]
      flexible_spec?: any[];        // [{interests:[{id,name}]}]
    };
  };
  creative: {
    name: string;
    message: string;
    link: string;
    image_url?: string;             // será upado em /adimages
    image_hash?: string;            // se já tiver
    call_to_action?: string;        // ex: SHOP_NOW, LEARN_MORE
    headline?: string;
    description?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Body
  let body: CreateBody;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validações
  const errors: string[] = [];
  if (!body.project_id) errors.push("project_id obrigatório");
  if (!body.ad_account_id) errors.push("ad_account_id obrigatório");
  if (!body.page_id) errors.push("page_id obrigatório");
  if (!body.campaign?.name?.trim()) errors.push("Nome da campanha obrigatório");
  if (!SUPPORTED_OBJECTIVES.has(body.campaign?.objective)) errors.push("Objetivo não suportado");
  if (!body.adset?.name?.trim()) errors.push("Nome do conjunto obrigatório");
  if (!(Number(body.adset?.daily_budget_brl) > 0)) errors.push("Orçamento diário inválido");
  if (!body.creative?.name?.trim()) errors.push("Nome do criativo obrigatório");
  if (!body.creative?.message?.trim()) errors.push("Texto principal obrigatório");
  if (!body.creative?.link?.trim()) errors.push("Link de destino obrigatório");
  if (!body.creative?.image_url && !body.creative?.image_hash) errors.push("Imagem (URL ou hash) obrigatória");
  if (errors.length) {
    return new Response(JSON.stringify({ error: errors.join("; ") }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Token
  const { data: creds } = await supabase
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", body.project_id)
    .eq("provider", "facebook")
    .maybeSingle();
  let accessToken = (creds?.credentials?.access_token || creds?.credentials?.marketing_token || "").toString();
  if (!accessToken) {
    const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", body.project_id).maybeSingle();
    accessToken = proj?.data?.facebook_marketing_token || proj?.data?.facebook_access_token || "";
  }
  accessToken = accessToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Token Facebook ausente para este projeto" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const actId = body.ad_account_id.startsWith("act_") ? body.ad_account_id : `act_${body.ad_account_id}`;
  const created: { campaign_id?: string; adset_id?: string; creative_id?: string; ad_id?: string } = {};

  const fbPost = async (path: string, payload: Record<string, unknown>) => {
    const url = `${FB_BASE}/${path}?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      const code = json?.error?.code;
      let msg = json?.error?.message || `HTTP ${res.status}`;
      if (code === 190) msg = "Token Facebook expirado. Reconecte a integração.";
      if (code === 200) msg = `Permissão insuficiente no Meta: ${msg}`;
      if (code === 100) msg = `Parâmetro inválido: ${msg}`;
      throw new Error(msg);
    }
    return json;
  };

  const rollback = async () => {
    const del = async (id: string) => {
      try {
        await fetch(`${FB_BASE}/${id}?access_token=${accessToken}`, { method: "DELETE" });
      } catch { /* best-effort */ }
    };
    if (created.ad_id) await del(created.ad_id);
    if (created.creative_id) await del(created.creative_id);
    if (created.adset_id) await del(created.adset_id);
    if (created.campaign_id) await del(created.campaign_id);
  };

  const logAction = async (resultado: "ok" | "erro", erro_msg?: string, extra?: Record<string, unknown>) => {
    await supabase.from("imphq_ads_actions").insert({
      project_id: body.project_id,
      plataforma: "Facebook",
      tipo: "campaign",
      entidade_id: created.campaign_id ?? "—",
      entidade_nome: body.campaign.name,
      acao: "criou_campanha",
      valor_anterior: null,
      valor_novo: JSON.stringify({ ...created, ...(extra || {}) }),
      resultado,
      erro_msg: erro_msg ?? null,
      duracao_ms: Date.now() - startedAt,
    });
  };

  try {
    // 1. Campanha
    const campRes = await fbPost(`${actId}/campaigns`, {
      name: body.campaign.name.trim(),
      objective: body.campaign.objective,
      status: "PAUSED",
      special_ad_categories: body.campaign.special_ad_categories ?? [],
    });
    created.campaign_id = campRes.id;

    // 2. AdSet
    const defaultOptGoal: Record<string, string> = {
      OUTCOME_SALES: "OFFSITE_CONVERSIONS",
      OUTCOME_LEADS: "LEAD_GENERATION",
      OUTCOME_TRAFFIC: "LINK_CLICKS",
      OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
      OUTCOME_AWARENESS: "REACH",
    };
    const targeting = {
      age_min: body.adset.targeting?.age_min ?? 18,
      age_max: body.adset.targeting?.age_max ?? 65,
      genders: body.adset.targeting?.genders ?? [1, 2],
      geo_locations: { countries: body.adset.targeting?.geo_countries ?? ["BR"] },
      ...(body.adset.targeting?.flexible_spec ? { flexible_spec: body.adset.targeting.flexible_spec } : {}),
    };
    const startTime = new Date(Date.now() + 5 * 60_000).toISOString();
    const adsetRes = await fbPost(`${actId}/adsets`, {
      name: body.adset.name.trim(),
      campaign_id: created.campaign_id,
      daily_budget: Math.round(Number(body.adset.daily_budget_brl) * 100),
      billing_event: body.adset.billing_event ?? "IMPRESSIONS",
      optimization_goal: body.adset.optimization_goal ?? defaultOptGoal[body.campaign.objective] ?? "LINK_CLICKS",
      targeting,
      start_time: startTime,
      status: "PAUSED",
    });
    created.adset_id = adsetRes.id;

    // 3. Imagem (se URL) → image_hash
    let imageHash = body.creative.image_hash;
    if (!imageHash && body.creative.image_url) {
      const imgRes = await fbPost(`${actId}/adimages`, { url: body.creative.image_url });
      const images = imgRes.images || {};
      const firstKey = Object.keys(images)[0];
      imageHash = images[firstKey]?.hash;
      if (!imageHash) throw new Error("Falha ao subir imagem para o Meta");
    }

    // 4. Creative
    const linkData: Record<string, unknown> = {
      link: body.creative.link,
      message: body.creative.message,
      image_hash: imageHash,
      ...(body.creative.headline ? { name: body.creative.headline } : {}),
      ...(body.creative.description ? { description: body.creative.description } : {}),
      ...(body.creative.call_to_action
        ? { call_to_action: { type: body.creative.call_to_action, value: { link: body.creative.link } } }
        : {}),
    };
    const creativeRes = await fbPost(`${actId}/adcreatives`, {
      name: body.creative.name.trim(),
      object_story_spec: { page_id: body.page_id, link_data: linkData },
    });
    created.creative_id = creativeRes.id;

    // 5. Ad
    const adRes = await fbPost(`${actId}/ads`, {
      name: body.creative.name.trim(),
      adset_id: created.adset_id,
      creative: { creative_id: created.creative_id },
      status: "PAUSED",
    });
    created.ad_id = adRes.id;

    await logAction("ok");

    return new Response(JSON.stringify({ success: true, ...created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("[facebook-ads-create] error", msg, created);
    await rollback();
    await logAction("erro", msg);
    return new Response(JSON.stringify({ error: msg, partial: created }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
