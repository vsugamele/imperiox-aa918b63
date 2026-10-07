import { describe, expect, it } from "vitest";
import { tictoBumpSales, tictoBumps } from "@shared/ticto-bumps";

const body = {
  status: "authorized",
  item: { product_name: "Código dos Cortes Perfeitos", amount: 4700 },
  order: { paid_amount: 13100 },
  bumps: [
    { offer_code: "OE37EAEC1", offer_name: "O Segredo do Corte Upsell", offer_price: "47.00", product_id: 81671, product_name: "Segredo do Corte" },
    { offer_code: "OD4F13421", offer_name: "A Arte da Finalização Oderbump", offer_price: "37.00", product_id: 81672, product_name: "Arte da Finalização" },
    { offer_code: "X", offer_price: "0" },
  ],
};

describe("order bumps da Ticto", () => {
  it("vira uma venda orderbump por bump pago, do mesmo pedido, sem evento de compra para a Meta", () => {
    expect(tictoBumps({})).toEqual([]);
    const rows = tictoBumpSales(body, { leadId: "l1", projectId: "jp_freitas", externalTxId: "4707596", dataCompra: "2026-10-07T00:51:30Z", utms: { utm_campaign: "ccp-teste-angulos-0510", utm_content: "07-publico" } }, "2026-10-07T01:00:00Z");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ produto_nome: "Segredo do Corte", valor: 47, tipo_venda: "orderbump", status: "aprovado", external_transaction_id: "4707596", utm_content: "07-publico", meta_offline_synced_at: "2026-10-07T01:00:00Z", created_at: "2026-10-07T00:51:30Z" });
    expect(rows[1]).toMatchObject({ produto_nome: "Arte da Finalização", valor: 37, data: { pedido_principal: "4707596", bump_offer_code: "OD4F13421" } });
  });
});
