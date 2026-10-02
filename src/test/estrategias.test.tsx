import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Estrategias from "@/pages/Estrategias";
import { PLAYBOOK_LIBRARY } from "@shared/playbook-library";

vi.mock("@/hooks/usePlaybooks", () => ({
  usePlaybooks: () => ({
    data: { playbooks: PLAYBOOK_LIBRARY, applications: [{ id: "a1", playbook_id: "x1-conversa", project_id: "slimsoda", map_id: "m1", status: "ativo", created_at: "2026-10-02" }] },
    isLoading: false, error: null,
  }),
  useProjectsAndMaps: () => ({ data: { projects: [{ id: "slimsoda", name: "SlimSoda" }], maps: [{ id: "m1", name: "SlimSoda — Operação", archived_at: null }] } }),
  useMapContext: () => ({ data: undefined, isLoading: false }),
  useApplyPlaybook: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("Estratégias", () => {
  it("lista as estratégias, filtra por família e abre o passo a passo com métricas", async () => {
    render(<MemoryRouter><Estrategias /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "X1 — anúncio para conversa" })).toBeInTheDocument();
    expect(screen.getByText("em uso · SlimSoda")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "SEO e conteúdo" }));
    // O card sai com animação.
    await waitFor(() => expect(screen.queryByRole("heading", { name: "X1 — anúncio para conversa" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("heading", { name: "SEO e conteúdo" }));
    const detail = screen.getByRole("region", { name: "Detalhes de SEO e conteúdo" });
    expect(within(detail).getByText("Auditoria técnica do site")).toBeInTheDocument();
    // Métrica sem fonte ligada fica explícita, nunca como número inventado.
    expect(within(detail).getAllByText(/Fonte ainda não ligada/).length).toBeGreaterThan(0);
    expect(within(detail).getByRole("button", { name: /Aplicar a um projeto/ })).toBeInTheDocument();
  });
});
