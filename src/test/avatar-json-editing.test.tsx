import type { Json } from "@/integrations/supabase/types";
import { PerfilTab } from "@/components/projeto/avatar/PerfilTab";
import { DoresTab } from "@/components/projeto/avatar/DoresTab";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoyerismosTab } from "@/components/projeto/avatar/VoyerismosTab";
import { computeAvatarHealthScore } from "@/components/projeto/avatar/avatar-health";

vi.mock("@/components/projeto/AIGenerateButton", () => ({ AIGenerateButton: ({ onResult }: { onResult: (value: Json) => void }) => <button onClick={() => onResult({ result: JSON.stringify({ dores_superficiais: ["surface"], dores_profundas: ["deep"], medos: ["fear"] }) })}>Generate test pains</button> }));

describe("avatar JSON editing", () => {
  it("preserves other avatar fields and scene metadata when editing", () => {
    const update = vi.fn();
    render(<VoyerismosTab avatar={{ other: "keep", voyerismos: [{ nome: "Scene", situacao: "Before", evidence: ["source"] }] }} onUpdate={update} />);
    fireEvent.change(screen.getByDisplayValue("Before"), { target: { value: "After" } });
    expect(update).toHaveBeenCalledWith({ other: "keep", voyerismos: [{ nome: "Scene", situacao: "After", evidence: ["source"] }] });
  });
  it("preserves profile metadata while editing a field", () => {
    const update = vi.fn();
    render(<PerfilTab avatar={{ other: "keep", perfil_psicologico: { retrato: "Portrait", source: "evidence" } }} onUpdate={update} />);
    fireEvent.change(screen.getByDisplayValue("Portrait"), { target: { value: "Revised" } });
    expect(update).toHaveBeenCalledWith({ other: "keep", perfil_psicologico: { retrato: "Revised", source: "evidence" } });
  });
  it("merges all generated pain collections without losing previous values", () => {
    const update = vi.fn();
    render(<DoresTab projectId="project" avatar={{ other: "keep", medos: ["existing"] }} onUpdate={update} />);
    fireEvent.click(screen.getByText("Generate test pains"));
    expect(update).toHaveBeenCalledWith({ other: "keep", medos: ["existing", "fear"], dores_superficiais: ["surface"], dores_profundas: ["deep"] });
  });
  it("computes confidence only from numeric scores", () => {
    expect(computeAvatarHealthScore({ _avatar_meta: { one: { score: 80 }, two: { score: "unknown" }, three: null } })).toEqual({ avg: 80, total: 3, filled: 1 });
  });
});
