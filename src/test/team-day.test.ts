import { describe, expect, it } from "vitest";
import { buildTodayBoard } from "@shared/today-board";
import { buildTeamDaySection } from "@shared/team-day";

const team = [{ id: "vini", name: "Vinicius Sugamele" }, { id: "bruno", name: "Bruno" }];

describe("resumo 'Dia de cada um'", () => {
  it("lista por pessoa com o atrasado primeiro, conta sem dono e IA, e linka o Hoje", () => {
    const boards = buildTodayBoard({
      today: "2026-10-02",
      projects: [{ id: "slimsoda", name: "SlimSoda" }],
      nodes: [
        { id: "a", map_id: "m1", label: "Subir na BM", kind: "meta_ads", executor_type: "HUMAN_OPERATOR", linked_project_id: "slimsoda", owner_member_id: "bruno", position: { x: 0, y: 0 } },
        { id: "b", map_id: "m1", label: "Checkout", kind: "checkout", executor_type: "HUMAN_OPERATOR", owner_member_id: "bruno", due_date: "2026-09-30", position: { x: 10, y: 0 } },
        { id: "c", map_id: "m1", label: "Comprar domínio", kind: "processo", executor_type: "HUMAN_OPERATOR", position: { x: 20, y: 0 } },
        { id: "d", map_id: "m1", label: "Briefs", kind: "doc", executor_type: "AI_SKILL", position: { x: 30, y: 0 } },
      ],
      salesToday: [],
      leadsToday: [],
    });
    const text = buildTeamDaySection(boards, team, "https://imperiox.vercel.app/").join("\n");
    expect(text).toContain("👤 *Vinicius* — nada pendente");
    expect(text).toContain("👤 *Bruno* — 2 etapa(s) (1 atrasada)");
    expect(text.indexOf("Checkout (SlimSoda) — ⏰ venceu 30/09")).toBeLessThan(text.indexOf("Subir na BM"));
    expect(text).toContain("❔ *Sem dono:* 1 etapa(s)");
    expect(text).toContain("🤖 *IA pode executar:* 1 etapa(s)");
    expect(text).toContain("🔗 https://imperiox.vercel.app/hoje");
  });
});
