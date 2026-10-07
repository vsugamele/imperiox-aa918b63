// Order bumps da Ticto (FUN1.3): a Ticto manda os bumps comprados DENTRO do aviso da compra principal (`bumps[]`),
// com o valor pago total incluindo os bumps. Cada bump vira uma venda "orderbump" do mesmo pedido.
// TS puro: monta as linhas; quem grava é o webhook-pagamento (e o backfill usa a mesma regra em SQL).

export interface BumpContext {
  leadId: string;
  projectId: string | null;
  externalTxId: string | null;
  dataCompra?: string | null;
  utms?: Record<string, string | null | undefined> | null;
}

export interface TictoBump { offer_code?: string; offer_name?: string; offer_price?: string | number; product_id?: number | string; product_name?: string }

export function tictoBumps(body: unknown): TictoBump[] {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>).bumps : null;
  return Array.isArray(b) ? b.filter((x): x is TictoBump => !!x && typeof x === "object") : [];
}

export function tictoBumpSales(body: unknown, ctx: BumpContext, now = new Date().toISOString()) {
  const utms = ctx.utms ?? null;
  return tictoBumps(body)
    .map((b) => ({ b, valor: Number(b.offer_price ?? 0) }))
    .filter(({ b, valor }) => valor > 0 && (b.product_name || b.offer_name))
    .map(({ b, valor }) => ({
      ...(ctx.dataCompra ? { created_at: ctx.dataCompra, data_venda: ctx.dataCompra } : {}),
      id: crypto.randomUUID(),
      lead_id: ctx.leadId,
      project_id: ctx.projectId,
      produto_nome: String(b.product_name || b.offer_name),
      valor,
      plataforma: "Ticto",
      status: "aprovado",
      tipo_venda: "orderbump",
      external_transaction_id: ctx.externalTxId,
      utm_source: utms?.utm_source ?? null,
      utm_medium: utms?.utm_medium ?? null,
      utm_campaign: utms?.utm_campaign ?? null,
      utm_content: utms?.utm_content ?? null,
      utm_term: utms?.utm_term ?? null,
      // A compra principal já foi para a Meta com o pedido; o bump não vira outro evento de compra.
      meta_offline_synced_at: now,
      data: { tipo_venda: "orderbump", bump_offer_code: b.offer_code ?? null, bump_offer_name: b.offer_name ?? null, bump_product_id: b.product_id ?? null, pedido_principal: ctx.externalTxId, ...(utms ? { utms } : {}) },
    }));
}
