import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LevaTable, NextBatchPanel } from "@/components/testes/NextBatchPanel";

const planMutate = vi.fn();
const actionMutate = vi.fn();
const generateMutate = vi.fn();
const leva = (o: Record<string, unknown>) => ({ id: "l1", nome: "Leva 10/10/2026 · 20 criativos", status: "planejado", project_id: "jp_freitas", created_at: "2026-10-10", total_gerado: 0, total_planejado: 0, error_message: null, itens: [], avisos: [], ...o });
let levas = [leva({})];
vi.mock("@/hooks/usePlaybooks", () => ({ useProjectsAndMaps: () => ({ data: { projects: [{ id: "jp_freitas", name: "JP Freitas" }], maps: [] } }) }));
vi.mock("@/hooks/useBatchStrategist", () => ({
  useSavedLevas: () => ({ data: levas }),
  useGenerateLeva: () => ({ mutate: generateMutate, isPending: false }),
  usePlanLeva: () => ({ mutate: planMutate, isPending: false }),
  useLevaAction: () => ({ mutate: actionMutate, isPending: false }),
}));

describe("Próxima leva", () => {
  it("lista a leva salva e aprova pelo botão", () => {
    render(<MemoryRouter><NextBatchPanel /></MemoryRouter>);
    const row = screen.getByRole("listitem", { name: /Leva 10\/10\/2026/ });
    expect(row).toHaveTextContent("Aguardando aprovação");
    fireEvent.click(within(row).getByRole("button", { name: /Aprovar/ }));
    expect(actionMutate).toHaveBeenCalledWith({ modo: "aprovar", leva_id: "l1" }, expect.anything());
  });

  it("Montar leva fica desligado sem projeto", () => {
    render(<MemoryRouter><NextBatchPanel /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Montar leva/ })).toBeDisabled();
  });

  it("leva aprovada pede a oferta e manda gerar; leva pronta mostra o link das artes", () => {
    levas = [leva({ status: "aprovado", itens: [{ precisa_video: false }, { precisa_video: true }] }), leva({ id: "l2", nome: "Leva antiga", status: "completed", total_gerado: 8, total_planejado: 10 })];
    render(<MemoryRouter><NextBatchPanel /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Gerar artes/ }));
    const gerar = screen.getByRole("button", { name: /Gerar 1/ });
    expect(gerar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Oferta"), { target: { value: "Código dos Cortes Perfeitos, R$47" } });
    fireEvent.click(gerar);
    expect(generateMutate).toHaveBeenCalledWith({ leva_id: "l1", oferta: "Código dos Cortes Perfeitos, R$47", publico: undefined }, expect.anything());
    const antiga = screen.getByRole("listitem", { name: /Leva antiga/ });
    expect(antiga).toHaveTextContent("Artes prontas · 8/10");
    expect(within(antiga).getByRole("link", { name: /ver artes/ })).toHaveAttribute("href", "/criativos/l2");
  });

  it("na tabela da leva, o avatar de cada peça pode ser trocado (ou tirado)", () => {
    const onAvatar = vi.fn();
    const itens = [{ bloco: "angulo_novo" as const, copy_lib_id: "x", angulo: "Inimigo comum", categoria: null, formato: "estatico", formato_label: "Estático", porta: "direta" as const, ponto_rota: 2 as const, carga: "cena_vida" as const, precisa_video: false, referencias: [], hipotese: "h", motivo: "m", avatar_id: "a1", avatar_nome: "Rita" }];
    const elenco = [{ id: "a1", nome: "Rita", tipo: "profissional", papel: "elenco", fotos: 4 }, { id: "a2", nome: "Bia", tipo: "cliente", papel: "elenco", fotos: 0 }];
    render(<LevaTable itens={itens} elenco={elenco} avatares={{}} onAvatar={onAvatar} />);
    const sel = screen.getByLabelText("Avatar da peça 1") as HTMLSelectElement;
    expect(sel.value).toBe("a1");
    expect(screen.getByRole("option", { name: "Bia (sem foto)" })).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: "a2" } });
    expect(onAvatar).toHaveBeenCalledWith(0, "a2");
    fireEvent.change(sel, { target: { value: "" } });
    expect(onAvatar).toHaveBeenCalledWith(0, null);
  });
});
