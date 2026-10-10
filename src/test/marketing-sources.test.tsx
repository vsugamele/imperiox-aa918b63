import { render, screen, waitFor } from "@testing-library/react";
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
});
