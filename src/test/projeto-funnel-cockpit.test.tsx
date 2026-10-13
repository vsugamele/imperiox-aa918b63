import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { buildFunnelLive } from "@shared/funnel-live";
import { ProjetoFunnelCockpit } from "@/components/projeto/ProjetoFunnelCockpit";

// JSDOM ResizeObserver mock for Radix UI Slider
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const mockFunnelData = buildFunnelLive({
  ads: [{ spend: 200, impressoes: 20000, link_clicks: 500, init_checkout: 30 }],
  pages: [{ url: "https://exemplo.com/vsl", values: { sessoes_pagina: 150, cliques_cta: 25 } }],
  sales: [
    { status: "aprovado", valor: 97, valor_liquido: 85, tipo_venda: "principal", produto_nome: "Curso VIP" },
    { status: "aprovado", valor: 27, valor_liquido: 25, tipo_venda: "order_bump", produto_nome: "Protocolo Extra" },
  ],
});

vi.mock("@/hooks/useFunnelLive", () => ({
  useFunnelLive: () => ({
    isLoading: false,
    error: null,
    data: {
      ...mockFunnelData,
      produtos: ["Curso VIP"],
      paginas: [{ url: "https://exemplo.com/vsl", values: { sessoes_pagina: 150, cliques_cta: 25 } }],
      adsDoProjetoInteiro: false,
    },
    refetch: vi.fn(),
    isRefetching: false,
  }),
}));

describe("ProjetoFunnelCockpit", () => {
  it("renderiza o cockpit com score de fluidez, 6 etapas e diagnóstico de gargalo", () => {
    const onNavigateTab = vi.fn();

    render(
      <MemoryRouter>
        <ProjetoFunnelCockpit
          projectId="proj_123"
          projectName="Projeto Alpha"
          onNavigateTab={onNavigateTab}
        />
      </MemoryRouter>
    );

    // Título e Score
    expect(screen.getByText("Saúde & Telemetria do Funil")).toBeInTheDocument();
    expect(screen.getByText(/Score de Fluidez:/)).toBeInTheDocument();

    // Nós das 6 etapas
    expect(screen.getByText("1. Anúncio")).toBeInTheDocument();
    expect(screen.getByText("2. Página")).toBeInTheDocument();
    expect(screen.getByText("3. Checkout")).toBeInTheDocument();
    expect(screen.getByText("4. Venda")).toBeInTheDocument();
    expect(screen.getByText("5. Bump & Upsell")).toBeInTheDocument();
    expect(screen.getByText("6. WhatsApp")).toBeInTheDocument();

    // Botões de Ação
    expect(screen.getByText("Playbook de Solução")).toBeInTheDocument();
    expect(screen.getByText("Simular Impacto")).toBeInTheDocument();

    // Toggle do simulador
    const simButton = screen.getByText("Simular Impacto");
    fireEvent.click(simButton);
    expect(screen.getByText(/Simulador de Impacto Financeiro/)).toBeInTheDocument();
  });
});
