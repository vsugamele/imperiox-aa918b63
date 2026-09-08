import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toNativeCinnaFlow } from "@/lib/cinna-shield-x1/openflow";
import { validateFlow } from "@/components/openflow/flow-editor/validate";
import { openFlowActionSchema } from "@/lib/openflow-action-schema";
const flow = () => toNativeCinnaFlow(JSON.parse(readFileSync(resolve(process.cwd(), "scripts/cinna-shield-x1/flow.yaml"), "utf8")), "google/gemini-2.5-flash");
describe("Cinna native editor validation", () => {
  it("preserves nine stages, approved replies and choices in the action schema", () => {
    const actions = flow();
    expect(validateFlow(actions).filter(issue => issue.severity === "error")).toEqual([]);
    for (const action of actions) expect(openFlowActionSchema.parse(action)).toEqual(action);
  });
  it("rejects removal of a response stage", () => {
    const actions = flow();
    actions.splice(actions.findIndex(action => action.cinna_stage), 1);
    expect(validateFlow(actions).some(issue => issue.severity === "error")).toBe(true);
  });
  it("rejects incomplete offer approval and duplicated stage identity", () => {
    const actions = flow();
    const waits = actions.filter(action => action.cinna_stage);
    waits[0].cinna_policy!.offer.approved = true;
    waits[1].cinna_stage!.id = waits[0].cinna_stage!.id;
    expect(validateFlow(actions).some(issue => issue.severity === "error")).toBe(true);
  });
  it("leaves ordinary wait_reply flows valid", () => {
    expect(validateFlow([{ tipo: "wait_reply", template: "", delay_min: 0 }])).toEqual([]);
  });
});
