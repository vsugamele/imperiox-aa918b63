import { describe, expect, it } from "vitest";
import { orderSteps } from "@shared/map-order";

const n = (id: string, x: number, y: number, kind = "processo") => ({ id, kind, position: { x, y } });
const e = (source: string, target: string) => ({ source, target });
const asList = (m: Map<string, number>) => [...m.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

describe("orderSteps", () => {
  it("follows the arrows before the position on the canvas", () => {
    // checkout está à esquerda, mas vem depois da página pela seta
    const nodes = [n("checkout", 0, 0), n("anuncio", 300, 0), n("pagina", 600, 0)];
    expect(asList(orderSteps(nodes, [e("anuncio", "pagina"), e("pagina", "checkout")]))).toEqual(["anuncio", "pagina", "checkout"]);
  });

  it("uses rows top-to-bottom and left-to-right when nothing connects the steps", () => {
    const nodes = [n("b", 400, 10), n("c", 0, 500), n("a", 0, 40)];
    expect(asList(orderSteps(nodes, []))).toEqual(["a", "b", "c"]);
  });

  it("leaves hub/area/image cards unnumbered and ignores their arrows", () => {
    const nodes = [n("hub", 0, 0, "vertical"), n("produto", 300, 0, "oferta"), n("img", 0, 300, "imagem")];
    const order = orderSteps(nodes, [e("hub", "produto"), e("img", "produto")]);
    expect(order.has("hub")).toBe(false);
    expect(order.has("img")).toBe(false);
    expect(order.get("produto")).toBe(1);
  });

  it("still numbers every step inside a cycle", () => {
    const nodes = [n("x", 0, 0), n("y", 300, 0), n("z", 600, 0)];
    const order = orderSteps(nodes, [e("x", "y"), e("y", "z"), e("z", "x")]);
    expect(asList(order)).toEqual(["x", "y", "z"]);
  });
});
