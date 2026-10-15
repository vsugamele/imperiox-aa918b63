import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Fabrica from "@/pages/Fabrica";

let projectId: string | null = "jp_freitas";
vi.mock("@/hooks/useGlobalProject", () => ({
  useGlobalProject: () => ({ projectId, setProjectId: vi.fn() }),
  useGlobalProjectList: () => ({ data: [{ id: "jp_freitas", name: "JP Freitas", icon: null, category: null }] }),
}));
vi.mock("@/hooks/useFactoryStatus", () => ({
  useFactoryStatus: () => ({ isLoading: false, error: null, data: {
    elenco: { visual: 0, comFoto: 0, persona: 0 },
    mercado: { referencias: 11, classificadas: 11, fontes: 0 },
    levas: { planejadas: 0, aprovadas: 0, gerando: 0, prontas: 0 },
    testes: { noAr: 1, total: 1 },
    placar: { vencedores: 1, moldes: 0 },
  } }),
}));
vi.mock("@/components/studio/CastTab", () => ({ CastTab: () => <div>painel elenco</div> }));
vi.mock("@/components/estrategias/MiningSources", () => ({ MiningSources: () => <div>painel mineração</div> }));
vi.mock("@/components/testes/NextBatchPanel", () => ({ NextBatchPanel: () => <div>painel leva</div> }));

describe("Fábrica de criativos", () => {
  it("mostra os 6 passos do projeto do topo, com o próximo passo em destaque", () => {
    render(<MemoryRouter><Fabrica /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fábrica de criativos · JP Freitas");
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Próximo passo" })).toHaveTextContent("Elenco: Sugerir o elenco com IA");
    expect(screen.getByRole("link", { name: /Passo 5 Teste no ar/ })).toHaveTextContent("1 teste(s) no ar de 1");
    expect(screen.getByText("painel elenco")).toBeInTheDocument();
    expect(screen.getByText("painel leva")).toBeInTheDocument();
  });

  it("sem projeto escolhido, pede para escolher no topo", () => {
    projectId = null;
    render(<MemoryRouter><Fabrica /></MemoryRouter>);
    expect(screen.getByText(/Escolha o projeto no seletor do topo/)).toBeInTheDocument();
    expect(screen.queryByText("painel elenco")).toBeNull();
  });
});
