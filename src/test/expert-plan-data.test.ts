import { describe, expect, it } from "vitest";
import { migrateToMonthly } from "@/components/projeto/expert-plan-data";

describe("expert content plan migration", () => {
  it("moves a legacy week into week one without losing copy or extra fields", () => {
    const item = { id: "post", platform: "Instagram", type: "Post", description: "Topic", copy: "Written copy", custom: { approved: true } };
    const plan = migrateToMonthly({ seg: [item] });
    expect(plan.semana_1.seg[0]).toMatchObject(item);
    expect(plan.semana_2).toEqual({});
  });
  it("preserves monthly dates and planning summaries", () => {
    const plan = migrateToMonthly({ semana_1: {}, semana_2: { ter: [{ id: "second", platform: "YouTube", type: "Video", description: "Topic" }] }, week_labels: { semana_2: "Launch" }, week_summaries: { semana_2: { focus: "Education", event: "Launch day" } } });
    expect(plan.semana_2.ter[0].id).toBe("second");
    expect(plan.week_labels.semana_2).toBe("Launch");
    expect(plan.week_summaries.semana_2).toEqual({ focus: "Education", event: "Launch day" });
  });
});
