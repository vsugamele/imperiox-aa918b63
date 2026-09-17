import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileNativeCinna } from "@/lib/cinna-shield-x1/native-contract";
import { readJourney, journeyMetrics, safeJourneyMedia, type JourneyExecution } from "@/lib/cinna-shield-x1/journey";

const snapshot = compileNativeCinna(JSON.parse(readFileSync(resolve("docs/sessions/2026-09/cinna-native-CSX1.7-actions.json"), "utf8")));
function execution(events: unknown[] = [], state: Record<string, unknown> = {}, patch: Partial<JourneyExecution> = {}): JourneyExecution {
  return { id: "execution", lead_id: "lead", channel_session_id: "session", status: "waiting", current_step: snapshot.waitSteps[0], created_at: "2026-09-08T12:00:00Z", updated_at: "2026-09-08T12:01:00Z", error_message: null,
    step_results: [{ tipo: "cinna_runtime", runtime: { snapshot, state: { stageIndex: 0, status: "active", version: snapshot.config.version, ...state } } }, ...events], ...patch };
}
const receipt = (step = 0, status = "sent") => ({ step, status, started_at: "2026-09-08T12:00:02Z" });
const turn = (action = "hold", id = "event", stage = 0) => ({ tipo: "cinna_turn", status: "confirmed", step: snapshot.waitSteps[stage], stage_id: snapshot.config.stages[stage].id, event_id: id, action, timestamp: "2026-09-08T12:01:00Z" });
describe("Cinna conversation metrics", () => {
  it("does not count runtime initialization or pending/failed delivery as reached", () => {
    const result = readJourney(execution([receipt(0, "delivery_pending"), receipt(0, "error")]))!;
    expect(result.stages.every(stage => !stage.reached)).toBe(true);
    expect(result.stageTitle).toBe("Ainda sem etapa entregue");
  });
  it("deduplicates repeated receipts and event IDs per conversation", () => {
    const row = readJourney(execution([receipt(), receipt(), turn(), turn(), turn("advance", "second")]))!;
    const metrics = journeyMetrics([row]);
    expect(metrics[0]).toMatchObject({ reached: 1, responded: 1, advanced: 1, holds: 1 });
    expect(row.turns).toHaveLength(2);
  });
  it("does not call next stage reached just because the policy cursor advanced", () => {
    const result = readJourney(execution([receipt(), turn("advance")], { stageIndex: 1 }, { status: "running", current_step: snapshot.waitSteps[0] + 1 }))!;
    expect(result.stages[0].advanced).toBe(true);
    expect(result.stages[1].reached).toBe(false);
    expect(result.stageTitle).toBe(snapshot.config.stages[0].title);
  });
  it("keeps current waiting distinct from terminal handoff, stop and checkout", () => {
    for (const [stateStatus, action, status] of [["human", "human", "human"], ["stopped", "stop", "stopped"], ["complete", "checkout", "checkout"]]) {
      const result = readJourney(execution([receipt(), turn(action)], { status: stateStatus, checkoutSent: action === "checkout" }))!;
      expect(result.status).toBe(status);
      expect(result.stages[0].waiting).toBe(false);
    }
    expect(readJourney(execution([receipt()]))!.stages[0].waiting).toBe(true);
  });
  it("does not count uncertain delivery as a confirmed turn", () => {
    const row = execution([receipt(), { ...turn(), status: "pending" }], {}, { error_message: "Unconfirmed" });
    expect(readJourney(row)).toMatchObject({ status: "review", turns: [] });
    expect(readJourney(row)!.stages[0].waiting).toBe(false);
  });
  it("shows unconfirmed executor checkpoints, but a later receipt resolves them", () => {
    expect(readJourney(execution([receipt(0, "delivery_pending")], {}, { status: "running" }))!.status).toBe("review");
    expect(readJourney(execution([receipt(0, "delivery_pending"), receipt()]))!.status).toBe("waiting");
  });
  it("uses pinned titles and groups metrics from different versions separately", () => {
    const a = readJourney(execution([receipt()]))!;
    const b = readJourney(execution([receipt()], { version: "previous-version" }, { id: "older" }))!;
    expect(journeyMetrics([a, b]).filter(stage => stage.index === 0)).toHaveLength(2);
    expect(a.stages[0].title).toBe(snapshot.config.stages[0].title);
  });
  it("does not reconstruct missing old snapshots or infer past responses", () => {
    expect(readJourney(execution([], {}, { step_results: [] }))).toBeNull();
    const result = readJourney(execution([receipt()], { stageIndex: 2 }))!;
    expect(result.stages.every(stage => !stage.responded)).toBe(true);
  });
  it("counts returning lead as separate conversations with explicit denominator", () => {
    const a = readJourney(execution([receipt()]))!;
    const b = readJourney(execution([receipt()], {}, { id: "second" }))!;
    expect(journeyMetrics([a, b])[0].reached).toBe(2);
  });
  it("excludes instruction-like captures and raw text from journey telemetry", () => {
    const result = readJourney(execution([turn()], { answers: { concern: "PRIVATE HEALTH TEXT" } }))!;
    expect(JSON.stringify(result)).not.toContain("PRIVATE HEALTH TEXT");
  });
  it("allows only credential-free HTTPS media", () => {
    for (const url of ["javascript:alert(1)", "http://example.org/a.mp3", "https://user:pass@example.org/a.mp3", null]) expect(safeJourneyMedia(url)).toBeNull();
    expect(safeJourneyMedia("https://example.org/audio.mp3")).toBe("https://example.org/audio.mp3");
  });
});
