import { describe, expect, it } from "vitest";
import { extractFilename } from "@/components/whatsapp/chat-media";

describe("chat attachment filenames", () => {
  it.each(["📎", "🎵", "🎬", "🖼️", "🖼"])("removes the complete %s prefix", prefix => {
    expect(extractFilename(`${prefix} report.pdf`, undefined)).toBe("report.pdf");
  });

  it("preserves emoji within an actual filename", () => {
    expect(extractFilename("holiday 🖼️.png", undefined)).toBe("holiday 🖼️.png");
  });

  it("does not treat a standalone variation selector as an attachment icon", () => {
    expect(extractFilename("\uFE0Freport.pdf", undefined)).toBe("\uFE0Freport.pdf");
  });

  it.each(["imagem", "📎 documento", "🎵 áudio", undefined])("uses decoded URL for generic caption %s", caption => {
    // documento is an existing descriptive caption, not one of the generic aliases.
    const expected = caption === "📎 documento" ? "documento" : "my photo.png";
    expect(extractFilename(caption, "https://example.org/my%20photo.png?token=ignored")).toBe(expected);
  });

  it("falls back safely for malformed URLs and percent encoding", () => {
    expect(extractFilename(undefined, "not a URL")).toBe("arquivo");
    expect(extractFilename(undefined, "https://example.org/%GG")).toBe("arquivo");
  });
});
