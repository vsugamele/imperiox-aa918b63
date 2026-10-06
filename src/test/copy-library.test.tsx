import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyLibrary } from "@/components/estrategias/CopyLibrary";

vi.mock("@/hooks/useCopyLibrary", () => ({
  useCopyLibrary: () => ({
    isLoading: false, error: null,
    data: [
      { id: "angulo-1", biblioteca: "angulo", numero: 1, categoria: "problema", nome: "Dor / Agitação (PAS)", explicacao: "Escancara a dor.", exemplo: "Exemplo de dor", como_usar: null, prompt: "Escreva a abertura...", extra: {}, ordem: 1 },
      { id: "angulo-62", biblioteca: "angulo", numero: 62, categoria: "oferta", nome: "Custo por dia", explicacao: "Divide o preço.", exemplo: null, como_usar: null, prompt: null, extra: {}, ordem: 2 },
      { id: "objecao-7", biblioteca: "objecao", numero: 7, categoria: "solucao", nome: "\"Já tentei algo parecido\"", explicacao: "Experiência ruim real.", exemplo: null, como_usar: "Validar e diferenciar.", prompt: null, extra: { prova_que_quebra: "Contraprova", onde_quebrar: "Página" }, ordem: 3 },
    ],
  }),
}));

describe("Biblioteca de copy", () => {
  it("filtra por biblioteca e camada e abre o item com prompt e etiqueta", () => {
    render(<CopyLibrary />);
    expect(screen.getByText("Dor / Agitação (PAS)")).toBeInTheDocument();
    expect(screen.queryByText("\"Já tentei algo parecido\"")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Oferta" }));
    expect(screen.queryByText("Dor / Agitação (PAS)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas as camadas" }));

    fireEvent.click(screen.getByText("Dor / Agitação (PAS)"));
    const detail = screen.getByRole("region", { name: "Detalhes de Dor / Agitação (PAS)" });
    expect(detail).toHaveTextContent("Escreva a abertura...");
    expect(detail).toHaveTextContent("angulo-1");

    fireEvent.click(screen.getByRole("tab", { name: /Objeções/ }));
    fireEvent.click(screen.getByText("\"Já tentei algo parecido\""));
    expect(screen.getByText("Prova que quebra")).toBeInTheDocument();
    expect(screen.getByText("Como quebrar")).toBeInTheDocument();
  });
});
