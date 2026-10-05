import { describe, expect, it } from "vitest";
import { copyPrompt, imageInstruction, parseCopy, planAxes } from "@shared/creative-variations";

describe("variações de criativo vencedor", () => {
  it("distribui os eixos da Esteira P2 até a quantidade, com teto de 6", () => {
    expect(planAxes({ quantidade: 3 })).toEqual(["headline", "avatar", "gancho"]);
    expect(planAxes({ quantidade: 5, eixos: ["publico", "headline"] })).toEqual(["publico", "headline", "publico", "headline", "publico"]);
    expect(planAxes({ quantidade: 40 })).toHaveLength(6);
    expect(planAxes({ quantidade: 0 })).toHaveLength(1);
  });

  it("o prompt da copy leva oferta, ângulo, hipótese, eixo e evita headlines já usadas", () => {
    const p = copyPrompt({ angulo: "Medo de cortar cachos", hipotese: "Medo trava", oferta: "CCP R$ 47", quantidade: 2, texto_base: "Medo de errar?" }, "gancho", ["MEDO DE CORTAR CACHOS?"]);
    expect(p.system).toContain("Responda SÓ JSON");
    expect(p.user).toContain("Hipótese confirmada: Medo trava");
    expect(p.user).toContain("Gancho empilhado");
    expect(p.user).toContain("Não repita estas headlines: MEDO DE CORTAR CACHOS?");
  });

  it("valida a copy do modelo: campos obrigatórios e limites de palavras", () => {
    const ok = { headline_arte: "Medo de errar no cacho?", subtitulo_arte: "Aprenda o método para cortar com segurança.", cta_arte: "Saiba mais", texto_anuncio: "Texto.", headline_anuncio: "O Código" };
    expect(parseCopy(JSON.stringify(ok))).toMatchObject({ headline_arte: "Medo de errar no cacho?" });
    expect(parseCopy("```json\n" + JSON.stringify(ok) + "\n```")).not.toBeNull();
    expect(parseCopy({ ...ok, headline_arte: "uma duas tres quatro cinco seis sete oito" })).toBeNull();
    expect(parseCopy({ ...ok, cta_arte: "" })).toBeNull();
    expect(parseCopy("não é json")).toBeNull();
  });

  it("a instrução de imagem mantém a pessoa e o estilo e manda o texto exato", () => {
    const text = imageInstruction({ marca_topo: "O CÓDIGO DOS CORTES PERFEITOS" }, { headline_arte: "Pare de travar no cacho", subtitulo_arte: "Método", cta_arte: "Quero aprender", texto_anuncio: "x", headline_anuncio: "y" });
    expect(text).toContain("MESMA pessoa");
    expect(text).toContain('"PARE DE TRAVAR NO CACHO"');
    expect(text).toContain('Mantenha no topo, pequeno: "O CÓDIGO DOS CORTES PERFEITOS"');
  });
});
