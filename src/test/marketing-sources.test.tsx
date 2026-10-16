import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/marketing-load", () => ({ loadMarketing: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/dashboard/SeoResearchLog", () => ({ SeoResearchLog: ({ projectId }: { projectId: string }) => <div>SEO do projeto {projectId}</div> }));
import { loadMarketing } from "@/lib/marketing-load";
import { MarketingSources } from "@/components/dashboard/MarketingSources";
describe("Existing dashboard source view", () => {
  it("requires explicit project and does not request a cross-project aggregate", () => {
    render(<QueryClientProvider client={new QueryClient()}><MarketingSources projectId="all" /></QueryClientProvider>);
    expect(screen.getByText(/Selecione um projeto para reconciliar/)).toBeInTheDocument(); expect(loadMarketing).not.toHaveBeenCalled();
  });
  it("shows unavailable separately from absent and does not fabricate zero paid orders", async () => {
    const absent = { rows: [], error: false, truncated: false };
    vi.mocked(loadMarketing).mockResolvedValue({ sales: absent, ads: { ...absent, error: true }, events: absent, funnel: absent, leads: absent, health: null });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MarketingSources projectId="linfaflow" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("Fonte indisponível")).toBeInTheDocument());
    expect(screen.getByText(/zero não confirmado/)).toBeInTheDocument(); expect(screen.getByText("Sem ingestão confirmada")).toBeInTheDocument(); expect(screen.getByText("SEO do projeto linfaflow")).toBeInTheDocument();
    expect(vi.mocked(loadMarketing).mock.calls[0][0]).toBe("linfaflow");
  });
  it("navigates project, date and source without leaking prior project state; flags stale source", async () => {
    // jsdom has no scrolling layout; keep Radix selection behavior intact and supply only this DOM API.
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.mocked(loadMarketing).mockClear();
    const absent = { rows: [], error: false, truncated: false };
    vi.mocked(loadMarketing).mockResolvedValue({ sales: absent, ads: { ...absent, rows: [{ id: "a", source: "zernio", plataforma: "Facebook", ad_id: "a1", data_ref: "2026-10-01", moeda: "BRL", valor: 0, landing_page_views: 0, init_checkout: 0 }] }, events: absent, funnel: absent, leads: absent, health: { meta_ultimo_sync: null, meta_status: null, zernio_ultimo_sync: "2026-01-01T00:00:00Z", zernio_status: "success" } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(<QueryClientProvider client={client}><MarketingSources key="jp_freitas" projectId="jp_freitas" /></QueryClientProvider>);
    expect(await screen.findByText("Fonte defasada")).toBeInTheDocument();
    expect(screen.getByText(/BRL: gasto 0/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("De (UTC)"), { target: { value: "2026-09-01" } });
    await waitFor(() => expect(vi.mocked(loadMarketing).mock.calls.some(c => c[1] === "2026-09-01T00:00:00.000Z")).toBe(true));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: " " });
    fireEvent.click(await screen.findByRole("option", { name: "Checkout" }));
    expect(screen.queryByText("Fonte defasada")).not.toBeInTheDocument();
    expect(screen.getByText(/zero não confirmado/)).toBeInTheDocument();
    rerender(<QueryClientProvider client={client}><MarketingSources key="linfaflow" projectId="linfaflow" /></QueryClientProvider>);
    expect(await screen.findByText("Fonte defasada")).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(loadMarketing).mock.calls.at(-1)?.[0]).toBe("linfaflow"));
    expect(screen.getByText("SEO do projeto linfaflow")).toBeInTheDocument();
  });
});
