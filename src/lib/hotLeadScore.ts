// Calculadora de "calor" de leads — sinais de oportunidade urgente para o time agir.
// Roda no client, sem novas tabelas. Recebe lead enriquecido + sinais auxiliares.

export type HotReason = {
  key: string;
  label: string;
  points: number;
  intensity: "critical" | "high" | "medium";
};

export interface LeadSignals {
  lead: {
    id: string;
    nome?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    score?: number | null;
    total_gasto?: number | string | null;
    updated_at?: string | null;
    data?: any;
    project_id?: string | null;
  };
  // Predição IA opcional
  predictionProbability?: number | null;
  // Última atividade contatada (de imphq_activity_log) — quando definido,
  // se < 24h o lead some da inbox por padrão (filtro "não contatado").
  lastContactAt?: string | null;
}

export interface HotLeadResult {
  leadId: string;
  score: number;
  reasons: HotReason[];
  contacted: boolean;
}

const HOT_PAYMENT_EVENTS = new Set([
  "aguardando_pagamento", "pix_gerado", "pix_created",
  "boleto_gerado", "purchase_billet_printed",
  "pagamento_recusado", "refused", "pagamento_pendente",
]);

function minutesSince(iso?: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

export function calcHotLead(signals: LeadSignals): HotLeadResult {
  const { lead } = signals;
  const reasons: HotReason[] = [];
  let score = 0;

  const data = lead.data || {};
  const evento: string = data.ultimo_evento || "";
  const updatedMin = minutesSince(lead.updated_at);
  const totalGasto = parseFloat(String(lead.total_gasto || 0)) || 0;

  // 1. PIX/Boleto recém-gerado sem pagar
  if (HOT_PAYMENT_EVENTS.has(evento) && totalGasto === 0) {
    if (updatedMin < 120) {
      score += 40;
      reasons.push({ key: "pix_recente", label: `PIX/Boleto há ${Math.max(1, Math.floor(updatedMin))}min`, points: 40, intensity: "critical" });
    } else if (updatedMin < 1440) {
      score += 25;
      reasons.push({ key: "pix_24h", label: "PIX/Boleto < 24h sem pagar", points: 25, intensity: "high" });
    }
  }

  // 2. Pagamento recusado < 24h
  if ((evento === "pagamento_recusado" || evento === "refused") && updatedMin < 1440) {
    score += 30;
    reasons.push({ key: "recusado", label: "Cartão recusado < 24h", points: 30, intensity: "high" });
  }

  // 3. Score do lead alto
  const leadScore = lead.score ?? 0;
  if (leadScore >= 70) {
    score += 15;
    reasons.push({ key: "score_alto", label: `Score ${leadScore}`, points: 15, intensity: "medium" });
  }

  // 4. Predição IA alta
  const prob = signals.predictionProbability ?? null;
  if (prob !== null && prob >= 0.7) {
    const pts = prob >= 0.85 ? 25 : 20;
    score += pts;
    reasons.push({ key: "predicao_alta", label: `IA: ${Math.round(prob * 100)}% conversão`, points: pts, intensity: prob >= 0.85 ? "high" : "medium" });
  }

  // 5. Sinais de engajamento recente em data.interacoes
  const interacoes: any[] = Array.isArray(data.interacoes) ? data.interacoes : [];
  if (interacoes.length > 0) {
    const last = interacoes[interacoes.length - 1];
    const lastMin = minutesSince(last?.data);
    if (lastMin < 60) {
      score += 15;
      reasons.push({ key: "engajou_agora", label: `Interagiu há ${Math.max(1, Math.floor(lastMin))}min`, points: 15, intensity: "high" });
    } else if (lastMin < 360) {
      score += 8;
      reasons.push({ key: "engajou_hoje", label: "Interagiu nas últimas 6h", points: 8, intensity: "medium" });
    }
  }

  // 6. Cliente recorrente parado (winback)
  if (lead.status === "cliente" && totalGasto > 0) {
    if (updatedMin > 30 * 1440 && updatedMin < 90 * 1440) {
      score += 10;
      reasons.push({ key: "winback", label: "Cliente parado 30-90d", points: 10, intensity: "medium" });
    }
  }

  const contacted = signals.lastContactAt
    ? minutesSince(signals.lastContactAt) < 1440
    : false;

  return { leadId: lead.id, score: Math.min(100, score), reasons, contacted };
}

export function heatColor(score: number): { bg: string; text: string; border: string; label: string } {
  if (score >= 70) return { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/40", label: "Crítico" };
  if (score >= 40) return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", label: "Alto" };
  return { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", label: "Atenção" };
}
