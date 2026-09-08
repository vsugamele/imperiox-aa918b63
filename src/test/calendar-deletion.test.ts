import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

describe("calendar deletion confirmation", () => {
  it.each([204, 404, 410, 403, 500])("handles Google HTTP %i without false success", async (status) => {
    const source = readFileSync(resolve(process.cwd(), "supabase/functions/google-calendar-sync/index.ts"), "utf8").replace(/^import .*;\r?\n/gm, "");
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
    let handler: ((request: Request) => Promise<Response>) | undefined;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test" }))).mockResolvedValueOnce(new Response(null, { status }));
    new Function("Deno", "createClient", "fetch", compiled.outputText)({ env: { get: () => "test" }, serve: (value: typeof handler) => { handler = value; } }, () => ({}), fetchMock);
    if (!handler) throw new Error("Missing handler");
    const response = await handler(new Request("https://test.local", { method: "POST", body: JSON.stringify({ action: "delete_from_google", event: { google_event_id: "event-1" } }) }));
    const expected = [204, 404, 410].includes(status);
    const result = await response.json();
    expect(result.success === true).toBe(expected);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });
});
