import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Hoje from "@/pages/Hoje";
import { buildTodayBoard } from "@/lib/today-board";

const boards = buildTodayBoard({
  projects: [{ id: "slimsoda", name: "SlimSoda" }],
  nodes: [
    { id: "a", map_id: "m1", label: "Briefs de criativo", kind: "doc", executor_type: "AI_SKILL", linked_skill_id: "angulos-criativos", linked_project_id: "slimsoda", position: { x: 0, y: 0 } },
    { id: "b", map_id: "m1", label: "Subir na BM", kind: "meta_ads", executor_type: "HUMAN_OPERATOR", position: { x: 100, y: 0 } },
    { id: "c", map_id: "m1", label: "Copy da VSL", kind: "vsl", executor_type: "AI_SKILL", notes: "[agent_status:ready_review]", position: { x: 200, y: 0 } },
  ],
  salesToday: [{ project_id: "slimsoda", valor: 27.49, data: { moeda: "USD" } }],
  leadsToday: [],
});

vi.mock("@/hooks/useTodayBoard", () => ({
  useTodayBoard: () => ({ data: boards, isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
  useSetStepStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useCompanyMap", () => ({
  useCompanyMap: () => ({ data: [{ projectId: "slimsoda", gaps: [{ severity: "critica", area: "funil", message: "Sem venda com origem", action: "Ligar a venda ao anúncio" }] }] }),
}));

describe("Hoje", () => {
  it("shows each project's steps split by who executes, with deep links and today's numbers", () => {
    render(<MemoryRouter><Hoje /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "SlimSoda" })).toBeInTheDocument();
    expect(screen.getByText(/1 venda\(s\) hoje · US\$/)).toBeInTheDocument();
    expect(screen.getByText("Sem venda com origem")).toBeInTheDocument();

    const ai = screen.getByRole("group", { name: "IA pode executar" });
    expect(within(ai).getByRole("link", { name: "Briefs de criativo" })).toHaveAttribute("href", "/funis?view=mapa&map=m1&node=a");
    expect(within(ai).getByTitle("Copiar prompt para a IA")).toBeInTheDocument();

    const waiting = screen.getByRole("group", { name: "Esperando você" });
    expect(within(waiting).getByText("Subir na BM")).toBeInTheDocument();

    const review = screen.getByRole("group", { name: "Para revisar" });
    expect(within(review).getByText("Copy da VSL")).toBeInTheDocument();
  });
});
