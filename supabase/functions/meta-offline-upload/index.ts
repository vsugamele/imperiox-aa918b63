// Purchase server-side para a Meta via Conversions API (substitui a Offline Conversions API, descontinuada).
// Envia vendas aprovadas de imphq_vendas para /{pixel_id}/events com event_id = número do pedido (dedup com o Pixel).
// Roda para 1 projeto (body: { project_id }) ou para todos (body: {} via cron a cada 30 min).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildUserData, matchKeys, PAID_STATUSES, sendCapi, type CapiEvent } from "../_shared/meta-capi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeClient(url: string, key: string) { return createClient(url, key); }
interface CapiProject { id: string; fb_pixel_id: string | null; fb_access_token: string | null; fb_test_event_code?: string | null; settings?: Record<string, unknown> | null }
interface SaleLead { id?: string; email?: string | null; phone?: string | null; nome?: string | null }
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Valor da Purchase: "comissao" (padrão para afiliado, quando existe valor_liquido) ou "preco". */
function purchaseValue(v: Record<string, unknown>, mode: string): number {
  const liquido = Number(v.valor_liquido);
  if (mode !== "preco" && Number.isFinite(liquido) && liquido > 0) return liquido;
  return Number(v.valor || 0);
}

/** fbclid salvo pelo checkout: data.utms.fbclid, ou embutido no utm_content no padrão "nome-do-anuncio::FBCLID::". */
function extractFbclid(v: Record<string, unknown>): string | null {
  const utms = rec(rec(v.data).utms);
  const direct = str(utms.fbclid) ?? str(rec(rec(v.data).atribuicao).fbclid);
  if (direct) return direct;
  for (const raw of [v.utm_content, utms.utm_content, v.utm_term, utms.utm_term]) {
    const s = str(raw);
    if (!s || !s.includes("::")) continue;
    const hit = s.split("::").map((p) => p.trim()).find((p) => /^[A-Za-z0-9_-]{40,}$/.test(p));
    if (hit) return hit;
  }
  return null;
}

async function processProject(supabase: ReturnType<typeof makeClient>, project: CapiProject) {
  const pixelId = project.fb_pixel_id;
  const accessToken = project.fb_access_token;
  if (!pixelId || !accessToken) return { project_id: project.id, skipped: true, reason: "missing_pixel_or_token" };
  // Quando o checkout (ex.: Ticto) já manda Purchase pela própria integração, enviar de novo duplicaria a venda.
  if (rec(project.settings).meta_purchase_source === "plataforma") return { project_id: project.id, skipped: true, reason: "purchase_sent_by_platform" };
  const valueMode = str(rec(project.settings).meta_purchase_value) ?? "comissao";

  // Meta aceita eventos de até 7 dias atrás com action_source=website.
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: vendas, error: errV } = await supabase
    .from("imphq_vendas")
    .select("id, lead_id, valor, valor_liquido, produto_nome, data_venda, external_transaction_id, utm_campaign, utm_source, utm_content, click_id, status, pais, nome, data, tipo_venda")
    .eq("project_id", project.id)
    .is("meta_offline_synced_at", null)
    .gte("data_venda", sinceIso)
    .in("status", PAID_STATUSES)
    .limit(500);

  if (errV) return { project_id: project.id, error: errV.message };
  if (!vendas || vendas.length === 0) return { project_id: project.id, uploaded: 0 };

  const leadIds = [...new Set(vendas.map((v) => v.lead_id).filter(Boolean))];
  const leadMap = new Map<string, SaleLead>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("imphq_leads").select("id, email, phone, nome").in("id", leadIds);
    for (const l of leads || []) leadMap.set(l.id, l);
  }

  const events: CapiEvent[] = [];
  const eventSaleIds: string[] = [];
  const keysBySale: string[][] = [];
  for (const v of vendas) {
    const lead = leadMap.get(v.lead_id) || {};
    const data = rec(v.data);
    const attr = rec(data.atribuicao);
    const tracker = rec(data.tracker);
    const eventMs = new Date(v.data_venda).getTime();
    const userData = await buildUserData({
      email: lead.email, phone: lead.phone, name: lead.nome || v.nome, country: v.pais,
      externalId: str(attr.sub3) ?? str(tracker.visitor_id) ?? v.lead_id,
      fbp: str(attr.sub1) ?? str(tracker.fbp), fbc: str(attr.sub2) ?? str(tracker.fbc),
      fbclid: extractFbclid(v),
    }, eventMs);
    const keys = matchKeys(userData);
    // Sem nenhuma chave de identidade a Meta descarta; deixa para nova tentativa quando o lead for enriquecido.
    if (!["em", "ph", "fbc", "fbp"].some((k) => keys.includes(k))) continue;
    const orderId = str(data.pedido) ?? v.external_transaction_id ?? v.id;
    const currency = (str(data.moeda) && str(data.moeda) !== "UNKNOWN" ? str(data.moeda)! : "BRL").toUpperCase();
    eventSaleIds.push(v.id);
    keysBySale.push(keys);
    events.push({
      event_name: "Purchase",
      event_time: Math.floor(eventMs / 1000),
      event_id: `purchase_${v.external_transaction_id || v.id}`,
      action_source: "website",
      user_data: userData,
      custom_data: {
        value: purchaseValue(v, valueMode),
        currency,
        order_id: orderId,
        content_name: v.produto_nome || "",
        content_type: "product",
        utm_campaign: v.utm_campaign || undefined,
        utm_source: v.utm_source || undefined,
        utm_content: v.utm_content || undefined,
        sale_type: v.tipo_venda || undefined,
      },
    });
  }

  if (events.length === 0) return { project_id: project.id, uploaded: 0, total_candidates: vendas.length, skipped_no_match: vendas.length };

  let uploaded = 0;
  const errors: string[] = [];
  for (let i = 0; i < events.length; i += 100) {
    const batch = events.slice(i, i + 100);
    const ids = eventSaleIds.slice(i, i + 100);
    const result = await sendCapi(pixelId, accessToken, batch, { testEventCode: project.fb_test_event_code, fetchImpl: fetch });
    await supabase.from("imphq_capi_log").insert(batch.map((e, j) => ({
      project_id: project.id, pixel_id: pixelId, event_name: e.event_name, event_id: e.event_id, source: "venda",
      match_keys: keysBySale[i + j], ok: result.ok, http_status: result.status, error: result.error ?? null,
      fbtrace_id: result.fbtrace_id ?? null, test_mode: !!project.fb_test_event_code,
    })));
    if (!result.ok) {
      errors.push(result.error ?? "send_failed");
      await supabase.from("imphq_vendas").update({ meta_capi_status: "erro", meta_capi_error: (result.error ?? "").slice(0, 500) }).in("id", ids);
      continue;
    }
    // Em modo teste não marca como enviada, para a venda real ainda subir depois.
    if (project.fb_test_event_code) { uploaded += batch.length; continue; }
    const { error: syncError } = await supabase.from("imphq_vendas")
      .update({ meta_offline_synced_at: new Date().toISOString(), meta_capi_status: "enviado", meta_capi_error: null }).in("id", ids);
    if (syncError) { errors.push(`sync marker: ${syncError.message}`); continue; }
    uploaded += batch.length;
  }

  return { project_id: project.id, uploaded, total_candidates: vendas.length, errors: errors.length ? errors : undefined };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let body: { project_id?: string } = {};
    try { const input: unknown = await req.json(); if (input && typeof input === "object" && "project_id" in input && typeof input.project_id === "string") body = { project_id: input.project_id }; } catch { /* Empty bodies are allowed for cron. */ }

    const cols = "id, fb_pixel_id, fb_access_token, fb_test_event_code, settings";
    let projects: CapiProject[] = [];
    if (body.project_id) {
      const { data } = await supabase.from("imphq_projects").select(cols).eq("id", body.project_id).maybeSingle();
      if (data) projects = [data];
    } else {
      const { data } = await supabase.from("imphq_projects").select(cols)
        .not("fb_pixel_id", "is", null).not("fb_access_token", "is", null).eq("is_archived", false);
      projects = data || [];
    }

    const results = [];
    for (const p of projects) results.push(await processProject(supabase, p));
    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : undefined }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
