import { describe, expect, it } from "vitest";
import { flowSteps, nextStep, type FactoryStatus } from "@/lib/creative-flow";

const vazio: FactoryStatus = {
  elenco: { visual: 0, comFoto: 0, persona: 0 },
  mercado: { referencias: 0, classificadas: 0, fontes: 0 },
  levas: { planejadas: 0, aprovadas: 0, gerando: 0, prontas: 0 },
  testes: { noAr: 0, total: 0 },
  placar: { vencedores: 0, moldes: 0 },
};

describe("fluxo da fábrica de criativos", () => {
  it("projeto zerado começa pelo elenco", () => {
    const steps = flowSteps(vazio);
    expect(steps.map((s) => s.key)).toEqual(["elenco", "mercado", "leva", "artes", "teste", "placar"]);
    expect(nextStep(steps)?.key).toBe("elenco");
    expect(nextStep(steps)?.proximo).toContain("Sugerir o elenco");
  });

  it("elenco sem foto fica em atenção e pede fotos", () => {
    const s = flowSteps({ ...vazio, elenco: { visual: 3, comFoto: 0, persona: 1 } });
    expect(s[0]).toMatchObject({ estado: "atencao" });
    expect(s[0].proximo).toContain("Gerar fotos");
  });

  it("caso do JP hoje: elenco e mercado incompletos, mas com teste no ar e vencedor sem molde", () => {
    const s = flowSteps({ ...vazio, elenco: { visual: 4, comFoto: 3, persona: 1 }, mercado: { referencias: 11, classificadas: 11, fontes: 0 }, testes: { noAr: 1, total: 1 }, placar: { vencedores: 1, moldes: 0 } });
    expect(nextStep(s)?.key).toBe("mercado");
    expect(s.find((x) => x.key === "placar")?.proximo).toContain("Desmontar o vencedor");
  });

  it("tudo feito: sem próximo passo obrigatório", () => {
    const s = flowSteps({ elenco: { visual: 3, comFoto: 3, persona: 1 }, mercado: { referencias: 80, classificadas: 60, fontes: 2 }, levas: { planejadas: 0, aprovadas: 0, gerando: 0, prontas: 1 }, testes: { noAr: 1, total: 2 }, placar: { vencedores: 1, moldes: 1 } });
    expect(nextStep(s)).toBeNull();
  });
});
