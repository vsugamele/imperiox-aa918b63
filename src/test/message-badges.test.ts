/**
 * Testes para lógica de badges nas mensagens
 * Valida detecção de source (reengajamento / closer)
 */

import { describe, it, expect } from "vitest";

// ── Helpers (espelham a lógica dos componentes) ───────────────────────────────

interface MessageMetadata {
  source?: string;
  days_silent?: number;
  lead_score?: number;
}

function getReengagementBadge(metadata: unknown): { show: boolean; daysSilent: number } {
  const m = metadata as MessageMetadata | null;
  if (!m || m.source !== "wa-reengagement") return { show: false, daysSilent: 0 };
  return { show: true, daysSilent: m.days_silent ?? 0 };
}

function getCloserBadge(metadata: unknown): { show: boolean; leadScore: number } {
  const m = metadata as MessageMetadata | null;
  if (!m || m.source !== "wa-closer-trigger") return { show: false, leadScore: 0 };
  return { show: true, leadScore: m.lead_score ?? 0 };
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("Badge de reengajamento", () => {
  it("não exibe quando metadata é null", () => {
    expect(getReengagementBadge(null).show).toBe(false);
  });

  it("não exibe quando source é diferente", () => {
    expect(getReengagementBadge({ source: "manual" }).show).toBe(false);
    expect(getReengagementBadge({ source: "wa-closer-trigger" }).show).toBe(false);
  });

  it("exibe quando source é wa-reengagement", () => {
    const result = getReengagementBadge({ source: "wa-reengagement", days_silent: 7 });
    expect(result.show).toBe(true);
    expect(result.daysSilent).toBe(7);
  });

  it("days_silent padrão é 0 quando não informado", () => {
    const result = getReengagementBadge({ source: "wa-reengagement" });
    expect(result.daysSilent).toBe(0);
  });

  it("exibe corretamente com 21 dias de silêncio", () => {
    const result = getReengagementBadge({ source: "wa-reengagement", days_silent: 21 });
    expect(result.show).toBe(true);
    expect(result.daysSilent).toBe(21);
  });
});

describe("Badge de closer automático", () => {
  it("não exibe quando metadata é null", () => {
    expect(getCloserBadge(null).show).toBe(false);
  });

  it("não exibe quando source é diferente", () => {
    expect(getCloserBadge({ source: "wa-reengagement" }).show).toBe(false);
    expect(getCloserBadge({ source: "manual" }).show).toBe(false);
  });

  it("exibe quando source é wa-closer-trigger", () => {
    const result = getCloserBadge({ source: "wa-closer-trigger", lead_score: 85 });
    expect(result.show).toBe(true);
    expect(result.leadScore).toBe(85);
  });

  it("leadScore padrão é 0 quando não informado", () => {
    const result = getCloserBadge({ source: "wa-closer-trigger" });
    expect(result.leadScore).toBe(0);
  });

  it("exibe corretamente com score acima do threshold", () => {
    const result = getCloserBadge({ source: "wa-closer-trigger", lead_score: 150 });
    expect(result.show).toBe(true);
    expect(result.leadScore).toBe(150);
  });
});

describe("Badges são mutuamente exclusivos", () => {
  it("uma mensagem não pode ter os dois badges ao mesmo tempo", () => {
    const reeng = getReengagementBadge({ source: "wa-reengagement", days_silent: 5 });
    const closer = getCloserBadge({ source: "wa-reengagement", days_silent: 5 });
    // Reengajamento mostra, closer não
    expect(reeng.show).toBe(true);
    expect(closer.show).toBe(false);
  });

  it("mensagem sem source não mostra nenhum badge", () => {
    const reeng = getReengagementBadge({ source: undefined });
    const closer = getCloserBadge({ source: undefined });
    expect(reeng.show).toBe(false);
    expect(closer.show).toBe(false);
  });
});
