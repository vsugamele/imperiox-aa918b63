import { describe, expect, it } from "vitest";
import { parseFormFields, completionText } from "@/components/leads/form-builder-data";

describe("form field JSON boundary", () => {
  it("preserves question text, options and future configuration fields", () => {
    const field = { key: "question", label: "Which option?", type: "radio", required: true, options: ["One", "Two"], validation: { min: 1 }, placeholder: "Choose" };
    expect(parseFormFields([field])).toEqual([field]);
  });
  it("rejects unsupported fields instead of silently removing questions", () => {
    expect(() => parseFormFields([{ key: "custom", type: "future-widget" }])).toThrow("Tipo de campo");
    expect(() => parseFormFields([{ type: "select", options: [{}] }])).toThrow("Opções");
  });
  it("guards completion payload before extracting text", () => {
    expect(completionText({ choices: [{ message: { content: "[]" } }] })).toBe("[]");
    expect(completionText({ choices: {} })).toBe("");
  });
});
