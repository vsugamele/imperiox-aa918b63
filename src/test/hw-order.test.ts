import { describe, expect, it } from "vitest";
import { isHwPayload, parseHwPayload, projectForProduct } from "@shared/hw-order";

const projects = [
  { id: "vigor_boost", name: "Vigor Boost" },
  { id: "slimsoda", name: "SlimSoda" },
  { id: "jp_freitas", name: "JP Freitas" },
  { id: "tatuagem", name: "Tatuagem — Jonathan" },
];

// Formato real observado em produção (dados de comprador trocados por fictícios).
const orderPaid = {
  event: "ORDER_PAID",
  createdAt: "2026-09-05T12:02:33Z",
  data: {
    order: {
      id: "o1", orderNumber: "ORD-260905-01306", status: "PAID", type: "INITIAL", currency: "USD", isTest: false,
      paidAt: "2026-09-05T09:00:49-03:00", paymentPlatform: "SPARK",
      customer: { id: "c1", name: "Cliente Teste" },
      values: { totalGross: 12000, totalNet: 12000, totalFee: 0 },
      products: [
        { sku: "DTCVC04FE", name: "VigorBoost Capsule 2 + 2 Bottles LT", unitPrice: 10996, subtotal: 10996, total: -1004, isUpsell: false, quantity: 1, affiliateCommission: { commissionType: "CPA", commissionValue: 12000 } },
        { sku: "UPS01", name: "VigorBoost Extra Bottle", unitPrice: 3900, subtotal: 3900, total: 3900, isUpsell: true, quantity: 1, affiliateCommission: { commissionType: "CPA", commissionValue: 1500 } },
        { sku: "SHIP", name: "Express Shipping", unitPrice: 994, subtotal: 994, total: 994, isUpsell: false, quantity: 1, affiliateCommission: { commissionType: "CPA", commissionValue: 0 } },
      ],
      utm: { utm_source: "fb", utm_medium: "paid", utm_campaign: "vb-teste", utm_content: "ad-7", fbclid: "fb.1.abc", ad_id: "123", adset: "456", campaign_id: "789", affid: "aff_1" },
      buyLinks: [{ url: "https://cc.govigorboost.com/dtcnew-whop/" }],
    },
  },
};

describe("H&W webhook", () => {
  it("recognizes H&W orders and postbacks, but not Hotmart", () => {
    expect(isHwPayload(orderPaid)).toBe(true);
    expect(isHwPayload({ event: "SUBSCRIPTION_CANCELED", click_id: "x", payout: 10 })).toBe(true);
    expect(isHwPayload({ event: "PURCHASE_APPROVED", data: { buyer: {} } })).toBe(false);
    expect(isHwPayload({ event: "SUBSCRIPTION_CANCELLATION", data: { subscriber: {} } })).toBe(false);
    expect(isHwPayload({ status: "authorized", token: "t", item: {}, customer: {} })).toBe(false);
  });

  it("parses one sale per product with dollars, status, project and ad attribution", () => {
    const parsed = parseHwPayload(orderPaid, projects);
    expect(parsed.kind).toBe("pedido");
    expect(parsed.sales).toHaveLength(3);
    const [main, upsell, shipping] = parsed.sales;
    expect(main).toMatchObject({
      externalId: "ORD-260905-01306:DTCVC04FE", status: "aprovado", tipoVenda: "principal",
      valor: 109.96, valorLiquido: 120, moeda: "USD", projectId: "vigor_boost", clickId: "fb.1.abc",
      utms: { source: "fb", campaign: "vb-teste", content: "ad-7" },
    });
    expect(main.atribuicao).toMatchObject({ ad_id: "123", adset: "456", campaign_id: "789", affid: "aff_1", payment_platform: "SPARK" });
    expect(upsell).toMatchObject({ tipoVenda: "upsell", valor: 39, valorLiquido: 15 });
    // Frete não tem nome de projeto, mas herda o do produto principal do pedido.
    expect(shipping).toMatchObject({ tipoVenda: "orderbump", valor: 9.94, valorLiquido: 0, projectId: "vigor_boost" });
  });

  it("maps pending and failed orders, and honors an explicit project", () => {
    const failed = { ...orderPaid, event: "ORDER_FAILED", data: { order: { ...orderPaid.data.order, status: "FAILED" } } };
    expect(parseHwPayload(failed, projects).sales[0].status).toBe("recusado");
    expect(parseHwPayload({ ...orderPaid, event: "ORDER_PENDING" }, projects).sales[0].status).toBe("pendente");
    expect(parseHwPayload(orderPaid, projects, "slimsoda").sales[0].projectId).toBe("slimsoda");
  });

  it("does not guess a project for unknown products", () => {
    expect(projectForProduct("HorseJelo DTC 3 + 3 Bottles (v1)", projects)).toBeNull();
    expect(projectForProduct("SlimSoda Powder 6 Tubs", projects)).toBe("slimsoda");
  });

  it("keeps short postbacks as notices without inventing sales", () => {
    const parsed = parseHwPayload({ event: "ORDER_COMPLETED", click_id: "x", payout: 42, ct: "Purchase" }, projects);
    expect(parsed).toEqual({ evento: "ORDER_COMPLETED", kind: "postback", sales: [] });
  });
});
