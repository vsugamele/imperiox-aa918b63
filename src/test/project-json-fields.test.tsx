import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjetoLinks } from "@/components/projeto/ProjetoLinks";
import { ProjetoPipeline } from "@/components/projeto/ProjetoPipeline";

vi.mock("@/components/ui/slider", () => ({ Slider: () => null }));

describe("project JSON editing", () => {
  it("adds a valid link while preserving other project fields", () => {
    const update = vi.fn();
    render(<ProjetoLinks project={{ data: { branding: { voice: "calm" }, links: [{ label: "Site", url: "https://example.com" }] } }} onUpdateData={update} />);
    fireEvent.change(screen.getByPlaceholderText("Nome do link"), { target: { value: "Checkout" } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com/buy" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(update).toHaveBeenCalledWith({ branding: { voice: "calm" }, links: [{ label: "Site", url: "https://example.com" }, { label: "Checkout", url: "https://example.com/buy" }] });
  });

  it("keeps pipeline notes and unrelated data when updating a note", () => {
    const update = vi.fn();
    render(<ProjetoPipeline project={{ pipeline: { avatar: 25 }, data: { other: "keep", pipeline_notes: { avatar: "before", copy: "existing" } } }} onUpdateData={update} onUpdatePipeline={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue("before"), { target: { value: "after" } });
    expect(update).toHaveBeenCalledWith({ other: "keep", pipeline_notes: { avatar: "after", copy: "existing" } });
  });
});
