import { describe, expect, it } from "vitest";
import { extractAgentData } from "@/components/funis/map-agent-data";
import { readAgentStatus } from "@shared/project-map";

describe("registered map executor", () => {
  it("reads node configuration when legacy notes have no agent tags", () => {
    expect(extractAgentData(null, { executor_type: "AI_SKILL", linked_skill_id: "lp-persuasiva-v2" }))
      .toMatchObject({ executor: "AI_SKILL", skill: "lp-persuasiva-v2", status: "pending" });
  });
  it("preserves the explicit notes override used by MCP", () => {
    expect(extractAgentData("[agent_executor:human_traffic]\n[agent_skill:ads]\n[agent_status:ready_review]", {
      executor_type: "AI_SKILL", linked_skill_id: "copywriting",
    })).toMatchObject({ executor: "human_traffic", skill: "ads", status: "ready_review" });
  });
  it("does not infer execution from complete, partial or missing checklists", () => {
    for (const checklist of [undefined, [], [{ done: true }], [{ done: true }, { done: false }]]) {
      expect(extractAgentData(null, { checklist })).toMatchObject({ status: "pending", status_source: "not_declared", operationalEvidence: "unverified" });
    }
    expect(extractAgentData("[agent_status:running-unverified]")).toMatchObject({ status: "pending", status_source: "not_declared" });
  });
  it("keeps every explicit status declarative even with an output and a full checklist", () => {
    for (const status of ["pending", "in_progress", "ready_review", "done"]) {
      const notes = `[agent_status:${status}]\n[agent_output:https://output.test/file]`;
      expect(extractAgentData(notes, { checklist: [{ done: true }] })).toMatchObject({ ...readAgentStatus(notes), status, status_source: "notes", operationalEvidence: "unverified" });
    }
  });
  it("ignores examples in closed, unclosed and single-line prompts and preserves first tag precedence", () => {
    for (const notes of ["[agent_prompt_start]\n[agent_status:done]\n[agent_prompt_end]", "[agent_prompt_start]\n[agent_status:done]", "[agent_prompt:usar [agent_status:done]]"]) {
      expect(readAgentStatus(notes)).toMatchObject({ status: "pending", status_source: "not_declared" });
    }
    expect(readAgentStatus("[agent_status:ready_review]\n[agent_status:done]").status).toBe("ready_review");
    expect(readAgentStatus("[agent_status:invalid]\n[agent_status:done]").status).toBe("pending");
    expect(readAgentStatus("[agent_prompt:Revisar a página] [agent_status:done]")).toMatchObject({ status: "done", status_source: "notes" });
    expect(readAgentStatus("[agent_prompt:Exemplo [agent_status:pending]] [agent_status:done]")).toMatchObject({ status: "done", status_source: "notes" });
  });
  it("retains multiline playbooks without generating replacement instructions", () => {
    expect(extractAgentData("[agent_prompt_start]\nEntrada\nSaída\n[agent_prompt_end]").prompt).toBe("Entrada\nSaída");
    expect(extractAgentData(null).prompt).toBe("");
  });
});
