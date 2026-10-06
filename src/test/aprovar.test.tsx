import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildApprovalQueue, waitingFor } from "@shared/approval-queue";
import Aprovar from "@/pages/Aprovar";

const fullQueue = buildApprovalQueue({
  steps: [{ id: "s1", map_id: "m1", label: "Copy da VSL", linked_project_id: "slimsoda", status_changed_at: "2026-10-01T10:00:00Z" }],
  actions: [
    { id: "a1", kind: "notify", title: "Avisar lead quente", risk_level: "low", created_at: "2026-09-30T10:00:00Z" },
    { id: "a2", kind: "createTask", title: "Pausar conjunto caro", risk_level: "high", impact_brl: 320, created_at: "2026-10-01T09:00:00Z" },
  ],
  contents: [{ id: "c1", project_id: "slimsoda", title: "Reels 01", cover_url: "https://x/capa.jpg", batch: "lote-01", created_at: "2026-10-01T08:00:00Z" }],
  drafts: [{ id: "d1", project_id: "jp_freitas", contact_name: "Ana", suggested_text: "Oi Ana!", created_at: "2026-10-02T08:00:00Z" }, { id: null }],
  pix: [{
    id: "px1",
    customer_name: "Lucas Silva",
    customer_phone: "11999998888",
    product_name: "Método Cacheadas",
    valor: 97,
    created_at: "2026-10-02T09:00:00Z",
    recovery_level: 1,
    recovery_message: "Oi Lucas! Vi que o Pix ficou pendente...",
  }],
  semaforo: [{
    id: "sem1",
    title: 'Pausar adset "Corte Aberto" — Gastou R$ 68 sem venda',
    reason: "Gastou R$ 68 nos últimos 3 dias sem conversão de compra.",
    risk_level: "high",
    spend_brl: 68,
    purchases: 0,
    recommendation: "pausar",
    created_at: "2026-10-02T09:15:00Z",
  }],
  knowledge: [{
    id: "kn1",
    project_id: "jp_freitas",
    pergunta: "Vocês atendem cabelo crespo tipo 4C?",
    resposta: "Sim, somos especialistas em cabelos cacheados, crespos e ondulados!",
    created_at: "2026-10-02T09:30:00Z",
  }],
});

const mutate = vi.fn();
vi.mock("@/hooks/useApprovals", () => ({
  useApprovals: () => ({ data: fullQueue, isLoading: false, error: null }),
  useDecideApproval: () => ({ mutate, isPending: false }),
}));
vi.mock("@/hooks/useAiFeed", () => ({
  useAiFeed: () => ({ data: [], isLoading: false, error: null }),
  useAiFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/usePlaybooks", () => ({
  useProjectsAndMaps: () => ({ data: { projects: [{ id: "slimsoda", name: "SlimSoda" }, { id: "jp_freitas", name: "JP Freitas" }], maps: [] } }),
}));

describe("fila Aprovar", () => {
  it("ordena com prioridade comercial: pix_travado, semaforo_ads, duvida_bot, rascunhos, etapas, acoes, conteudo", () => {
    expect(fullQueue.map((i) => i.key)).toEqual([
      "pix_travado:px1",
      "semaforo_ads:sem1",
      "duvida_bot:kn1",
      "rascunho:d1",
      "etapa:s1",
      "acao_ia:a2",
      "acao_ia:a1",
      "conteudo:c1",
    ]);
    expect(fullQueue[0]).toMatchObject({ inline: true, source: "pix_travado" });
    expect(fullQueue[1]).toMatchObject({ inline: true, source: "semaforo_ads" });
    expect(fullQueue[2]).toMatchObject({ inline: true, source: "duvida_bot" });
  });

  it("mostra a fila e decide semáforo, pix e dúvida do bot no próprio card", async () => {
    render(<MemoryRouter><Aprovar /></MemoryRouter>);
    // Abre em "A IA fez"; a fila de decisão fica em "Precisa de você".
    expect(screen.getByRole("heading", { name: "A IA fez" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Precisa de você/ }));
    expect(screen.getByRole("tab", { name: /Tudo 8/ })).toBeInTheDocument();

    // Semáforo card
    expect(screen.getByText(/Pausar adset "Corte Aberto"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pausar Imediatamente/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pausar Imediatamente/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ decision: "approve", item: expect.objectContaining({ id: "sem1" }) }), expect.anything());

    // Pix card
    expect(screen.getAllByText(/Lucas Silva/)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disparar WhatsApp \(1-Clique\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Disparar WhatsApp \(1-Clique\)/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ decision: "approve", item: expect.objectContaining({ id: "px1" }) }), expect.anything());

    // Dúvida do Bot card
    expect(screen.getAllByText(/Vocês atendem cabelo crespo tipo 4C/)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aprovar no Acervo \(Alimentar RAG\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aprovar no Acervo \(Alimentar RAG\)/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ decision: "approve", item: expect.objectContaining({ id: "kn1" }) }), expect.anything());
  });
});

