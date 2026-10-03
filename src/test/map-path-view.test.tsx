import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapPathView } from "@/components/funis/MapPathView";
import type { MapNode } from "@/components/funis/map-node-model";

const node = (id: string, kind: string, x: number, extra: Partial<MapNode> = {}): MapNode => ({
  id, map_id: "m", label: id.toUpperCase(), kind, color: "#fff", position: { x, y: 0 }, size: "M", checklist: [], ...extra,
});

const nodes = [
  node("ads", "meta_ads", 0, { step_status: "done", description: "O QUÊ: anúncio\nSAÍDA: 3 anúncios no ar" }),
  node("pagina", "pagina_vendas", 300, { step_status: "in_progress", metrics_target: { key: "taxa_clique_checkout", meta: "5% a 15%" } }),
  node("checkout", "checkout", 600, { metrics_target: { key: "cpa", meta: "até o CPA alvo" } }),
  node("compra", "compra", 900),
  node("down", "downsell", 400, { position: { x: 400, y: 400 } }),
  node("solto", "doc", 0, { position: { x: 0, y: 900 } }),
];
const edges = [{ source: "ads", target: "pagina" }, { source: "pagina", target: "checkout" }, { source: "checkout", target: "compra" }, { source: "pagina", target: "down" }];

describe("MapPathView", () => {
  it("shows the main path in order with delivery, metric × target and where it is stuck", () => {
    render(<MapPathView nodes={nodes} edges={edges} today="2026-10-03" metricValues={{ taxa_clique_checkout: 7.5, cpa: 80 }} scaleRefs={{ cpaAlvo: 60 }} onOpen={vi.fn()} onSetRole={vi.fn()} />);
    expect(screen.getByText(/4 passo\(s\) até/)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("ADS");
    expect(items[3]).toContain("COMPRA");
    expect(screen.getByText("3 anúncios no ar")).toBeInTheDocument();
    expect(screen.getByText("7,5%")).toBeInTheDocument();
    expect(screen.getByText("80,00")).toBeInTheDocument();
    expect(screen.getByText(/Travado no passo 2: PAGINA/)).toBeInTheDocument();
    expect(screen.getByText(/em andamento · sem dono/)).toBeInTheDocument();
    expect(screen.getByText("Alternativas a partir daqui")).toBeInTheDocument();
    expect(screen.getByText("DOWN")).toBeInTheDocument();
    expect(screen.queryByText("SOLTO")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Fora do caminho \(1\)/));
    expect(screen.getByText("SOLTO")).toBeInTheDocument();
  });

  it("opens a step from the stuck banner", () => {
    const onOpen = vi.fn();
    render(<MapPathView nodes={nodes} edges={edges} today="2026-10-03" onOpen={onOpen} onSetRole={vi.fn()} />);
    fireEvent.click(screen.getByText(/Travado no passo 2/));
    expect(onOpen).toHaveBeenCalledWith("pagina");
  });

  it("explains what to do when the map has no purchase or checkout", () => {
    render(<MapPathView nodes={[node("a", "anuncio", 0)]} edges={[]} today="2026-10-03" onOpen={vi.fn()} onSetRole={vi.fn()} />);
    expect(screen.getByText(/ainda não tem compra nem checkout/)).toBeInTheDocument();
  });
});
