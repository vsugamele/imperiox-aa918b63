import { describe, expect, it } from "vitest";
import { groupHubMessages } from "@/components/whatsapp/hub-conversations";

describe("hub conversation identities", () => {
  it("keeps separate conversation ids when the same phone belongs to different projects", () => {
    const base = { phone: "5511999999999", content: "Hello", created_at: "2026-09-07T12:00:00Z" };
    const groups = groupHubMessages([{ ...base, id: "m1", conversation_id: "conversation-a", project_id: "project-a" }, { ...base, id: "m2", conversation_id: "conversation-b", project_id: "project-b" }]);
    expect(groups.map(group => group.conversationId)).toEqual(["conversation-a", "conversation-b"]);
  });
  it("never invents a conversation id for an orphan message", () => {
    expect(groupHubMessages([{ id: "m1", phone: "5511999999999", content: "Hello", created_at: "2026-09-07T12:00:00Z", conversation_id: null, project_id: null }])[0].conversationId).toBeNull();
  });
});
