import { describe, expect, it } from "vitest";
import { normalizeFunnelEvent } from "@shared/funnel-event";
const now = new Date("2026-10-06T12:00:00Z");
describe("tracker ingestion contract", () => {
  it("does not fabricate sessions or treat cart as checkout", () => { const r = normalizeFunnelEvent({ project: "slimsoda", event_name: "AddToCart" }, now); expect(r.session_id).toBeNull(); expect(r.step).toBe("add_to_cart"); });
  it("requires immutable event/session identity for v2", () => { expect(() => normalizeFunnelEvent({ project_id: "leaftide", step: "vsl_view", meta: { tracker_version: "TRK1.1" } }, now)).toThrow("missing_identity"); });
  it("accepts malformed encoding and removes query PII", () => { const r = normalizeFunnelEvent({ project_id: "leaftide", step: "vsl_view", xcod: "camp|set|ad%oops", page_url: "https://our.site/vsl?email=private#phone" }, now); expect(r.creative_id).toBe("ad%oops"); expect(r.page_url).toBe("https://our.site/vsl"); });
  it("rejects future timestamps and unrecognized steps", () => { expect(() => normalizeFunnelEvent({ project_id: "leaftide", step: "purchase" }, now)).toThrow("invalid_payload"); expect(() => normalizeFunnelEvent({ project_id: "leaftide", step: "vsl_view", event_at: "2030-01-01" }, now)).toThrow("invalid_event_time"); });
});
