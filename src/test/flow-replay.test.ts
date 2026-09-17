import { describe, expect, it } from "vitest";
import { flowReplayBody } from "@/lib/flow-replay";

const exec = { lead_id: "lead-1", project_id: "project-1", trigger_tipo: "manual", automacao_id: "flow-1" };
const lead = { id: "lead-1", project_id: "project-1", nome: "Lead", phone: "123", email: "", tags: [], data: { lead_id: "stale", phone: "old", custom: "retained" } };
describe("flow replay identity", () => {
  it("uses the selected lead and executor resume contract", () => {
    const body = flowReplayBody(exec, lead, 3);
    expect(body.resume_from_step).toBe(3);
    expect(body).not.toHaveProperty("start_from_step");
    expect(body.lead_data).toMatchObject({ lead_id: "lead-1", phone: "123", custom: "retained" });
  });
  it("rejects a different lead or project instead of replaying another contact", () => {
    expect(() => flowReplayBody(exec, { ...lead, id: "other" })).toThrow();
    expect(() => flowReplayBody(exec, { ...lead, project_id: "other" })).toThrow();
    expect(() => flowReplayBody(exec, null)).toThrow();
  });
});
