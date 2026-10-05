// Resumo do projeto em uma chamada (MCP get_briefing): o dia (quadro de Hoje), números e o que espera decisão.
// TS puro: monta a resposta a partir do quadro (today-board) e da fila (approval-queue), sem tocar no banco.

import { SOURCE_LABEL, waitingFor, type ApprovalItem, type ApprovalSource } from "./approval-queue.ts";
import { DUE_LABEL, type TeamMember } from "./map-steps.ts";
import { mapLink, type BoardStep, type ProjectBoard } from "./today-board.ts";
import { DECISIONS_BY_SOURCE, type ApprovalDecision } from "./approval-decide.ts";
import { effectiveAutonomy } from "./autonomy.ts";

const LIST_LIMIT = 5;

export interface BriefingNumbers {
  revenueMonth: Record<string, number>;
  hotLeads: number;
}

function stepLine(step: BoardStep, team: ReadonlyArray<TeamMember>) {
  const owner = step.ownerId ? team.find((m) => m.id === step.ownerId) : null;
  return {
    node_id: step.id,
    etapa: step.label,
    status: step.status,
    responsavel: owner?.name ?? null,
    prazo: step.due,
    situacao_prazo: step.dueState ? DUE_LABEL[step.dueState] : null,
    checklist: step.progress.total ? `${step.progress.done}/${step.progress.total}` : null,
    link: mapLink(step),
  };
}

/** Contagem por origem da fila (só as origens com item). */
export function approvalCounts(items: ReadonlyArray<ApprovalItem>): Partial<Record<ApprovalSource, number>> {
  const counts: Partial<Record<ApprovalSource, number>> = {};
  for (const item of items) counts[item.source] = (counts[item.source] ?? 0) + 1;
  return counts;
}

/**
 * O que o MCP pode decidir, pelos níveis de autonomia (_shared/autonomy.ts): tudo que não é "nunca".
 * As de nível "aprovar" exigem confirmado_por (alguém do time) no decide_approval.
 * Resposta para cliente envia mensagem: só na tela /rascunhos.
 */
export function mcpDecisions(item: Pick<ApprovalItem, "source" | "inline">): ApprovalDecision[] {
  if (!item.inline) return [];
  return DECISIONS_BY_SOURCE[item.source].filter((d) => effectiveAutonomy(`${item.source}:${d}`) !== "nunca");
}

/** Decisões que precisam do OK de alguém do time quando a IA executa. */
export function decisionsNeedingOk(item: Pick<ApprovalItem, "source" | "inline">): ApprovalDecision[] {
  return mcpDecisions(item).filter((d) => effectiveAutonomy(`${item.source}:${d}`) === "aprovar");
}

/** Item da fila no formato das respostas do MCP. `key` é o que decide_approval recebe. */
export function approvalLine(item: ApprovalItem, now: number = Date.now()) {
  return {
    key: item.key,
    origem: SOURCE_LABEL[item.source],
    titulo: item.title,
    detalhe: item.detail,
    projeto: item.projectId,
    esperando_ha: waitingFor(item.createdAt, now),
    risco: item.risk,
    impacto_brl: item.impactBrl,
    decisao_pelo_mcp: mcpDecisions(item),
    precisa_ok_de_alguem: decisionsNeedingOk(item),
    link: item.link,
  };
}

export interface JournalEntry { created_at: string; action: string; actor: string | null; entity_name: string | null; details: unknown }
export interface PaymentPulse { plataforma: string; ultima: string; total_90d: number }
export interface AdsHealthSummary { estado: string; problemas: string[] }

export interface BriefingAlert { nivel: "critico" | "atencao"; texto: string }

const DAY_MS = 86_400_000;

/** Alertas que pedem ação: prazo vencido, decisão parada, aviso de pagamento sumido, sync de anúncios com problema. */
export function briefingAlerts(input: {
  board: ProjectBoard | null;
  approvals: ReadonlyArray<ApprovalItem>;
  payments?: ReadonlyArray<PaymentPulse>;
  ads?: AdsHealthSummary | null;
  now?: number;
}): BriefingAlert[] {
  const now = input.now ?? Date.now();
  const alerts: BriefingAlert[] = [];
  const b = input.board;
  if (b) {
    const late = [...b.review, ...b.toConfirm, ...b.waitingYou, ...b.aiReady, ...b.inProgress].filter((s) => s.dueState === "atrasada");
    if (late.length) alerts.push({ nivel: "critico", texto: `${late.length} etapa(s) com prazo vencido: ${late.slice(0, 3).map((s) => s.label).join(", ")}` });
  }
  const waiting = input.approvals.filter((a) => now - Date.parse(a.createdAt) > DAY_MS);
  if (waiting.length) alerts.push({ nivel: "atencao", texto: `${waiting.length} decisão(ões) esperando há mais de 24 h na fila Aprovar` });
  for (const p of input.payments ?? []) {
    const days = Math.floor((now - Date.parse(p.ultima)) / DAY_MS);
    // Fonte com ~1 aviso/dia que some 3+ dias: pode ser falta de venda ou postback desligado.
    if (p.total_90d >= 30 && days >= 3) {
      alerts.push({ nivel: "atencao", texto: `${p.plataforma}: nenhum aviso de pagamento há ${days} dias (média ${Math.round((p.total_90d / 90) * 10) / 10}/dia). Conferir se é falta de venda ou postback.` });
    }
  }
  if (input.ads && input.ads.estado !== "ok" && input.ads.estado !== "sem_config") {
    alerts.push({ nivel: "atencao", texto: `Anúncios: ${input.ads.problemas.join(" ")}` });
  }
  return alerts;
}

export function buildProjectBriefing(input: {
  project: { id: string; name: string };
  board: ProjectBoard | null;
  approvals: ReadonlyArray<ApprovalItem>;
  team: ReadonlyArray<TeamMember>;
  numbers: BriefingNumbers;
  journal?: ReadonlyArray<JournalEntry>;
  payments?: ReadonlyArray<PaymentPulse>;
  ads?: AdsHealthSummary | null;
  now?: number;
}) {
  const { board, team } = input;
  const now = input.now ?? Date.now();
  const top = (list: BoardStep[] | undefined) => (list ?? []).slice(0, LIST_LIMIT).map((s) => stepLine(s, team));
  const all = board ? [...board.review, ...board.toConfirm, ...board.waitingYou, ...board.aiReady, ...board.inProgress] : [];
  const overdue = all.filter((s) => s.dueState === "atrasada");

  return {
    projeto: input.project,
    alertas: briefingAlerts({ board, approvals: input.approvals, payments: input.payments, ads: input.ads, now }),
    hoje: {
      vendas: board?.salesToday.count ?? 0,
      faturamento: board?.salesToday.byCurrency ?? {},
      leads_novos: board?.leadsToday ?? 0,
      leads_quentes_2h: input.numbers.hotLeads,
    },
    mes: { faturamento: input.numbers.revenueMonth },
    etapas: board
      ? {
          progresso: `${board.done}/${board.total}`,
          atrasadas: overdue.length,
          para_revisar: top(board.review),
          para_confirmar: top(board.toConfirm),
          esperando_o_time: top(board.waitingYou),
          prontas_para_ia: top(board.aiReady),
          em_andamento: top(board.inProgress),
          lista_atrasadas: top(overdue),
        }
      : null,
    aprovacoes: {
      total: input.approvals.length,
      por_origem: approvalCounts(input.approvals),
      primeiras: input.approvals.slice(0, LIST_LIMIT).map((a) => approvalLine(a, now)),
    },
    fontes: { avisos_de_pagamento: input.payments ?? [], anuncios: input.ads ?? null },
    diario: (input.journal ?? []).slice(0, 10).map((j) => ({ quando: j.created_at, acao: j.action, quem: j.actor, o_que: j.entity_name, detalhes: j.details })),
    observacao: board ? null : "Projeto sem mapa de operação dedicado: só números e aprovações.",
  };
}
