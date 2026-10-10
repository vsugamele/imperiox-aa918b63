import { describe, it, expect } from "vitest";
import { isUnreadSession, getLastSenderInfo, type WaSession } from "@/components/whatsapp/ConversationList";

describe("WhatsApp ConversationList - unread and sender detection", () => {
  const baseSession: WaSession = {
    id: "sess-1",
    phone: "5511999998888",
    contact_name: "Ana Silva",
    session: "session-1",
    project_id: "proj-1",
    status: "active",
    message_count: 5,
    metadata: null,
    created_at: new Date().toISOString(),
    provider_id: "prov-1",
  };

  describe("isUnreadSession", () => {
    it("returns true when unread_count is greater than 0", () => {
      const session: WaSession = {
        ...baseSession,
        unread_count: 3,
        last_message_direction: "in",
      };
      expect(isUnreadSession(session)).toBe(true);
    });

    it("returns true when incoming message has last_message_at newer than last_read_at", () => {
      const session: WaSession = {
        ...baseSession,
        unread_count: 0,
        last_message_direction: "incoming",
        last_message_at: "2026-10-10T15:00:00Z",
        last_read_at: "2026-10-10T14:50:00Z",
      };
      expect(isUnreadSession(session)).toBe(true);
    });

    it("returns false when incoming message has been read (last_read_at >= last_message_at)", () => {
      const session: WaSession = {
        ...baseSession,
        unread_count: 0,
        last_message_direction: "in",
        last_message_at: "2026-10-10T15:00:00Z",
        last_read_at: "2026-10-10T15:05:00Z",
      };
      expect(isUnreadSession(session)).toBe(false);
    });

    it("returns false for outgoing messages when unread_count is 0", () => {
      const session: WaSession = {
        ...baseSession,
        unread_count: 0,
        last_message_direction: "outgoing",
        last_message_at: "2026-10-10T15:00:00Z",
        last_read_at: "2026-10-10T14:00:00Z",
      };
      expect(isUnreadSession(session)).toBe(false);
    });
  });

  describe("getLastSenderInfo", () => {
    it("identifies outgoing messages sent by autonomous AI when locked", () => {
      const session: WaSession = {
        ...baseSession,
        last_message_direction: "outgoing",
        ai_lock_until: new Date(Date.now() + 60000).toISOString(),
      };
      const info = getLastSenderInfo(session);
      expect(info.role).toBe("ai");
      expect(info.label).toBe("🤖 IA:");
    });

    it("identifies outgoing messages sent by AI based on close timestamp match", () => {
      const now = new Date();
      const session: WaSession = {
        ...baseSession,
        last_message_direction: "out",
        last_message_at: now.toISOString(),
        ai_last_reply_at: new Date(now.getTime() - 2000).toISOString(),
      };
      const info = getLastSenderInfo(session);
      expect(info.role).toBe("ai");
      expect(info.label).toBe("🤖 IA:");
    });

    it("identifies outgoing messages sent by human agent", () => {
      const session: WaSession = {
        ...baseSession,
        last_message_direction: "outgoing",
        last_message_at: "2026-10-10T12:00:00Z",
        ai_last_reply_at: null,
        ai_lock_until: null,
      };
      const info = getLastSenderInfo(session);
      expect(info.role).toBe("user");
      expect(info.label).toBe("✓✓ Você:");
    });

    it("identifies incoming messages from client with unread emphasis", () => {
      const session: WaSession = {
        ...baseSession,
        last_message_direction: "incoming",
        unread_count: 1,
      };
      const info = getLastSenderInfo(session);
      expect(info.role).toBe("lead");
      expect(info.label).toBe("↙ Cliente:");
      expect(info.badgeCls).toContain("text-emerald-400");
    });

    it("identifies incoming messages from client when read", () => {
      const session: WaSession = {
        ...baseSession,
        last_message_direction: "in",
        unread_count: 0,
        last_message_at: "2026-10-10T10:00:00Z",
        last_read_at: "2026-10-10T11:00:00Z",
      };
      const info = getLastSenderInfo(session);
      expect(info.role).toBe("lead");
      expect(info.label).toBe("↙ Cliente:");
    });
  });
});
