import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildOutline, filterOutline, isKnowledgeMap } from "@/lib/map-outline";
import { MapOutlineView } from "@/components/funis/MapOutlineView";

const doc = (id: string, label: string, y: number, extra: Record<string, unknown> = {}) => ({ id, label, kind: "doc", position: { x: 0, y }, ...extra });
const nodes = [
  doc("root", "DotCom Secrets", 0),
  doc("s2", "SEÇÃO 2 — Funis da Escada de Valor", 200),
  doc("s1", "SEÇÃO 1 — Segredos dos Funis", 100, { description: "A escada de valor" }),
  doc("a", "Segredo #1", 110), doc("b", "Segredo #2", 120), doc("c", "Funil de quiz", 210),
  doc("solto", "Anotação solta", 900),
];
const edges = [
  { source: "root", target: "s1" }, { source: "root", target: "s2" },
  { source: "s1", target: "a" }, { source: "s1", target: "b" }, { source: "s2", target: "c" },
  { source: "a", target: "s1" }, // ciclo: ignorado
  { source: "s2", target: "a" }, // segundo pai: fica sob o primeiro
];

describe("mapa de conhecimento em lista", () => {
  it("detecta mapa de livro, monta a árvore pela ordem visual e corta ciclos", () => {
    expect(isKnowledgeMap(Array.from({ length: 25 }, () => ({ kind: "doc" })))).toBe(true);
    expect(isKnowledgeMap([...Array.from({ length: 15 }, () => ({ kind: "doc" })), ...Array.from({ length: 10 }, () => ({ kind: "checkout" }))])).toBe(false);
    expect(isKnowledgeMap(Array.from({ length: 5 }, () => ({ kind: "doc" })))).toBe(false);
    const tree = buildOutline(nodes, edges);
    expect(tree.map((t) => t.id)).toEqual(["root", "solto"]);
    expect(tree[0].children.map((c) => c.id)).toEqual(["s1", "s2"]);
    expect(tree[0].children[0].children.map((c) => c.id)).toEqual(["a", "b"]);
    expect(tree[0].total).toBe(5);
    const f = filterOutline(tree, "quiz");
    expect(f.map((t) => t.id)).toEqual(["root"]);
    expect(f[0].children.map((c) => c.id)).toEqual(["s2"]);
  });

  it("abre e fecha seções, busca e leva ao cartão no mapa", () => {
    const onOpen = vi.fn();
    render(<MapOutlineView title="Bookmap — DotCom Secrets" nodes={nodes} edges={edges} onOpen={onOpen} />);
    const root = screen.getByRole("treeitem", { name: "DotCom Secrets" });
    expect(root).toHaveAttribute("aria-expanded", "true"); // raiz única já vem aberta
    expect(screen.queryByText("Segredo #1")).not.toBeInTheDocument();
    fireEvent.click(within(root).getByText("SEÇÃO 1 — Segredos dos Funis"));
    expect(screen.getByText("Segredo #1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar no mapa"), { target: { value: "quiz" } });
    expect(screen.getByText("Funil de quiz")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("treeitem", { name: "Funil de quiz" })).getByRole("button", { name: /Ver no mapa/ }));
    expect(onOpen).toHaveBeenCalledWith("c");
  });
});
