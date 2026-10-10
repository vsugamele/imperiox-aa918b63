import { describe, expect, it } from "vitest";
import { assignAvatars, avatarImageLine, castSuggestPrompt, moldAvatar, parseCastSuggestion, personaBlock, portraitPrompts, type CastMember } from "@shared/cast";
import type { LevaItem } from "@shared/batch-strategist";

const m = (id: string, tipo: CastMember["tipo"], o: Partial<CastMember> = {}): CastMember => ({ id, nome: id, tipo, papel: tipo === "publico" ? "publico" : "elenco", ficha: {}, fotos: 3, ativo: true, ...o });
const cast = [m("Ana", "profissional"), m("Bia", "cliente"), m("Dra Carla", "especialista"), m("Linda", "publico", { ficha: { idade: 34, dores: ["cliente não volta"], linguagem: ["eu travo no cacho"], frase: "Eu corto e ela some" } }), m("Sem foto", "apresentadora", { fotos: 0 }), m("Inativa", "cliente", { ativo: false })];
const item = (o: Partial<LevaItem> = {}): LevaItem => ({ bloco: "angulo_novo", copy_lib_id: "a", angulo: "A", categoria: null, formato: "estatico", formato_label: "Estático", porta: "direta", ponto_rota: 2, carga: "cena_vida", precisa_video: false, referencias: [], hipotese: "", motivo: "", ...o });

describe("Elenco", () => {
  it("atribui avatar só onde alguém aparece, gira o elenco com foto primeiro e nunca usa persona/inativo", () => {
    const out = assignAvatars([item(), item(), item({ formato: "print_conversa" }), item(), item()], cast);
    expect(out[2].avatar_id).toBeNull();
    const usados = out.map((i) => i.avatar_id).filter(Boolean);
    expect(usados).not.toContain("Linda");
    expect(usados).not.toContain("Inativa");
    expect(usados.slice(0, 3)).toEqual(["Ana", "Bia", "Dra Carla"]);
    expect(usados[3]).toBe("Sem foto");
  });

  it("variações do vencedor alternam o avatar dele; a escolha manual sempre ganha", () => {
    const out = assignAvatars([item({ bloco: "variacao" }), item({ bloco: "variacao" }), item({ bloco: "variacao" })], cast, { vencedorAvatarId: "Bia", overrides: { 2: null } });
    expect(out.map((i) => i.avatar_id)).toEqual(["Bia", "Ana", null]);
  });

  it("persona vai para a copy e o avatar para a imagem", () => {
    expect(personaBlock(cast)).toContain("Palavras dela: \"eu travo no cacho\"");
    expect(personaBlock([m("Ana", "profissional")])).toBe("");
    expect(avatarImageLine(cast[2])).toContain("referência do ROSTO");
    expect(avatarImageLine(cast[4])).not.toContain("referência do ROSTO");
  });

  it("Molde: V01 pega outro do mesmo tipo, V02 o tipo oposto", () => {
    const c2 = [...cast, m("Ana 2", "profissional")];
    expect(moldAvatar("V01", "Ana", c2)?.id).toBe("Ana 2");
    expect(moldAvatar("V02", "Bia", c2)?.id).toBe("Dra Carla");
    expect(moldAvatar("V03", "Bia", c2)).toBeNull();
  });

  it("sugestão por IA: prompt pede persona + elenco variado; parser descarta tipo inválido e força papel da persona", () => {
    expect(castSuggestPrompt({ projeto: "JP" }).system).toContain("papel \"publico\"");
    const s = parseCastSuggestion(JSON.stringify({ avatares: [
      { nome: "Rita", tipo: "profissional", papel: "elenco", ficha: { idade: 38, dores: ["a"], linguagem: "não lista" } },
      { nome: "Joana", tipo: "publico", papel: "elenco", ficha: {} },
      { nome: "X", tipo: "astronauta" },
    ] }));
    expect(s.map((a) => [a.nome, a.papel])).toEqual([["Rita", "elenco"], ["Joana", "publico"]]);
    expect(s[0].ficha.linguagem).toEqual([]);
  });

  it("fotos: um retrato base e variações da mesma pessoa", () => {
    const p = portraitPrompts({ nome: "Rita", tipo: "profissional", ficha: { idade: 38, cenario: "salão de bairro" } }, 4);
    expect(p.base).toContain("Rita, 38 anos");
    expect(p.variacoes).toHaveLength(3);
    expect(p.variacoes[0]).toContain("salão de bairro");
    expect(p.variacoes.every((v) => v.includes("MESMA pessoa"))).toBe(true);
  });
});
