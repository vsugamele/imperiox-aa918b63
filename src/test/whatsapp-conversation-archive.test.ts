import { describe, it, expect, vi } from "vitest";
import {
  isArchivedSession,
  getArchiveReason,
  getArchiveReasonConfig,
  ARCHIVE_REASONS,
} from "@/lib/conversationArchive";

describe("WhatsApp Conversation Archive & Clean Inbox Logic", () => {
  it("detects archived status via status string or metadata flag", () => {
    expect(isArchivedSession({ status: "archived" })).toBe(true);
    expect(isArchivedSession({ status: "active", metadata: { archived: true } })).toBe(true);
    expect(isArchivedSession({ status: "active", metadata: { archived: false } })).toBe(false);
    expect(isArchivedSession({ status: "needs_human" })).toBe(false);
    expect(isArchivedSession({ status: "active" })).toBe(false);
  });

  it("extracts archive reason accurately", () => {
    expect(getArchiveReason({ status: "archived", metadata: { archive_reason: "spam" } })).toBe("spam");
    expect(getArchiveReason({ status: "archived", metadata: { archive_reason: "amigo" } })).toBe("amigo");
    expect(getArchiveReason({ status: "archived", metadata: { archive_reason: "fora_projeto" } })).toBe("fora_projeto");
    expect(getArchiveReason({ status: "archived" })).toBe("geral");
  });

  it("provides user-friendly icons and badges for reasons", () => {
    const spamCfg = getArchiveReasonConfig("spam");
    expect(spamCfg.icon).toBe("🚫");
    expect(spamCfg.shortLabel).toBe("Spam");

    const amigoCfg = getArchiveReasonConfig("amigo");
    expect(amigoCfg.icon).toBe("👤");
    expect(amigoCfg.shortLabel).toBe("Amigo");

    const foraCfg = getArchiveReasonConfig("fora_projeto");
    expect(foraCfg.icon).toBe("📦");
    expect(foraCfg.shortLabel).toBe("Outro");

    const geralCfg = getArchiveReasonConfig("geral");
    expect(geralCfg.icon).toBe("📁");
    expect(geralCfg.shortLabel).toBe("Arquivo");
  });

  it("filters out spam and personal contacts from the main active inbox list", () => {
    const sampleSessions = [
      { id: "1", contact_name: "Cliente Lead A", status: "active", unread_count: 2 },
      { id: "2", contact_name: "Spam Bot", status: "archived", metadata: { archive_reason: "spam" }, unread_count: 5 },
      { id: "3", contact_name: "Amigo João", status: "archived", metadata: { archive_reason: "amigo" }, unread_count: 1 },
      { id: "4", contact_name: "Lead Quente B", status: "needs_human", unread_count: 0 },
    ];

    const activeProjectSessions = sampleSessions.filter(s => !isArchivedSession(s));
    expect(activeProjectSessions.length).toBe(2);
    expect(activeProjectSessions.map(s => s.id)).toEqual(["1", "4"]);

    // Notifications from spam/friends are ignored in active counts
    const activeUnreadTotal = activeProjectSessions.reduce((acc, s) => acc + (s.unread_count || 0), 0);
    expect(activeUnreadTotal).toBe(2);
  });
});
