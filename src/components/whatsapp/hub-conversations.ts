import type { Tables } from "@/integrations/supabase/types";
export type HubMessage = Pick<Tables<"imphq_wa_messages">, "id" | "phone" | "content" | "created_at" | "project_id" | "conversation_id">;
export function groupHubMessages(messages: HubMessage[]) {
    const map = new Map<string, { phone: string; lastMsg: string; lastAt: string; count: number; projectId: string; conversationId: string | null }>();
    messages.forEach(m => {
      const key = m.conversation_id || m.phone;
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { phone: m.phone || "", conversationId: m.conversation_id, lastMsg: m.content?.slice(0, 60) || "", lastAt: m.created_at, count: 1, projectId: m.project_id || "" });
      } else {
        existing.count++;
        if (m.created_at > existing.lastAt) { existing.lastAt = m.created_at; existing.lastMsg = m.content?.slice(0, 60) || ""; }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
