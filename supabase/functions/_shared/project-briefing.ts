// Resumo do projeto em uma chamada (MCP get_briefing): o dia (quadro de Hoje), números e o que espera decisão.
// TS puro: monta a resposta a partir do quadro (today-board) e da fila (approval-queue), sem tocar no banco.

import { SOURCE_LABEL, waitingFor, type ApprovalItem, type ApprovalSource } from "./approval-queue.ts";
import { DUE_LABEL, type TeamMember } from "./map-steps.ts";
import { mapLink, type BoardStep, type ProjectBoard } from "./today-board.ts";

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
 * O que o MCP pode decidir. Aprovar ação da IA executa mudança real (anúncio, orçamento) e exige login de alguém
 * do time no imperius-executor: pelo MCP só dá para reprovar. Rascunho envia mensagem ao cliente: só na tela.
 */
export function mcpDecisions(item: Pick<ApprovalItem, "source" | "inline">): Array<"approve" | "reject"> {
  if (!item.inline || item.source === "rascunho") return [];
  return item.source === "acao_ia" ? ["reject"] : ["approve", "reject"];
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
    link: item.link,
  };
}

export function buildProjectBriefing(input: {
  project: { id: string; name: string };
  board: ProjectBoard | null;
  approvals: ReadonlyArray<ApprovalItem>;
  team: ReadonlyArray<TeamMember>;
  numbers: BriefingNumbers;
  now?: number;
}) {
  const { board, team } = input;
  const now = input.now ?? Date.now();
  const top = (list: BoardStep[] | undefined) => (list ?? []).slice(0, LIST_LIMIT).map((s) => stepLine(s, team));
  const all = board ? [...board.review, ...board.toConfirm, ...board.waitingYou, ...board.aiReady, ...board.inProgress] : [];
  const overdue = all.filter((s) => s.dueState === "atrasada");

  return {
    projeto: input.project,
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
    observacao: board ? null : "Projeto sem mapa de operação dedicado: só números e aprovações.",
  };
}
