import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { splitReport } from "@shared/page-split";
import { PageSplitsSection } from "@/components/funis/PageSplitsSection";

const variantes = [{ key: "A", url: "https://ccp.com/v1", peso: 1 }, { key: "B", url: "https://ccp.com/v2", peso: 1 }];
const create = vi.fn();
const end = vi.fn();
vi.mock("@/hooks/usePageSplits", () => ({
  usePageSplits: () => ({
    data: [{
      id: "s1", slug: "ccp-x1", nome: "CCP página", status: "ativo", vencedor: null, created_at: "2026-10-07", link: "https://x/split/ccp-x1", variantes,
      report: splitReport(variantes, { A: 160, B: 150 }, { "ccp.com/v1": { sessoes_pagina: 150, cliques_checkout: 15 }, "ccp.com/v2": { sessoes_pagina: 140, cliques_checkout: 7 } }),
    }],
  }),
  useCreatePageSplit: () => ({ mutate: create, isPending: false }),
  useEndPageSplit: () => ({ mutate: end, isPending: false }),
}));

describe("Testes de página A/B/C", () => {
  it("mostra a leitura por variante, a vencedora e encerra mantendo a vencedora", () => {
    render(<PageSplitsSection projectId="jp_freitas" />);
    const card = screen.getByRole("article", { name: "Teste CCP página" });
    expect(card).toHaveTextContent("310 pessoas enviadas");
    expect(card).toHaveTextContent("Página A converte 10% contra 5% da B: vencedora.");
    fireEvent.click(within(card).getByRole("button", { name: /Encerrar \(fica a A\)/ }));
    expect(end).toHaveBeenCalledWith({ id: "s1", vencedor: "A" }, expect.anything());
  });

  it("cria um teste com 2 a 3 páginas e pesos", () => {
    render(<PageSplitsSection projectId="jp_freitas" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo teste/ }));
    fireEvent.change(screen.getByLabelText("Nome do teste"), { target: { value: "VSL x Carta" } });
    fireEvent.change(screen.getByLabelText("Página A"), { target: { value: "https://ccp.com/vsl" } });
    fireEvent.change(screen.getByLabelText("Página B"), { target: { value: "https://ccp.com/carta" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Página C" }));
    fireEvent.change(screen.getByLabelText("Página C"), { target: { value: "https://ccp.com/quiz" } });
    fireEvent.change(screen.getByLabelText("Peso C"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar e copiar link" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ projectId: "jp_freitas", nome: "VSL x Carta", variantes: [{ url: "https://ccp.com/vsl", peso: 1 }, { url: "https://ccp.com/carta", peso: 1 }, { url: "https://ccp.com/quiz", peso: 2 }] }), expect.anything());
  });
});
