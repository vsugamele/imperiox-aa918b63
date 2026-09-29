import { describe, expect, it } from "vitest";
import { checkMcpKey } from "@shared/mcp-auth";

const KEY_A = "imp_mcp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "imp_mcp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const headers = (h: Record<string, string>) => new Headers(h);

describe("checkMcpKey", () => {
  it("fails closed when no key is configured", () => {
    expect(checkMcpKey(headers({ "x-mcp-key": KEY_A }), undefined)).toMatchObject({ ok: false, status: 503 });
    expect(checkMcpKey(headers({ "x-mcp-key": KEY_A }), "  ")).toMatchObject({ ok: false, status: 503 });
  });

  it("ignores configured keys too short to be safe", () => {
    expect(checkMcpKey(headers({ "x-mcp-key": "123" }), "123")).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects missing or wrong keys, including the public anon key header", () => {
    expect(checkMcpKey(headers({}), KEY_A)).toMatchObject({ ok: false, status: 401 });
    expect(checkMcpKey(headers({ "x-mcp-key": KEY_B }), KEY_A)).toMatchObject({ ok: false, status: 401 });
    expect(checkMcpKey(headers({ apikey: KEY_A }), KEY_A)).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts x-mcp-key or a Bearer token, with several keys configured", () => {
    expect(checkMcpKey(headers({ "x-mcp-key": KEY_B }), `${KEY_A}, ${KEY_B}`)).toEqual({ ok: true, keyIndex: 1 });
    expect(checkMcpKey(headers({ authorization: `Bearer ${KEY_A}` }), `${KEY_A},${KEY_B}`)).toEqual({ ok: true, keyIndex: 0 });
  });
});
