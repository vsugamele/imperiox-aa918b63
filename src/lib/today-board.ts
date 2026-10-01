import {
  checklistProgress, executorGroup, needsConfirmation, readAgentNotes, stepSkill, stepStatus,
  type ExecutorGroup, type StepStatus,
} from "@shared/map-steps";

export interface BoardNode {
  id: string;
  map_id: string;
  label: string;
  kind: string;
  description?: string | null;
  notes?: string | null;
  checklist?: unknown;
  position?: unknown;
  executor_type?: string | null;
  linked_skill_id?: string | null;
  linked_project_id?: string | null;
  stage_role?: string | null;
}

export interface BoardSale { project_id: string | null; valor: number | null; data: unknown }

export interface BoardStep {
  id: string;
  mapId: string;
  label: string;
  kind: string;
  stage: string | null;
  status: StepStatus;
  executor: ExecutorGroup;
  skill: string | null;
  progress: { done: number; total: number };
  /** Checklist completa sem status declarado: precisa de alguém confirmar. */
  toConfirm: boolean;
  prompt: string;
}

export interface ProjectBoard {
  projectId: string;
  projectName: string;
  mapIds: string[];
  /** Checklist completa, mas ninguém declarou que está feita. */
  toConfirm: BoardStep[];
  /** Pendentes que dependem de alguém do time (humano ou ferramenta externa). */
  waitingYou: BoardStep[];
  /** Pendentes que uma IA ou automação executa. */
  aiReady: BoardStep[];
  inProgress: BoardStep[];
  review: BoardStep[];
  done: number;
  total: number;
  salesToday: { count: number; byCurrency: Record<string, number> };
  leadsToday: number;
}

/** Cartões que só organizam o mapa (centro do projeto, área do time); não são tarefa do dia. */
const STRUCTURAL_KINDS = new Set(["vertical", "area"]);

const STATUS_ORDER: Record<StepStatus, number> = { ready_review: 0, in_progress: 1, pending: 2, done: 3 };

function pos(value: unknown): { x: number; y: number } {
  if (value && typeof value === "object") {
    const p = value as { x?: unknown; y?: unknown };
    return { x: typeof p.x === "number" ? p.x : 0, y: typeof p.y === "number" ? p.y : 0 };
  }
  return { x: 0, y: 0 };
}

/**
 * Projeto de cada mapa: só conta mapa dedicado a um único projeto (as etapas sem vínculo herdam dele).
 * Mapas de empresa com vários projetos (ex.: Fluxo Master) ficam fora do quadro diário para não duplicar etapas.
 */
export function projectOfMaps(nodes: ReadonlyArray<BoardNode>): Map<string, string> {
  const linked = new Map<string, Set<string>>();
  for (const n of nodes) {
    if (!n.linked_project_id) continue;
    const set = linked.get(n.map_id) ?? new Set<string>();
    set.add(n.linked_project_id);
    linked.set(n.map_id, set);
  }
  const result = new Map<string, string>();
  for (const [mapId, set] of linked) if (set.size === 1) result.set(mapId, [...set][0]);
  return result;
}

export function toStep(n: BoardNode): BoardStep {
  const agent = readAgentNotes(n.notes);
  return {
    id: n.id,
    mapId: n.map_id,
    label: n.label,
    kind: n.kind,
    stage: n.stage_role || null,
    status: stepStatus(n),
    executor: executorGroup(n),
    skill: stepSkill(n),
    progress: checklistProgress(n.checklist),
    toConfirm: needsConfirmation(n),
    prompt: agent.prompt || `Executar a etapa "${n.label}". Objetivo: ${n.description || n.label}`,
  };
}

function currencyOf(data: unknown): string {
  if (data && typeof data === "object" && "moeda" in data) {
    const m = (data as { moeda?: unknown }).moeda;
    if (typeof m === "string" && m.trim()) return m.trim().toUpperCase();
  }
  return "BRL";
}

export function buildTodayBoard(input: {
  projects: ReadonlyArray<{ id: string; name: string }>;
  nodes: ReadonlyArray<BoardNode>;
  salesToday: ReadonlyArray<BoardSale>;
  leadsToday: ReadonlyArray<{ project_id: string | null }>;
}): ProjectBoard[] {
  const mapProject = projectOfMaps(input.nodes);
  const byProject = new Map<string, BoardNode[]>();
  for (const n of input.nodes) {
    const pid = mapProject.get(n.map_id);
    if (!pid || STRUCTURAL_KINDS.has(n.kind)) continue;
    const list = byProject.get(pid) ?? [];
    list.push(n);
    byProject.set(pid, list);
  }

  const boards: ProjectBoard[] = [];
  for (const project of input.projects) {
    const nodes = (byProject.get(project.id) ?? [])
      .slice()
      .sort((a, b) => pos(a.position).x - pos(b.position).x || pos(a.position).y - pos(b.position).y);
    if (!nodes.length) continue;
    const steps = nodes.map(toStep).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const pending = steps.filter((s) => s.status === "pending" && !s.toConfirm);

    const byCurrency: Record<string, number> = {};
    let count = 0;
    for (const sale of input.salesToday) {
      if (sale.project_id !== project.id) continue;
      count += 1;
      const cur = currencyOf(sale.data);
      byCurrency[cur] = Math.round(((byCurrency[cur] ?? 0) + (sale.valor ?? 0)) * 100) / 100;
    }

    boards.push({
      projectId: project.id,
      projectName: project.name,
      mapIds: [...new Set(nodes.map((n) => n.map_id))],
      toConfirm: steps.filter((s) => s.toConfirm),
      waitingYou: pending.filter((s) => s.executor === "humano" || s.executor === "ferramenta"),
      aiReady: pending.filter((s) => s.executor === "ia" || s.executor === "automatico"),
      inProgress: steps.filter((s) => s.status === "in_progress"),
      review: steps.filter((s) => s.status === "ready_review"),
      done: steps.filter((s) => s.status === "done").length,
      total: steps.length,
      salesToday: { count, byCurrency },
      leadsToday: input.leadsToday.filter((l) => l.project_id === project.id).length,
    });
  }
  const attention = (b: ProjectBoard) => b.review.length + b.toConfirm.length + b.waitingYou.length;
  return boards.sort((a, b) => attention(b) - attention(a));
}

/** Abre o canvas já no mapa e na etapa (lido por /funis via ?map= e ?node=). */
export function mapLink(step: Pick<BoardStep, "mapId" | "id">): string {
  return `/funis?view=mapa&map=${step.mapId}&node=${step.id}`;
}

export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
