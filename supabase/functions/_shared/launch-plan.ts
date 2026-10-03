// Lançador de projetos (LAUNCH1.3): ideia → projeto + mapa de operação + playbooks dos canais + kit de acessos.
// TS puro: o planejamento e a ordem de gravação moram aqui; quem grava (CLI numa transação, MCP pelo cliente) passa o writer.
// Os playbooks são planejados em sequência no mesmo mapa: etapa igual de outro canal (ex.: avatar) é reaproveitada, não duplicada.

import { ACCESS_BY_KEY, CHANNEL_BY_KEY, accessChecklist, type ChannelKey } from "./launch-kit.ts";
import { planPlaybook, type Playbook, type PlaybookPlan } from "./playbooks.ts";
import { writePlaybookPlan, type PlaybookWriter } from "./playbook-apply.ts";

export const DEFAULT_MARKET = "EUA (EN)";

export interface LaunchInput {
  nome: string;
  canais: ChannelKey[];
  /** Id do projeto; sem ele, sai do nome. */
  id?: string | null;
  mercado?: string | null;
  produto?: string | null;
  descricao?: string | null;
}

export interface LaunchStepPlan { playbook: Playbook; plan: PlaybookPlan }

export interface LaunchPlan {
  projectId: string;
  nome: string;
  mercado: string;
  canais: ChannelKey[];
  mapName: string;
  params: Record<string, string>;
  steps: LaunchStepPlan[];
  /** Playbooks que os canais pedem mas não estão na biblioteca. */
  faltando: string[];
  kit: ReturnType<typeof accessChecklist>;
  kitNode: { label: string; description: string; checklist: string[] };
}

/** Id de projeto a partir do nome: minúsculo, sem acento, separado por "_". */
export function projectSlug(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

const PLACEHOLDER = "launch:";
const placeholder = (playbookId: string, ordem: number) => `${PLACEHOLDER}${playbookId}#${ordem}`;

export function planLaunch(input: LaunchInput, library: ReadonlyArray<Playbook>, takenIds: ReadonlyArray<string> = []): LaunchPlan {
  const nome = input.nome.trim();
  if (!nome) throw new Error("nome é obrigatório");
  if (!input.canais.length) throw new Error("informe ao menos um canal");
  const projectId = (input.id?.trim() || projectSlug(nome));
  if (!projectId) throw new Error("não deu para gerar o id do projeto: informe id");
  if (takenIds.includes(projectId)) throw new Error(`Já existe um projeto com id '${projectId}'. Use outro nome ou informe id.`);
  const mercado = input.mercado?.trim() || DEFAULT_MARKET;
  const params: Record<string, string> = { projeto: nome, produto: input.produto?.trim() || nome };

  const byId = new Map(library.map((p) => [p.id, p]));
  const wanted = [...new Set(input.canais.flatMap((c) => CHANNEL_BY_KEY.get(c)?.playbooks ?? []))];
  const faltando = wanted.filter((id) => !byId.has(id));

  // Planeja um playbook por vez, como se os anteriores já estivessem no mapa.
  const nodes: Array<{ id: string; label: string; kind: string; position?: { x?: number; y?: number } | null; height?: number | null }> = [];
  const frames: Array<{ y: number; height: number }> = [];
  const steps: LaunchStepPlan[] = [];
  for (const id of wanted) {
    const playbook = byId.get(id);
    if (!playbook) continue;
    const plan = planPlaybook(playbook, { nodes, frames }, params);
    steps.push({ playbook, plan });
    for (const n of plan.nodes) if (!n.existingId) nodes.push({ id: placeholder(playbook.id, n.stepOrdem), label: n.label, kind: n.kind, position: n.position });
    for (const f of plan.frames) frames.push({ y: f.y, height: f.height });
  }

  const kit = accessChecklist(input.canais, []);
  const required = kit.itens.filter((i) => i.obrigatorio);
  const channelLabels = input.canais.map((c) => CHANNEL_BY_KEY.get(c)?.label.split(" (")[0] ?? c);
  return {
    projectId, nome, mercado, canais: input.canais, params, steps, faltando, kit,
    mapName: `${nome} — Operação (${channelLabels.join(" · ")})`,
    kitNode: {
      label: `Kit de acessos — ${nome}`,
      description: `O que só uma pessoa do time faz para os canais rodarem (${mercado}). Marque cada acesso em scripts/launch.mjs acesso ou pelo MCP set_project_access; senha nunca vai para o Império.`,
      checklist: [
        ...required.map((i) => `${i.label} — ${ACCESS_BY_KEY.get(i.key)?.como ?? ""}`.trim()),
        ...kit.grupos.map((g) => `Um destes: ${g.label}`),
      ],
    },
  };
}

export interface LaunchWriter extends PlaybookWriter {
  insertProject(row: { id: string; name: string; category: string; description: string | null; data: Record<string, unknown> }): Promise<void>;
  insertMap(row: { id: string; name: string }): Promise<void>;
  upsertAccess(row: { project_id: string; access_key: string; status: "falta"; nota: string; updated_by: string }): Promise<void>;
}

/** Grava o plano na ordem certa: projeto, mapa, kit, playbooks (trocando as etapas reaproveitadas pelos ids reais), acessos. */
export async function writeLaunch(launch: LaunchPlan, ctx: { appliedBy: string; newId: () => string; today: string }, w: LaunchWriter) {
  const mapId = ctx.newId();
  await w.insertProject({
    id: launch.projectId, name: launch.nome, category: "Lançador",
    description: `Canais: ${launch.canais.join(", ")} · mercado ${launch.mercado}`,
    data: { canais: launch.canais, mercado: launch.mercado, produto: launch.params.produto, lancado_por: ctx.appliedBy, lancado_em: ctx.today },
  });
  await w.insertMap({ id: mapId, name: launch.mapName });
  const kitId = await w.insertNode({
    map_id: mapId, label: launch.kitNode.label, kind: "processo", color: "#f59e0b", size: "M", description: launch.kitNode.description,
    notes: "[agent_status:pending]\n[agent_launch:kit]", executor_type: "HUMAN_OPERATOR", linked_skill_id: null, stage_role: "Preparação",
    linked_project_id: launch.projectId, checklist: launch.kitNode.checklist.map((text) => ({ id: ctx.newId(), text, done: false })),
    metrics_target: null, position: { x: 0, y: -320 }, show_live_kpis: false, step_status: "pending", status_changed_by: `launch:${ctx.appliedBy}`,
  });

  // Seta já gravada por um playbook anterior não se repete quando o seguinte reaproveita as mesmas etapas.
  const edges = new Set<string>();
  const writer: LaunchWriter = { ...w, insertEdge: async (row) => { edges.add(`${row.source_id}>${row.target_id}`); await w.insertEdge(row); } };
  const realId = new Map<string, string>();
  const applied: Array<{ playbook: string; criadas: number; reaproveitadas: number; setas: number }> = [];
  for (const { playbook, plan } of launch.steps) {
    const resolved: PlaybookPlan = { ...plan, nodes: plan.nodes.map((n) => (n.existingId?.startsWith(PLACEHOLDER) ? { ...n, existingId: realId.get(n.existingId) ?? null } : n)) };
    const result = await writePlaybookPlan(resolved, {
      playbook, mapId, projectId: launch.projectId, params: launch.params, appliedBy: ctx.appliedBy, existingEdges: edges, newId: ctx.newId,
    }, writer);
    resolved.nodes.forEach((n, i) => { if (!n.existingId) realId.set(placeholder(playbook.id, n.stepOrdem), result.nodeIds[i]); });
    applied.push({ playbook: playbook.id, criadas: result.created, reaproveitadas: result.reused, setas: result.edges });
  }
  for (const item of launch.kit.itens.filter((i) => i.obrigatorio)) {
    await w.upsertAccess({ project_id: launch.projectId, access_key: item.key, status: "falta", nota: "Criado pelo lançador", updated_by: ctx.appliedBy });
  }
  return { projectId: launch.projectId, mapId, kitNodeId: kitId, playbooks: applied };
}

/** Resumo do plano para CLI e MCP (nada gravado). */
export function launchPreview(launch: LaunchPlan) {
  return {
    projeto: { id: launch.projectId, nome: launch.nome, mercado: launch.mercado, canais: launch.canais },
    mapa: launch.mapName,
    playbooks: launch.steps.map(({ playbook, plan }) => ({
      id: playbook.id, nome: playbook.nome, novas: plan.created, reaproveitadas: plan.reused,
      etapas: plan.nodes.map((n) => ({ ordem: n.stepOrdem, etapa: n.label, tipo: n.kind, reaproveita: n.existingId ? "sim" : "" })),
    })),
    faltando_na_biblioteca: launch.faltando,
    kit_de_acessos: { obrigatorios: launch.kitNode.checklist.length, proximos: launch.kit.proximos.map((k) => ACCESS_BY_KEY.get(k)?.label ?? k) },
  };
}
