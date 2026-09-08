import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toNativeCinnaFlow } from "@/lib/cinna-shield-x1/openflow";
import { parseConfig } from "@/lib/cinna-shield-x1/engine";
import { openFlowActionsSchema } from "@/lib/openflow-action-schema";
import { compileNativeCinna } from "@/lib/cinna-shield-x1/native-contract";

const config = parseConfig(JSON.parse(readFileSync(resolve("scripts/cinna-shield-x1/flow.yaml"), "utf8")));
describe("Cinna native OpenFlow import", () => {
  it("preserves every script message, question and stage in order", () => {
    const actions = toNativeCinnaFlow(config, "google/gemini-2.5-flash");
    expect(actions.filter(a => a.tipo === "whatsapp").map(a => a.template)).toEqual(config.stages.flatMap(s => [...s.messages, s.question]));
    expect(actions.filter(a => a.cinna_stage).map(a => a.cinna_stage?.id)).toEqual(config.stages.map(s => s.id));
    expect(new Set(actions.map(a => a.id)).size).toBe(actions.length);
    expect(actions.filter(a => a.cinna_policy)).toHaveLength(1);
    expect(openFlowActionsSchema.parse(actions)).toEqual(actions);
  });
  it("keeps unapproved offer and does not mutate source while editing", () => {
    const actions = toNativeCinnaFlow(config, "model");
    const policy = actions.find(a => a.cinna_policy)!.cinna_policy!;
    expect(policy.offer.approved).toBe(false);
    expect(policy.offer.checkoutUrl).toBe(null);
    policy.replies.question = "Changed";
    expect(config.replies.question).not.toBe("Changed");
  });
  it("rebuilds execution from the edited native messages", () => {
    const actions = toNativeCinnaFlow(config, "model");
    actions[0].template = "Edited first message";
    const rebuilt = compileNativeCinna(JSON.parse(JSON.stringify(actions)));
    expect(rebuilt.config.stages[0].messages[0]).toBe("Edited first message");
    expect(rebuilt.config.stages[1]).toEqual(config.stages[1]);
    expect(rebuilt.waitSteps).toHaveLength(9);
  });
});
