import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decide, initialState, parseConfig } from "@/lib/cinna-shield-x1/engine";
import { composeConsultativeReply, acknowledgements, type ConsultativeRequest } from "@/lib/cinna-shield-x1/consultative";
import { toNativeCinnaFlow } from "@/lib/cinna-shield-x1/openflow";
import { createCinnaRuntime, planCinnaReply } from "../../supabase/functions/_shared/cinna-openflow";
const config = () => parseConfig(JSON.parse(readFileSync(resolve("scripts/cinna-shield-x1/flow.yaml"), "utf8")));

describe("Ana consultative policy", () => {
  it("recognizes a direct product question as interest instead of keeping the welcome in a loop", async () => {
    const c = config();
    const initial = await decide(c, { eventId: "interest", message: "Can you tell me about the supplement?" });
    expect(initial.action).toBe("advance");
    expect(initial.state.awaitingProductConsent).toBe(true);
    const permitted = await decide(c, { eventId: "permission", message: "yes", state: initial.state });
    expect(permitted.state.stageIndex).toBe(2);
    expect(permitted.action).toBe("advance");
  });
  it.each(["I was diagnosed with diabetes and feel overwhelmed", "I have diabetes and I'm worried"])("welcomes general concern: %s", async message => {
    const c = config(); const result = await decide(c, { eventId: "concern", message });
    expect(result.action).toBe("hold"); expect(result.state.status).toBe("active");
    expect(result.state.stageIndex).toBe(0);
  });
  it.each(["Can I take this with insulin?", "Is it safe for me?", "Can I take the supplement?", "What dose should I take?", "Do I have diabetes?", "Posso tomar com insulina?", "fruity breath and vomiting", "vomiting and fruity breath", "Estou com falta de ar"])("blocks automated sale for personal advice or emergency: %s", async message => {
    const c = config(); const classify = vi.fn();
    const result = await decide(c, { eventId: "medical", message }, classify);
    expect(result.action).toBe("human"); expect(classify).not.toHaveBeenCalled();
    const followup = await decide(c, { eventId: "buy", message: "send me the link", state: result.state }, classify);
    expect(followup.action).toBe("ignored"); expect(followup.state.checkoutSent).toBe(false);
  });
  it.each(["Can I use PayPal?", "Can I take a look at the ingredients?", "Can I take a look at the product?"])("does not mistake a commercial question for personal medical advice: %s", async message => {
    const result = await decide(config(), { eventId: "commercial", message });
    expect(result.action).not.toBe("human");
    expect(result.intent).not.toBe("medical");
    expect(result.state.status).toBe("active");
  });
  it("distinguishes truthful identity questions from requests for a real person", async () => {
    const c = config();
    expect((await decide(c, { eventId: "identity", message: "Are you a real person?" })).messages.join(" ")).toContain("virtual support assistant");
    expect((await decide(c, { eventId: "human", message: "I want a real person" })).action).toBe("human");
  });
  it("requires explicit permission after a hold; yes and classifier cannot bypass consent", async () => {
    const c = config(); const state = { ...initialState(c), stageIndex: 1 };
    const held = await decide(c, { eventId: "worry", message: "I feel worried", state });
    const yes = await decide(c, { eventId: "yes", message: "yes", state: held.state }, async () => ({ intent: "answer" }));
    expect(yes.action).toBe("hold"); expect(yes.state.stageIndex).toBe(1);
    const consent = await decide(c, { eventId: "consent", message: "Tell me about the product", state: yes.state });
    expect(consent.action).toBe("advance"); expect(consent.state.stageIndex).toBe(2);
  });
  it("accepts natural yes after the product permission question was emitted", async () => {
    const c = config();
    const asked = await decide(c, { eventId: "intro", message: "continue" });
    expect(asked.state.stageIndex).toBe(1); expect(asked.state.awaitingProductConsent).toBe(true);
    const accepted = await decide(c, { eventId: "yes", message: "yes", state: asked.state });
    expect(accepted.action).toBe("advance"); expect(accepted.state.stageIndex).toBe(2);
    expect(accepted.state.awaitingProductConsent).toBe(false);
  });
  it("reasks naturally after an intervening hold and protects the question from composition", async () => {
    const c = config(); const waiting = { ...initialState(c), stageIndex: 1, awaitingProductConsent: true };
    const hold = await decide(c, { eventId: "concern", message: "I am worried", state: waiting });
    expect(hold.state.awaitingProductConsent).toBe(false);
    const reask = await decide(c, { eventId: "yes", message: "yes", state: hold.state });
    expect(reask.action).toBe("hold"); expect(reask.permissionPrompt).toBe(true);
    expect(reask.messages).toEqual([c.stages[1].question]); expect(reask.state.awaitingProductConsent).toBe(true);
    const compose = vi.fn();
    expect(await composeConsultativeReply(c, reask, "yes", [], compose)).toBeNull(); expect(compose).not.toHaveBeenCalled();
    const accepted = await decide(c, { eventId: "second-yes", message: "yes", state: reask.state });
    expect(accepted.action).toBe("advance");
  });
  it("identity holds clear consent and absent consent state requires a fresh question", async () => {
    const c = config();
    const identity = await decide(c, { eventId: "identity", message: "Who are you?", state: { ...initialState(c), stageIndex: 1, awaitingProductConsent: true } });
    expect(identity.state.awaitingProductConsent).toBe(false);
    const legacyState = { ...initialState(c), stageIndex: 1 };
    const reask = await decide(c, { eventId: "yes", message: "yes", state: legacyState });
    expect(reask.permissionPrompt).toBe(true); expect(reask.state.stageIndex).toBe(1);
  });
  it("cannot buy before permission even if classifier suggests buy and offer is approved", async () => {
    const c = config(); c.offer = { approved: true, checkoutUrl: "https://shop.validbrand.com/checkout", priceLabel: "$50" };
    const result = await decide(c, { eventId: "early", message: "take my money" }, async () => ({ intent: "buy" }));
    expect(result.action).toBe("hold"); expect(result.state.checkoutSent).toBe(false);
  });
  it("composes relevant pinned facts verbatim with one safe question, without moving cursor", async () => {
    const c = config(); const decision = await decide(c, { eventId: "q", message: "I am worried" });
    const snippet = c.consultative!.approvedSnippets.find(s => !/cinna|product|formula|checkout|offer/i.test(s.text))!;
    const compose = vi.fn(async () => ({ acknowledgementId: "overwhelmed", snippetIds: [snippet.id], questionId: "clarify" }));
    const result = await composeConsultativeReply(c, decision, "I am worried", [], compose);
    expect(result?.[0]).toContain(snippet.text); expect(result?.[0]).toContain(acknowledgements.overwhelmed);
    expect(result?.[0].match(/\?/g)).toHaveLength(1); expect(decision.state.stageIndex).toBe(0);
  });
  it.each([
    { acknowledgementId: "unknown", snippetIds: [], questionId: "none" },
    { acknowledgementId: "concern", snippetIds: ["invented-source"], questionId: "none" },
    { acknowledgement: "Everything will be fine.", snippetIds: [], questionId: "none" },
    { acknowledgement: "I have been through this myself.", snippetIds: [], questionId: "none" },
    { acknowledgementId: "concern", snippetIds: [], questionId: "__proto__" },
    { acknowledgementId: "concern", snippetIds: [], questionId: "none", url: "https://bad.test" },
  ])("falls back for unapproved output %j", async output => {
    const c = config(); const decision = await decide(c, { eventId: "q", message: "I am worried" });
    expect(await composeConsultativeReply(c, decision, "I am worried", [], async () => output)).toBeNull();
  });
  it("delivers contextual advance acknowledgement separately from next-stage script", async () => {
    const runtime = createCinnaRuntime(toNativeCinnaFlow(config(), "model")); runtime.state.stageIndex = 1;
    const compose = vi.fn(async () => ({ acknowledgementId: "permission", snippetIds: [], questionId: "none" }));
    const plan = await planCinnaReply(runtime, runtime.snapshot.waitSteps[1], "consent", "Tell me about the product", undefined, { compose, history: [] });
    expect(plan.messages).toEqual([acknowledgements.permission]); expect(plan.resumeStep).not.toBeNull();
    expect(plan.messages.join(" ")).not.toContain(runtime.snapshot.config.stages[2].question);
  });
  it.each(["How much?", "too expensive", "not now", "Is it a scam?", "shipping", "ingredients"])("preserves approved commerce FAQ: %s", async message => {
    const c = config(); const decision = await decide(c, { eventId: "faq", message });
    const compose = vi.fn();
    expect(await composeConsultativeReply(c, decision, message, [], compose)).toBeNull();
    expect(compose).not.toHaveBeenCalled();
  });
  it("bounds contextual history without storing a profile when capture is not configured", async () => {
    const c = config(); c.stages.forEach(stage => { delete stage.capture; });
    const decision = await decide(c, { eventId: "q", message: "I am worried" });
    const compose = vi.fn(async (_request: ConsultativeRequest) => ({ acknowledgementId: "concern", snippetIds: [], questionId: "none" }));
    await composeConsultativeReply(c, decision, "I am worried", Array.from({ length: 20 }, () => ({ role: "user" as const, content: "x".repeat(1200) })), compose);
    expect(compose.mock.calls[0][0].messages).toHaveLength(9);
    expect(compose.mock.calls[0][0].messages[0].content).toHaveLength(800);
    expect(JSON.stringify(decision.state)).not.toContain("worried");
  });
});
