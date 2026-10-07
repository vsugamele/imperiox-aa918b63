import { describe, expect, it } from "vitest";
import { buildFunnelLive } from "@shared/funnel-live";

const ads = [{ spend: 100, impressoes: 10000, link_clicks: 200, init_checkout: 30 }, { spend: "27.6", impressoes: 2000, link_clicks: 40, init_checkout: 5 }];
const sales = [
  { status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "principal", data: { hot_lead_responder_ok: true, recovery_sent_levels: [1] } },
  { status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "orderbump" },
  { status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "principal" },
  { status: "pix_gerado", valor: 47, tipo_venda: "principal", data: { recovery_sent_levels: [1] } },
  { status: "recusado", valor: 47, tipo_venda: "principal" },
  { status: "carrinho_abandonado", valor: 0, tipo_venda: "principal" },
];

describe("painel ao vivo do funil", () => {
  it("calcula etapas, totais e aponta o gargalo, sem inventar página quando não há rastreador", () => {
    const f = buildFunnelLive({ ads, pages: [], sales });
    expect(f.totais).toMatchObject({ gasto: 127.6, bruto: 141, liquido: 70.5, saldo: -57.1, vendas: 2, cpa: 63.8 });
    const [anuncio, pagina, checkout, venda, extra, recup] = f.etapas;
    expect(anuncio).toMatchObject({ status: "ok", conversao: { value: 2 } });
    expect(pagina).toMatchObject({ status: "sem_dado", nota: "A página não tem o rastreador do Império." });
    expect(checkout.metrics[0]).toMatchObject({ value: 35 });
    expect(venda).toMatchObject({ conversao: { value: 50 }, status: "ok" }); // 2 aprovadas de 4 pedidos (pix e recusado contam)
    expect(extra).toMatchObject({ status: "ok", conversao: { value: 50 } });
    expect(recup).toMatchObject({ conversao: { value: 50 }, status: "ok" });
    expect(f.gargalo).toBeNull();
  });

  it("marca medição incompleta quando a página mede bem menos visitas que cliques, e não chama isso de gargalo", () => {
    const f = buildFunnelLive({ ads, pages: [{ url: "x", values: { sessoes_pagina: 34, cliques_cta: 2 } }], sales });
    expect(f.etapas[1]).toMatchObject({ status: "medicao_incompleta" });
    expect(f.etapas[1].nota).toContain("34 visitas");
    expect(f.etapas[2]).toMatchObject({ status: "medicao_incompleta" }); // 35 checkouts para 34 visitas
    expect(f.gargalo).not.toBe("pagina");
  });

  it("aponta como gargalo a etapa mais abaixo da referência", () => {
    const f = buildFunnelLive({ ads: [{ spend: 50, impressoes: 10000, link_clicks: 30 }], pages: [], sales: [] });
    expect(f.etapas[0].status).toBe("gargalo");
    expect(f.gargalo).toBe("anuncio");
    expect(f.totais.cpa).toBeNull();
  });
});
