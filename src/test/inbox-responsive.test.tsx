import { act, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Inbox from "@/pages/Inbox";

const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => viewport.mobile }));
vi.mock("@/hooks/useSidebarBadges", () => ({ useSidebarBadges: () => ({ data: { inbox: 0, leads: 0 } }) }));
vi.mock("@/components/mobile/MobileInboxList", () => ({ MobileInboxList: () => <div>Mobile inbox</div> }));
vi.mock("@/pages/WhatsAppPage", () => ({ default: () => <div>WhatsApp conversations</div> }));
vi.mock("@/pages/InstagramPage", () => ({ default: () => <div>Instagram conversations</div> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => {
    const query = {
      select: () => query, neq: () => query, lt: () => query, gt: () => query,
      gte: () => query, order: () => query, limit: () => query,
      then: (resolve: (value: { count: number; data: never[] }) => unknown) => Promise.resolve(resolve({ count: 0, data: [] })),
    };
    return query;
  } },
}));

describe("Inbox responsive hook ordering", () => {
  beforeEach(() => { viewport.mobile = false; localStorage.clear(); });

  it("keeps desktop state while switching to mobile and back", async () => {
    const view = render(<MemoryRouter><Inbox /></MemoryRouter>);
    await screen.findByText("WhatsApp conversations");
    fireEvent.click(screen.getByTitle("Recolher KPIs"));
    expect(localStorage.getItem("wa.showKpiStrip")).toBe("false");
    viewport.mobile = true;
    await act(async () => { view.rerender(<MemoryRouter><Inbox /></MemoryRouter>); });
    expect(screen.getByText("Mobile inbox")).toBeInTheDocument();
    viewport.mobile = false;
    await act(async () => { view.rerender(<MemoryRouter><Inbox /></MemoryRouter>); });
    expect(screen.getByTitle("Expandir KPIs")).toBeInTheDocument();
  });

  it("can start on mobile then render desktop", async () => {
    viewport.mobile = true;
    const view = render(<MemoryRouter><Inbox /></MemoryRouter>);
    expect(screen.getByText("Mobile inbox")).toBeInTheDocument();
    viewport.mobile = false;
    await act(async () => { view.rerender(<MemoryRouter><Inbox /></MemoryRouter>); });
    expect(await screen.findByText("WhatsApp conversations")).toBeInTheDocument();
  });
});

