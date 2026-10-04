import { describe, expect, it } from "vitest";
import { edgeVolume, flowMetricFor, flowMotion, nodeVolumes, normalizeUrl, sessionsByUrl } from "@shared/flow-volume";
import { newSales } from "@/lib/sale-watch";

describe("volume real nas setas (UX1.4)", () => {
  it("normaliza URL e conta sessões distintas", () => {
    expect(normalizeUrl("https://www.Slim-Soda01.vercel.app/slimsoda-pdp.html?utm=x#a")).toBe("slim-soda01.vercel.app/slimsoda-pdp");
    expect(normalizeUrl("https://slimsoda-two.vercel.app/")).toBe("slimsoda-two.vercel.app");
    const s = sessionsByUrl([
      { page_url: "https://a.com/p?x=1", session_id: "s1" }, { page_url: "https://a.com/p", session_id: "s1" },
      { page_url: "https://a.com/p.html", session_id: "s2" }, { page_url: null, session_id: "s3" },
    ]);
    expect(s.get("a.com/p")).toBe(2);
  });

  it("cada etapa mede o que faz sentido; seta usa o destino e, sem ele, a origem", () => {
    expect(flowMetricFor({ id: "1", kind: "pagina_vendas", url: "https://a.com/p" })).toBe("sessoes");
    expect(flowMetricFor({ id: "1", kind: "pagina_vendas" })).toBeNull();
    expect(flowMetricFor({ id: "1", kind: "checkout" })).toBe("vendas");
    expect(flowMetricFor({ id: "1", kind: "meta_ads" })).toBeNull();
    const vols = nodeVolumes(
      [{ id: "p", kind: "pagina_vendas", url: "https://a.com/p" }, { id: "c", kind: "checkout" }, { id: "ad", kind: "meta_ads" }],
      { sessions: new Map([["a.com/p", 12]]), byProject: { slim: { conversas: 0, vendas: 3, leads: 0 } }, mapProjectId: "slim" },
    );
    expect(edgeVolume(vols, "ad", "p")).toEqual({ metric: "sessoes", value: 12 });
    expect(edgeVolume(vols, "p", "c")).toEqual({ metric: "vendas", value: 3 });
    expect(edgeVolume(vols, "ad", "x")).toBeNull();
  });

  it("sem volume a seta fica parada; mais volume, mais partículas e mais rápidas", () => {
    expect(flowMotion(0)).toEqual({ particles: 0, durationSec: 0 });
    expect(flowMotion(1).particles).toBe(1);
    expect(flowMotion(12).particles).toBe(3);
    expect(flowMotion(500).durationSec).toBeLessThan(flowMotion(2).durationSec);
  });

  it("isolates page volume by project and distinguishes an unseen URL from measured zero", () => {
    const vols = nodeVolumes([
      { id: "a", kind: "vsl", url: "https://same.test", linked_project_id: "slimsoda" },
      { id: "b", kind: "vsl", url: "https://same.test", linked_project_id: "memoflow" },
      { id: "unseen", kind: "vsl", url: "https://missing.test", linked_project_id: "slimsoda" },
    ], { sessions: new Map([["same.test", 99]]), byProject: {},
      pageSessionsByProject: { slimsoda: new Map([["same.test", 0]]), memoflow: new Map([["same.test", 7]]) } });
    expect(vols.get("a")?.value).toBe(0);
    expect(vols.get("b")?.value).toBe(7);
    expect(vols.has("unseen")).toBe(false);
  });
});

describe("aviso de venda nova", () => {
  it("a primeira leitura não avisa; depois só avisa venda recente e nunca repete", () => {
    const seen = new Set<string>();
    const now = Date.parse("2026-10-02T15:00:00Z");
    const old = { id: "v1", project_id: "slimsoda", valor: 49, produto_nome: "Kit", data: null, created_at: "2026-10-02T14:00:00Z" };
    expect(newSales([old], seen, false, now)).toEqual([]);
    const fresh = { ...old, id: "v2" };
    const stale = { ...old, id: "v3", created_at: "2026-10-02T10:00:00Z" };
    expect(newSales([fresh, stale, old], seen, true, now).map((s) => s.id)).toEqual(["v2"]);
    expect(newSales([fresh], seen, true, now)).toEqual([]);
  });
});
