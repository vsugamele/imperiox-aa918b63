import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildApprovalQueue, type ApprovalItem } from "@shared/approval-queue";
import { countBySource, DecisionsSummary } from "@/components/hoje/DecisionsSummary";

let queue: ApprovalItem[] = buildApprovalQueue({
  pix: [{ id: "px1", project_id: "jp_freitas", valor: 47, created_at: "2026-10-15T09:00:00Z" }],
  support: [
    { channel: "whatsapp", conversation_id: "w1", project_id: "jp_freitas", support_status: "handoff", contact_name: "Ana" },
    { channel: "instagram", conversation_id: "i1", project_id: "jp_freitas", support_status: "pending", contact_name: "Bia" },
  ],
  levas: [{ id: "l1", project_id: "slimsoda", nome: "Leva 1", status: "planejado", created_at: "2026-10-15T08:00:00Z" }],
});
vi.mock("@/hooks/useApprovals", () => ({ useApprovals: () => ({ data: queue, isLoading: false, error: null }) }));

const renderIt = (projectId?: string | null) => render(<MemoryRouter><DecisionsSummary projectId={projectId} /></MemoryRouter>);

describe("Hoje: decisões esperando (vem da fila Aprovar)", () => {
  it("conta por tipo na ordem de urgência", () => {
    expect(countBySource(queue)).toEqual([{ source: "pix_travado", n: 1 }, { source: "suporte", n: 2 }, { source: "leva", n: 1 }]);
  });

  it("mostra o total, os tipos, os 3 mais urgentes e leva para o Aprovar", () => {
    renderIt();
    expect(screen.getByRole("heading", { name: "4 decisão(ões) esperando você" })).toBeInTheDocument();
    expect(screen.getByText("Suporte parado:")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").filter((li) => li.closest("ol"))).toHaveLength(3);
    expect(screen.getByRole("link", { name: /Decidir no Aprovar/ })).toHaveAttribute("href", "/aprovar");
  });

  it("com projeto escolhido no topo, mostra só as dele", () => {
    renderIt("slimsoda");
    expect(screen.getByRole("heading", { name: "1 decisão(ões) esperando você" })).toBeInTheDocument();
  });

  it("fila vazia: avisa que não há decisão", () => {
    queue = [];
    renderIt();
    expect(screen.getByText("Nenhuma decisão esperando você.")).toBeInTheDocument();
  });
});
