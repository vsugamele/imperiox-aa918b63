import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ReferenceLibraryView } from "@/components/referencias/ReferenceLibraryView";
import { ProfilesMatrix } from "@/components/empresa/ProfilesMatrix";
import Plataformas from "@/pages/Plataformas";

const tables: Record<string, unknown[]> = {
  imphq_referencias: [{
    id: "centro-1", titulo: "R1 — Contestar o conhecido", url: "https://instagram.com/p/x", lote: "referencias-20260928-storyboard", duracao: 39.75,
    quadros: [{ seconds: 0.5, url: "https://cdn/f1.jpg" }, { seconds: 2.5, url: "https://cdn/f2.jpg" }],
    analise: { ordinal: 1, arquivo: "health.mp4", editorial: { primaryNiche: "Saúde digestiva", format: "Receita", topic: "Inchaço", transfer: "Conservar frase concreta + ação" },
      anatomy: { blocks: [{ kind: "hook", start: 0, end: 2, label: "Contraste", purpose: "parar o scroll" }] }, transcript: [{ start: 0, end: 2, text: "Você já tentou..." }] },
  }],
  imphq_profiles: [{ id: "p1", nome: "Brandonmikes · MemoFlow", project_id: "memoflow", email: "ipx@gmail.com", maquina: "6302", proxy: null, status: "bloqueado",
    canais: { instagram: { ref: "brandonmikeys", status: "unknown" }, facebook: { ref: "Bruno Leonardo", status: "unknown" } },
    paginas_facebook: [{ nome: "homelifeulid", ref: "x", status: "unknown" }, { nome: "ifeelgood", ref: "y", status: "unknown" }] }],
  imphq_projects: [{ id: "memoflow", name: "MemoFlow" }],
  imphq_empresa: [{ nome: "ipx@gmail.com", extra: { status_aquecimento: "Pronto" } }],
  imphq_cloud_phones: [],
};
const room = {
  gerado_em: new Date().toISOString(), rotinas: [], acoes: [], webhooks: [], anuncios: [], whatsapp: [{ projeto: "jp", instancia: "Suporte", ativo: true, status: "connected", visto: new Date().toISOString() }],
  instagram: [], voz: { ultimo_envio: null, ultima_falta_saldo: null, enviados_7d: 0 }, custo_ia_7d: [], fontes: [],
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: async () => ({ data: room, error: null }),
  functions: { invoke: async () => ({ data: { url: "https://signed/video.mp4" }, error: null }) },
  from: (table: string) => {
    const q = { select: () => q, eq: () => q, order: () => q, then: (r: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve(r({ data: tables[table] ?? [], error: null })) };
    return q;
  },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("telas trazidas do Centro de Comando", () => {
  it("biblioteca: quadros com tempo, ficha editorial e análise completa", async () => {
    render(<ReferenceLibraryView />);
    expect(await screen.findByText("01 · R1 — Contestar o conhecido")).toBeInTheDocument();
    expect(screen.getByText("1 referência(s) encontrada(s)")).toBeInTheDocument();
    expect(screen.getByText("2.50s")).toBeInTheDocument();
    expect(screen.getByText("Saúde digestiva · Receita")).toBeInTheDocument();
    expect(screen.getByText("Conservar frase concreta + ação")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Link da referência/ })).toHaveAttribute("href", "https://instagram.com/p/x");
    fireEvent.click(screen.getByRole("button", { name: "Examinar análise" }));
    expect(await screen.findByText(/Contraste/)).toBeInTheDocument();
    expect(screen.getByText("Você já tentou...")).toBeInTheDocument();
  });

  it("matriz de perfis: canais, páginas e status de aquecimento do e-mail", async () => {
    render(<ProfilesMatrix />);
    expect(await screen.findByText("Brandonmikes · MemoFlow")).toBeInTheDocument();
    expect(screen.getByText("MemoFlow")).toBeInTheDocument();
    expect(screen.getByText("Empresa: Pronto")).toBeInTheDocument();
    expect(screen.getByText("brandonmikeys")).toBeInTheDocument();
    expect(screen.getByText("2 cadastrada(s)")).toBeInTheDocument();
    expect(screen.getAllByText("Sem vínculo")).toHaveLength(2);
  });

  it("plataformas: resumo e cartões por categoria com estado real", async () => {
    render(<QueryClientProvider client={new QueryClient()}><Plataformas /></QueryClientProvider>);
    expect(await screen.findByText("WhatsApp (Evolution)")).toBeInTheDocument();
    expect(screen.getByText("O que podemos usar, como operar e o que falta.")).toBeInTheDocument();
    expect(screen.getByText("CRM e conversas")).toBeInTheDocument();
    expect(screen.getAllByText("Operacional").length).toBeGreaterThan(0);
  });
});
