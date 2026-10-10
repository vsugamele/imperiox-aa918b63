import { describe, expect, it } from "vitest";
import { deadAngles, planLeva, winners, type LibraryAngle, type MarketRef, type TestedAd } from "@shared/batch-strategist";

const lib: LibraryAngle[] = Array.from({ length: 12 }, (_, i) => ({ id: `angulo-${i + 1}`, numero: i + 1, nome: `Ângulo ${i + 1}`, categoria: ["problema", "solucao", "produto"][i % 3] }));
const market: MarketRef[] = [
  ...Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, copy_lib_id: "angulo-4", formato: "estatico" })),
  { id: "r10", copy_lib_id: "angulo-5", formato: "print_conversa" },
  { id: "r11", copy_lib_id: "angulo-5", formato: "print_conversa" },
  { id: "r12", copy_lib_id: null, formato: "ugc_fala" },
  { id: "r13", copy_lib_id: null, formato: "carrossel" },
];
const ad = (id: string, vendas: number, gasto: number, extra: Partial<TestedAd> = {}): TestedAd => ({ copy_lib_id: id, formato: "estatico", porta: null, angulo: id, gasto, vendas, status: "no_ar", ...extra });

describe("Estrategista: monta a leva", () => {
  it("vencedor = 3 vendas no payout; morto = 2× o payout sem vender (a não ser que o ângulo venda em outro anúncio)", () => {
    const tested = [ad("angulo-1", 3, 120), ad("angulo-2", 4, 400), ad("angulo-3", 0, 130), ad("angulo-6", 0, 130), ad("angulo-6", 1, 20)];
    expect(winners(tested, 59).map((w) => w.copy_lib_id)).toEqual(["angulo-1"]);
    expect([...deadAngles(tested, 59)]).toEqual(["angulo-3"]);
  });

  it("sem vencedor: 14 ângulos novos + 6 formatos; prioriza o que o mercado roda e não repete testados", () => {
    const plan = planLeva({ library: lib, market, tested: [ad("angulo-1", 0, 30)], payout: 59 });
    expect(plan.composicao).toEqual({ variacao: 0, angulo_novo: 11, formato_novo: 6 });
    expect(plan.avisos.join(" ")).toContain("Só 11 ângulos novos");
    const novos = plan.itens.filter((i) => i.bloco === "angulo_novo");
    expect(novos[0].copy_lib_id).toBe("angulo-4");
    expect(novos.map((i) => i.copy_lib_id)).not.toContain("angulo-1");
    expect(novos[0].formato).toBe("estatico");
    expect(novos.find((i) => i.copy_lib_id === "angulo-5")?.formato).toBe("print_conversa");
  });

  it("com vencedor: metade da leva vira variações dele, com portas diferentes da original", () => {
    const plan = planLeva({ library: lib, market, tested: [ad("angulo-2", 3, 90, { porta: "voz_dela" })], payout: 59, tamanho: 20 });
    expect(plan.composicao.variacao).toBe(10);
    const vars = plan.itens.filter((i) => i.bloco === "variacao");
    expect(vars.every((v) => v.copy_lib_id === "angulo-2")).toBe(true);
    expect(vars.some((v) => v.porta === "voz_dela")).toBe(false);
    expect(new Set(vars.slice(0, 4).map((v) => v.porta)).size).toBe(4);
    expect(new Set(plan.itens.map((i) => i.porta)).size).toBe(5);
  });

  it("um vencedor só não gera variações repetidas e mercado pequeno vira aviso", () => {
    const plan = planLeva({ library: lib, market, tested: [ad("angulo-2", 3, 90, { porta: "voz_dela" })], payout: 59, tamanho: 20 });
    const combos = plan.itens.filter((i) => i.bloco === "variacao").map((i) => `${i.porta}|${i.formato}`);
    expect(new Set(combos).size).toBe(combos.length);
    expect(plan.avisos.join(" ")).toContain("Só 9 referências");
  });

  it("formatos novos vêm do mercado, só de imagem por padrão, e a carga nunca é bloco", () => {
    const plan = planLeva({ library: lib, market, tested: [ad("angulo-2", 3, 90)], payout: 59 });
    const daLeva = plan.itens.map((i) => i.formato);
    expect(daLeva).toContain("print_conversa");
    expect(daLeva).toContain("carrossel");
    expect(daLeva).not.toContain("ugc_fala");
    // Formato novo não repete o que as variações do mesmo ângulo já cobriram.
    const deVariacao = new Set(plan.itens.filter((i) => i.bloco === "variacao").map((i) => i.formato));
    expect(plan.itens.filter((i) => i.bloco === "formato_novo").every((i) => !deVariacao.has(i.formato))).toBe(true);
    expect(plan.itens.every((i) => i.carga !== "bloco" && [1, 2].includes(i.ponto_rota))).toBe(true);
    const comVideo = planLeva({ library: lib, market, tested: [], soImagem: false });
    expect(comVideo.itens.some((i) => i.formato === "ugc_fala" && i.precisa_video)).toBe(true);
  });
});
