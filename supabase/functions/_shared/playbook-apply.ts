// Grava no mapa o plano de um playbook (planPlaybook). Quem chama (project-mcp, tela de Estratégias)
// só fornece os inserts; a regra do que criar, ligar e registrar fica aqui, igual para IA e pessoa.
import { elementType } from "./map-elements.ts";
import { FAMILY_COLOR, type Playbook, type PlaybookFamily, type PlaybookPlan, type PlaybookStep } from "./playbooks.ts";

// ── Linhas do banco → Playbook ───────────────────────────────────────────────

export interface PlaybookRow {
  id: string; nome: string; familia: string; resumo: string; quando_usar: string | null; quando_evitar: string | null;
  horizonte: string | null; north_star: string | null; kpis: unknown; riscos: string[] | null; fonte: string | null;
}
export interface PlaybookStepRow {
  ordem: number; secao: string; label: string; kind: string; executor_type: string; skill: string | null;
  contrato: unknown; metrica: unknown; checklist: string[] | null; depende_de: number[] | null;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function playbookFromRows(row: PlaybookRow, steps: ReadonlyArray<PlaybookStepRow>): Playbook {
  return {
    id: row.id, nome: row.nome, familia: row.familia as PlaybookFamily, resumo: row.resumo,
    quando_usar: row.quando_usar ?? "", quando_evitar: row.quando_evitar ?? "", horizonte: row.horizonte ?? "",
    north_star: row.north_star ?? "",
    kpis: (Array.isArray(row.kpis) ? row.kpis : []).map((k) => {
      const o = obj(k);
      return { key: str(o.key), label: str(o.label), meta: str(o.meta), ...(o.unidade ? { unidade: str(o.unidade) } : {}) };
    }),
    riscos: row.riscos ?? [], fonte: row.fonte,
    steps: [...steps].sort((a, b) => a.ordem - b.ordem).map((s): PlaybookStep => {
      const c = obj(s.contrato), m = obj(s.metrica);
      return {
        ordem: s.ordem, secao: s.secao, label: s.label, kind: s.kind, executor_type: s.executor_type, skill: s.skill,
        contrato: { o: str(c.o), e: str(c.e), s: str(c.s), p: str(c.p), m: str(c.m), d: str(c.d), f: str(c.f), x: str(c.x) },
        metrica: m.key ? { key: str(m.key), ...(m.meta ? { meta: str(m.meta) } : {}), ...(m.unidade ? { unidade: str(m.unidade) } : {}) } : null,
        checklist: s.checklist ?? [], depende_de: s.depende_de ?? [],
      };
    }),
  };
}

/** Mapa de operação do projeto: o não arquivado cujo nome cita o projeto, preferindo os de "Operação". */
export function findProjectMap<T extends { id: string; name: string; archived_at?: string | null }>(maps: ReadonlyArray<T>, projectName: string): T | null {
  const name = projectName.trim().toLowerCase();
  if (!name) return null;
  const candidates = maps.filter((m) => !m.archived_at && m.name.toLowerCase().includes(name));
  return candidates.find((m) => m.name.toLowerCase().includes("operação")) ?? candidates[0] ?? null;
}

// ── Gravação ─────────────────────────────────────────────────────────────────

export interface FrameInsert { map_id: string; kind: "frame"; text: string; x: number; y: number; width: number; height: number; z_index: number; style: { borderColor: string } }
export interface NodeInsert {
  map_id: string; label: string; kind: string; color: string; size: "M"; description: string; notes: string;
  executor_type: string; linked_skill_id: string | null; stage_role: string; linked_project_id: string;
  checklist: Array<{ id: string; text: string; done: boolean }>; metrics_target: { key: string; meta?: string } | null;
  position: { x: number; y: number }; show_live_kpis: boolean;
  step_status: "pending"; status_changed_by: string;
}
export interface ApplicationInsert { playbook_id: string; project_id: string; map_id: string; node_ids: string[]; params: Record<string, string>; aplicado_por: string }

export interface PlaybookWriter {
  insertFrame(row: FrameInsert): Promise<void>;
  /** Devolve o id do nó criado. */
  insertNode(row: NodeInsert): Promise<string>;
  insertEdge(row: { map_id: string; source_id: string; target_id: string }): Promise<void>;
  insertApplication(row: ApplicationInsert): Promise<void>;
}

export interface ApplyContext {
  playbook: Pick<Playbook, "id" | "familia">;
  mapId: string;
  projectId: string;
  params: Record<string, string>;
  appliedBy: string;
  /** Setas que já existem no mapa ("origem>destino"), para não duplicar entre etapas reaproveitadas. */
  existingEdges: ReadonlySet<string>;
  newId: () => string;
}

export interface ApplyResult { nodeIds: string[]; created: number; reused: number; edges: number; frames: number }

export async function writePlaybookPlan(plan: PlaybookPlan, ctx: ApplyContext, w: PlaybookWriter): Promise<ApplyResult> {
  // Seção cujas etapas já existem todas no mapa não ganha moldura vazia.
  const frames = plan.frames.filter((f) => plan.nodes.some((n) => n.stage_role === f.secao && !n.existingId));
  for (const f of frames) {
    await w.insertFrame({ map_id: ctx.mapId, kind: "frame", text: f.text, x: f.x, y: f.y, width: f.width, height: f.height, z_index: -1, style: { borderColor: FAMILY_COLOR[ctx.playbook.familia] ?? "#64748b" } });
  }

  const idByOrdem = new Map<number, string>();
  for (const n of plan.nodes) {
    if (n.existingId) { idByOrdem.set(n.stepOrdem, n.existingId); continue; }
    const id = await w.insertNode({
      map_id: ctx.mapId, label: n.label, kind: n.kind, color: elementType(n.kind)?.color ?? "#64748b", size: "M",
      description: n.description,
      // Etapa nova nasce pendente de verdade; a marca do playbook permite medir e diagnosticar depois.
      notes: `[agent_status:pending]\n[agent_playbook:${ctx.playbook.id}#${n.stepOrdem}]`,
      executor_type: n.executor_type, linked_skill_id: n.linked_skill_id, stage_role: n.stage_role, linked_project_id: ctx.projectId,
      checklist: n.checklist.map((c) => ({ id: ctx.newId(), text: c.text, done: false })),
      metrics_target: n.metrics_target, position: n.position, show_live_kpis: true,
      step_status: "pending", status_changed_by: `playbook:${ctx.playbook.id}`,
    });
    idByOrdem.set(n.stepOrdem, id);
  }

  let edges = 0;
  for (const e of plan.edges) {
    const source = idByOrdem.get(e.from), target = idByOrdem.get(e.to);
    if (!source || !target || ctx.existingEdges.has(`${source}>${target}`)) continue;
    await w.insertEdge({ map_id: ctx.mapId, source_id: source, target_id: target });
    edges++;
  }

  const nodeIds = plan.nodes.map((n) => idByOrdem.get(n.stepOrdem)).filter((id): id is string => !!id);
  await w.insertApplication({ playbook_id: ctx.playbook.id, project_id: ctx.projectId, map_id: ctx.mapId, node_ids: nodeIds, params: ctx.params, aplicado_por: ctx.appliedBy });
  return { nodeIds, created: plan.created, reused: plan.reused, edges, frames: frames.length };
}
