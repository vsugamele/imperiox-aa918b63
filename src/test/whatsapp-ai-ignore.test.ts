import { describe, it, expect, vi } from "vitest";
import {
  isPhoneInIgnoredList,
  isChatAiIgnored,
} from "@/lib/whatsappAiIgnore";

describe("WhatsApp AI Ignore & Stop Analyzing/Replying Logic", () => {
  it("matches phone numbers in ignored list regardless of symbols or formatting", () => {
    const list = ["+55 (11) 99999-8888", "120363425336533862", "5521988887777"];

    expect(isPhoneInIgnoredList("5511999998888", list)).toBe(true);
    expect(isPhoneInIgnoredList("+5511999998888", list)).toBe(true);
    expect(isPhoneInIgnoredList("120363425336533862", list)).toBe(true);
    expect(isPhoneInIgnoredList("5521988887777", list)).toBe(true);

    expect(isPhoneInIgnoredList("5511999991111", list)).toBe(false);
    expect(isPhoneInIgnoredList(null, list)).toBe(false);
    expect(isPhoneInIgnoredList("120363425336533862", [])).toBe(false);
    expect(isPhoneInIgnoredList("120363425336533862", null)).toBe(false);
  });

  it("detects AI ignored state via ia_ativa flag", () => {
    expect(isChatAiIgnored({ ia_ativa: false })).toBe(true);
    expect(isChatAiIgnored({ ia_ativa: true })).toBe(false);
    expect(isChatAiIgnored({ ia_ativa: null })).toBe(false);
  });

  it("detects AI ignored state via metadata.ai_ignored", () => {
    expect(isChatAiIgnored({ ia_ativa: true, metadata: { ai_ignored: true } })).toBe(true);
    expect(isChatAiIgnored({ ia_ativa: true, metadata: { ai_ignored: false } })).toBe(false);
  });

  it("detects AI ignored state when session phone matches ignored_phones list", () => {
    const ignoredList = ["120363425336533862"];

    expect(
      isChatAiIgnored(
        { phone: "120363425336533862", ia_ativa: true },
        ignoredList
      )
    ).toBe(true);

    expect(
      isChatAiIgnored(
        { phone: "5511999990000", ia_ativa: true },
        ignoredList
      )
    ).toBe(false);
  });
});
