import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { evaluateRound, roundSummary, scaleStepPhase, spendByAdset, spendByDay } from "@shared/scale-ladder";
import { StepScaleLadder } from "@/components/funis/StepScaleLadder";
import type { ScaleRound } from "@/hooks/useScaleRounds";

const saved: ScaleRound = {
  id: "r1", project_id: "jp_freitas", node_id: "n1", fase: "p1", rodada: "S41", created_by: "v@test", updated_at: "2026-10-02T12:00:00Z",
  params: { payout: 70, cpa_alvo: 45, ics_por_venda: 8 },
  data: { concepts: [{ concept: "Inchaço no turno", hipotese: "Quem fica em pé sente à tarde", gasto: "80", ic: "15", vendas: "0" }] },
  resultado: null, resumo: "1 concepts: 1 qualificados",
};

const mutateAsync = vi.fn(async () => "r1");
const loadSpend = vi.fn(async () => [
  { data_ref: "2026-10-01", conjunto_anuncios: "Inchaço no turno", valor: 50, checkouts_iniciados: 10, compras: 0 },
  { data_ref: "2026-10-02", conjunto_anuncios: "Inchaço no turno", valor: 30, checkouts_iniciados: 5, compras: 0 },
  { data_ref: "2026-10-02", conjunto_anuncios: "Meia que falhou", valor: 90, checkouts_iniciados: 0, compras: 0 },
]);
vi.mock("@/hooks/useScaleRounds", () => ({
  useScaleRounds: () => ({ data: { rounds: [saved], lastParams: saved.params } }),
  useSaveScaleRound: () => ({ mutateAsync, isPending: false }),
  loadSpend: (...args: unknown[]) => loadSpend(...(args as [])),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

describe("esteira na etapa: regras de apoio", () => {
  it("descobre a fase pela marca do playbook", () => {
    expect(scaleStepPhase("[agent_status:pending]\n[agent_playbook:esteira-escala-dtc#5]")).toBe("p1");
    expect(scaleStepPhase("[agent_playbook:esteira-escala-dtc#3]")).toBe("parametros");
    expect(scaleStepPhase("[agent_playbook:esteira-escala-dtc#9]")).toBe("p4");
    expect(scaleStepPhase("[agent_playbook:esteira-escala-dtc#10]")).toBeNull();
    expect(scaleStepPhase("[agent_playbook:ads-direto-dtc#5]")).toBeNull();
    expect(scaleStepPhase(null)).toBeNull();
  });

  it("soma o sync de anúncios por conjunto e por dia", () => {
    const rows = [
      { data_ref: "2026-10-02", conjunto_anuncios: "A", valor: 10.1, checkouts_iniciados: 2, compras: 1 },
      { data_ref: "2026-10-01", conjunto_anuncios: "A", valor: 20.2, checkouts_iniciados: 1, compras: 0 },
      { data_ref: "2026-10-01", conjunto_anuncios: null, campanha: "Camp", valor: 40, checkouts_iniciados: null, compras: null },
    ];
    expect(spendByAdset(rows)).toEqual([{ nome: "Camp", gasto: 40, ic: 0, vendas: 0 }, { nome: "A", gasto: 30.3, ic: 3, vendas: 1 }]);
    expect(spendByDay(rows)).toEqual([{ dia: "2026-10-01", gasto: 60.2, ic: 1, vendas: 0 }, { dia: "2026-10-02", gasto: 10.1, ic: 2, vendas: 1 }]);
  });

  it("resume cada fase em uma linha", () => {
    const params = { payout: 70, cpa_alvo: 45 };
    expect(roundSummary("p1", evaluateRound("p1", params, saved.data))).toBe("1 concepts: 1 qualificados, 0 mais textos, 0 mortos; 1 hipóteses no placar.");
    expect(roundSummary("p2", evaluateRound("p2", params, { dias: [{ gasto: 100, vendas: 1 }, { gasto: 100, vendas: 2 }, { gasto: 100, vendas: 2 }], conjuntos: [{ gasto: 90, vendas: 2 }] })))
      .toBe("Dia 3: ESTENDE +3 DIAS (CPA 60); conjuntos: 1 duplica, 0 mantém, 0 pausa");
    expect(roundSummary("p4", evaluateRound("p4", params, { angulos: [{ nome: "X", gasto7: 90, vendas7: 3, diasSeguidosNoCpa: 3 }] }))).toBe("1 no cemitério (1 voltam ao P3), 9 vagas.");
    expect(evaluateRound("p1", { payout: 0, cpa_alvo: 45 }, {})).toBeNull();
  });
});

describe("painel da etapa P1", () => {
  it("abre a última rodada com veredito e placar ao vivo", () => {
    render(<StepScaleLadder nodeId="n1" projectId="jp_freitas" fase="p1" />);
    expect(screen.getByText(/P1 · Teste de concepts/)).toBeInTheDocument();
    expect(screen.getByLabelText("Payout")).toHaveValue(70);
    expect(screen.getByText("QUALIFICADO")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMADA")).toBeInTheDocument();
    expect(screen.getByText(/Teto por IC 5,63/)).toBeInTheDocument();

    // Custo por IC sobe para 16: o veredito muda na hora.
    fireEvent.change(screen.getAllByLabelText("IC")[0], { target: { value: "5" } });
    expect(screen.getByText("MATA")).toBeInTheDocument();
    expect(screen.getByText("REFUTADA")).toBeInTheDocument();
  });

  it("puxa os conjuntos do sync mantendo a hipótese já escrita e salva a rodada", async () => {
    render(<StepScaleLadder nodeId="n1" projectId="jp_freitas" fase="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /Puxar do Império/ }));
    await waitFor(() => expect(screen.getAllByLabelText("Concept (ângulo · avatar)")).toHaveLength(2));
    const concepts = screen.getAllByLabelText("Concept (ângulo · avatar)").map((el) => (el as HTMLInputElement).value);
    expect(concepts).toEqual(["Meia que falhou", "Inchaço no turno"]);
    expect(screen.getAllByLabelText("Hipótese testada").map((el) => (el as HTMLInputElement).value)).toEqual(["", "Quem fica em pé sente à tarde"]);

    fireEvent.click(screen.getByRole("button", { name: /Salvar rodada/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: "r1", projectId: "jp_freitas", nodeId: "n1", fase: "p1", rodada: "S41",
      params: { payout: 70, cpa_alvo: 45, ics_por_venda: 8 },
      data: { concepts: [expect.objectContaining({ concept: "Meia que falhou", gasto: "90" }), expect.objectContaining({ concept: "Inchaço no turno", gasto: "80", ic: "15" })] },
    }));
  });

  it("sem projeto ligado, pede para ligar", () => {
    render(<StepScaleLadder nodeId="n1" projectId={null} fase="p1" />);
    expect(screen.getByText(/Ligue a etapa a um projeto/)).toBeInTheDocument();
  });
});
