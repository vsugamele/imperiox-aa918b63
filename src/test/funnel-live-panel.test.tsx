import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildFunnelLive } from "@shared/funnel-live";
import { FunnelLivePanel } from "@/components/funis/FunnelLivePanel";

const live = buildFunnelLive({
  ads: [{ spend: 50, impressoes: 10000, link_clicks: 30, init_checkout: 4 }],
  pages: [],
  sales: [{ status: "aprovado", valor: 47, valor_liquido: 23.5, tipo_venda: "principal" }],
});

vi.mock("@/hooks/useFunnelLive", () => ({
  useFunnelLive: () => ({ isLoading: false, error: null, data: { ...live, produtos: ["Código dos Cortes Perfeitos"], paginas: [], adsDoProjetoInteiro: false } }),
}));

describe("Painel ao vivo do funil", () => {
  it("mostra totais, etapas em ordem e destaca o gargalo", () => {
    render(<FunnelLivePanel projects={[{ id: "jp_freitas", name: "JP Freitas" }]} />);
    const kpis = screen.getByLabelText("Resultado do período");
    expect(kpis).toHaveTextContent("R$ 50,00");
    expect(kpis).toHaveTextContent("R$ 47,00");
    const etapas = within(screen.getByRole("list", { name: "Etapas do funil" })).getAllByRole("article");
    expect(etapas.map((e) => e.getAttribute("aria-label"))).toEqual(["Etapa Anúncio", "Etapa Página", "Etapa Checkout", "Etapa Venda", "Etapa Bump e upsell", "Etapa Recuperação no WhatsApp"]);
    expect(screen.getByRole("status")).toHaveTextContent("Gargalo agora: Anúncio");
    expect(within(etapas[0]).getByText("Gargalo")).toBeInTheDocument();
    expect(within(etapas[1]).getByText("A página não tem o rastreador do Império.")).toBeInTheDocument();
  });
});
