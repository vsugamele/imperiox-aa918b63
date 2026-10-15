import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ALL_NAV_ITEMS, LABORATORIO, MENU, routeKey } from "@/lib/navigation";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { CommandPalette } from "@/components/CommandPalette";

const appRoutes = new Set(
  [...readFileSync(resolve(__dirname, "../App.tsx"), "utf8").matchAll(/path="([^"]+)"/g)].map((m) => `/${m[1].replace(/^\//, "")}`),
);

describe("menu por tarefa (UX1.1)", () => {
  it("toda tela do menu e do Laboratório é uma rota que existe", () => {
    for (const i of ALL_NAV_ITEMS) expect(appRoutes.has(i.url), `${i.title} → ${i.url}`).toBe(true);
  });

  it("menu enxuto, sem repetição entre menu e Laboratório", () => {
    const menu = MENU.flatMap((g) => g.items.map((i) => i.url));
    expect(menu.length).toBeLessThanOrEqual(26);
    expect(new Set(menu).size).toBe(menu.length);
    expect(LABORATORIO.some((l) => menu.includes(l.url))).toBe(false);
    expect(LABORATORIO.every((l) => l.motivo.length > 0)).toBe(true);
  });

  it("rota normalizada troca ids por :id", () => {
    expect(routeKey("/projetos/3c368b42-5b73-4d86-a1cd-35c3022b142d")).toBe("/projetos/:id");
    expect(routeKey("/leads/123?x=1")).toBe("/leads/:id");
    expect(routeKey("/funis/linfaflow-x1")).toBe("/funis/linfaflow-x1");
    expect(routeKey("/")).toBe("/");
  });
});

describe("projeto atual compartilhado", () => {
  it("o seletor global vale para todas as telas abertas", () => {
    localStorage.clear();
    const a = renderHook(() => useGlobalProject());
    const b = renderHook(() => useGlobalProject());
    expect(a.result.current.projectId).toBeNull();
    act(() => a.result.current.setProjectId("jp_freitas"));
    expect(b.result.current.projectId).toBe("jp_freitas");
    act(() => b.result.current.setProjectId(null));
    expect(a.result.current.projectId).toBeNull();
  });
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ações rápidas ⌘J", () => {
  it("telas do Laboratório aparecem em 'Ir para' ao digitar", () => {
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Abrir ações rápidas (Cmd+J)"));
    fireEvent.change(screen.getByPlaceholderText(/O que você quer fazer/), { target: { value: "market" } });
    expect(screen.getByText("Ir para")).toBeInTheDocument();
    expect(screen.getByText("/market-intel · no Laboratório")).toBeInTheDocument();
  });
});
