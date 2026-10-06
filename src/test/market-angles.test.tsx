import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketAngles } from "@/components/estrategias/MarketAngles";

const mutate = vi.fn();
vi.mock("@/hooks/useCopyLibrary", () => ({
  useReferenceAngles: () => ({
    isLoading: false, error: null,
    data: [
      { id: "r1", titulo: "PCOS e receita", url: "https://x/1", copy_lib_id: "angulo-6", copy_lib_status: "firme", copy_lib_conf: 0.99, copy_lib_alt: [] },
      { id: "r2", titulo: "Nora segredo", url: null, copy_lib_id: "angulo-6", copy_lib_status: "revisado", copy_lib_conf: 0.5, copy_lib_alt: [] },
      { id: "r3", titulo: "Ken canela", url: null, copy_lib_id: "angulo-70", copy_lib_status: "duvida", copy_lib_conf: 0.31, copy_lib_alt: [{ id: "angulo-6", p: 0.2 }, { id: "nenhum", p: 0.1 }] },
    ],
  }),
  useReviewReferenceAngle: () => ({ mutate, isPending: false }),
}));

const library = [
  { id: "angulo-6", numero: 6, nome: "Sintoma → causa raiz", categoria: "problema" },
  { id: "angulo-70", numero: 70, nome: "Curiosidade / Loop aberto", categoria: "generico" },
] as never;

describe("No mercado", () => {
  it("resume camadas e ângulos e decide uma dúvida", () => {
    render(<MarketAngles library={library} />);
    expect(screen.getByText(/2 referências com ângulo decidido/)).toBeInTheDocument();
    const angulos = screen.getByRole("region", { name: "Ângulos do mercado" });
    fireEvent.click(within(angulos).getByRole("button", { name: /6 · Sintoma → causa raiz/ }));
    expect(within(angulos).getByText("PCOS e receita")).toBeInTheDocument();

    const duvidas = screen.getByRole("region", { name: "Dúvidas para revisar" });
    expect(within(duvidas).getByText("Ken canela")).toBeInTheDocument();
    fireEvent.click(within(duvidas).getByRole("button", { name: "Nenhum ângulo claro" }));
    expect(mutate).toHaveBeenCalledWith({ id: "r3", copy_lib_id: null }, expect.anything());
  });
});
