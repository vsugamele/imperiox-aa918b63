import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CastTab } from "@/components/studio/CastTab";

const photosMutate = vi.fn();
const toggleMutate = vi.fn();
vi.mock("@/hooks/usePlaybooks", () => ({ useProjectsAndMaps: () => ({ data: { projects: [{ id: "jp_freitas", name: "JP Freitas" }], maps: [] } }) }));
vi.mock("@/hooks/useCast", () => ({
  useCast: () => ({ isLoading: false, data: [
    { id: "a1", nome: "Rita", tipo: "profissional", papel: "elenco", ativo: true, origem: "ia", ficha: { idade: 38, aparencia: "cabelo cacheado volumoso", frase: "Eu travo no cacho" }, fotos: [] },
    { id: "a2", nome: "Linda", tipo: "publico", papel: "publico", ativo: true, origem: "ia", ficha: { idade: 34, dores: ["cliente não volta"] }, fotos: [] },
  ] }),
  useSuggestCast: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateCastPhotos: () => ({ mutate: photosMutate, isPending: false }),
  useToggleAvatar: () => ({ mutate: toggleMutate, isPending: false }),
  useSaveAvatar: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("Elenco", () => {
  it("avatar que aparece nas artes pede fotos; persona do público não", () => {
    render(<CastTab />);
    const rita = screen.getByRole("article", { name: "Avatar Rita" });
    expect(rita).toHaveTextContent("Sem fotos");
    fireEvent.click(within(rita).getByRole("button", { name: /Gerar fotos/ }));
    expect(photosMutate).toHaveBeenCalledWith({ avatar_id: "a1", project_id: "" }, expect.anything());
    const linda = screen.getByRole("article", { name: "Avatar Linda" });
    expect(linda).toHaveTextContent("Persona do público");
    expect(within(linda).queryByRole("button", { name: /Gerar fotos/ })).toBeNull();
    fireEvent.click(within(linda).getByRole("button", { name: "Desativar" }));
    expect(toggleMutate).toHaveBeenCalledWith({ id: "a2", ativo: false, project_id: "" });
  });
});
