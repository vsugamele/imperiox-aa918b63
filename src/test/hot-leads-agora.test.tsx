import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import HotLeadsInbox from "@/components/leads/HotLeadsInbox";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const conversations = [{ id: "c1", phone: "5511988887777", contact_name: "Marcos", project_id: "jp", last_message: "Qual o valor do curso?", last_message_at: minutesAgo(40), last_message_direction: "incoming", jid_suffix: "s.whatsapp.net" }];

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
  from: (table: string) => {
    const rows = table === "imphq_wa_conversations" ? conversations : [];
    const q = {
      select: () => q, eq: () => q, gte: () => q, in: () => q, order: () => q, limit: () => q,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
    };
    return q;
  },
} }));

const leads = [
  { id: "l1", nome: "Ana Pix", phone: "5511911112222", status: "pix_gerado", score: 10, updated_at: minutesAgo(20), project_id: "jp", data: { stage: "pix_gerado", ultimo_status: "pix_gerado" } },
  { id: "l2", nome: "Bruno Quente", phone: "5511933334444", status: "lead", score: 90, updated_at: minutesAgo(5), project_id: "jp", data: {} },
];

describe("Leads → Agora", () => {
  it("shows who is waiting for a reply first, with a direct link to the conversation, then groups the rest by next action", async () => {
    render(<MemoryRouter><HotLeadsInbox leads={leads} projects={[{ id: "jp", name: "JP Freitas" }]} onOpenLead={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Agora: quem precisa de ação")).toBeInTheDocument();
    const responder = (await screen.findByText("Responder agora")).closest("section")!;
    expect(within(responder).getByText("Marcos")).toBeInTheDocument();
    expect(within(responder).getByText(/esperando há 40 min/)).toBeInTheDocument();
    expect(within(responder).getByRole("link", { name: /Abrir conversa/ })).toHaveAttribute("href", "/inbox?tab=whatsapp&phone=5511988887777");
    const sections = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(sections[0]).toBe("Responder agora");
    expect(screen.getAllByText(/Próxima ação:/).length).toBeGreaterThan(1);
  });
});
