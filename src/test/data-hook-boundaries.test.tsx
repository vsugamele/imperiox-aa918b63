import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLead360 } from "@/hooks/useLead360";
import { useCreativeContext } from "@/hooks/useCreativeContext";

const responses = vi.hoisted(() => ({ rpc: vi.fn(), project: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: responses.rpc,
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: responses.project };
    return query;
  },
} }));
function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("JSON boundaries in data hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retains valid RPC lead and sale data including additional metadata", async () => {
    responses.rpc.mockResolvedValue({ error: null, data: {
      lead: { id: "lead-1", nome: "Lead", data: { source: "form" } },
      timeline: [{ kind: "venda", at: "2026-09-08T00:00:00Z", data: { valor: 42, status: "paid", extra: "retained" } }],
    } });
    const { result } = renderHook(() => useLead360("lead-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.timeline[0].data.valor).toBe(42);
    expect(result.current.data?.timeline[0].data.extra).toBe("retained");
  });

  it("keeps the lead visible while excluding unsupported or malformed events", async () => {
    responses.rpc.mockResolvedValue({ error: null, data: {
      lead: { id: "lead-1" }, timeline: [{ kind: "venda", at: {}, data: { valor: 42 } }, { kind: "future", at: "2026-09-08", data: null }],
    } });
    const { result } = renderHook(() => useLead360("lead-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.lead?.id).toBe("lead-1");
    expect(result.current.data?.timeline).toEqual([]);
  });

  it("preserves the RPC not-found and error envelope", async () => {
    responses.rpc.mockResolvedValue({ error: null, data: { lead: null, timeline: [], error: "lookup failed" } });
    const { result } = renderHook(() => useLead360("missing"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ lead: null, timeline: [], error: "lookup failed" });
  });

  it("reads briefing stored as a JSON string", async () => {
    responses.project.mockResolvedValue({ data: { data: JSON.stringify({ briefing: {
      avatar: { descricao: "Compradores", dores: ["Tempo", "Custo"] },
      branding: { tom: "Direto", cores: ["azul"] },
    } }) } });
    const { result } = renderHook(() => useCreativeContext("project-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatar).toBe("Quem é: Compradores\nDores: Tempo; Custo");
    expect(result.current.branding).toBe("Tom: Direto\nCores: azul");
  });

  it("uses empty context for malformed serialized briefing", async () => {
    responses.project.mockResolvedValue({ data: { data: "{broken" } });
    const { result } = renderHook(() => useCreativeContext("project-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.avatar).toBe("");
    expect(result.current.branding).toBe("");
  });
});
