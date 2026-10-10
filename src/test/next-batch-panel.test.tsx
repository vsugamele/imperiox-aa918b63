import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextBatchPanel } from "@/components/testes/NextBatchPanel";

const planMutate = vi.fn();
const actionMutate = vi.fn();
vi.mock("@/hooks/usePlaybooks", () => ({ useProjectsAndMaps: () => ({ data: { projects: [{ id: "jp_freitas", name: "JP Freitas" }], maps: [] } }) }));
vi.mock("@/hooks/useBatchStrategist", () => ({
  useSavedLevas: () => ({ data: [{ id: "l1", nome: "Leva 10/10/2026 · 20 criativos", status: "planejado", project_id: "jp_freitas", created_at: "2026-10-10", itens: [], avisos: [] }] }),
  usePlanLeva: () => ({ mutate: planMutate, isPending: false }),
  useLevaAction: () => ({ mutate: actionMutate, isPending: false }),
}));

describe("Próxima leva", () => {
  it("lista a leva salva e aprova pelo botão", () => {
    render(<NextBatchPanel />);
    const row = screen.getByRole("listitem", { name: /Leva 10\/10\/2026/ });
    expect(row).toHaveTextContent("Aguardando aprovação");
    fireEvent.click(within(row).getByRole("button", { name: /Aprovar/ }));
    expect(actionMutate).toHaveBeenCalledWith({ modo: "aprovar", leva_id: "l1" }, expect.anything());
  });

  it("Montar leva fica desligado sem projeto", () => {
    render(<NextBatchPanel />);
    expect(screen.getByRole("button", { name: /Montar leva/ })).toBeDisabled();
  });
});
