import { describe, expect, it } from "vitest";
import { lastSync, liveLabel, liveReadings, saleContent, testReportText, type LiveOrder, type LiveVariant } from "@shared/test-live";

const order: LiveOrder = {
  nome: "[JP][CCP] Teste de ângulos", oferta: "Código dos Cortes Perfeitos", status: "no_ar", utm_campaign: "ccp-teste-angulos-0510",
  payout: 23.5, cpa_alvo: 60, ics_por_venda: 4, verba_dia_conjunto: 30, ativado_em: "2026-10-05T15:00:00Z",
};
const variants: LiveVariant[] = [
  { ordem: 1, angulo: "Medo de cortar cachos", status: "no_ar", utm_content: "01-medo", meta_ad_id: "ad1" },
  { ordem: 2, angulo: "Quer cobrar mais?", status: "no_ar", utm_content: "02-dinheiro", meta_ad_id: "ad2" },
];
const spend = [
  { ad_id: "ad1", spend: "9.5", init_checkout: 3, link_clicks: 9, impressoes: 400, purchases: 4, effective_status: "ACTIVE", created_at: "2026-10-06T12:20:00Z" },
  { ad_id: "ad1", spend: 2, init_checkout: 1, link_clicks: 1, impressoes: 50, purchases: 0, effective_status: "ACTIVE", created_at: "2026-10-06T06:20:00Z" },
  { ad_id: "ad2", spend: 6.66, init_checkout: 0, link_clicks: 1, impressoes: 393, purchases: 0, effective_status: "PAUSED", created_at: "2026-10-06T12:20:00Z" },
  { ad_id: "outro", spend: 50, created_at: "2026-10-06T13:00:00Z" },
];
const sales = [
  { utm_campaign: "ccp-teste-angulos-0510", utm_content: "01-medo::PAZXh0bg", status: "aprovado", valor: 47, valor_liquido: 23.5 },
  { utm_campaign: "ccp-teste-angulos-0510", utm_content: "01-medo", status: "recusado", valor: 47 },
  { utm_campaign: "Não Informado", utm_content: "Não Informado", status: "aprovado", valor: 47 },
];

describe("leitura ao vivo do teste", () => {
  it("só chama de vendendo quem vendeu; qualificado sem venda é IC barato", () => {
    expect(liveLabel("vencedor", 0)).toBe("ic_barato");
    expect(liveLabel("manter", 1)).toBe("vendendo");
    expect(liveLabel("pausar", 0)).toBe("pausar");
    expect(liveLabel("ja_parado", 2)).toBe("parado");
  });

  it("soma o gasto por anúncio, conta só vendas aprovadas da UTM e ignora outros anúncios", () => {
    expect(saleContent("01-medo::abc")).toBe("01-medo");
    const [medo, dinheiro] = liveReadings(order, variants, spend, sales);
    expect(medo).toMatchObject({ gasto: 11.5, ic: 4, cliques: 10, compras_pixel: 4, vendas: 1, receita_liquida: 23.5, cpa: 11.5, status_meta: "ACTIVE" });
    expect(dinheiro).toMatchObject({ gasto: 6.66, vendas: 0, cpa: null, status_meta: "PAUSED" });
    expect(lastSync(spend)).toBe("2026-10-06T13:00:00Z");
  });

  it("monta o relatório do grupo com totais, ângulos e o aviso de que o pixel não decide", () => {
    const readings = liveReadings(order, variants, spend, sales);
    const text = testReportText(order, variants, readings, "2026-10-06T12:20:00Z", new Date("2026-10-06T13:00:00Z"));
    expect(text).toContain("*📊 Teste de criativos · [JP][CCP] Teste de ângulos*");
    expect(text).toContain("Vendas reais: *1*");
    expect(text).toContain("Pixel diz 4 compra(s); vale a venda da plataforma.");
    expect(text).toContain("01 Medo de cortar cachos: R$ 11,50 · 4 IC · 1 venda(s) · CPA R$ 11,50");
    expect(text).toContain("02 Quer cobrar mais? (pausado na Meta)");
    expect(text).toContain("Dia 1 de teste");
    expect(text).toContain("🏆 01 Medo");
    expect(text).not.toContain("Vencedores");
    expect(text).toContain("Gasto do Zernio até 06/10 09:20");
    // O ângulo com venda vem primeiro.
    expect(text.indexOf("01 Medo")).toBeLessThan(text.indexOf("02 Quer"));
  });
});

describe("bump no teste de criativos", () => {
  it("soma o bump na receita do anúncio sem contar outra venda", () => {
    const comBump = [
      { utm_campaign: "ccp-teste-angulos-0510", utm_content: "01-medo", status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "principal" },
      { utm_campaign: "ccp-teste-angulos-0510", utm_content: "01-medo", status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "orderbump" },
    ];
    const [medo] = liveReadings(order, variants.slice(0, 1), [], comBump);
    expect(medo).toMatchObject({ vendas: 1, receita_liquida: 47 });
  });
});
