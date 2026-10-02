import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CapabilitiesCatalog } from "@/components/skills/CapabilitiesCatalog";

const base = { descricao: null, licenca_nota: null, fonte: "x", created_at: "", updated_at: "", url: null };
const CAPS = [
  { ...base, id: "satori", nome: "Satori", categoria: "Imagem", quando_usar: "Criativos estáticos em série", serve_para: ["criativo_imagem"], prioridade: "alta", skills: ["angulos-criativos"], ativo: true },
  { ...base, id: "d3", nome: "D3.js", categoria: "Gráficos", quando_usar: "Gráfico sob medida", serve_para: ["dashboard"], prioridade: "baixa", skills: [], ativo: true },
  { ...base, id: "old-lib", nome: "Old Lib", categoria: "Motion", quando_usar: null, serve_para: [], prioridade: "media", skills: [], ativo: false },
];
const SKILLS = [{ slug: "angulos-criativos", nome: "Angulos Criativos" }, { slug: "vsl-filemon", nome: "VSL Filemon" }];

const updates: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const rows = table === "imphq_skills" ? SKILLS : CAPS;
  let pending: Record<string, unknown> | null = null;
  const query = {
    select: () => query, order: () => query, not: () => query, eq: () => query,
    update: (payload: Record<string, unknown>) => { pending = payload; updates.push(payload); return query; },
    single: () => Promise.resolve({ data: { ...CAPS[0], ...pending }, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
  };
  return query;
} } }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("capabilities catalog", () => {
  it("lists active tools high priority first, with linked skill names, and hides inactive ones", async () => {
    render(<CapabilitiesCatalog />);
    expect(await screen.findByText("Satori")).toBeInTheDocument();
    expect(screen.getByText("Angulos Criativos")).toBeInTheDocument();
    expect(screen.queryByText("Old Lib")).not.toBeInTheDocument();
    const names = screen.getAllByText(/^(Satori|D3\.js)$/).map((el) => el.textContent);
    expect(names).toEqual(["Satori", "D3.js"]);
    expect(screen.getByText("2 ativas · 1 com skill")).toBeInTheDocument();
  });

  it("filters by text", async () => {
    render(<CapabilitiesCatalog />);
    await screen.findByText("Satori");
    fireEvent.change(screen.getByPlaceholderText("Buscar ferramenta..."), { target: { value: "gráfico" } });
    expect(screen.queryByText("Satori")).not.toBeInTheDocument();
    expect(screen.getByText("D3.js")).toBeInTheDocument();
  });

  it("links a skill to a tool and saves the skill slugs", async () => {
    updates.length = 0;
    render(<CapabilitiesCatalog />);
    await screen.findByText("Satori");
    fireEvent.click(screen.getByLabelText("Editar Satori"));
    fireEvent.click(await screen.findByText("VSL Filemon"));
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toMatchObject({ nome: "Satori", skills: ["angulos-criativos", "vsl-filemon"], ativo: true });
  });
});
