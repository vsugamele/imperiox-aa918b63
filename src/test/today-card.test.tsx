import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TodayCard from "@/components/dashboard/TodayCard";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = {
      select: () => query, gte: () => query, lte: () => query, in: () => query,
      eq: () => query, limit: () => query,
      then: (resolve: (value: { count: number; data: { id: string; data: { last_outgoing_at: string } }[] }) => unknown) => Promise.resolve(resolve({
        count: 0,
        data: table === "imphq_leads" ? [{ id: "lead-1", data: { last_outgoing_at: "not-a-date" } }] : [],
      })),
    };
    return query;
  },
} }));

describe("TodayCard invalid stored timestamp", () => {
  it("finishes loading without throwing on a malformed outgoing timestamp", async () => {
    render(<MemoryRouter><TodayCard /></MemoryRouter>);
    expect(await screen.findByText("Tudo sob controle")).toBeInTheDocument();
  });
});
