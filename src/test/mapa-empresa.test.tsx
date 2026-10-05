import { fireEvent, render as rtlRender, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import MapaEmpresa from "@/pages/MapaEmpresa";
import { buildProjectMap, type ProjectMapInput } from "@shared/project-map";

const activity: ProjectMapInput["activity"] = {
  approvedSales30dByProduct: { Curso: 3 },
  waIncoming30d: 10,
  waOutgoing30d: 8,
  funnelSessions7d: 0,
  activeWaProviders: 1,
  aiEnabled: true,
  aiDraftMode: false,
};

const maps = [
  buildProjectMap({ project: { id: "vazio", name: "Projeto Vazio", data: {}, avatar: {} }, competitors: [], mapNodes: [], activity: { ...activity, approvedSales30dByProduct: {}, waIncoming30d: 0, waOutgoing30d: 0, activeWaProviders: 0, aiEnabled: null, aiDraftMode: null } }),
  buildProjectMap({ project: { id: "vende", name: "Projeto Vendendo", data: { produtos: [{ nome: "Curso", preco: "97", link_checkout: "https://pay.kiwify.com/x" }] }, avatar: {} }, competitors: [], mapNodes: [], activity }),
  buildProjectMap({
    project: {
      id: "completo",
      name: "Projeto Completo",
      data: {
        produtos: [{ nome: "Curso", preco: "97", link_checkout: "https://pay.kiwify.com/x", links: [{ url: "https://curso.app", tipo: "vsl" }] }],
        mecanismo_unico: "m".repeat(150),
        publico_alvo: "mulheres 40+",
      },
      avatar: { problemas: ["p"], desejos_internos: ["d"], objecoes: ["o"], crenca_bloqueadora: "c", inimigo: "i", headlines: ["h"] },
    },
    competitors: [],
    mapNodes: [],
    activity: { ...activity, funnelSessions7d: 12 },
  }),
];

vi.mock("@/hooks/useCompanyMap", () => ({
  useCompanyMap: () => ({ data: maps, isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
}));

// Só o Projeto Vendendo tem mapa de operação no canvas.
vi.mock("@/hooks/useTodayBoard", () => ({
  useTodayBoard: () => ({ data: [{ projectId: "vende", mapIds: ["map-vende"] }] }),
}));

vi.mock("@/hooks/useMapPathMetrics", () => ({
  useMapPathMetrics: () => ({ data: {} }),
}));

const render = (ui: ReactElement, initialEntries = ["/mapa?tab=matriz"]) =>
  rtlRender(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

describe("MapaEmpresa", () => {
  it("lists projects with critical gaps first and opens the project detail", () => {
    render(<MapaEmpresa />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Projeto Vazio")).toBeInTheDocument();
    expect(within(rows[1]).getAllByText("Rodando").length).toBeGreaterThan(0);

    fireEvent.click(within(rows[0]).getByText("Projeto Vazio"));
    expect(screen.getByText("Nenhum produto cadastrado no projeto.")).toBeInTheDocument();
    expect(screen.getByText(/skill: avatar-architect-v8/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Montar mapa de operação/ })).toHaveAttribute("href", "/funis?view=mapa");
  });

  it("links a project to its operation map", () => {
    render(<MapaEmpresa />);
    fireEvent.click(screen.getAllByText("Projeto Vendendo")[0]);
    expect(screen.getByRole("link", { name: /Abrir mapa de operação/ })).toHaveAttribute("href", "/funis?view=mapa&map=map-vende");
  });

  it("filters to projects with critical gaps", () => {
    expect(maps[2].gaps.some((g) => g.severity === "critica")).toBe(false);
    render(<MapaEmpresa />);
    expect(screen.getAllByText("Projeto Completo").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Só projetos com lacuna crítica"));
    expect(screen.queryByText("Projeto Completo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Projeto Vazio").length).toBeGreaterThan(0);
  });
});
