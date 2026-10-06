import { describe, expect, it } from "vitest";
import { angleRequest, NENHUM, parseAngleAnswer } from "@shared/angle-classifier";

const library = [
  { id: "angulo-2", numero: 2, nome: "Medo / Consequência futura", categoria: "problema", explicacao: "Projeta o custo de não agir." },
  { id: "angulo-40", numero: 40, nome: "Autoridade do criador", categoria: "produto", explicacao: "Credenciais de quem vende." },
  { id: "objecao-1", numero: 1, nome: "Não é problema", categoria: "problema", explicacao: null },
];

describe("classificador de ângulo (Jev)", () => {
  it("monta duas perguntas sobre o mesmo texto, só com ângulos e a saída 'nenhum'", () => {
    const req = angleRequest({ titulo: "Domine o corte", texto: "Eu sou o JP, 12 anos cortando cachos..." }, library);
    expect(req.model).toBe("jev-latest");
    expect(Object.keys(req.questions.angulo.criteria)).toEqual(["angulo-2", "angulo-40", NENHUM]);
    expect(Object.keys(req.questions.camada.criteria)).toContain("oferta");
    expect(req.state.texto_do_anuncio).toContain("12 anos");
  });

  it("separa firme, dúvida e sem ângulo pela confiança", () => {
    const firme = parseAngleAnswer({ answers: { angulo: { choice: "angulo-40", probabilities: { "angulo-40": 0.93, "angulo-2": 0.05, nenhum: 0.02 }, confidence: 0.92 }, camada: { choice: "produto", confidence: 0.8 } } });
    expect(firme).toMatchObject({ copy_lib_id: "angulo-40", decisao: "firme", camada: "produto", alternativas: [{ id: "angulo-2", p: 0.05 }, { id: "nenhum", p: 0.02 }] });
    expect(parseAngleAnswer({ answers: { angulo: { choice: "angulo-2", probabilities: { "angulo-2": 0.4 }, confidence: 0.43 } } }).decisao).toBe("duvida");
    expect(parseAngleAnswer({ answers: { angulo: { choice: NENHUM, confidence: 0.9 } } })).toMatchObject({ copy_lib_id: null, decisao: "sem_angulo" });
  });
});
