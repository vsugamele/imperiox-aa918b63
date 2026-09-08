import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileNativeCinna } from "@/lib/cinna-shield-x1/native-contract";
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
  it("round-trips consultative snippets through converter, editor schema and pinned snapshot", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/cinna-shield-x1/flow.yaml"), "utf8"));
    config.consultative = { personaName: "Ana", approvedSnippets: [{ id: "education-v1", text: "  Approved educational context.  " }] };
    const actions = toNativeCinnaFlow(config, "google/gemini-2.5-flash");
    const parsed = actions.map(action => openFlowActionSchema.parse(action));
    const snapshot = compileNativeCinna(parsed);
    expect(snapshot.config.consultative).toEqual(config.consultative);
    config.consultative.approvedSnippets[0].text = "Changed later";
    expect(snapshot.config.consultative?.approvedSnippets[0].text).toBe("  Approved educational context.  ");
  });
  it("preserves the absence of consultative configuration in older flows", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/cinna-shield-x1/flow.yaml"), "utf8"));
    delete config.consultative;
    const actions = toNativeCinnaFlow(config, "google/gemini-2.5-flash");
    expect(actions.find(action => action.cinna_policy)?.cinna_policy).not.toHaveProperty("consultative");
    expect(compileNativeCinna(actions).config.consultative).toBeUndefined();
  });
  it.each([
    { personaName: "Ana", approvedSnippets: [] },
    { personaName: "Ana", approvedSnippets: [{ id: "same", text: "One" }, { id: "same", text: "Two" }] },
    { personaName: "Ana", approvedSnippets: [{ id: "bad id", text: "One" }] },
    { personaName: "Ana", approvedSnippets: [{ id: "valid", text: " " }] },
  ])("rejects invalid consultative policy in the editor", consultative => {
    const wait = flow().find(action => action.cinna_policy)!;
    expect(openFlowActionSchema.safeParse({ ...wait, cinna_policy: { ...wait.cinna_policy, consultative } }).success).toBe(false);
  });

});
