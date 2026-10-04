import { afterEach, describe, expect, it, vi } from "vitest";
import { extractUsage, installAiUsageTracking, providerOf, resetAiUsageTrackingForTests, setAiUsageProject } from "@shared/ai-usage";
import { parseElevenLabsSubscription, parseKieCredit, parseOpenRouterKey, readProviderUsage } from "@shared/provider-usage";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ai usage per call", () => {
  afterEach(() => resetAiUsageTrackingForTests());

  it("recognizes AI providers by host", () => {
    expect(providerOf("https://openrouter.ai/api/v1/chat/completions")).toBe("openrouter");
    expect(providerOf("https://ai.gateway.lovable.dev/v1/chat/completions")).toBe("lovable");
    expect(providerOf("https://api.elevenlabs.io/v1/text-to-speech/abc")).toBe("elevenlabs");
    expect(providerOf("https://tkb.supabase.co/rest/v1/x")).toBeNull();
  });

  it("reads usage in each provider format and skips non-consuming calls", () => {
    expect(extractUsage("https://openrouter.ai/api/v1/chat/completions", { model: "x" }, { model: "anthropic/claude", usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.0012 } }, "application/json"))
      .toMatchObject({ provider: "openrouter", model: "anthropic/claude", total_tokens: 15, cost_usd: 0.0012 });
    expect(extractUsage("https://api.anthropic.com/v1/messages", { model: "claude" }, { model: "claude", usage: { input_tokens: 7, output_tokens: 3 } }, "application/json"))
      .toMatchObject({ provider: "anthropic", prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 });
    expect(extractUsage("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {}, { usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 } }, "application/json"))
      .toMatchObject({ provider: "google", model: "gemini-2.5-flash", total_tokens: 10 });
    expect(extractUsage("https://api.elevenlabs.io/v1/text-to-speech/v1", { text: "olá mundo", model_id: "eleven_v3" }, null, "audio/mpeg"))
      .toMatchObject({ provider: "elevenlabs", total_tokens: 9, tag: "tts_caracteres", model: "eleven_v3" });
    expect(extractUsage("https://openrouter.ai/api/v1/chat/completions", { model: "m" }, null, "text/event-stream")).toMatchObject({ tag: "stream", model: "m" });
    expect(extractUsage("https://openrouter.ai/api/v1/models", {}, {}, "application/json")).toBeNull();
    expect(extractUsage("https://api.kie.ai/api/v1/chat/credit", {}, {}, "application/json")).toBeNull();
  });

  it("logs the call in the background without changing the AI response", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("openrouter")) return json({ model: "m1", usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cost: 0.5 } });
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const pending: Promise<unknown>[] = [];
    const before = globalThis.fetch;
    installAiUsageTracking("wa-teste", { fetchImpl: fake, supabaseUrl: "https://db", serviceKey: "svc", waitUntil: (p) => pending.push(p) });
    setAiUsageProject("jp_freitas");
    const res = await globalThis.fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "m1", messages: [] }) });
    expect((await res.json()).model).toBe("m1");
    await Promise.all(pending);
    globalThis.fetch = before;
    const log = calls.find((c) => c.url === "https://db/rest/v1/imphq_ai_usage");
    expect(JSON.parse(log!.body!)).toEqual({ provider: "openrouter", model: "m1", prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cost_usd: 0.5, tag: null, function_name: "wa-teste", project_id: "jp_freitas" });
    expect(log!.body).not.toContain("messages");
  });

  it("does not log calls to non-AI hosts", async () => {
    const fake = vi.fn(async () => json({ ok: true })) as unknown as typeof fetch;
    const pending: Promise<unknown>[] = [];
    const before = globalThis.fetch;
    installAiUsageTracking("x", { fetchImpl: fake, supabaseUrl: "https://db", serviceKey: "svc", waitUntil: (p) => pending.push(p) });
    await globalThis.fetch("https://tkb.supabase.co/rest/v1/tabela");
    globalThis.fetch = before;
    expect(pending).toHaveLength(0);
    expect(fake).toHaveBeenCalledTimes(1);
  });
});

describe("provider usage", () => {
  it("parses OpenRouter, ElevenLabs and Kie responses", () => {
    expect(parseOpenRouterKey({ data: { usage: 120, usage_daily: 1.5, usage_weekly: 9, usage_monthly: 30, limit_remaining: null } })).toMatchObject({ spent_usd: 1.5, details: { usage_monthly: 30 } });
    expect(parseElevenLabsSubscription({ character_count: 1000, character_limit: 30000, tier: "creator", next_character_count_reset_unix: 1790000000 })).toMatchObject({ units_used: 1000, balance: 29000 });
    expect(parseKieCredit({ code: 200, msg: "success", data: 100 })).toMatchObject({ balance: 100, unit: "creditos" });
  });

  it("reads only providers with a key and keeps going when one fails", async () => {
    const fake = vi.fn(async (url: string) => (url.includes("openrouter") ? json({ data: { usage_daily: 2 } }) : json({}, 401))) as unknown as (u: string, i?: RequestInit) => Promise<Response>;
    const env = (k: string) => ({ OPENROUTER_API_KEY: "a", ELEVENLABS_API_KEY: "b" } as Record<string, string>)[k];
    const { results, errors } = await readProviderUsage(env, fake);
    expect(results.map((r) => r.provider)).toEqual(["openrouter"]);
    expect(errors).toEqual([{ provider: "elevenlabs", error: "HTTP 401" }, { provider: "kie", error: "KIE_API_KEY não configurada" }]);
  });
});
