import { describe, expect, it } from "vitest";
import { briefingResponseSchema } from "@/components/dashboard/briefing-schema";

describe("daily briefing response", () => {
  it("accepts the generated action fields consumed by both dashboard views", () => {
    const briefing = { briefing_text: "Há leads aguardando.", actions: [{ label: "Abrir", route: "/leads", icon: "flame" }] };
    expect(briefingResponseSchema.parse({ briefing, cached: true }).briefing).toEqual(briefing);
  });
  it("supports empty briefings and missing actions", () => {
    expect(briefingResponseSchema.parse({ briefing: null }).briefing).toBeNull();
    expect(briefingResponseSchema.parse({ briefing: { briefing_text: "Sem ações." } }).briefing?.actions).toBeUndefined();
  });
  it("rejects malformed action destinations before navigation", () => {
    expect(briefingResponseSchema.safeParse({ briefing: { briefing_text: "Texto", actions: [{ label: "Abrir", route: {}, icon: "flame" }] } }).success).toBe(false);
  });
});
