import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildApprovalQueue, waitingFor } from "@shared/approval-queue";
import Aprovar from "@/pages/Aprovar";

const queue = buildApprovalQueue({
  steps: [{ id: "s1", map_id: "m1", label: "Copy da VSL", linked_project_id: "slimsoda", status_changed_at: "2026-10-01T10:00:00Z" }],
  actions: [
    { id: "a1", kind: "notify", title: "Avisar lead quente", risk_level: "low", created_at: "2026-09-30T10:00:00Z" },
    { id: "a2", kind: "createTask", title: "Pausar conjunto caro", risk_level: "high", impact_brl: 320, created_at: "2026-10-01T09:00:00Z" },
  ],
  contents: [{ id: "c1", project_id: "slimsoda", title: "Reels 01", cover_url: "https://x/capa.jpg", batch: "lote-01", created_at: "2026-10-01T08:00:00Z" }],
  drafts: [{ id: "d1", project_id: "jp_freitas", contact_name: "Ana", suggested_text: "Oi Ana!", created_at: "2026-10-02T08:00:00Z" }, { id: null }],
});

const mutate = vi.fn();
vi.mock("@/hooks/useApprovals", () => ({
  useApprovals: () => ({ data: queue, isLoading: false, error: null }),
  useDecideApproval: () => ({ mutate, isPending: false }),
}));
vi.mock("@/hooks/usePlaybooks", () => ({
  useProjectsAndMaps: () => ({ data: { projects: [{ id: "slimsoda", name: "SlimSoda" }, { id: "jp_freitas", name: "JP Freitas" }], maps: [] } }),
}));

describe("fila Aprovar", () => {
  it("ordena: resposta para cliente, etapas, ações da IA por risco, conteúdo; ignora rascunho sem id", () => {
    expect(queue.map((i) => i.key)).toEqual(["rascunho:d1", "etapa:s1", "acao_ia:a2", "acao_ia:a1", "conteudo:c1"]);
    expect(queue[0]).toMatchObject({ inline: false, link: "/rascunhos" });
    expect(queue[1].link).toBe("/funis?view=mapa&map=m1&node=s1");
    expect(waitingFor("2026-10-01T10:00:00Z", Date.parse("2026-10-03T12:00:00Z"))).toBe("2 d");
    expect(waitingFor("2026-10-03T09:30:00Z", Date.parse("2026-10-03T12:00:00Z"))).toBe("2 h");
  });

  it("mostra a fila por origem e decide no próprio card", async () => {
    render(<MemoryRouter><Aprovar /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: /Tudo 5/ })).toBeInTheDocument();
    expect(screen.getByText("Pausar conjunto caro")).toBeInTheDocument();
    expect(screen.getByText("risco alto")).toBeInTheDocument();
    // Resposta para cliente envia mensagem: só abre a tela de origem.
    expect(screen.getByRole("link", { name: /Abrir para responder/ })).toHaveAttribute("href", "/rascunhos");

    fireEvent.click(screen.getByRole("tab", { name: /Etapas para revisar 1/ }));
    await waitFor(() => expect(screen.queryByText("Pausar conjunto caro")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Devolver/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ decision: "reject", item: expect.objectContaining({ id: "s1" }) }), expect.anything());
  });
});
