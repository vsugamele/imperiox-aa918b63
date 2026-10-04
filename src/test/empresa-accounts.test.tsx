import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Empresa from "@/pages/Empresa";

const account = { id: "acc-1", nome: "conta@gmail.com", tipo: "email", valor: null, extra: { senha_ref: "ref-1", telefone: "+55 11 9", status_aquecimento: "Pronto", bio: "manter" } };
const rpc = vi.fn(async (name: string) => (name === "imphq_reveal_account_secret" ? { data: "segredo-123", error: null } : { data: null, error: null }));
const updates: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: (name: string, args: unknown) => rpc(name, args),
  from: (table: string) => {
    const rows = table === "imphq_empresa" ? [account] : [];
    const q = {
      select: () => q, order: () => q, eq: () => q, single: () => Promise.resolve({ data: { id: "acc-1" }, error: null }),
      update: (payload: Record<string, unknown>) => { updates.push(payload); return q; },
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    };
    return q;
  },
  storage: { from: () => ({}) },
} }));
vi.mock("@/components/empresa/AdAccountsTab", () => ({ AdAccountsTab: () => null }));
vi.mock("@/components/empresa/ZernioTab", () => ({ ZernioTab: () => null }));
vi.mock("@/components/empresa/FarmTab", () => ({ FarmTab: () => null }));
vi.mock("@/components/empresa/DevicesTab", () => ({ DevicesTab: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Empresa → contas de e-mail", () => {
  it("reveals the password from the vault on demand and never preloads it", async () => {
    render(<MemoryRouter><Empresa /></MemoryRouter>);
    expect(await screen.findByText("conta@gmail.com")).toBeInTheDocument();
    expect(screen.queryByText("segredo-123")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-eye"))!);
    expect(await screen.findByText("segredo-123")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("imphq_reveal_account_secret", { p_account_id: "acc-1", p_kind: "senha" });
  });

  it("edit modal scrolls inside, keeps Save visible, groups fields and keeps the vault reference when saving", async () => {
    updates.length = 0;
    render(<MemoryRouter><Empresa /></MemoryRouter>);
    await screen.findByText("conta@gmail.com");
    fireEvent.click(screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-pencil"))!);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("max-h-[90vh]");
    expect(screen.getByText("Conta")).toBeInTheDocument();
    expect(screen.getByText("Uso")).toBeInTheDocument();
    expect(screen.getByText(/Avançado: foto, proxy e GeeLark/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Guardada no Cofre — em branco mantém")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(updates).toHaveLength(1));
    const extra = updates[0].extra as Record<string, unknown>;
    expect(extra.senha_ref).toBe("ref-1");
    expect(extra.bio).toBe("manter");
    expect(extra).not.toHaveProperty("senha");
    expect(rpc).not.toHaveBeenCalledWith("imphq_set_account_secret", expect.anything());
  });
});
