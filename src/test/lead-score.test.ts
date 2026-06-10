/**
 * Testes para a lógica de score de leads (lead-score-updater)
 * Valida regras de pontuação, clamping e detecção de threshold
 */

import { describe, it, expect } from "vitest";

// ── Regras de pontuação (espelho do edge function) ────────────────────────────
const SCORE_RULES = {
  wa_message_incoming: 8,
  email_opened: 4,
  email_clicked: 12,
  checkout_visited: 20,
  purchase_approved: 100,
  flow_attribution: 15,
  in_active_flow: 8,
  inactivity_per_7d: -10,
  inactivity_max_penalty: -40,
};

const CLOSER_THRESHOLD = 70;
const SCORE_MIN = 0;
const SCORE_MAX = 200;

function calcScore({
  waMsgs = 0,
  emailOpens = 0,
  emailClicks = 0,
  hasCheckout = false,
  hasPurchase = false,
  inActiveFlow = false,
  hasAttribution = false,
  weeksSilent = 0,
}: {
  waMsgs?: number;
  emailOpens?: number;
  emailClicks?: number;
  hasCheckout?: boolean;
  hasPurchase?: boolean;
  inActiveFlow?: boolean;
  hasAttribution?: boolean;
  weeksSilent?: number;
}): number {
  let score = 0;

  // WA engagement (cap: 6 mensagens)
  score += Math.min(waMsgs, 6) * SCORE_RULES.wa_message_incoming;

  // Email
  score += Math.min(emailOpens, 5) * SCORE_RULES.email_opened;
  score += Math.min(emailClicks, 3) * SCORE_RULES.email_clicked;

  // Comportamento
  if (hasCheckout) score += SCORE_RULES.checkout_visited;
  if (hasPurchase) score += SCORE_RULES.purchase_approved;
  if (inActiveFlow) score += SCORE_RULES.in_active_flow;
  if (hasAttribution) score += SCORE_RULES.flow_attribution;

  // Inactividade
  const penalty = Math.max(SCORE_RULES.inactivity_max_penalty, weeksSilent * SCORE_RULES.inactivity_per_7d);
  score += penalty;

  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("Lead score — cálculo básico", () => {
  it("lead sem atividade tem score zero", () => {
    expect(calcScore({})).toBe(0);
  });

  it("1 mensagem WA = 8 pontos", () => {
    expect(calcScore({ waMsgs: 1 })).toBe(8);
  });

  it("cap de 6 mensagens WA = 48 pontos", () => {
    expect(calcScore({ waMsgs: 10 })).toBe(48); // 6 * 8 = 48
  });

  it("checkout visitado adiciona 20 pontos", () => {
    expect(calcScore({ hasCheckout: true })).toBe(20);
  });

  it("compra aprovada adiciona 100 pontos", () => {
    expect(calcScore({ hasPurchase: true })).toBe(100);
  });

  it("email opened cap em 5 = 20 pontos", () => {
    expect(calcScore({ emailOpens: 10 })).toBe(20); // 5 * 4 = 20
  });

  it("email clicked cap em 3 = 36 pontos", () => {
    expect(calcScore({ emailClicks: 10 })).toBe(36); // 3 * 12 = 36
  });
});

describe("Lead score — clamping", () => {
  it("score não pode ser negativo", () => {
    expect(calcScore({ weeksSilent: 100 })).toBe(0);
  });

  it("score não pode exceder 200", () => {
    const score = calcScore({
      hasPurchase: true,
      waMsgs: 6,
      emailOpens: 5,
      emailClicks: 3,
      hasCheckout: true,
      inActiveFlow: true,
      hasAttribution: true,
    });
    // 100 + 48 + 20 + 36 + 20 + 8 + 15 = 247 → clampado em 200
    expect(score).toBe(200);
  });

  it("penalidade máxima de inatividade é -40", () => {
    // 4 semanas = -40, 8 semanas ainda = -40
    const score4 = calcScore({ waMsgs: 6, weeksSilent: 4 }); // 48 - 40 = 8
    const score8 = calcScore({ waMsgs: 6, weeksSilent: 8 }); // 48 - 40 = 8
    expect(score4).toBe(8);
    expect(score8).toBe(8);
  });
});

describe("Lead score — threshold do closer", () => {
  it("score abaixo de 70 não dispara closer", () => {
    const score = calcScore({ waMsgs: 6, hasCheckout: false }); // 48
    expect(score).toBeLessThan(CLOSER_THRESHOLD);
  });

  it("score >= 70 dispara closer", () => {
    // 6 mensagens (48) + checkout (20) + flow (8) = 76 >= 70
    const score = calcScore({ waMsgs: 6, hasCheckout: true, inActiveFlow: true });
    expect(score).toBeGreaterThanOrEqual(CLOSER_THRESHOLD);
  });

  it("threshold crossing: prevScore < 70, novoScore >= 70", () => {
    const prevScore = 48;
    const newScore = calcScore({ waMsgs: 6, hasCheckout: true }); // 48 + 20 = 68... ajustando
    const newScore2 = calcScore({ waMsgs: 6, hasCheckout: true, emailOpens: 1 }); // 48 + 20 + 4 = 72
    const crossedThreshold = prevScore < CLOSER_THRESHOLD && newScore2 >= CLOSER_THRESHOLD;
    expect(crossedThreshold).toBe(true);
  });

  it("threshold crossing não ocorre se prevScore já era >= 70", () => {
    const prevScore = 72;
    const newScore = 80;
    const crossedThreshold = prevScore < CLOSER_THRESHOLD && newScore >= CLOSER_THRESHOLD;
    expect(crossedThreshold).toBe(false);
  });

  it("threshold crossing não ocorre se novoScore < 70", () => {
    const prevScore = 0;
    const newScore = 48; // abaixo
    const crossedThreshold = prevScore < CLOSER_THRESHOLD && newScore >= CLOSER_THRESHOLD;
    expect(crossedThreshold).toBe(false);
  });
});

describe("Lead score — cenários reais", () => {
  it("lead frio: sem atividade há 3 semanas = penalizado mas não negativo", () => {
    const score = calcScore({ weeksSilent: 3 }); // -30 → clampado em 0
    expect(score).toBe(0);
  });

  it("lead morno: 3 mensagens + 2 email opens", () => {
    const score = calcScore({ waMsgs: 3, emailOpens: 2 }); // 24 + 8 = 32
    expect(score).toBe(32);
  });

  it("lead quente: 6 mensagens + checkout + flow ativo", () => {
    const score = calcScore({ waMsgs: 6, hasCheckout: true, inActiveFlow: true });
    // 48 + 20 + 8 = 76
    expect(score).toBe(76);
    expect(score).toBeGreaterThanOrEqual(CLOSER_THRESHOLD);
  });

  it("lead convertido: compra aprovada sempre domina", () => {
    const score = calcScore({ hasPurchase: true });
    expect(score).toBeGreaterThanOrEqual(100);
  });
});
