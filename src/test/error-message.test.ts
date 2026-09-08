import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/error-message";

describe("API error messages", () => {
  it("preserves Error and structured API messages", () => {
    expect(errorMessage(new Error("Network unavailable"))).toBe("Network unavailable");
    expect(errorMessage({ message: "Request rejected", status: 400 })).toBe("Request rejected");
  });
  it("leaves caller fallback available for malformed failures", () => {
    for (const value of [undefined, null, 42, { message: { nested: true } }]) expect(errorMessage(value) || "Try again").toBe("Try again");
    expect(errorMessage("Unavailable")).toBe("Unavailable");
  });
});
