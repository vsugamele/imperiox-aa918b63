import { describe, expect, it } from "vitest";
import { marketSummary, methodScoreboard, normalizeMetodo, SEM_ETIQUETA, type ScoreInput } from "@shared/method-scoreboard";

const library = [
  { id: "angulo-1", nome: "Dor / Agitação (PAS)", categoria: "problema", numero: 1 },
  { id: "angulo-2", nome: "Medo / Consequência futura", categoria: "problema", numero: 2 },
  { id: "angulo-62", nome: "Custo por dia", categoria: "oferta", numero: 62 },
];

const rows: ScoreInput[] = [
  { metodo: "Grok:minerado", copy_lib_id: "angulo-2", gasto: 10, ic: 6, vendas: 1, receita_liquida: 23.5 },
  { metodo: "grok:minerado", copy_lib_id: "angulo-1", gasto: 12, ic: 2, vendas: 2, receita_liquida: 47 },
  { metodo: "derick:native-ads", copy_lib_id: "angulo-62", gasto: 20, ic: 1, vendas: 0, receita_liquida: 0 },
  { metodo: null, copy_lib_id: null, gasto: 5, ic: 0, vendas: 3, receita_liquida: 70.5 },
];

describe("placar por método e ângulo", () => {
  it("normaliza o método", () => {
    expect(normalizeMetodo(" Derick Native Ads ")).toBe("derick-native-ads");
    expect(normalizeMetodo("")).toBeNull();
  });

  it("agrupa por método, soma vendas e põe 'sem etiqueta' por último mesmo vendendo mais", () => {
    const placar = methodScoreboard(rows, "metodo");
    expect(placar.map((l) => l.chave)).toEqual(["grok:minerado", "derick:native-ads", SEM_ETIQUETA]);
    expect(placar[0]).toMatchObject({ anuncios: 2, com_venda: 2, taxa_com_venda: 1, gasto: 22, vendas: 3, cpa: 7.33, saldo: 48.5 });
    expect(placar[1]).toMatchObject({ vendas: 0, cpa: null, saldo: -20 });
  });

  it("agrupa por ângulo com o nome da biblioteca e por categoria", () => {
    const porAngulo = methodScoreboard(rows, "angulo", library);
    expect(porAngulo[0]).toMatchObject({ chave: "angulo-1", rotulo: "1 · Dor / Agitação (PAS)", vendas: 2 });
    const porCategoria = methodScoreboard(rows, "categoria", library);
    expect(porCategoria.map((l) => [l.rotulo, l.vendas])).toEqual([["Problema", 3], ["Oferta", 0], ["Sem etiqueta", 3]]);
  });
});

describe("o que o mercado está rodando", () => {
  it("conta só firmes e revisadas, por ângulo e por camada", () => {
    const resumo = marketSummary([
      { copy_lib_id: "angulo-1", copy_lib_status: "firme" },
      { copy_lib_id: "angulo-1", copy_lib_status: "revisado" },
      { copy_lib_id: "angulo-62", copy_lib_status: "firme" },
      { copy_lib_id: "angulo-2", copy_lib_status: "duvida" },
      { copy_lib_id: null, copy_lib_status: "sem_angulo" },
    ], library);
    expect(resumo).toMatchObject({ classificadas: 3, duvidas: 1 });
    expect(resumo.angulos[0]).toMatchObject({ id: "angulo-1", n: 2, rotulo: "1 · Dor / Agitação (PAS)" });
    expect(resumo.camadas).toEqual([{ id: "problema", n: 2, rotulo: "Problema" }, { id: "oferta", n: 1, rotulo: "Oferta" }]);
  });
});
