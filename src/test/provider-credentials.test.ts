import { describe, expect, it } from "vitest";
import { providerCredentialPatch } from "@/components/whatsapp/provider-credentials";

describe("provider credential updates", () => {
  it("does not erase credentials absent from the read projection", () => {
    expect(providerCredentialPatch({ api_key: "", access_token: "" }, true)).toEqual({});
    expect(providerCredentialPatch({ api_key: " ", access_token: " " }, true)).toEqual({});
  });
  it("updates only an explicitly supplied replacement", () => {
    expect(providerCredentialPatch({ api_key: "replacement", access_token: "" }, true)).toEqual({ api_key: "replacement" });
  });
  it("preserves creation semantics", () => {
    expect(providerCredentialPatch({ api_key: "", access_token: "" }, false)).toEqual({ api_key: null, access_token: null });
  });
});
