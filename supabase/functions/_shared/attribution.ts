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
    } catch (_) {}
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
  metadata?: Record<string, any>;
};

/**
 * Processa um texto outgoing: se contém link de checkout, gera attribution_id,
 * substitui o link no texto pela versão com ?attr=<id> e registra em imphq_wa_attribution.
 *
 * @returns { text: string, attribution_id: string | null }
 */
export async function attributeOutgoing(
  supabase: any,
  text: string,
  ctx: AttributionContext
): Promise<{ text: string; attribution_id: string | null; link_url: string | null }> {
  const link = detectCheckoutLink(text);
  if (!link) return { text, attribution_id: null, link_url: null };

  const attrId = generateAttributionId();
  const newLink = injectAttributionParam(link, attrId);
  const newText = text.replace(link, newLink);

  try {
    await supabase.from("imphq_wa_attribution").insert({
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
    });
  } catch (e: any) {
    console.warn(`[attribution] insert failed: ${e?.message}`);
  }

  return { text: newText, attribution_id: attrId, link_url: newLink };
}

/**
 * Liga uma venda a um attribution_id quando o webhook de pagamento dispara.
 * Match prioritário: por click_id explícito → por phone+produto (fallback).
 */
export async function linkSaleToAttribution(
  supabase: any,
  opts: {
    project_id: string;
    venda_id: string;
    venda_status: string;
    click_id?: string | null;
    phone?: string | null;
    produto_nome?: string | null;
    valor?: number;
  }
): Promise<string | null> {
  let attrRow: any = null;

  if (opts.click_id) {
    const { data } = await supabase
      .from("imphq_wa_attribution")
      .select("id, attribution_id, sent_at")
      .or(`click_id.eq.${opts.click_id},attribution_id.eq.${opts.click_id}`)
      .eq("project_id", opts.project_id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attrRow = data;
  }

  if (!attrRow && opts.phone) {
    const { data } = await supabase
      .from("imphq_wa_attribution")
      .select("id, attribution_id, sent_at")
      .eq("project_id", opts.project_id)
      .eq("phone", opts.phone)
      .is("venda_id", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attrRow = data;
  }

  if (!attrRow) return null;

  await supabase
    .from("imphq_wa_attribution")
    .update({
      venda_id: opts.venda_id,
      venda_status: opts.venda_status,
      matched_at: new Date().toISOString(),
      click_id: opts.click_id || attrRow.attribution_id,
    })
    .eq("id", attrRow.id);

  return attrRow.attribution_id;
}
