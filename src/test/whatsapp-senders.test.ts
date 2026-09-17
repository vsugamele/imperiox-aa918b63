import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function loadSenders(status: number) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "provider unavailable" }), { status }));
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/whatsapp-api/_lib/senders.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  interface Provider { instance_name: string; api_url: string; api_key: string }
  const exports: {
    sendEvolutionButtons?: (p: Provider, phone: string, text: string, buttons: { text: string }[]) => Promise<unknown>;
    sendEvolutionList?: (p: Provider, phone: string, text: string, list: { rows: { title: string }[] }) => Promise<unknown>;
  } = {};
  const record = (v: unknown) => v !== null && typeof v === "object" ? v : {};
  new Function("exports", "fetch", "record", compiled.outputText)(exports, fetchMock, record);
  if (!exports.sendEvolutionButtons || !exports.sendEvolutionList) throw new Error("Missing senders");
  return { buttons: exports.sendEvolutionButtons, list: exports.sendEvolutionList, fetchMock };
}

describe("WhatsApp interactive senders", () => {
  const provider = { instance_name: "test", api_url: "https://provider.invalid", api_key: "test-only" };
  it("rejects an HTTP failure for buttons instead of reporting a sent message", async () => {
    const sender = loadSenders(503);
    await expect(sender.buttons(provider, "test", "Menu", [{ text: "Option" }])).rejects.toThrow("503");
    expect(sender.fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an HTTP failure for a list instead of reporting a sent message", async () => {
    const sender = loadSenders(401);
    await expect(sender.list(provider, "test", "Menu", { rows: [{ title: "Option" }] })).rejects.toThrow("401");
  });
});
