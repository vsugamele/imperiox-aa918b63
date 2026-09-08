import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import ImperiusSuggestionsTab from "@/components/inbox/ImperiusSuggestionsTab";

const calls = vi.hoisted(() => [] as { table: string; operation: string; value: unknown }[]);
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let columns = "";
    const query = {
      select: (value: string) => { columns = value; calls.push({ table, operation: "select", value }); return query; },
      in: (field: string, value: unknown) => { calls.push({ table, operation: field, value }); return query; },
      gte: () => query, lt: () => query, gt: () => query, neq: () => query, not: () => query, order: () => query, limit: () => query,
      then: (resolve: (result: { data: Json[] }) => unknown) => {
        const data: Json[] = table === "imphq_vendas" ? [{ id: "sale", lead_id: "lead", status: "pendente", data: { last_intent_at: new Date(Date.now() - 3 * 3600000).toISOString() }, produto_nome: "Produto", valor: 30 }]
          : table === "imphq_leads" && columns === "id,nome,phone" ? [{ id: "lead", nome: "Contato real", phone: "5511999999999" }]
          : table === "imphq_wa_conversations" && columns.includes("last_incoming_at") ? [{ id: "conversation", phone: "5511888888888", contact_name: "Aguardando humano", last_incoming_at: new Date(Date.now() - 2 * 3600000).toISOString(), last_message_direction: "incoming", ia_ativa: false }]
          : [];
        return Promise.resolve(resolve({ data }));
      },
    };
    return query;
  },
} }));

describe("Imperius suggestions schema", () => {
  it("uses stored payment intent and linked contact, and recognizes paused incoming conversations", async () => {
    render(<ImperiusSuggestionsTab />);
    expect(await screen.findByText("Contato real")).toBeInTheDocument();
    expect(await screen.findByText(/IA pausada/)).toBeInTheDocument();
    expect(calls).toContainEqual({ table: "imphq_wa_conversations", operation: "last_message_direction", value: ["incoming", "in"] });
    expect(calls.filter(c => c.operation === "select").map(c => c.value).join(" ")).not.toMatch(/last_inbound_at|last_outbound_at|comprador_nome/);
  });
});

