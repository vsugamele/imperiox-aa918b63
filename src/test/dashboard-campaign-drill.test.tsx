import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import DashboardDrillSheet from "@/components/dashboard/DashboardDrillSheet";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const query = {
    select: () => query, eq: () => query, gte: () => query, lte: () => query, in: () => query,
    then: (resolve: (value: { data: Json[] }) => unknown) => Promise.resolve(resolve({ data: table === "imphq_ads_spend"
      ? [{ conjunto_anuncios: "Audience A", anuncio: "Creative A", valor: 20, moeda: "BRL", compras: 1, checkouts_iniciados: 2, ctr: 3 }]
      : [{ id: "sale", produto_nome: "Matched product", valor: 50, data: { utms: { utm_campaign: "Campaign A" } } }, { id: "other", produto_nome: "Unrelated product", valor: 20, data: { utms: { utm_campaign: "Other" } } }] })),
  };
  return query;
} } }));

describe("campaign drill", () => {
  it("shows actual adset and creative names and matching UTM sales", async () => {
    render(<MemoryRouter><DashboardDrillSheet open onOpenChange={vi.fn()} metric="campaign" period="7d" projectFilter="all" campaignName="Campaign A" /></MemoryRouter>);
    expect(await screen.findByText("Audience A")).toBeInTheDocument();
    expect(screen.getByText("Creative A")).toBeInTheDocument();
    expect(screen.getByText("Matched product")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated product")).not.toBeInTheDocument();
  });
});
