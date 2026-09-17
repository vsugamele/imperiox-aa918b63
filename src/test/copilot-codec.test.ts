import { describe, expect, it } from "vitest";
import { decodeCopilotMessages, decodeCopilotStream, serializeCopilotMessages } from "@/components/copilot/copilot-codec";

describe("copilot persistence and stream boundary", () => {
  it("round-trips content, timestamps and tool JSON without adding undefined fields", () => {
    const stored = [{ role: "assistant", content: "Resultado", ts: "2026-09-08", tools: [{ name: "buscarLead", args: { id: "lead-1" }, result: null }] }];
    expect(serializeCopilotMessages(decodeCopilotMessages(stored))).toEqual(stored);
    expect(serializeCopilotMessages([{ role: "user", content: "Olá" }])).toEqual([{ role: "user", content: "Olá" }]);
  });
  it("keeps valid history while excluding invalid roles or message bodies", () => {
    expect(decodeCopilotMessages([{ role: "user", content: "Olá" }, { role: "system", content: "ignored" }, { role: "assistant", content: {} }])).toEqual([{ role: "user", content: "Olá" }]);
  });
  it("accepts meta, tools and token events and ignores malformed deltas", () => {
    expect(decodeCopilotStream({ type: "meta", threadId: "thread-1" })).toEqual({ type: "meta", threadId: "thread-1" });
    expect(decodeCopilotStream({ choices: [{ delta: { content: "Texto" } }] })).toEqual({ type: "delta", content: "Texto" });
    expect(decodeCopilotStream({ choices: [{ delta: { content: {} } }] })).toBeNull();
    expect(decodeCopilotStream({ type: "tools", tools: [{ name: "listarProjetos", args: {}, result: { projetos: [] } }, { name: 3 }] })).toEqual({ type: "tools", tools: [{ name: "listarProjetos", args: {}, result: { projetos: [] } }] });
  });
});
