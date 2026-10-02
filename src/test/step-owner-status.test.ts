import { describe, expect, it } from "vitest";
import { readStepStatus } from "@shared/project-map";
import { addDays, dueState, firstName, needsConfirmation, stepStatus } from "@shared/map-steps";
import { buildTodayBoard, filterBoardByOwner, matchesOwner } from "@/lib/today-board";

describe("status da etapa em coluna (UX1.1)", () => {
  it("a coluna vence a marcação nas notas; sem coluna, vale a marcação declarada", () => {
    expect(readStepStatus({ step_status: "done", notes: "[agent_status:in_progress]" })).toMatchObject({ status: "done", status_source: "column" });
    expect(readStepStatus({ step_status: null, notes: "[agent_status:in_progress]" })).toMatchObject({ status: "in_progress", status_source: "notes" });
    expect(readStepStatus({ step_status: "inventado", notes: "" })).toMatchObject({ status: "pending", status_source: "not_declared" });
  });

  it("pendente declarado na coluna não pede confirmação, mesmo com checklist completa", () => {
    const checklist = [{ text: "a", done: true }];
    expect(needsConfirmation({ checklist })).toBe(true);
    expect(needsConfirmation({ checklist, step_status: "pending" })).toBe(false);
    expect(stepStatus({ step_status: "ready_review" })).toBe("ready_review");
  });
});

describe("prazo", () => {
  it("classifica atrasada, hoje, em breve e no prazo; etapa feita não atrasa", () => {
    const today = "2026-10-02";
    expect(dueState("2026-10-01", today)).toBe("atrasada");
    expect(dueState("2026-10-02", today)).toBe("hoje");
    expect(dueState("2026-10-05", today)).toBe("em_breve");
    expect(dueState("2026-10-06", today)).toBe("futura");
    expect(dueState("2026-10-01", today, "done")).toBeNull();
    expect(dueState(null, today)).toBeNull();
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(firstName("  Bruno Souza ")).toBe("Bruno");
  });
});

describe("quadro por pessoa", () => {
  const boards = buildTodayBoard({
    today: "2026-10-02",
    projects: [{ id: "slimsoda", name: "SlimSoda" }],
    nodes: [
      { id: "a", map_id: "m1", label: "Subir na BM", kind: "meta_ads", executor_type: "HUMAN_OPERATOR", linked_project_id: "slimsoda", owner_member_id: "bruno", due_date: "2026-10-05", position: { x: 0, y: 0 } },
      { id: "b", map_id: "m1", label: "Revisar copy", kind: "doc", executor_type: "HUMAN_OPERATOR", owner_member_id: "vini", due_date: "2026-10-01", position: { x: 100, y: 0 } },
      { id: "c", map_id: "m1", label: "Comprar domínio", kind: "processo", executor_type: "HUMAN_OPERATOR", position: { x: 200, y: 0 } },
      { id: "d", map_id: "m1", label: "Briefs", kind: "doc", executor_type: "AI_SKILL", position: { x: 300, y: 0 } },
    ],
    salesToday: [],
    leadsToday: [],
  });
  const board = boards[0];

  it("o atrasado sobe na fila e cada etapa traz dono e situação do prazo", () => {
    expect(board.waitingYou.map((s) => s.label)).toEqual(["Revisar copy", "Subir na BM", "Comprar domínio"]);
    expect(board.waitingYou[0]).toMatchObject({ ownerId: "vini", dueState: "atrasada" });
  });

  it("filtra por pessoa e por sem dono (etapa de IA não entra em sem dono)", () => {
    expect(filterBoardByOwner(board, "bruno").waitingYou.map((s) => s.id)).toEqual(["a"]);
    expect(filterBoardByOwner(board, "sem_dono").waitingYou.map((s) => s.id)).toEqual(["c"]);
    expect(filterBoardByOwner(board, "sem_dono").aiReady).toEqual([]);
    expect(filterBoardByOwner(board, "todos")).toBe(board);
    expect(matchesOwner(board.aiReady[0], "todos")).toBe(true);
    // Progresso do projeto não muda com o filtro.
    expect(filterBoardByOwner(board, "bruno").total).toBe(board.total);
  });
});
