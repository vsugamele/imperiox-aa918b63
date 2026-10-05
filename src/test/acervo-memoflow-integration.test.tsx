import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoFlowAdGeneratorModal } from "../components/acervo/MemoFlowAdGeneratorModal";
import { supabase } from "@/integrations/supabase/client";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({
                  data: [
                    { pergunta: "O que é LinfaFlow?", resposta: "Gotas sublinguais com Cleavers." },
                    { pergunta: "Qual a posologia?", resposta: "1 mL 2x ao dia sublingual." },
                  ],
                  error: null,
                })
              ),
            })),
          })),
        })),
      })),
      functions: {
        invoke: vi.fn(() =>
          Promise.resolve({
            data: {
              content: `# 🚀 BRIEFING EXECUTIVO DE ANÚNCIOS — PADRÃO MEMOFLOW

## 1. ⚙️ INSTRUÇÕES OPERACIONAIS & ARQUITETURA DE CAMPANHA
- **Campanha Sugerida:** C1 (Principal / Escala)
- **Destino Recomendado:** Advertorial de Drenagem Linfática
- **Regra de Julgamento:** Janela de 3 a 4 dias. Cortar criativos com gasto > 1.5x CPA-alvo sem vendas.
- **Estratégia de Montagem Rápida:** Manter Copy Mestre no Texto Principal e alternar a 1ª linha.

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
`,
            },
            error: null,
          })
        ),
      },
    },
  };
});

describe("MemoFlowAdGeneratorModal Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it("renders modal with LinfaFlow presets and RAG count", async () => {
    render(
      <MemoFlowAdGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        initialProjectId="linfaflow"
      />
    );

    expect(screen.getByText("Gerador de Lotes de Anúncios")).toBeInTheDocument();
    expect(screen.getByText("Padrão MemoFlow")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Soluções Externas Falham vs. Drenagem Interna/)).toBeInTheDocument();
      expect(screen.getByText(/O Paradoxo dos Exames Normais/)).toBeInTheDocument();
    });
  });

  it("generates MemoFlow batch on click and provides 1-click copy buttons", async () => {
    const handleNavigate = vi.fn();

    render(
      <MemoFlowAdGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        initialProjectId="linfaflow"
        onNavigateToCopyLab={handleNavigate}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /Gerar Lote de Anúncios Agora/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith("copy-engine", expect.objectContaining({
        body: expect.objectContaining({
          intent: "lote_anuncios_memoflow",
        }),
      }));
    });

    // Check parsed components
    await waitFor(() => {
      expect(screen.getByText(/Campanha: C1/)).toBeInTheDocument();
      expect(screen.getByText(/Destino: Advertorial/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copiar Texto Principal/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Copiar Pacote Completo/i })).toBeInTheDocument();
    });

    // Test copy copy mestre
    const copyMestreBtn = screen.getByRole("button", { name: /Copiar Texto Principal/i });
    fireEvent.click(copyMestreBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Você já deve ter percebido que meias de compressão"));

    // Test copy full brief
    const copyFullBriefBtn = screen.getByRole("button", { name: /Copiar Pacote Completo/i });
    fireEvent.click(copyFullBriefBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("BRIEFING EXECUTIVO DE TRÁFEGO — PADRÃO MEMOFLOW"));

    // Test navigate to Copy Lab button
    const openCopyLabBtn = screen.getByRole("button", { name: /Abrir no Copy Lab/i });
    fireEvent.click(openCopyLabBtn);
    expect(handleNavigate).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "linfaflow",
    }));
  });
});
