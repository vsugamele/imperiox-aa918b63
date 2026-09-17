import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function loadNotify(fetchMock: ReturnType<typeof vi.fn>) {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/push-notify.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const exports: { pushNotifyByPref?: (args: { supabase: unknown; prefKey: string; title: string; message: string; user_ids?: string[] }) => Promise<void> } = {};
  const record = (v: unknown) => v !== null && typeof v === "object" ? v : {};
  new Function("exports", "Deno", "fetch", "record", compiled.outputText)(exports, { env: { get: () => "test-only" } }, fetchMock, record);
  if (!exports.pushNotifyByPref) throw new Error("Missing notification helper");
  return exports.pushNotifyByPref;
}

describe("notification preferences", () => {
  it("does not re-add an explicitly muted recipient as a missing preference", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));
    const rows = [{ user_id: "enabled", novo_lead: true }, { user_id: "muted", novo_lead: false }];
    const query = { select: () => query, in: () => query, then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) };
    await loadNotify(fetchMock)({ supabase: { from: () => query }, prefKey: "novo_lead", title: "Test", message: "Test", user_ids: ["enabled", "muted", "new"] });
    const recipients = fetchMock.mock.calls.map(call => JSON.parse(String((call[1] as RequestInit).body)).user_id);
    expect(recipients).toEqual(["enabled", "new"]);
  });
});
