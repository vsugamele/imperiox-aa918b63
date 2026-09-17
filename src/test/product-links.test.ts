import { describe, expect, it } from "vitest";
import { normalizeProductLinks, pickBestLink } from "@/lib/produto-links";

describe("product link boundaries", () => {
  it("preserves legacy URLs and structured priorities", () => {
    expect(normalizeProductLinks({ link: "https://example.com" })[0].url).toBe("https://example.com");
    const links = normalizeProductLinks({ links: ["https://example.com/old", { url: "https://example.com/new", tipo: "checkout", prioridade_ia: "preferido", contexto_ia: ["pix"] }] });
    expect(pickBestLink(links, { contexto: "pix" })?.url).toBe("https://example.com/new");
  });
  it("ignores malformed entries and validates metadata before string operations", () => {
    const links = normalizeProductLinks({ links: [null, 5, { url: "https://example.com", label: {}, tipo: "invalid", contexto_ia: [7, null, "pix"] }] });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ label: "", tipo: "outro", contexto_ia: ["pix"] });
    expect(() => pickBestLink(links, { contexto: "pix" })).not.toThrow();
    expect(normalizeProductLinks(false)).toEqual([]);
  });
});
