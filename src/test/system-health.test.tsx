import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { parseHealthReport, summarize, timeAgo } from "@/lib/system-health";
import SaudeSistema from "@/pages/SaudeSistema";
import { HealthAlertStrip } from "@/components/saude/HealthAlertStrip";

const report = {
  generated_at: "2026-10-05T17:00:00Z",
  checks: [
    { key: "meta_token:jp", area: "Tráfego", label: "Conexão Meta Ads — JP", status: "fail", last_at: "2026-06-26T17:30:00Z",
      detail: "Session has expired", hint: "Token da Meta expirou: gere um novo token." },
    { key: "vendas", area: "Vendas", label: "Vendas aprovadas chegando", status: "ok", last_at: "2026-10-05T16:00:00Z", detail: "3 venda(s)" },
    { key: "weird", area: "Infra", label: "Algo novo", status: "bogus" },
  ],
};

const rpc = vi.fn(async () => ({ data: report, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: () => rpc() } }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe("system health", () => {
  it("parses the report and treats unknown statuses as 'sem dado'", () => {
    const parsed = parseHealthReport(report);
    expect(parsed.checks[2].status).toBe("unknown");
    expect(summarize(parsed.checks)).toEqual({ ok: 1, warn: 0, fail: 1, unknown: 1 });
  });

  it("formats relative time without inventing a value", () => {
    const now = new Date("2026-10-05T17:00:00Z").getTime();
    expect(timeAgo(null, now)).toBe("sem registro");
    expect(timeAgo("2026-10-05T16:30:00Z", now)).toBe("há 30 min");
    expect(timeAgo("2026-10-01T17:00:00Z", now)).toBe("há 4 dias");
  });

  it("shows broken checks first with what to do", async () => {
    wrap(<SaudeSistema />);
    expect(await screen.findByText("Conexão Meta Ads — JP")).toBeInTheDocument();
    expect(screen.getByText(/gere um novo token/)).toBeInTheDocument();
    expect(screen.getByText("Vendas aprovadas chegando")).toBeInTheDocument();
  });

  it("alerts on /hoje only when something is broken", async () => {
    wrap(<HealthAlertStrip />);
    expect(await screen.findByTestId("health-alert-strip")).toHaveTextContent("1 coisa(s) quebrada(s)");
  });
});
