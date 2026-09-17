import { describe, expect, it } from "vitest";
import { parsePosition, parseChecklist, parseAnnotationStyle, parseAnnotationKind } from "@/components/funis/company-map-data";

describe("company map persistence boundaries", () => {
  it("preserves negative canvas coordinates and accepts legacy numeric strings", () => {
    expect(parsePosition({ x: -42, y: 180 })).toEqual({ x: -42, y: 180 });
    expect(parsePosition({ x: "-42", y: "180" })).toEqual({ x: -42, y: 180 });
    expect(parsePosition(null)).toEqual({ x: 0, y: 0 });
  });
  it("preserves checklist order, state and additional persisted fields", () => {
    const checklist = [{ id: "one", text: "Original", done: true, owner: "a" }, { id: "two", text: "Next", done: false }];
    expect(parseChecklist(checklist)).toEqual(checklist);
  });
  it("keeps annotation style and schedule data including custom metadata", () => {
    const style = { borderColor: "#123456", recurrence: "weekly", custom: { retained: true }, items: [{ time: "09:00", kind: "post", label: "Publish", extra: 1 }] };
    expect(parseAnnotationStyle(style)).toEqual(style);
    expect(parseAnnotationKind("schedule")).toBe("schedule");
  });
  it("rejects unsupported annotation kinds instead of silently changing their meaning", () => {
    expect(() => parseAnnotationKind("unsupported")).toThrow();
  });
});
