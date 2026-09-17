import { describe, expect, it } from "vitest";
import { processPayload } from "@/lib/tarefas-data";

describe("process persistence", () => {
  it("saves supported fields and original steps without sending unsupported form controls", () => {
    const form = { title: " Process ", description: "Details", steps: [{ text: "First", done: true }, { text: "Second", done: false }], category: "geral", member_id: "member", project_id: "project", horario: "09:00", referencias: [{ tipo: "link", url: "https://example.com" }] };
    expect(processPayload(form)).toEqual({ title: "Process", description: "Details", steps: form.steps, category: "geral", member_id: "member", project_id: "project" });
  });
  it("uses database nulls for unassigned member and project", () => {
    expect(processPayload({ title: "Process", description: "", steps: [], category: "geral", member_id: "none", project_id: "none" })).toMatchObject({ member_id: null, project_id: null, description: null });
  });
});
