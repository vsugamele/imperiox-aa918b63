import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildProjectMap } from "@shared/project-map";
import { ProjectMapDetail } from "@/components/mapa/ProjectMapDetail";

afterEach(cleanup);

describe("native project detail", () => {
  it("reads the selected project's offers and replaces them when switching projects", () => {
    const map = (id: string, name: string) => buildProjectMap({
      project: { id, name: `Projeto ${name}`, data: { produtos: [{ nome: name, preco: "47,00" }] }, avatar: {} },
      competitors: [], mapNodes: [],
      activity: { approvedSales30dByProduct: {}, waIncoming30d: 0, waOutgoing30d: 0, funnelSessions7d: 0, activeWaProviders: 0, aiEnabled: null, aiDraftMode: null },
    });
    const a = map("a", "Oferta A");
    const before = structuredClone(a);
    // O detalhe tem links para o mapa de operação e o Hoje, então precisa de um roteador.
    const { rerender } = render(<ProjectMapDetail map={a} onOpenChange={() => undefined} />, { wrapper: MemoryRouter });
    expect(screen.getByLabelText("Oferta A: Página de obrigado")).toHaveTextContent("Não localizado neste cadastro");
    expect(screen.getByLabelText("Oferta A: E-mail de compra / acesso")).toHaveTextContent("não conferida");
    rerender(<ProjectMapDetail map={map("b", "Oferta B")} onOpenChange={() => undefined} />);
    expect(screen.queryByLabelText("Oferta A: Página de obrigado")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Oferta B: Página de obrigado")).toBeInTheDocument();
    expect(a).toEqual(before);
    rerender(<ProjectMapDetail map={null} onOpenChange={() => undefined} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
