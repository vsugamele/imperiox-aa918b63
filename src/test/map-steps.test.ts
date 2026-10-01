import { describe, expect, it } from "vitest";
import { executorGroup, readAgentNotes, stepSkill, stepStatus, writeAgentNotes } from "@shared/map-steps";

describe("map steps", () => {
  it("reads and rewrites agent markers without losing free text", () => {
    const notes = "Briefing do anúncio.\n\n[agent_executor:ai_higgsfield]\n[agent_status:in_progress]\n[agent_prompt_start]\nGerar 3 criativos\n[agent_prompt_end]";
    expect(readAgentNotes(notes)).toMatchObject({ executor: "ai_higgsfield", status: "in_progress", prompt: "Gerar 3 criativos" });
    const updated = writeAgentNotes(notes, { status: "done" });
    expect(updated.startsWith("Briefing do anúncio.")).toBe(true);
    expect(readAgentNotes(updated)).toMatchObject({ executor: "ai_higgsfield", status: "done", prompt: "Gerar 3 criativos" });
    expect(writeAgentNotes("só texto", { status: "pending" })).toBe("só texto");
  });

  it("ignores unknown status markers", () => {
    expect(readAgentNotes("[agent_status:quase]").status).toBe("pending");
  });

  it("derives status from marker first, then checklist", () => {
    const list = (done: boolean[]) => done.map((d, i) => ({ id: String(i), text: "x", done: d }));
    expect(stepStatus({ notes: "[agent_status:ready_review]", checklist: list([true, true]) })).toBe("ready_review");
    expect(stepStatus({ checklist: list([true, true]) })).toBe("done");
    expect(stepStatus({ checklist: list([true, false]) })).toBe("in_progress");
    expect(stepStatus({ checklist: list([false]) })).toBe("pending");
    expect(stepStatus({ checklist: null })).toBe("pending");
  });

  it("groups every executor vocabulary already saved in the maps", () => {
    const g = (executor_type: string | null, notes?: string) => executorGroup({ executor_type, notes });
    expect(g("AI_SKILL")).toBe("ia");
    expect(g("agente_ia")).toBe("ia");
    expect(g("API_AUTONOMOUS")).toBe("automatico");
    expect(g("EXTERNAL_TOOL")).toBe("ferramenta");
    expect(g("HUMAN_OPERATOR")).toBe("humano");
    expect(g("humano")).toBe("humano");
    expect(g("hibrido")).toBe("humano");
    expect(g(null)).toBe("humano");
    expect(g("HUMAN_OPERATOR", "[agent_executor:ai_copywriter]")).toBe("ia");
  });

  it("prefers the skill marker over the linked skill", () => {
    expect(stepSkill({ linked_skill_id: "rebel-copy" })).toBe("rebel-copy");
    expect(stepSkill({ linked_skill_id: "rebel-copy", notes: "[agent_skill:vsl-filemon]" })).toBe("vsl-filemon");
    expect(stepSkill({})).toBeNull();
  });
});
