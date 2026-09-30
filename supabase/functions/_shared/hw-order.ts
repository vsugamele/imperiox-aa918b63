// Leitura dos avisos de venda da H&W (checkout "cc.<marca>.com", pagamento SPARK).
// TS puro e sem dependências: testável fora do Deno e usado pelo webhook-pagamento.
// Formatos vistos em produção:
//   pedido   → { event: "ORDER_PAID" | "ORDER_PENDING" | "ORDER_FAILED" ..., createdAt, data: { order: {...} } }
//   postback → { event, event_type, click_id, payout, ct, createdAt }   (ex.: ORDER_COMPLETED, SUBSCRIPTION_CANCELED)

export type VendaStatus = "aprovado" | "pendente" | "recusado" | "reembolsado" | "cancelado" | "chargeback";

export interface HwSale {
  externalId: string;       // número do pedido + SKU (um pedido pode ter vários produtos)
  orderNumber: string;
  produto: string;
  sku: string | null;
  status: VendaStatus;
  tipoVenda: "principal" | "upsell" | "orderbump";
  valor: number;            // preço pago pelo cliente, na moeda original (a H&W manda em centavos)
  valorLiquido: number;     // comissão que o afiliado recebe (CPA) por este item
  moeda: string;
  dataVenda: string | null;
  nome: string | null;
  projectId: string | null;
  utms: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null };
  clickId: string | null;
  atribuicao: Record<string, string>;
}

export interface HwParsed {
  evento: string;
  kind: "pedido" | "postback";
  sales: HwSale[];
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
const key = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HW_EVENT = /^(ORDER|SUBSCRIPTION)_[A-Z_]+$/;

/** Reconhece um aviso da H&W sem confundir com Hotmart (que usa PURCHASE_* e SUBSCRIPTION_CANCELLATION). */
export function isHwPayload(input: unknown): boolean {
  const body = rec(input);
  const event = str(body.event) ?? str(body.event_type) ?? "";
  if (!HW_EVENT.test(event)) return false;
  const order = rec(rec(body.data).order);
  if (Object.keys(order).length) return "orderNumber" in order || "paymentPlatform" in order || "buyLinks" in order;
  return "click_id" in body || "payout" in body;
}

const STATUS_BY_EVENT: Record<string, VendaStatus> = {
  ORDER_PAID: "aprovado",
  ORDER_COMPLETED: "aprovado",
  ORDER_PENDING: "pendente",
  ORDER_FAILED: "recusado",
  ORDER_REFUNDED: "reembolsado",
  ORDER_CANCELED: "cancelado",
  ORDER_CANCELLED: "cancelado",
  ORDER_CHARGEBACK: "chargeback",
  SUBSCRIPTION_CANCELED: "cancelado",
  SUBSCRIPTION_CANCELLED: "cancelado",
};
const STATUS_BY_ORDER: Record<string, VendaStatus> = {
  PAID: "aprovado", COMPLETED: "aprovado", PENDING: "pendente", FAILED: "recusado",
  REFUNDED: "reembolsado", CANCELED: "cancelado", CANCELLED: "cancelado", CHARGEBACK: "chargeback",
};

/** Projeto pelo nome do produto: "VigorBoost Capsule 2 + 2" → vigor_boost (nome "Vigor Boost"). Sem palpite quando não bate. */
export function projectForProduct(produto: string, projects: ReadonlyArray<{ id: string; name: string }>): string | null {
  const p = key(produto);
  if (!p) return null;
  const match = projects
    .map((proj) => ({ id: proj.id, k: key(proj.name.split(/[—–-]/)[0] || proj.name) }))
    .filter((proj) => proj.k.length >= 4 && p.includes(proj.k))
    .sort((a, b) => b.k.length - a.k.length)[0];
  return match?.id ?? null;
}

const ATTRIBUTION_KEYS = [
  "fbclid", "ad_id", "ad_name", "adname", "adset", "adset_name", "campaign_id", "campaign_name",
  "placement", "site_source_name", "affid", "subid", "sub1", "sub2", "sub3", "sub4", "sub5", "hid", "utm_id",
];

export function parseHwPayload(
  input: unknown,
  projects: ReadonlyArray<{ id: string; name: string }>,
  projectOverride: string | null = null,
): HwParsed {
  const body = rec(input);
  const evento = str(body.event) ?? str(body.event_type) ?? "desconhecido";
  const order = rec(rec(body.data).order);

  if (!Object.keys(order).length) {
    // Postback curto: não tem produto nem valor confiáveis, só registra o aviso.
    return { evento, kind: "postback", sales: [] };
  }

  const orderNumber = str(order.orderNumber) ?? str(order.id) ?? "";
  const status = STATUS_BY_EVENT[evento] ?? STATUS_BY_ORDER[(str(order.status) ?? "").toUpperCase()] ?? "pendente";
  const moeda = (str(order.currency) ?? "USD").toUpperCase();
  const utm = rec(order.utm);
  const atribuicao: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = str(utm[k]);
    if (v) atribuicao[k] = v;
  }
  const paymentPlatform = str(order.paymentPlatform);
  if (paymentPlatform) atribuicao.payment_platform = paymentPlatform;

  const products = Array.isArray(order.products) ? order.products.map(rec) : [];
  const values = rec(order.values);
  const list = products.length ? products : [{}];
  const productName = (prod: Record<string, unknown>) =>
    str(prod.name) ?? str(rec(Array.isArray(order.offers) ? order.offers[0] : null).name) ?? "Pedido H&W";
  // O projeto vem do produto principal; frete e clube ("Express Shipping", "Wellness Club") herdam dele.
  const orderProject = projectOverride
    ?? list.map((prod) => projectForProduct(productName(prod), projects)).find((id): id is string => !!id)
    ?? null;

  const sales = list.map((prod, index): HwSale => {
    const produto = productName(prod);
    const sku = str(prod.sku);
    const commission = rec(prod.affiliateCommission);
    // Visão de afiliado: subtotal/unitPrice = preço pago pelo cliente; commissionValue = CPA recebido.
    // `total` do item é um saldo com desconto (pode ser negativo) e não serve como preço.
    const priceCents = products.length ? num(prod.subtotal ?? num(prod.unitPrice) * (num(prod.quantity) || 1)) : num(values.totalGross);
    const commissionCents = products.length ? num(commission.commissionValue ?? commission.valueNet) : num(values.totalNet);
    const tipoVenda = prod.isUpsell === true ? "upsell" : list.length > 1 && commissionCents === 0 ? "orderbump" : "principal";
    return {
      externalId: `${orderNumber}:${sku ?? index}`,
      orderNumber,
      produto,
      sku,
      status,
      tipoVenda,
      valor: Math.round(priceCents) / 100,
      valorLiquido: Math.round(commissionCents) / 100,
      moeda,
      dataVenda: str(order.paidAt) ?? str(order.createdAt) ?? str(body.createdAt),
      nome: str(rec(order.customer).name),
      projectId: orderProject,
      utms: {
        source: str(utm.utm_source), medium: str(utm.utm_medium), campaign: str(utm.utm_campaign),
        content: str(utm.utm_content), term: str(utm.utm_term),
      },
      clickId: str(utm.fbclid) ?? str(utm.click_id) ?? str(body.click_id),
      atribuicao,
    };
  });

  return { evento, kind: "pedido", sales };
}
