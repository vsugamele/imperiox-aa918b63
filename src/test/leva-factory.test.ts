import { describe, expect, it } from "vitest";
import { levaCopyPrompt, levaImagePrompt, levaToGenerate, parseLevaCopy, quickReview } from "@shared/leva-factory";
import type { LevaItem } from "@shared/batch-strategist";

const item = (o: Partial<LevaItem> = {}): LevaItem => ({
  bloco: "angulo_novo", copy_lib_id: "angulo-3", angulo: "Inimigo comum", categoria: "problema", formato: "print_conversa", formato_label: "Print de conversa",
  porta: "voz_dela", ponto_rota: 2, carga: "objeto_estranho", precisa_video: false, referencias: [], hipotese: "h", motivo: "m", ...o,
});
const copy = { headline_arte: "Cortei e a cliente sumiu", subtitulo_arte: "O erro que ninguém te contou sobre cacho", cta_arte: "Ver como", texto_anuncio: "\"Eu corto e ela não volta.\" Se você já disse isso, o problema não é você.", headline_anuncio: "O erro do corte em cacho", cena_primeiro_quadro: "Celular com conversa de cliente reclamando" };

describe("fábrica da leva", () => {
  it("o prompt de copy leva porta, ponto, formato, carga e as regras de hook e pouso", () => {
    const { system, user } = levaCopyPrompt(item(), { oferta: "Código dos Cortes Perfeitos R$47", angulo: { nome: "Inimigo comum", explicacao: "Um culpado externo" } }, ["Já usada"]);
    expect(system).toContain("ATERRISSAGEM");
    expect(system).toContain("PROIBIDO");
    expect(user).toContain("VOZ DELA");
    expect(user).toContain("Ponto da rota: 2");
    expect(user).toContain("Print de conversa");
    expect(user).toContain("Não repita estas headlines: Já usada");
  });

  it("valida a copy e recusa campo faltando ou headline longa", () => {
    expect(parseLevaCopy(JSON.stringify(copy))?.cena_primeiro_quadro).toContain("Celular");
    expect(parseLevaCopy({ ...copy, cena_primeiro_quadro: "" })).toBeNull();
    expect(parseLevaCopy({ ...copy, headline_arte: "uma duas três quatro cinco seis sete oito" })).toBeNull();
  });

  it("imagem segue o formato (print sem botão), a carga e avisa para não copiar a referência", () => {
    const p = levaImagePrompt(item(), copy, { publico: "cabeleireiras 25-45" }, "4:5", true);
    expect(p).toContain("WhatsApp");
    expect(p).toContain("objeto ou ação inesperada");
    expect(p).toContain("Não copie pessoas, marcas");
    expect(p).not.toContain("Botão:");
    expect(levaImagePrompt(item({ formato: "estatico", formato_label: "Estático" }), copy, {})).toContain("Botão:");
  });

  it("gera só os itens de imagem e respeita o limite; checagem rápida pega compliance", () => {
    const itens = [item(), item({ precisa_video: true, formato: "ugc_fala" }), item(), item()];
    expect(levaToGenerate(itens, 2).map((x) => x.idx)).toEqual([0, 2]);
    expect(quickReview({ ...copy, texto_anuncio: "Perca 10 kg em 30 dias." }).reprova).toBe(true);
    expect(quickReview(copy).reprova).toBe(false);
  });
});
