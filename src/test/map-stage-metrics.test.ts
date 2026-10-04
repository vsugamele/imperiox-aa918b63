import { describe, expect, it } from "vitest";
import { nodeMetricSnapshot, pageSnapshots, type ProjectMetricSnapshot } from "@/lib/map-stage-metrics";

const project = (count: number): ProjectMetricSnapshot => ({
  values: { sessoes_pagina: 999, cpa: count * 10 },
  refs: { cpaAlvo: count * 10 },
  pages: [{ url: "same.test/vsl", sources: ["funnel", "legacy"], values: { sessoes_pagina: count }, lastEventAt: null }],
  updatedAt: "2026-10-04T20:00:00Z",
});
const node = { linked_project_id: "slimsoda", url: "https://same.test/vsl.html?utm=x", metrics_target: { key: "sessoes_pagina" } };

describe("page-stage attribution (MAP2.4)", () => {
  it("uses the project's exact URL counter instead of another project's or a project total", () => {
    const projects = { slimsoda: project(4), memoflow: project(9) };
    expect(nodeMetricSnapshot(node, projects).values.sessoes_pagina).toBe(4);
    expect(nodeMetricSnapshot({ ...node, linked_project_id: "memoflow" }, projects).values.sessoes_pagina).toBe(9);
    expect(nodeMetricSnapshot(node, projects).source).toBe("Tracker do funil + Tracker anterior");
  });

  it("distinguishes measured zero, missing URL and a read failure without inheriting totals", () => {
    const projects = { slimsoda: project(0) };
    expect(nodeMetricSnapshot(node, projects)).toMatchObject({ status: "ready", values: { sessoes_pagina: 0 } });
    expect(nodeMetricSnapshot({ ...node, url: "https://unknown.test" }, projects)).toMatchObject({ status: "missing", values: {} });
    expect(nodeMetricSnapshot(node, { slimsoda: { ...project(9), error: "unavailable" } })).toMatchObject({ status: "error", values: {} });
  });

  it("keeps project metrics and scale references attached to that project only", () => {
    const result = nodeMetricSnapshot({ ...node, metrics_target: { key: "cpa" } }, { slimsoda: project(4), memoflow: project(9) });
    expect(result).toMatchObject({ scope: "projeto", values: { cpa: 40 }, refs: { cpaAlvo: 40 } });
    expect(result.values.sessoes_pagina).toBeUndefined();
    expect(nodeMetricSnapshot({ ...node, linked_project_id: null }, { slimsoda: project(4) }).values).toEqual({});
  });

  it("does not invent values from malformed RPC responses or unavailable metric sources", () => {
    expect(pageSnapshots({ pages: [{ url: "https://same.test", values: { sessoes_pagina: "not-a-number", cliques_cta: null } }] })[0].values)
      .toEqual({ sessoes_pagina: null, cliques_cta: null });
    expect(nodeMetricSnapshot({ ...node, metrics_target: { key: "youtube_ctr" } }, { slimsoda: project(4) }))
      .toMatchObject({ status: "missing", source: "Fonte indisponível" });
  });
});
