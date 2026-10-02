import { describe, expect, it } from "vitest";
import {
  bidStep, cpaZone, dailyBrake, deriveParams, evaluateActiveAngle, evaluateAdset, evaluateConcept, evaluateGraveyardAngle,
  evaluateP1Round, evaluateP2Days, evaluateScale, p2Checkpoint, type ScaleParams,
} from "@shared/scale-ladder";

// Payout 70, CPA alvo 45, 8 ICs por venda: teto de custo por IC = 5,625; "mais textos" até 9,84.
const p: ScaleParams = { payout: 70, cpaAlvo: 45, icsPorVenda: 8 };

describe("esteira de escala: parâmetros e zonas", () => {
  it("deriva tetos, lances e verbas de referência", () => {
    expect(deriveParams(p)).toMatchObject({
      breakeven: 70, margem_no_alvo: 25, roas_alvo: 1.56, teto_custo_ic_qualificado: 5.63, teto_custo_ic_mais_textos: 9.84,
      lance_inicial_p3: 27, teto_economico: 56, cost_cap_p4: 31.5, verba_referencia_p1: 450, verba_referencia_p2: 675,
    });
    expect(deriveParams({ payout: 70, cpaAlvo: 40 }).teto_custo_ic_qualificado).toBe(5); // padrão de 8 ICs por venda
  });

  it("classifica o CPA nas 4 zonas", () => {
    expect([45, 50, 60, 80, null].map((c) => cpaZone(c, p))).toEqual(["escala", "lucrativa", "magra", "prejuizo", "sem_venda"]);
  });
});

describe("P1: concepts e placar de hipóteses", () => {
  it("dá o veredito pelo custo por checkout iniciado", () => {
    const v = (gasto: number, ic: number, vendas = 0) => evaluateConcept({ gasto, ic, vendas }, p).veredito;
    expect(v(80, 15)).toBe("qualificado");   // 5,33 por IC
    expect(v(50, 0, 1)).toBe("qualificado"); // venda qualifica direto
    expect(v(80, 10)).toBe("mais_textos");   // 8 por IC
    expect(v(80, 5)).toBe("morto");          // 16 por IC
    expect(v(80, 0)).toBe("morto");          // gastou 2× o teto sem IC
    expect(v(10, 0)).toBe("cedo");
    expect(v(0, 0)).toBe("aguarda");
  });

  it("resume a rodada e só põe no placar hipótese com veredito final", () => {
    const round = evaluateP1Round([
      { concept: "Inchaço no turno · em pé", hipotese: "Quem trabalha em pé sente à tarde", gasto: 80, ic: 15, vendas: 0 },
      { concept: "Meia de compressão falha", hipotese: "Já tentou meia e desistiu", gasto: 80, ic: 0, vendas: 0 },
      { concept: "Sem hipótese", gasto: 80, ic: 10, vendas: 0 },
      { concept: "Cedo", hipotese: "Ainda não sei", gasto: 10, ic: 0, vendas: 0 },
      { gasto: 0, ic: 0, vendas: 0 },
    ], p);
    expect(round).toMatchObject({ investimento: 250, qualificados: 1, mais_textos: 1, mortos: 1, custo_por_qualificado: 250 });
    expect(round.linhas).toHaveLength(4);
    expect(round.placar_hipoteses).toEqual([
      { hipotese: "Quem trabalha em pé sente à tarde", concept: "Inchaço no turno · em pé", resultado: "confirmada" },
      { hipotese: "Já tentou meia e desistiu", concept: "Meia de compressão falha", resultado: "refutada" },
    ]);
  });
});

describe("P2: rodada de texto", () => {
  it("só julga no dia 3, pelo CPA acumulado", () => {
    const leitura = (dias: Array<[number, number]>) => evaluateP2Days(dias.map(([gasto, vendas]) => ({ gasto, vendas })), p).map((d) => d.veredito);
    expect(leitura([[80, 1], [80, 2], [80, 3]])).toEqual(["nao_julga", "nao_julga", "aprovado"]);  // 40
    expect(leitura([[100, 1], [100, 2], [100, 2]])).toEqual(["nao_julga", "nao_julga", "estende"]); // 60 ≤ 67,5
    expect(leitura([[100, 0], [100, 1], [100, 2]]).at(-1)).toBe("reprovado");                       // 100
  });

  it("checkpoint do dia 2 só sinaliza", () => {
    const cp = p2Checkpoint({ gasto2d: 200, ic: 40, pageviews: 50 }, p);
    expect(cp.ic).toMatchObject({ custo: 5, leitura: "no ritmo do CPA alvo" });
    expect(cp.pageview).toMatchObject({ custo: 4, leitura: "acima do breakeven" });
  });

  it("por conjunto: duplica, mantém ou pausa", () => {
    const v = (gasto: number, vendas: number) => evaluateAdset({ gasto, vendas }, p).veredito;
    expect([v(90, 2), v(100, 2), v(120, 2), v(200, 2), v(100, 0)]).toEqual(["duplica", "duplica", "mantem", "pausa", "pausa"]);
  });
});

describe("P3 e P4", () => {
  it("rotina do dia: uma mexida, verba ou lance", () => {
    expect(dailyBrake({ verba: 100, gastoOntem: 96 })?.freio).toBe("verba");
    expect(dailyBrake({ verba: 100, gastoOntem: 50 })?.freio).toBe("lance");
    expect(dailyBrake({ verba: 0, gastoOntem: 50 })).toBeNull();
  });

  it("escada do lance sobe 17,5% e para quando o gasto não cresce", () => {
    expect(bidStep({ lance: 20, cresceu: true }).proximo_lance).toBe(23.5);
    expect(bidStep({ lance: 20, cresceu: false }).acao).toMatch(/^PARA/);
    expect(bidStep({ lance: 20 }).proximo_lance).toBeNull();
  });

  it("ângulo ativo vai para o cemitério após 7 dias sem gastar", () => {
    const v = (gasto7: number, vendas7: number, diasSemGastar: number) => evaluateActiveAngle({ gasto7, vendas7, diasSemGastar }, p).veredito;
    expect([v(0, 0, 7), v(300, 3, 0), v(0, 0, 2), v(300, 6, 0)]).toEqual(["cemiterio", "revisa", "sem_gasto", "rodando"]);
  });

  it("cemitério: dormindo é normal, 3 dias no CPA volta ao P3", () => {
    const v = (gasto7: number, vendas7: number, diasSeguidosNoCpa: number) => evaluateGraveyardAngle({ gasto7, vendas7, diasSeguidosNoCpa }).veredito;
    expect([v(0, 0, 0), v(90, 3, 3), v(60, 2, 1), v(60, 0, 0)]).toEqual(["dormindo", "volta_p3", "catando", "gastou_sem_venda"]);
  });
});

describe("evaluateScale (entrada do MCP)", () => {
  it("sem fase devolve as regras; fase exige payout e CPA alvo", () => {
    expect(evaluateScale({})).toMatchObject({ fase: "regras", regras: expect.arrayContaining([expect.stringMatching(/^P1/)]) });
    expect(() => evaluateScale({ fase: "p1" })).toThrow(/payout e cpa_alvo/);
    expect(() => evaluateScale({ fase: "p9", payout: 70, cpa_alvo: 45 })).toThrow(/fase inválida/);
  });

  it("aceita números em texto com vírgula e 'SIM'/'NAO' no lance", () => {
    const p1 = evaluateScale({ fase: "p1", payout: "70", cpa_alvo: "45", concepts: [{ concept: "A", gasto: "80,0", ic: "15", vendas: 0 }] });
    expect(p1).toMatchObject({ qualificados: 1 });
    const p3 = evaluateScale({ fase: "p3", payout: 70, cpa_alvo: 45, verba: 100, gasto_ontem: 96, lances: [{ lance: 20, cresceu: "SIM" }] });
    expect(p3).toMatchObject({ rotina_do_dia: { freio: "verba" }, escada_do_lance: [{ proximo_lance: 23.5 }] });
    const p4 = evaluateScale({ fase: "p4", payout: 70, cpa_alvo: 45, angulos: [{ nome: "X", gasto7: 0, vendas7: 0, diasSeguidosNoCpa: 0 }] });
    expect(p4).toMatchObject({ vagas_livres: 9 });
  });
});
