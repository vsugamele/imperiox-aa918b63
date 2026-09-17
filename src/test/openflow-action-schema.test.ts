import { describe, expect, it } from "vitest";
import { openFlowActionsSchema } from "@/lib/openflow-action-schema";

describe("OpenFlow persisted action validation", () => {
  it("keeps extension fields and normalizes legacy missing timing/template", () => {
    const parsed = openFlowActionsSchema.parse([{ tipo: "whatsapp", extension: { tracking: true }, media: { id: "m", url: "https://example.com/m.png", label: "Photo", kind: "image" } }]);
    expect(parsed[0]).toMatchObject({ tipo: "whatsapp", template: "", delay_min: 0, extension: { tracking: true } });
    expect(parsed[0].media?.kind).toBe("image");
  });
  it("rejects invalid nested values instead of silently dropping saved steps", () => {
    expect(openFlowActionsSchema.safeParse([{ tipo: "ia_message", ia_routes: [{ name: "price", jump_steps: "broken" }] }]).success).toBe(false);
    expect(openFlowActionsSchema.safeParse([{ tipo: "quick_reply", options: ["Sim", { label: "Não", skip_n: 2 }] }]).success).toBe(true);
    expect(openFlowActionsSchema.safeParse([{ tipo: "whatsapp" }, null]).success).toBe(false);
  });
});
