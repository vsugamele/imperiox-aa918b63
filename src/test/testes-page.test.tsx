import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Testes from "@/pages/Testes";

const mutate = vi.fn();

vi.mock("@/components/testes/NextBatchPanel", () => ({ NextBatchPanel: () => null }));
vi.mock("@/hooks/useCast", () => ({ useAvatarNames: () => ({ data: new Map() }) }));

vi.mock("@/hooks/useCopyLibrary", () => ({
  useCopyLibrary: () => ({ data: [{ id: "angulo-2", nome: "Medo / Consequência futura", categoria: "problema", numero: 2, biblioteca: "angulo" }] }),
}));

vi.mock("@/hooks/useTestOrders", () => ({
  useTestOrders: () => ({
    isLoading: false, error: null,
    data: [{
      id: "o1", project_id: "jp_freitas", nome: "[JP][CCP] Teste de ângulos", oferta: "Código dos Cortes Perfeitos", status: "no_ar",
      verba_dia_conjunto: 30, ativado_em: "2026-10-05T12:00:00Z", payout: 23.5, cpa_alvo: 60, ics_por_venda: 4, utm_campaign: "ccp-teste-angulos-0510", corte_autorizado_por: "Vinicius", corte_ate: "2026-10-14",
      ultima_avaliacao: null,
      variantes: [{
        id: "v1", order_id: "o1", ordem: 1, angulo: "Medo de cortar cachos", hipotese: "Medo trava a compra", status: "no_ar",
        image_url: "https://x/1.jpg", utm_content: "01-medo", meta_ad_id: "ad1", metodo: "grok:minerado", copy_lib_id: "angulo-2", texto: "Texto base", ultima_leitura: { lido_em: "2026-10-05", gasto: 12, ic: 1, vendas: 0 }, veredito: null,
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
  useTestLive: () => ({
    data: { o1: { sync: "2026-10-06T12:20:00Z", readings: [{ ordem: 1, gasto: 11.5, ic: 4, cliques: 10, impressoes: 400, ctr: 2.5, compras_pixel: 4, vendas: 1, receita_liquida: 23.5, cpa: 11.5, status_meta: "ACTIVE" }] } },
  }),
}));

describe("Testes", () => {
  it("mostra o teste, as variantes e dispara variações com a arte da variante", () => {
    render(<MemoryRouter><Testes /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "[JP][CCP] Teste de ângulos" })).toBeInTheDocument();
    expect(screen.getByText("01 · Medo de cortar cachos")).toBeInTheDocument();
    expect(screen.getByLabelText("Resultado ao vivo")).toHaveTextContent("R$ 11,5 · 1 venda(s) · CPA R$ 11,5");
    expect(screen.getByText(/CTR 2.5% · CPA R\$ 11,5/)).toBeInTheDocument();
    expect(screen.getByText(/^Esteira:/)).toBeInTheDocument();
    expect(screen.getByLabelText("Etiquetas")).toHaveTextContent("grok:minerado2 · Medo / Consequência futura");
    const placar = screen.getByRole("region", { name: "Placar por método e ângulo" });
    expect(placar).toHaveTextContent("grok:minerado");
    fireEvent.click(screen.getByRole("tab", { name: "Camada" }));
    expect(placar).toHaveTextContent("Problema");
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
