import { describe, expect, it } from "vitest";
import { expertPortalSchema } from "@/lib/expert-portal-data";
import { migrateToMonthly } from "@/components/projeto/expert-plan-data";

describe("expert portal response", () => {
  it("accepts the actual monthly plan and preserves recording fields", () => {
    const data = expertPortalSchema.parse({ project_name: "Projeto", content_plan: { semana_1: { seg: [{ id: "item", platform: "Instagram", type: "Story", description: "Tema", roteiro: "Texto da gravação", sequencia: 2, custom: "preserved" }] } }, events: [], tasks: [], processes: [], expert_logs: [], chat_messages: [], shared_docs: [] });
    expect(migrateToMonthly(data.content_plan).semana_1.seg[0]).toMatchObject({ roteiro: "Texto da gravação", sequencia: 2, custom: "preserved" });
  });
  it("rejects an error body or malformed structures before displaying success", () => {
    expect(expertPortalSchema.safeParse({ error: "Token expirado" }).success).toBe(false);
    expect(expertPortalSchema.safeParse({ project_name: "Projeto", content_plan: {}, processes: [{ id: "p", title: "SOP", steps: "invalid" }] }).success).toBe(false);
  });
});
