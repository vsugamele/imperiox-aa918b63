import { describe, expect, it } from "vitest";
import {
  BUYING_RE, EMOTIONAL_RE, cachedAudioUrl, decideVoice, inFailurePause, inQuotaCooldown, isQuotaError, voiceTextHash,
  type VoiceDecisionInput, type VoiceLogEntry,
} from "@shared/voice-policy";

const now = new Date("2026-10-01T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
const tts = (status: VoiceLogEntry["status"], minutes: number, conversation_id = "c1", extra: Partial<VoiceLogEntry> = {}): VoiceLogEntry =>
  ({ kind: "tts", status, conversation_id, created_at: ago(minutes), ...extra });
const base = (over: Partial<VoiceDecisionInput> = {}): VoiceDecisionInput => ({
  trigger: "first_contact", draftMode: false, isGroupOrBroadcast: false, providerSupportsAudio: true,
  conversationId: "c1", recentLog: [], now, ...over,
});

describe("voice policy", () => {
  it("never spends on drafts, groups, providers without audio or missing triggers", () => {
    expect(decideVoice(base({ trigger: null })).blockedBy).toBe("no_trigger");
    expect(decideVoice(base({ draftMode: true })).blockedBy).toBe("draft_mode");
    expect(decideVoice(base({ isGroupOrBroadcast: true })).blockedBy).toBe("group_or_broadcast");
    expect(decideVoice(base({ providerSupportsAudio: false })).blockedBy).toBe("provider_without_audio");
    expect(decideVoice(base())).toEqual({ useVoice: true, reason: "first_contact", blockedBy: null });
  });

  it("stops for an hour after the provider reports no credits", () => {
    expect(inQuotaCooldown([tts("quota_exceeded", 30)], now)).toBe(true);
    expect(inQuotaCooldown([tts("quota_exceeded", 90)], now)).toBe(false);
    expect(decideVoice(base({ recentLog: [tts("quota_exceeded", 5)] })).blockedBy).toBe("quota_cooldown");
  });

  it("pauses after 3 failures in a row, and a successful send resets the count", () => {
    const failures = [tts("send_failed", 10), tts("tts_failed", 20), tts("send_failed", 30)];
    expect(inFailurePause(failures, now)).toBe(true);
    expect(inFailurePause([tts("send_failed", 10), tts("sent", 15), tts("tts_failed", 20), tts("send_failed", 30)], now)).toBe(false);
    expect(inFailurePause([tts("send_failed", 10), tts("send_failed", 20), tts("send_failed", 7 * 60)], now)).toBe(false);
    expect(decideVoice(base({ recentLog: failures })).blockedBy).toBe("failure_pause");
  });

  it("caps voice replies per conversation per day, except steps that force audio", () => {
    const log = [tts("sent", 60), tts("sent", 120), tts("sent", 30, "c2")];
    expect(decideVoice(base({ recentLog: log })).blockedBy).toBe("conversation_daily_cap");
    expect(decideVoice(base({ recentLog: log, conversationId: "c3" })).useVoice).toBe(true);
    expect(decideVoice(base({ recentLog: log, trigger: "flow_step_forced" })).useVoice).toBe(true);
  });

  it("reuses an audio already generated for the same voice and text", () => {
    const hash = voiceTextHash("jp-voice", "Fala, irmão! Bora destravar esse corte? ");
    expect(hash).toBe(voiceTextHash("jp-voice", "Fala, irmão! Bora destravar esse corte?"));
    expect(hash).not.toBe(voiceTextHash("outra-voz", "Fala, irmão! Bora destravar esse corte?"));
    const log = [tts("send_failed", 10, "c1", { text_hash: hash, audio_url: "https://x/voice_1.mp3" })];
    expect(cachedAudioUrl(log, hash, now)).toBe("https://x/voice_1.mp3");
    expect(cachedAudioUrl(log, "outro", now)).toBeNull();
    expect(cachedAudioUrl([tts("generated", 8 * 24 * 60, "c1", { text_hash: hash, audio_url: "https://x/old.mp3" })], hash, now)).toBeNull();
  });

  it("recognizes no-credit answers and keeps triggers narrow", () => {
    expect(isQuotaError(401, '{"detail":{"status":"quota_exceeded","message":"This request exceeds your quota"}}')).toBe(true);
    expect(isQuotaError(400, '{"detail":"invalid voice"}')).toBe(false);
    expect(EMOTIONAL_RE.test("preciso de ajuda pra entrar hoje")).toBe(false);
    expect(EMOTIONAL_RE.test("perdi meu emprego e tô com medo")).toBe(true);
    expect(BUYING_RE.test("não consigo acesso, como entrar?")).toBe(false);
    expect(BUYING_RE.test("qual o valor no pix?")).toBe(true);
  });
});
