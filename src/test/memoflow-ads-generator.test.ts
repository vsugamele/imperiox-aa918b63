import { describe, it, expect } from "vitest";
import {
  parseMemoFlowAdBatch,
  generateAdWithHook,
  formatBatchForMediaBuyer,
  PROJECT_ANGLE_PRESETS,
} from "../lib/memoflow-ads-generator";

describe("memoflow-ads-generator", () => {
  it("provides angle presets for primary projects", () => {
    expect(PROJECT_ANGLE_PRESETS.linfaflow).toBeDefined();
    expect(PROJECT_ANGLE_PRESETS.linfaflow.length).toBeGreaterThanOrEqual(2);
    expect(PROJECT_ANGLE_PRESETS.linfaflow[0].mecanismo).toContain("Cleavers");

    expect(PROJECT_ANGLE_PRESETS.slimsoda).toBeDefined();
    expect(PROJECT_ANGLE_PRESETS.slimsoda[0].mecanismo).toContain("GLP-1");
  });

  it("parses canonical MemoFlow markdown format cleanly", () => {
    const sampleMarkdown = `
# 🚀 BRIEFING EXECUTIVO DE ANÚNCIOS — PADRÃO MEMOFLOW

## 1. ⚙️ INSTRUÇÕES OPERACIONAIS & ARQUITETURA DE CAMPANHA
- **Campanha Sugerida:** C1 (Principal / Escala)
- **Destino Recomendado:** Advertorial de Drenagem Linfática
- **Regra de Julgamento:** Janela de 3 a 4 dias. Cortar criativos com gasto > 1.5x CPA-alvo sem vendas.
- **Estratégia de Teste:** Manter Copy Mestre no Texto Principal e substituir a 1ª linha.

---

## 2. 🎯 ÂNGULO PERSUASIVO & MECANISMO ÚNICO
- **Nome do Ângulo:** A Falha das Soluções Externas vs Drenagem Interna
- **Avatar Alvo:** Mulheres 45-65 anos com inchaço persistente nos tornozelos
- **Vilão Batizado:** Lodo Linfático Retido e Vasos Lentos
- **Mecanismo da Solução:** Cleavers Aerial Parts como 'A Vassoura Linfática' sublingual
- **Analogia-Mestre:** Tentar secar o chão com o cano da pia estourado

---

## 3. 📝 COPY MESTRE (TEXTO PRINCIPAL / PRIMARY TEXT)
*(Colar este texto completo no campo "Texto Principal" do anúncio no Meta Ads)*

Você já deve ter percebido que meias de compressão e drenagens em clínicas dão um alívio momentâneo... mas no dia seguinte o inchaço volta idêntico.

O motivo é simples: soluções externas apenas empurram o líquido de fora para dentro. Se os canais de drenagem internos estiverem obstruídos por fluido espesso, o corpo não tem como eliminar nada.

É exatamente por isso que o ritual botânico de 30 segundos com Cleavers Aerial Parts atua na raiz do problema, liberando o fluxo de dentro para fora antes que você saia da cama.

Clique no botão abaixo para conhecer a pesquisa completa e entender por que seus exames davam 'normais' enquanto suas pernas continuavam pesadas.

---

## 4. 🪝 3 VARIAÇÕES DE GANCHO (1ª LINHA - SCROLL STOPPERS)
- **Gancho 1 (Causa Raiz / Fato):** "Seus exames voltaram perfeitos, mas seus tornozelos dobram de tamanho às 16h."
- **Gancho 2 (Contradição / Curiosidade):** "Beber 3 litros de água por dia não vai desentupir vasos linfáticos lentos."
- **Gancho 3 (Identitário / Específico):** "Para quem já desistiu de comprar sapatos fechados por causa do inchaço da tarde."

---

## 5. 📌 3 HEADLINES DE ALTA CONVERSÃO (CAMPO DE TÍTULO)
- **Headline 1 (Editorial / Curiosidade):** "O Que Nenhum Médico Te Contou Sobre Inchaço Após os 40"
- **Headline 2 (Causa Raiz / Revelação):** "Por Que Seus Tornozelos Inchados Não São Retenção Comum"
- **Headline 3 (Alerta / Quebra de Paradigma):** "A 'Vassoura Linfática' que Limpa os Vasos de Dentro Para Fora"
`;

    const parsed = parseMemoFlowAdBatch(sampleMarkdown);

    expect(parsed.campanha.tipo).toContain("C1");
    expect(parsed.campanha.destino).toContain("Advertorial");
    expect(parsed.angulo.nome).toContain("A Falha das Soluções Externas");
    expect(parsed.angulo.mecanismo).toContain("Cleavers");
    expect(parsed.copyMestre).toContain("Você já deve ter percebido que meias de compressão");
    expect(parsed.copyMestre).not.toContain("*(Colar este texto");

    expect(parsed.ganchos).toHaveLength(3);
    expect(parsed.ganchos[0].id).toBe("G1");
    expect(parsed.ganchos[0].texto).toBe("Seus exames voltaram perfeitos, mas seus tornozelos dobram de tamanho às 16h.");
    expect(parsed.ganchos[1].id).toBe("G2");
    expect(parsed.ganchos[2].id).toBe("G3");

    expect(parsed.headlines).toHaveLength(3);
    expect(parsed.headlines[0].id).toBe("H1");
    expect(parsed.headlines[0].texto).toContain("O Que Nenhum Médico Te Contou");
    expect(parsed.headlines[1].id).toBe("H2");
    expect(parsed.headlines[2].id).toBe("H3");
  });

  it("replaces the first paragraph of copy mestre with custom hook", () => {
    const copyMestre = `Linha original do gancho que será trocada.\n\nSegundo parágrafo com a explicação do mecanismo.\n\nTerceiro parágrafo com a chamada para ação.`;
    const newHook = `Novo gancho agressivo de causa raiz!`;

    const result = generateAdWithHook(copyMestre, newHook);
    expect(result.startsWith("Novo gancho agressivo de causa raiz!")).toBe(true);
    expect(result).toContain("Segundo parágrafo com a explicação do mecanismo.");
    expect(result).not.toContain("Linha original do gancho que será trocada.");
  });

  it("formats ready-to-use executive brief for media buyer", () => {
    const batch = {
      rawOutput: "",
      campanha: {
        tipo: "C1 (Principal)",
        destino: "Advertorial LinfaFlow",
        regraCpa: "Janela 3-4 dias, corte 1.5x CPA",
        instrucoes: "",
      },
      angulo: {
        nome: "Paradoxo dos Exames",
        avatar: "Mulher 50+",
        vilao: "Subdiagnóstico linfático",
        mecanismo: "Cleavers e Stillingia",
        analogia: "Pia entupida",
      },
      copyMestre: "Texto do anúncio aqui...",
      ganchos: [
        { id: "G1", tipo: "Causa Raiz", texto: "Gancho 1 teste" },
        { id: "G2", tipo: "Curiosidade", texto: "Gancho 2 teste" },
        { id: "G3", tipo: "Identitário", texto: "Gancho 3 teste" },
      ],
      headlines: [
        { id: "H1", tipo: "Editorial", texto: "Headline 1 teste" },
        { id: "H2", tipo: "Alerta", texto: "Headline 2 teste" },
        { id: "H3", tipo: "Quebra", texto: "Headline 3 teste" },
      ],
    };

    const formatted = formatBatchForMediaBuyer(batch);
    expect(formatted).toContain("*🚀 BRIEFING EXECUTIVO DE TRÁFEGO — PADRÃO MEMOFLOW*");
    expect(formatted).toContain("Gancho 1 teste");
    expect(formatted).toContain("Headline 1 teste");
    expect(formatted).toContain("Texto do anúncio aqui...");
  });

  it("handles fallback parsing when given unstructured or raw text", () => {
    const fallback = parseMemoFlowAdBatch("Texto cru sem nenhum header estruturado");
    expect(fallback.campanha).toBeDefined();
    expect(fallback.ganchos.length).toBe(3);
    expect(fallback.headlines.length).toBe(3);
  });
});
