// Meta Offline Conversions uploader
// Envia vendas de imphq_vendas para o Offline Event Set da Meta
// Pode rodar para 1 projeto (body: { project_id }) ou para todos (body: {} via cron)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FB_VERSION = "v19.0";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D+/g, "");
}

function makeClient(url: string, key: string) { return createClient(url, key); }
interface OfflineProject { id: string; meta_offline_event_set_id: string | null; fb_access_token: string | null }
interface OfflineLead { id?: string; email?: string | null; phone?: string | null; nome?: string | null }
interface MatchKeys { em?: string[]; ph?: string[]; fn?: string[]; ln?: string[] }
interface OfflineEvent { match_keys: MatchKeys; event_name: string; event_time: number; value: number; currency: string; order_id: string; custom_data: { content_name: string; utm_campaign: string; utm_source: string; utm_content: string; click_id: string } }
async function processProject(supabase: ReturnType<typeof makeClient>, project: OfflineProject) {
  const eventSetId: string | null = project.meta_offline_event_set_id;
  const accessToken: string | null = project.fb_access_token;
  if (!eventSetId || !accessToken) {
    return { project_id: project.id, skipped: true, reason: "missing_event_set_or_token" };
  }

  // pega vendas pendentes (ultimos 60 dias - limite Meta é 62 dias)
  const sinceIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: vendas, error: errV } = await supabase
    .from("imphq_vendas")
    .select("id, lead_id, valor, valor_liquido, produto_nome, data_venda, external_transaction_id, utm_campaign, utm_source, utm_content, click_id, status")
    .eq("project_id", project.id)
    .is("meta_offline_synced_at", null)
    .gte("data_venda", sinceIso)
    .in("status", ["aprovada", "approved", "paid", "completed", "finalizada"])
    .limit(500);

  if (errV) return { project_id: project.id, error: errV.message };
  if (!vendas || vendas.length === 0) return { project_id: project.id, uploaded: 0 };

  // Busca leads em batch
  const leadIds = [...new Set(vendas.map((v) => v.lead_id).filter(Boolean))];
  const leadMap = new Map<string, OfflineLead>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("imphq_leads")
      .select("id, email, phone, nome")
      .in("id", leadIds);
    for (const l of leads || []) leadMap.set(l.id, l);
  }

  // Constroi eventos
  const events: OfflineEvent[] = [];
  const eventSaleIds: string[] = [];
  for (const v of vendas) {
    const lead = leadMap.get(v.lead_id) || {};
    const matchKeys: MatchKeys = {};
    if (lead.email) matchKeys.em = [await sha256(lead.email)];
    const phone = onlyDigits(lead.phone);
    if (phone) matchKeys.ph = [await sha256(phone)];
    if (lead.nome) {
      const parts = String(lead.nome).trim().split(/\s+/);
      matchKeys.fn = [await sha256(parts[0] || "")];
      if (parts.length > 1) matchKeys.ln = [await sha256(parts.slice(-1)[0] || "")];
    }
    if (!matchKeys.em && !matchKeys.ph) continue; // sem match key, pula

    eventSaleIds.push(v.id);
    events.push({
      match_keys: matchKeys,
      event_name: "Purchase",
      event_time: Math.floor(new Date(v.data_venda).getTime() / 1000),
      value: Number(v.valor || 0),
      currency: "BRL",
      order_id: v.external_transaction_id || v.id,
      custom_data: {
        content_name: v.produto_nome || "",
        utm_campaign: v.utm_campaign || "",
        utm_source: v.utm_source || "",
        utm_content: v.utm_content || "",
        click_id: v.click_id || "",
      },
    });
  }

  if (events.length === 0) {
    return { project_id: project.id, uploaded: 0, skipped_no_match: vendas.length };
  }

  // Envia em batches de 100 (limite Meta = 1000, mas 100 é seguro)
  let uploaded = 0;
  const url = `https://graph.facebook.com/${FB_VERSION}/${eventSetId}/events`;
  const errors: string[] = [];
  for (let i = 0; i < events.length; i += 100) {
    const batch = events.slice(i, i + 100);
    const form = new FormData();
    form.append("upload_tag", `imperius_${project.id}_${Date.now()}`);
    form.append("data", JSON.stringify(batch));
    form.append("access_token", accessToken);
    const resp = await fetch(url, { method: "POST", body: form });
    const json = await resp.json();
    if (!resp.ok || json.error) {
      errors.push(JSON.stringify(json.error || json));
      continue;
    }
    const ids = eventSaleIds.slice(i, i + 100);
    const { error: syncError } = await supabase.from("imphq_vendas")
      .update({ meta_offline_synced_at: new Date().toISOString() }).in("id", ids);
    if (syncError) { errors.push(`sync marker: ${syncError.message}`); continue; }
    uploaded += batch.length;
  }

  return { project_id: project.id, uploaded, total_candidates: vendas.length, errors: errors.length ? errors : undefined };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let body: { project_id?: string } = {};
    try { const input: unknown = await req.json(); if (input && typeof input === "object" && "project_id" in input && typeof input.project_id === "string") body = { project_id: input.project_id }; } catch { /* Empty bodies are allowed for cron. */ }

    let projects: OfflineProject[] = [];
    if (body.project_id) {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, meta_offline_event_set_id, fb_access_token")
        .eq("id", body.project_id)
        .maybeSingle();
      if (data) projects = [data];
    } else {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, meta_offline_event_set_id, fb_access_token")
        .not("meta_offline_event_set_id", "is", null)
        .not("fb_access_token", "is", null)
        .eq("is_archived", false);
      projects = data || [];
    }

    const results = [];
    for (const p of projects) {
      results.push(await processProject(supabase, p));
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? e.message : undefined }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
