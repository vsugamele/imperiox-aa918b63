import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustosIA from "@/pages/CustosIA";

const state = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, error: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "ai-usage"
    ? { data: state.rows, isLoading: false, isError: state.error }
    : { data: [{ id: "slimsoda", name: "SlimSoda" }] },
}));

describe("CustosIA consumption boundaries", () => {
  it("shows unknown cost as pending, with partial totals when only some calls report cost", () => {
    state.error = false;
    state.rows = [
      { id: "1", project_id: "slimsoda", function_name: "known", model: "m", cost_usd: 0.5, total_tokens: 20 },
      { id: "2", project_id: null, function_name: "unknown", model: null, cost_usd: null, total_tokens: null },
    ];
    render(<CustosIA />);
    expect(screen.getByText(/1 chamada\(s\) sem custo informado; total parcial/)).toBeInTheDocument();
    expect(screen.getAllByText("A confirmar").length).toBeGreaterThan(0);
    expect(screen.getByText("Sem projeto")).toBeInTheDocument();
    expect(screen.getByText("Modelo não informado")).toBeInTheDocument();
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument();
  });

  it("shows unavailable data on query failure rather than a zero cost", () => {
    state.rows = [];
    state.error = true;
    render(<CustosIA />);
    expect(screen.getByRole("alert")).toHaveTextContent("Os valores estão indisponíveis");
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument();
  });
});
