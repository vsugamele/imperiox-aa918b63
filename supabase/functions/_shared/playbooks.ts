// Playbooks de estratégia: tipos e o planejador que desenha um playbook no mapa de operação de um projeto.
// TS puro: usado pela tela de Estratégias, pelo project-mcp (apply_playbook) e pelos testes.

export type PlaybookFamily = "x1_ads" | "webinar_lancamento" | "organico" | "seo";

export interface PlaybookContract { o: string; e: string; s: string; p: string; m: string; d: string; f: string; x: string }

export interface PlaybookStep {
  ordem: number;
  secao: string;
  label: string;
  kind: string;
  executor_type: string;
  skill: string | null;
  contrato: PlaybookContract;
  metrica: { key: string; meta?: string; unidade?: string } | null;
  checklist: string[];
  depende_de: number[];
}

export interface Playbook {
  id: string;
  nome: string;
  familia: PlaybookFamily;
  resumo: string;
  quando_usar: string;
  quando_evitar: string;
  horizonte: string;
  north_star: string;
  kpis: Array<{ key: string; label: string; meta: string; unidade?: string }>;
  riscos: string[];
  fonte?: string | null;
  steps: PlaybookStep[];
}

/** Cor da moldura das seções no mapa, por família. */
export const FAMILY_COLOR: Record<PlaybookFamily, string> = {
  x1_ads: "#25d366",
  webinar_lancamento: "#6366f1",
  organico: "#e1306c",
  seo: "#16a34a",
};

export const FAMILY_LABEL: Record<PlaybookFamily, string> = {
  x1_ads: "X1 e anúncio direto",
  webinar_lancamento: "Webinar e lançamentos",
  organico: "Canal orgânico",
  seo: "SEO e conteúdo",
};

const CONTRACT_LABELS: Array<[keyof PlaybookContract, string]> = [
  ["o", "O QUÊ"], ["e", "ENTRADA"], ["s", "SAÍDA"], ["p", "PRONTO QUANDO"],
  ["m", "MÉTRICAS"], ["d", "DEPENDE DE"], ["f", "FREQUÊNCIA"], ["x", "SE FALHAR"],
];

/** Troca {projeto}, {produto}, {plataforma}… pelos valores do projeto; variável sem valor fica legível ("o produto"). */
export function fillVars(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => vars[name]?.trim() || FALLBACK[name] || name);
}
const FALLBACK: Record<string, string> = { projeto: "o projeto", produto: "o produto", plataforma: "a plataforma", conta: "a conta", oferta: "a oferta" };

/** Contrato no formato lido por readStageContract (uma seção por linha). */
export function contractText(contrato: PlaybookContract, vars: Record<string, string | null | undefined> = {}): string {
  return CONTRACT_LABELS.map(([k, label]) => `${label}: ${fillVars(contrato[k] ?? "", vars).trim()}`).join("\n");
}

// ── Planejamento no mapa ─────────────────────────────────────────────────────

export interface ExistingNode { id: string; label: string; kind: string; position?: { x?: number; y?: number } | null; height?: number | null }
export interface ExistingFrame { y: number; height: number }

export interface PlannedNode {
  stepOrdem: number;
  /** Etapa que já existe no mapa (mesmo tipo e nome parecido): é ligada, não criada de novo. */
  existingId: string | null;
  label: string;
  kind: string;
  executor_type: string;
  linked_skill_id: string | null;
  stage_role: string;
  description: string;
  checklist: Array<{ text: string; done: false }>;
  metrics_target: { key: string; meta?: string } | null;
  position: { x: number; y: number };
}
export interface PlannedFrame { secao: string; text: string; x: number; y: number; width: number; height: number }
export interface PlaybookPlan { frames: PlannedFrame[]; nodes: PlannedNode[]; edges: Array<{ from: number; to: number }>; reused: number; created: number }

const GENERIC_KINDS = new Set(["doc", "processo", "ia", "nota"]);
const COL = 300, LEFT = 40, ROW_STEP = 640, FRAME_HEIGHT = 580, TOP = 90, GAP = 160;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "com", "para", "no", "na", "em"]);
const tokens = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));

/** Mesma etapa = mesmo tipo e pelo menos metade das palavras do nome em comum. */
export function sameStep(a: { label: string; kind: string }, b: { label: string; kind: string }): boolean {
  if (a.kind !== b.kind) return false;
  const ta = tokens(a.label), tb = tokens(b.label);
  if (!ta.size || !tb.size) return false;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size) >= 0.5;
}

/**
 * Desenha o playbook abaixo de tudo o que já existe no mapa: uma seção por `secao`, etapas da esquerda
 * para a direita na ordem, setas por `depende_de`. Etapas equivalentes já no mapa são reaproveitadas.
 */
export function planPlaybook(
  playbook: Pick<Playbook, "nome" | "steps">,
  existing: { nodes: ReadonlyArray<ExistingNode>; frames: ReadonlyArray<ExistingFrame> },
  vars: Record<string, string | null | undefined> = {},
): PlaybookPlan {
  const bottoms = [
    ...existing.frames.map((f) => f.y + f.height),
    ...existing.nodes.map((n) => (n.position?.y ?? 0) + (n.height ?? 300)),
  ];
  const startY = bottoms.length ? Math.round(Math.max(...bottoms)) + GAP : 0;

  const steps = [...playbook.steps].sort((a, b) => a.ordem - b.ordem);
  const sections: string[] = [];
  for (const s of steps) if (!sections.includes(s.secao)) sections.push(s.secao);

  // Tipo específico que aparece uma vez só no mapa e no playbook é a mesma etapa, mesmo com outro nome
  // (ex.: "Meta Ads — subir na BM" = "Campanha de teste (Meta)"). Tipos genéricos exigem nome parecido.
  const countBy = (kinds: string[]) => kinds.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());
  const mapKinds = countBy(existing.nodes.map((n) => n.kind)), stepKinds = countBy(steps.map((s) => s.kind));
  const uniqueKind = (kind: string) => !GENERIC_KINDS.has(kind) && mapKinds.get(kind) === 1 && stepKinds.get(kind) === 1;

  const frames: PlannedFrame[] = [];
  const nodes: PlannedNode[] = [];
  const usedExisting = new Set<string>();
  sections.forEach((secao, row) => {
    const y = startY + row * ROW_STEP;
    const inSection = steps.filter((s) => s.secao === secao);
    frames.push({ secao, text: `${fillVars(playbook.nome, vars).toUpperCase()} — ${secao}`, x: 0, y, width: Math.max(1, inSection.length) * COL + 2 * LEFT, height: FRAME_HEIGHT });
    inSection.forEach((step, col) => {
      const filled = { label: fillVars(step.label, vars), kind: step.kind };
      const match = existing.nodes.find((n) => !usedExisting.has(n.id) && sameStep(n, filled))
        ?? (uniqueKind(step.kind) ? existing.nodes.find((n) => !usedExisting.has(n.id) && n.kind === step.kind) : undefined);
      if (match) usedExisting.add(match.id);
      nodes.push({
        stepOrdem: step.ordem,
        existingId: match?.id ?? null,
        label: fillVars(step.label, vars),
        kind: step.kind,
        executor_type: step.executor_type,
        linked_skill_id: step.skill,
        stage_role: secao,
        description: contractText(step.contrato, vars),
        checklist: step.checklist.map((text) => ({ text: fillVars(text, vars), done: false as const })),
        metrics_target: step.metrica ? { key: step.metrica.key, ...(step.metrica.meta ? { meta: step.metrica.meta } : {}) } : null,
        position: { x: LEFT + col * COL, y: y + TOP },
      });
    });
  });

  const ordens = new Set(steps.map((s) => s.ordem));
  const edges = steps.flatMap((s) => s.depende_de.filter((d) => ordens.has(d)).map((d) => ({ from: d, to: s.ordem })));
  const reused = nodes.filter((n) => n.existingId).length;
  return { frames, nodes, edges, reused, created: nodes.length - reused };
}
