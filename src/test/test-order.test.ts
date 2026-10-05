import { describe, expect, it } from "vitest";
import { cutAllowed, evaluateTestOrder, launchSteps, planTestOrder, slug, variantLink, type TestOrderInput } from "@shared/test-order";

const base: TestOrderInput = {
  project_id: "jp_freitas", nome: "CCP ângulos Grok", oferta: "Código dos Cortes Perfeitos", pagina_url: "https://codigodoscortesperfeitos.vercel.app/",
  ad_account_id: "409426678174135", page_id: "429985333534854", pixel_id: "614834761557621",
  verba_dia_conjunto: 30, payout: 47, cpa_alvo: 40,
  variantes: [
    { angulo: "Medo de cortar cachos", hipotese: "Medo trava a compra", image_url: "https://x/1.jpg", texto: "Medo?", headline: "CCP" },
    { angulo: "Quer cobrar mais?", hipotese: "Dinheiro move", image_url: "https://x/2.jpg", texto: "Cobre mais", headline: "CCP" },
  ],
};

describe("plano da ordem de teste", () => {
  it("monta UTM por variante, nomes, verba total e referência da Esteira", () => {
    const plan = planTestOrder(base, "2026-10-05");
    expect(plan.utm_campaign).toBe("ccp-angulos-grok-0510");
    expect(plan.verba_dia_total).toBe(60);
    expect(plan.variantes.map((v) => v.utm_content)).toEqual(["01-medo-de-cortar-cachos", "02-quer-cobrar-mais"]);
    expect(plan.variantes[0].link_url).toBe("https://codigodoscortesperfeitos.vercel.app/?utm_source=facebook&utm_medium=paid&utm_campaign=ccp-angulos-grok-0510&utm_content=01-medo-de-cortar-cachos&utm_term={{ad.id}}");
    expect(plan.referencia_esteira.teto_custo_ic_qualificado).toBe(5);
    expect(plan.problemas).toEqual([]);
  });

  it("aponta o que impede o lançamento e o que só merece atenção", () => {
    const plan = planTestOrder({ ...base, page_id: null, pagina_url: "http://x.com", variantes: [{ angulo: "A", image_url: "https://x/1.jpg" }] }, "2026-10-05");
    expect(plan.problemas).toEqual(expect.arrayContaining(["A página precisa ser https.", "Um teste precisa de pelo menos 2 variantes (ângulos).", "Falta a página do Facebook (page_id) que assina os anúncios.", "Variante 01 (A) sem texto do anúncio."]));
    expect(plan.avisos.join(" ")).toContain("sem hipótese");
  });

  it("slug e link preservam a query da página", () => {
    expect(slug("Não é só cortar. É saber ler o fio.")).toBe("nao-e-so-cortar-e-saber-ler-o-fio");
    expect(variantLink("https://a.com/p?src=ig", "c", "01-x")).toContain("src=ig&utm_source=facebook");
  });

  it("passos de lançamento deixam tudo pausado e exigem OK para ativar", () => {
    const steps = launchSteps(base, planTestOrder(base, "2026-10-05"));
    expect(steps[1]).toContain("daily_budget=3000");
    expect(steps[5]).toContain("SÓ com o OK");
  });
});

describe("avaliação pela Esteira P1", () => {
  const variants = [
    { ordem: 1, angulo: "Medo", hipotese: "Medo trava", status: "no_ar" },
    { ordem: 2, angulo: "Dinheiro", hipotese: "Dinheiro move", status: "no_ar" },
    { ordem: 3, angulo: "Status", hipotese: "Status", status: "no_ar" },
    { ordem: 4, angulo: "Perda", hipotese: "Perda", status: "pausado" },
  ];
  const readings = [
    { ordem: 1, gasto: 60, ic: 0, vendas: 0 },          // sem IC com gasto alto: mata
    { ordem: 2, gasto: 60, ic: 15, vendas: 1 },         // vendeu: vencedor
    { ordem: 3, gasto: 60, ic: 0, vendas: 0, vendas_imperio: 1 }, // pixel perdeu a venda: mantém
    { ordem: 4, gasto: 30, ic: 0, vendas: 0 },
  ];

  it("depois do dia 2: pausa o morto, marca vencedor, protege venda vista só pelo Império", () => {
    const r = evaluateTestOrder({ payout: 47, cpa_alvo: 40 }, variants, readings, 2);
    expect(r.pausar).toEqual([1]);
    expect(r.vencedores).toEqual([2, 3]);
    expect(r.avaliacoes.find((a) => a.ordem === 4)?.decisao).toBe("ja_parado");
    expect(r.gasto_total).toBe(210);
    expect(r.vendas_total).toBe(2);
    expect(r.placar_hipoteses).toEqual(expect.arrayContaining([{ hipotese: "Medo trava", concept: "Medo", resultado: "refutada" }]));
  });

  it("antes do fim do dia 2 nada morre", () => {
    const r = evaluateTestOrder({ payout: 47, cpa_alvo: 40 }, variants, readings, 1);
    expect(r.pausar).toEqual([]);
    expect(r.avaliacoes[0].motivo).toContain("dia 2");
  });

  it("corte automático só com autorização e dentro do prazo", () => {
    expect(cutAllowed({ status: "no_ar", corte_autorizado_por: "Vinicius", corte_ate: "2026-10-14" }, "2026-10-07").ok).toBe(true);
    expect(cutAllowed({ status: "no_ar", corte_autorizado_por: "Vinicius", corte_ate: "2026-10-14" }, "2026-10-15").ok).toBe(false);
    expect(cutAllowed({ status: "no_ar", corte_autorizado_por: null }, "2026-10-07").ok).toBe(false);
    expect(cutAllowed({ status: "pronto", corte_autorizado_por: "Vinicius" }, "2026-10-07").ok).toBe(false);
  });
});
