/**
 * Testes para WeeklyReportWidget
 * Valida renderização de estados: loading, sem dados, com dados
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WeeklyReportWidget } from "@/components/dashboard/WeeklyReportWidget";

// ── Mock Supabase ─────────────────────────────────────────────────────────────
// Armazena a última chain criada para inspeção nos testes
let lastChain: ReturnType<typeof makeChain>;

function makeChain(resolveWith: { data: unknown; error: unknown } | Promise<unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveWith),
  };
  lastChain = chain;
  return chain;
}

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(() => lastChain),
      functions: { invoke: vi.fn().mockResolvedValue({ error: null }) },
    },
  };
});

// Helper: configura chain antes de cada test
function setupChain(resolveWith: { data: unknown; error: unknown }) {
  makeChain(resolveWith);
}

// Importa o mock para poder manipular
import { supabase } from "@/integrations/supabase/client";

describe("WeeklyReportWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe título 'Relatório Semanal'", async () => {
    setupChain({ data: [], error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(lastChain);
    render(<WeeklyReportWidget />);
    await waitFor(() => {
      expect(screen.getByText("Relatório Semanal")).toBeTruthy();
    });
  });

  it("exibe estado vazio quando não há relatório", async () => {
    setupChain({ data: [], error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(lastChain);
    render(<WeeklyReportWidget />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhum relatório gerado ainda/i)).toBeTruthy();
    });
  });

  it("exibe métricas de conversões quando há relatório", async () => {
    const mockReport = {
      week_label: "01/06/2026 – 08/06/2026",
      conversions: 5,
      revenue: 1500,
      new_leads: 12,
      active_conversations: 8,
      unanswered_questions: 2,
      top_flows: [],
    };

    setupChain({
      data: [{ event_data: mockReport, created_at: new Date().toISOString() }],
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(lastChain);

    render(<WeeklyReportWidget />);

    await waitFor(() => {
      // Conversions badge
      expect(screen.getByText("5")).toBeTruthy();
    });
  });

  it("exibe novos leads quando há relatório", async () => {
    const mockReport = {
      week_label: "01/06 – 08/06",
      conversions: 0,
      revenue: 0,
      new_leads: 12,
      active_conversations: 0,
      unanswered_questions: 0,
      top_flows: [],
    };

    setupChain({
      data: [{ event_data: mockReport, created_at: new Date().toISOString() }],
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(lastChain);

    render(<WeeklyReportWidget />);

    await waitFor(() => {
      expect(screen.getByText("12")).toBeTruthy();
    });
  });

  it("exibe nome do fluxo quando top_flows disponíveis", async () => {
    const mockReport = {
      week_label: "01/06 – 08/06",
      conversions: 3,
      revenue: 900,
      new_leads: 5,
      active_conversations: 4,
      unanswered_questions: 0,
      top_flows: [
        { nome: "Fluxo Urgência PIX", conversions: 3, revenue: 900 },
      ],
    };

    setupChain({
      data: [{ event_data: mockReport, created_at: new Date().toISOString() }],
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(lastChain);

    render(<WeeklyReportWidget />);

    await waitFor(() => {
      expect(screen.getByText("Fluxo Urgência PIX")).toBeTruthy();
    });
  });
});
