import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decide, initialState, parseConfig, validCheckout, type Config } from "@/lib/cinna-shield-x1/engine";

const config = (): Config => parseConfig(JSON.parse(readFileSync(resolve(process.cwd(), "src/test/fixtures/cinna-legacy.json"), "utf8")));
describe("Cinna Shield script and AI", () => {
  it("starts and completes the nine stages in order without offering a placeholder", async () => {
    const c = config();
    let result = await decide(c, { eventId: "start", message: "" });
    expect(result.action).toBe("start");
    for (let i = 1; i <= 8; i++) {
      result = await decide(c, { eventId: `step-${i}`, message: "Continue", state: result.state });
      expect(result.state.stageIndex).toBe(i);
      expect(result.stageId).toBe(c.stages[i].id);
    }
    result = await decide(c, { eventId: "end", message: "Continue", state: result.state });
    expect(result.action).toBe("complete");
    expect(result.state.checkoutSent).toBe(false);
  });
  it.each(["How much does it cost?", "Is this a scam?", "Where do you ship?", "What is in it?", "no", "not now", "no thanks", "I do not want to buy", "help me please", "not sure", "hello there"])("preserves pending question for %s", async message => {
    const c = config();
    const result = await decide(c, { eventId: "q", message });
    expect(result.action).toBe("hold");
    expect(result.state.stageIndex).toBe(0);
    if (result.intent !== "timing") expect(result.messages[result.messages.length - 1]).toBe(c.stages[0].question);
  });
  it.each(["Stop", "Please unsubscribe me", "I want a human"])("halts persistently on %s", async message => {
    const c = config();
    const result = await decide(c, { eventId: "halt", message });
    expect(["stop", "human"]).toContain(result.action);
    const next = await decide(c, { eventId: "later", message: "Continue", state: result.state });
    expect(next.action).toBe("ignored");
    expect(next.messages).toEqual([]);
  });
  it("does not advance the caller's state or store personal input", async () => {
    const c = config(); const state = initialState(c);
    const result = await decide(c, { eventId: "name", message: "My name is Alice", state });
    expect(state.revision).toBe(0);
    expect(result.action).toBe("advance");
    expect(JSON.stringify(result.state)).not.toContain("Alice");
  });
  it("deduplicates a retried provider event", async () => {
    const c = config();
    const result = await decide(c, { eventId: "one", message: "Continue" });
    const retry = await decide(c, { eventId: "one", message: "Continue", state: result.state });
    expect(retry.messages).toEqual([]);
    expect(retry.state.revision).toBe(result.state.revision);
  });
  it("never sends checkout when offer is unapproved", async () => {
    const result = await decide(config(), { eventId: "buy", message: "I want to buy" });
    expect(result.action).toBe("human");
    expect(result.state.checkoutSent).toBe(false);
    expect(result.messages.join(" ")).not.toMatch(/https:|\$97/);
  });
  it("sends only the configured approved offer and ends automation", async () => {
    const c = config(); c.offer = { approved: true, checkoutUrl: "https://checkout.merchant-fixture.com/cinna", priceLabel: "test package — USD 10" };
    const result = await decide(parseConfig(c), { eventId: "buy", message: "I want to buy" });
    expect(result.action).toBe("checkout"); expect(result.state.status).toBe("complete");
    expect(result.messages).toContain(c.offer.checkoutUrl);
  });
  it("handles medical questions before purchase intent without storing them", async () => {
    const result = await decide(config(), { eventId: "medical", message: "I take metformin, can I buy this?" });
    expect(result.intent).toBe("medical"); expect(result.action).toBe("hold");
    expect(JSON.stringify(result.state)).not.toContain("metformin");
  });
  it("uses validated AI for a free answer, without generating claims", async () => {
    const c = config(); const state = { ...initialState(c), stageIndex: 1 };
    const result = await decide(c, { eventId: "ai", message: "I'm comparing a couple of options", state }, async () => ({ intent: "answer" }));
    expect(result.source).toBe("ai"); expect(result.action).toBe("advance");
    expect(result.messages).toEqual([...c.stages[2].messages, c.stages[2].question]);
  });
  it.each([null, { intent: "skip" }, { intent: "buy", url: "https://evil.invalid" }, { intent: "answer", reply: "cure" }])("rejects unsafe AI outputs %j", async output => {
    const c = config(); const state = { ...initialState(c), stageIndex: 1 };
    const result = await decide(c, { eventId: "bad", message: "arbitrary ambiguous input", state }, async () => output);
    expect(result.action).toBe("hold"); expect(result.source).toBe("fallback");
  });
  it("holds on AI outage and missing provider", async () => {
    const c = config(); const state = { ...initialState(c), stageIndex: 1 };
    for (const classifier of [undefined, async () => { throw new Error("offline"); }]) {
      const result = await decide(c, { eventId: "offline", message: "a fairly ambiguous statement", state }, classifier);
      expect(result.source).toBe("fallback"); expect(result.state.stageIndex).toBe(1);
    }
  });
  it("lets AI map a paraphrased question to an approved FAQ without consuming it", async () => {
    const c = config();
    const result = await decide(c, { eventId: "faq", message: "What will it set me back?" }, async () => ({ intent: "price" }));
    expect(result.source).toBe("ai"); expect(result.intent).toBe("price"); expect(result.action).toBe("hold");
    expect(result.messages[0]).toBe(c.replies.price);
  });
  it.each(["answer", "buy"])("prevents AI from reinterpreting a question as %s", async intent => {
    const result = await decide(config(), { eventId: "guard", message: "What does that mean?" }, async () => ({ intent }));
    expect(result.action).toBe("hold"); expect(result.source).toBe("fallback");
  });
  it("finishes on an explicit closing instruction", async () => {
    const c = config();
    const result = await decide(c, { eventId: "finish", message: "Finish here", state: { ...initialState(c), stageIndex: 8 } });
    expect(result.action).toBe("complete");
  });
  it.each(["Just exploring", "Comparing options", "A simpler routine"])("acknowledges context choice %s without collecting personal data", async message => {
    const c = config(); const stage = c.stages[1];
    const result = await decide(c, { eventId: "context", message, state: { ...initialState(c), stageIndex: 1 } });
    expect(result.action).toBe("advance");
    expect(result.messages[0]).toBe(stage.choices?.find(choice => choice.label === message)?.acknowledgement);
    expect(JSON.stringify(result.state)).not.toContain(message);
  });
  it.each([["It's too expensive", "budget"], ["I need to think about it", "timing"]])("answers %s without pushing the pending question", async (message, intent) => {
    const result = await decide(config(), { eventId: "objection", message });
    expect(result.intent).toBe(intent); expect(result.action).toBe("hold");
    expect(result.messages).toHaveLength(1); expect(result.state.stageIndex).toBe(0);
  });
  it.each(["https://example.com/cinna", "https://a.example.com", "http://merchant.com", "https://a.test", "https://a.invalid", "https://127.0.0.1", "https://user:pass@merchant.com"])("rejects checkout %s", url => expect(validCheckout(url)).toBe(false));
  it("rejects missing approved price and a broken stage", () => {
    const c = config(); c.offer.approved = true;
    expect(() => parseConfig(c)).toThrow();
    const d = config(); d.stages[0].id = d.stages[1].id;
    expect(() => parseConfig(d)).toThrow();
  });
  it("rejects foreign product/version and out-of-range state", async () => {
    const c = config();
    for (const state of [{ ...initialState(c), version: "other" }, { ...initialState(c), stageIndex: 9 }, { ...initialState(c), revision: -1 }]) {
      await expect(decide(c, { eventId: "bad", message: "Continue", state })).rejects.toThrow();
    }
  });
  it("enforces event and message bounds", async () => {
    const c = config();
    await expect(decide(c, { eventId: "", message: "Continue" })).rejects.toThrow();
    await expect(decide(c, { eventId: "large", message: "x".repeat(2001) })).rejects.toThrow();
    await expect(decide(c, { eventId: "full", message: "Continue", state: { ...initialState(c), processedEventIds: Array.from({ length: 1000 }, (_, i) => String(i)) } })).rejects.toThrow();
  });
});
