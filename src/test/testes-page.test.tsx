import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Testes from "@/pages/Testes";

const mutate = vi.fn();

vi.mock("@/hooks/useTestOrders", () => ({
  useTestOrders: () => ({
    isLoading: false, error: null,
    data: [{
      id: "o1", project_id: "jp_freitas", nome: "[JP][CCP] Teste de ângulos", oferta: "Código dos Cortes Perfeitos", status: "no_ar",
      verba_dia_conjunto: 30, ativado_em: "2026-10-05T12:00:00Z", corte_autorizado_por: "Vinicius", corte_ate: "2026-10-14",
      ultima_avaliacao: null,
      variantes: [{
        id: "v1", order_id: "o1", ordem: 1, angulo: "Medo de cortar cachos", hipotese: "Medo trava a compra", status: "no_ar",
        image_url: "https://x/1.jpg", texto: "Texto base", ultima_leitura: { lido_em: "2026-10-05", gasto: 12, ic: 1, vendas: 0 }, veredito: null,
      }],
    }],
  }),
  useVariationBatches: () => ({
    data: [{
      id: "b1", nome: "Variações · Medo de cortar cachos", status: "processing", total_gerado: 1, total_planejado: 2, error_message: null,
      created_at: "2026-10-05", angulo: "Medo de cortar cachos",
      artes: [{ id: "a1", image_url: "https://x/a1.jpg", eixo: "headline", headline_arte: "PARE DE ERRAR", texto_anuncio: "Novo texto", headline: "h" }],
    }],
  }),
  useGenerateVariations: () => ({ mutate, isPending: false }),
}));

describe("Testes", () => {
  it("mostra o teste, as variantes e dispara variações com a arte da variante", () => {
    render(<MemoryRouter><Testes /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "[JP][CCP] Teste de ângulos" })).toBeInTheDocument();
    expect(screen.getByText("01 · Medo de cortar cachos")).toBeInTheDocument();
    expect(screen.getByText("Novo texto")).toBeInTheDocument();
    expect(screen.getByText(/Gerando · 1\/2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Gerar variações/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar 2 variação/ }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "jp_freitas", base_image_url: "https://x/1.jpg", angulo: "Medo de cortar cachos", texto_base: "Texto base", quantidade: 2, eixos: ["headline", "avatar"] }),
      expect.anything(),
    );
  });
});
