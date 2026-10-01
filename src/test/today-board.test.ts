import { describe, expect, it } from "vitest";
import { buildTodayBoard, mapLink, projectOfMaps, type BoardNode } from "@/lib/today-board";

const node = (over: Partial<BoardNode>): BoardNode => ({
  id: over.id ?? crypto.randomUUID(), map_id: "m-slim", label: "Etapa", kind: "processo", position: { x: 0, y: 0 }, ...over,
});

describe("today board", () => {
  it("only uses maps dedicated to a single project and lets unlinked steps inherit it", () => {
    const nodes = [
      node({ map_id: "m-slim", linked_project_id: "slimsoda" }),
      node({ map_id: "m-slim" }),
      node({ map_id: "m-master", linked_project_id: "slimsoda" }),
      node({ map_id: "m-master", linked_project_id: "jp_freitas" }),
    ];
    const owners = projectOfMaps(nodes);
    expect(owners.get("m-slim")).toBe("slimsoda");
    expect(owners.has("m-master")).toBe(false);
  });

  it("splits open steps between the team and the AI, ordered along the flow", () => {
    const nodes = [
      node({ id: "b", label: "Subir na BM", executor_type: "HUMAN_OPERATOR", linked_project_id: "slimsoda", position: { x: 500, y: 0 } }),
      node({ id: "a", label: "Briefs", executor_type: "AI_SKILL", linked_skill_id: "angulos-criativos", position: { x: 0, y: 0 } }),
      node({ id: "c", label: "Copy VSL", executor_type: "AI_SKILL", notes: "[agent_status:ready_review]", position: { x: 200, y: 0 } }),
      node({ id: "d", label: "Pixel", executor_type: "EXTERNAL_TOOL", checklist: [{ id: "1", text: "ok", done: true }], position: { x: 100, y: 0 } }),
      node({ id: "e", label: "Checkout", executor_type: "EXTERNAL_TOOL", position: { x: 300, y: 0 } }),
    ];
    const [board] = buildTodayBoard({
      projects: [{ id: "slimsoda", name: "SlimSoda" }, { id: "memoflow", name: "MemoFlow" }],
      nodes,
      salesToday: [
        { project_id: "slimsoda", valor: 27.49, data: { moeda: "USD" } },
        { project_id: "slimsoda", valor: 10, data: { moeda: "usd" } },
        { project_id: "jp_freitas", valor: 47, data: {} },
      ],
      leadsToday: [{ project_id: "slimsoda" }, { project_id: null }],
    });
    expect(board.projectId).toBe("slimsoda");
    expect(board.aiReady.map((s) => s.id)).toEqual(["a"]);
    expect(board.aiReady[0].skill).toBe("angulos-criativos");
    expect(board.waitingYou.map((s) => s.id)).toEqual(["e", "b"]);
    expect(board.review.map((s) => s.id)).toEqual(["c"]);
    expect(board.done).toBe(1);
    expect(board.total).toBe(5);
    expect(board.salesToday).toEqual({ count: 2, byCurrency: { USD: 37.49 } });
    expect(board.leadsToday).toBe(1);
  });

  it("skips projects without an operation map and builds a deep link to the step", () => {
    const boards = buildTodayBoard({ projects: [{ id: "x", name: "X" }], nodes: [], salesToday: [], leadsToday: [] });
    expect(boards).toEqual([]);
    expect(mapLink({ mapId: "m1", id: "n1" })).toBe("/funis?view=mapa&map=m1&node=n1");
  });
});
