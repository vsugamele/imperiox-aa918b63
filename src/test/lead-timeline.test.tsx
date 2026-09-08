import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadTimeline } from "@/hooks/useLeadTimeline";

const fixtures = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
      then: (resolve: (value: { data: Record<string, unknown>[] }) => unknown) => Promise.resolve(resolve({ data: fixtures.tables[table] ?? [] })),
    };
    return query;
  },
} }));
const at = "2026-09-08T12:00:00Z";

describe("lead timeline JSON boundaries", () => {
  beforeEach(() => { fixtures.tables = {}; });
  it("retains events and form answers without matching unrelated missing-email logs", async () => {
    fixtures.tables = {
      imphq_events: [{ id: "event-1", event_nome: "PageView", created_at: at, event_data: null, page_url: "/relative-path" }],
      imphq_automacao_logs: [
        { id: "unrelated", automacao_id: "auto-1", created_at: at, trigger_data: {}, status: "success" },
        { id: "matched", automacao_id: "auto-1", created_at: at, trigger_data: { lead_data: { lead_id: "lead-1" } }, status: "success", acoes_executadas: [{ tipo: "email", status: "ok" }] },
      ],
      imphq_lead_responses: [
        { id: "answer-1", lead_id: "lead-1", form_id: "form-1", field_key: "email", question: "Email", answer: "test@example.invalid", created_at: at },
        { id: "answer-2", lead_id: "lead-1", form_id: "form-1", field_key: "preferencia", question: "Preferência", answer: "Texto", created_at: at },
      ],
      imphq_capture_forms: [{ id: "form-1", nome: "Contato" }],
    };
    const { result } = renderHook(() => useLeadTimeline({ id: "lead-1" }, [{ id: "auto-1", nome: "Boas-vindas" }]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.leadAutomationLogs.map(log => log.id)).toEqual(["matched"]);
    expect(result.current.leadAutomationLogs[0].details.automacao).toBe("Boas-vindas");
    expect(result.current.formResponses).toHaveLength(1);
    expect(result.current.formResponses[0].answer).toBe("Texto");
    expect(result.current.timeline.find(event => event.id === "event-1")?.subtitle).toBe("/relative-path");
    expect(result.current.timeline.some(event => event.type === "FormResponse")).toBe(true);
  });
  it("clears loading and data when the selected lead is removed", async () => {
    const { result, rerender } = renderHook(({ active }) => useLeadTimeline(active ? { id: "lead-1" } : null, []), { initialProps: { active: true } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ active: false });
    expect(result.current.timeline).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
