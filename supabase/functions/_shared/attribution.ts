import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorText, record } from "./value.ts";
// Helper compartilhado de atribuição de venda.
// Quando uma msg outgoing carrega link de checkout, gera um attribution_id curto,
// injeta no link como ?attr=<id> e ?xc=<id> (compat com Ticto click_id) e salva
// registro em imphq_wa_attribution.
//
// Quando o webhook de pagamento dispara, conseguimos amarrar venda → atribuição
// via click_id.
//
// Source values padronizados:
//   "chat_manual"       (operador digitou no ChatView)
//   "ai_reply"          (IA respondeu)
//   "payment_recovery"  (cron recovery)
//   "campaign"          (campaign-scheduler)
//   "cold_reactivator"  (wa-cold-lead-reactivator)
//   "command"           (resposta de /comando)
//   "ig_*"              (espelho Instagram)

const CHECKOUT_HOSTS = [
  "checkout.ticto.app",
  "checkout.ticto.com.br",
  "pay.hotmart.com",
  "pay.kiwify.com.br",
  "kiwify.com.br",
  "kiwify.app",
  "monetizze.com.br",
  "hubla.com.br",
  "braip.com",
  "braip.com.br",
];

/**
 * Detecta se um texto contém link de checkout.
 * Retorna o primeiro link encontrado ou null.
 */
export function detectCheckoutLink(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  const urls = text.match(urlRegex) || [];
  for (const u of urls) {
    try {
      const host = new URL(u).host.toLowerCase();
      if (CHECKOUT_HOSTS.some(h => host === h || host.endsWith("." + h))) return u;
    } catch { /* Ignore malformed candidate URLs; inspect the next link. */ }
  }
  return null;
}

/**
 * Gera attribution_id curto (12 chars, base36) — humanamente curto mas suficiente
 * (36^12 ≈ 4.7 * 10^18 combinações).
 */
export function generateAttributionId(): string {
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

/**
 * Injeta ?attr=<id>&xc=<id> em uma URL.
 * Preserva query existente. Idempotente: se já tem ?attr= ou ?xc=, não duplica.
 */
export function injectAttributionParam(url: string, attrId: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("attr")) u.searchParams.set("attr", attrId);
    if (!u.searchParams.has("xc")) u.searchParams.set("xc", attrId);
    return u.toString();
  } catch (_) {
    return url.includes("?")
      ? `${url}&attr=${attrId}&xc=${attrId}`
      : `${url}?attr=${attrId}&xc=${attrId}`;
  }
}

export type AttributionContext = {
  project_id: string;
  conversation_id?: string | null;
  phone?: string | null;
  source: string;
  source_detail?: string;
  template_name?: string;
  campaign_id?: string;
  produto_nome?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Processa um texto outgoing: se contém link de checkout, gera attribution_id,
 * substitui o link no texto pela versão com ?attr=<id> e registra em imphq_wa_attribution.
 *
 * @returns { text: string, attribution_id: string | null }
 */
export async function attributeOutgoing(
  supabase: SupabaseClient,
  text: string,
  ctx: AttributionContext
): Promise<{ text: string; attribution_id: string | null; link_url: string | null }> {
  const link = detectCheckoutLink(text);
  if (!link) return { text, attribution_id: null, link_url: null };

  const existing = new URL(link);
  const attrId = existing.searchParams.get("attr") || existing.searchParams.get("xc") || generateAttributionId();
  const newLink = injectAttributionParam(link, attrId);
  const newText = text.replace(link, newLink);

  try {
    const { error } = await supabase.from("imphq_wa_attribution").upsert({
      attribution_id: attrId,
      project_id: ctx.project_id,
      conversation_id: ctx.conversation_id || null,
      phone: ctx.phone || null,
      link_url: newLink,
      source: ctx.source,
      source_detail: ctx.source_detail || null,
      template_name: ctx.template_name || null,
      campaign_id: ctx.campaign_id || null,
      produto_nome: ctx.produto_nome || null,
      metadata: ctx.metadata || {},
    }, { onConflict: "attribution_id", ignoreDuplicates: true });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn(`[attribution] insert failed: ${errorText(e)}`);
    return { text, attribution_id: null, link_url: link };
  }

  return { text: newText, attribution_id: attrId, link_url: newLink };
}

/**
 * Liga uma venda a um attribution_id quando o webhook de pagamento dispara.
 * Match prioritário: clique explícito; inferência por telefone+produto nos 7 dias anteriores à venda.
 */
export async function linkSaleToAttribution(
  supabase: SupabaseClient,
  opts: {
    project_id: string;
    venda_id: string;
    venda_status: string;
    click_id?: string | null;
    phone?: string | null;
    produto_nome?: string | null;
    valor?: number;
    data_venda?: string | null;
  }
): Promise<string | null> {
  let attrRow: { id: string; attribution_id: string; sent_at: string; metadata: unknown } | null = null;
  let method = "click_id";
  const paidAt = opts.data_venda && Number.isFinite(Date.parse(opts.data_venda)) ? new Date(opts.data_venda) : new Date();

  if (opts.click_id) {
    const matches = await Promise.all((["click_id", "attribution_id"] as const).map(column => supabase
      .from("imphq_wa_attribution")
      .select("id, attribution_id, sent_at, metadata")
      .eq(column, opts.click_id)
      .eq("project_id", opts.project_id)
      .gte("sent_at", new Date(paidAt.getTime() - 30 * 86400000).toISOString())
      .lte("sent_at", new Date(paidAt.getTime() + 300000).toISOString())
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()));
    // Preserve the former OR query's newest-match ordering across both exact IDs.
    for (const { data, error } of matches) {
      if (error) throw error;
      if (data && (!attrRow || Date.parse(data.sent_at) > Date.parse(attrRow.sent_at))) attrRow = data;
    }
  }

  if (!attrRow && opts.phone && opts.produto_nome) {
    const { data, error } = await supabase
      .from("imphq_wa_attribution")
      .select("id, attribution_id, sent_at, metadata")
      .eq("project_id", opts.project_id)
      .eq("phone", opts.phone)
      .eq("produto_nome", opts.produto_nome)
      .gte("sent_at", new Date(paidAt.getTime() - 7 * 86400000).toISOString())
      .lte("sent_at", paidAt.toISOString())
      .is("venda_id", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    attrRow = data;
    method = "phone_product_7d";
  }

  if (!attrRow) return null;

  const { error } = await supabase
    .from("imphq_wa_attribution")
    .update({
      venda_id: opts.venda_id,
      venda_status: opts.venda_status,
      matched_at: new Date().toISOString(),
      click_id: opts.click_id || attrRow.attribution_id,
      metadata: { ...record(attrRow.metadata), match_method: method, match_confidence: method === "click_id" ? "confirmed" : "inferred" },
    })
    .eq("id", attrRow.id);
  if (error) throw error;
  if (method === "click_id" && opts.click_id) {
    const { error: saleError } = await supabase.from("imphq_vendas").update({ click_id: opts.click_id }).eq("id", opts.venda_id).eq("project_id", opts.project_id);
    if (saleError) throw saleError;
  }

  return attrRow.attribution_id;
}
