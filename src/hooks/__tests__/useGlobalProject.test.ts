import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGlobalProject } from "../useGlobalProject";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({
          order: async () => ({
            data: [
              { id: "proj-1", name: "LinfaFlow", icon: "💧", category: "Nutra" },
              { id: "proj-2", name: "SlimSoda", icon: "🥤", category: "Nutra" },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useGlobalProject", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults projectId to null when storage is empty or 'all'", () => {
    const { result } = renderHook(() => useGlobalProject(), { wrapper: createWrapper() });
    expect(result.current.projectId).toBeNull();
    expect(Array.isArray(result.current.projects)).toBe(true);
  });

  it("normalizes 'all' and '__all__' to null and persists 'all' in localStorage", () => {
    const { result } = renderHook(() => useGlobalProject(), { wrapper: createWrapper() });

    act(() => {
      result.current.setProjectId("proj-1");
    });
    expect(result.current.projectId).toBe("proj-1");
    expect(localStorage.getItem("imphq:global:project")).toBe("proj-1");

    act(() => {
      result.current.setProjectId("all");
    });
    expect(result.current.projectId).toBeNull();
    expect(localStorage.getItem("imphq:global:project")).toBe("all");
  });
});
