import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiningSources } from "@/components/estrategias/MiningSources";

const run = vi.fn();
const toggle = vi.fn();
vi.mock("@/hooks/usePlaybooks", () => ({ useProjectsAndMaps: () => ({ data: { projects: [{ id: "slimsoda", name: "SlimSoda" }], maps: [] } }) }));
vi.mock("@/hooks/useMiningSources", () => ({
  useMiningSources: () => ({ data: [{ id: "s1", project_id: "slimsoda", tipo: "palavra", valor: "weight loss drink", pais: "US", ativo: true, ultima_execucao: "2026-10-07T12:50:39Z", ultimo_resultado: { encontrados: 10, gravados: 3 } }] }),
  useAddMiningSource: () => ({ mutate: vi.fn(), isPending: false }),
  useRunMiningSource: () => ({ mutate: run, isPending: false }),
  useToggleMiningSource: () => ({ mutate: toggle, isPending: false }),
}));

describe("Mineração", () => {
  it("mostra a fonte com o resultado da última rodada, roda agora e pausa", () => {
    render(<MiningSources />);
    const row = screen.getByRole("listitem", { name: "Fonte weight loss drink" });
    expect(row).toHaveTextContent('"weight loss drink" · US');
    expect(row).toHaveTextContent("10 vistos, 3 novos");
    fireEvent.click(within(row).getByRole("button", { name: /Rodar agora/ }));
    expect(run).toHaveBeenCalledWith("s1", expect.anything());
    fireEvent.click(within(row).getByRole("button", { name: "Pausar" }));
    expect(toggle).toHaveBeenCalledWith({ id: "s1", ativo: false });
  });
});
