/** Read-only projections of existing map records. No defaults, scores or execution decisions. */
export interface ContractNode {
  id: string; label: string; kind?: string; description?: string | null; notes?: string | null;
  stage_role?: string | null; executor_type?: string | null; linked_skill_id?: string | null;
  url?: string | null; metrics_target?: unknown;
  checklist?: ReadonlyArray<{ text: string; done: boolean }>;
}
export interface ContractField { key: string; label: string; value: string | null; source: string | null }
export interface AgentStatusReading {
  status: "pending" | "in_progress" | "ready_review" | "done";
  status_source: "notes" | "not_declared";
  operationalEvidence: "unverified";
}

/** First tag outside prompt examples wins; checklist/output never prove execution. */
export function readAgentStatus(notes?: string | null): AgentStatusReading {
  const text = (notes ?? "").replace(/\[agent_prompt_start\][\s\S]*?(?:\[agent_prompt_end\]|$)/g, "");
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf("[agent_prompt:", cursor);
    if (start < 0) { parts.push(text.slice(cursor)); break; }
    parts.push(text.slice(cursor, start));
    cursor = start + "[agent_prompt:".length;
    // Balance brackets to remove examples inside a legacy prompt, retaining later declarations.
    let depth = 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "[") depth++;
      if (text[cursor] === "]") depth--;
      cursor++;
    }
  }
  const declarations = parts.join("");
  const value = declarations.match(/\[agent_status:([^\]]+)\]/)?.[1];
  const valid = value === "pending" || value === "in_progress" || value === "ready_review" || value === "done";
  return { status: valid ? value : "pending", status_source: valid ? "notes" : "not_declared", operationalEvidence: "unverified" };
}

const MARKERS = {
  objective: ["O QUÊ", "OBJETIVO"], inputs: ["ENTRA", "ENTRADA", "ENTRADAS"],
  output: ["SAI", "SAÍDA", "SAÍDAS", "ENTREGÁVEL"], ready: ["PRONTO QUANDO"],
  frequency: ["FREQUÊNCIA", "ROTINA", "PERIODICIDADE", "GATILHO"],
  dependencies: ["DEPENDÊNCIAS", "DEPENDE DE"], metrics: ["MÉTRICAS"], failure: ["FALHA", "SE FALHAR"],
} as const;
function normalize(text: string) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); }
function sections(text: string): Map<string, string> {
  const result = new Map<string, string>();
  const markers = Object.entries(MARKERS).flatMap(([key, labels]) => labels.map(label => ({ key, label: normalize(label) })));
  const matches = [...text.matchAll(/(?:^|\n|\.\s+|;\s+)(?:#{1,4}\s*)?(?:\*\*)?([\p{L} ]{3,30})(?:\*\*)?\s*:\s*/gu)]
    .map(match => ({ match, key: markers.find(marker => marker.label === normalize(match[1].trim()))?.key }))
    .filter(item => item.key);
  matches.forEach(({ match, key }, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const value = text.slice(start, matches[index + 1]?.match.index ?? text.length).trim();
    if (value && key) result.set(key, value);
  });
  return result;
}
export function readStageContract(node: ContractNode): { fields: ContractField[]; checklist: ReadonlyArray<{ text: string; done: boolean }>; operationalEvidence: "unverified" } {
  const notes = node.notes ?? "";
  // Control tags and agent prompts remain in the SOP; they are not contract sections.
  const cleanNotes = notes.replace(/\[agent_prompt_start\][\s\S]*?\[agent_prompt_end\]/g, "").replace(/\[agent_[^\]]*\]/g, "");
  const fromNotes = sections(cleanNotes), fromDescription = sections(node.description ?? "");
  const field = (key: string, label: string, fallback?: string | null, fallbackSource?: string): ContractField => ({
    key, label, value: fromNotes.get(key) || fromDescription.get(key) || fallback?.trim() || null,
    source: fromNotes.has(key) ? "Notas" : fromDescription.has(key) ? "Descrição / playbook" : fallback?.trim() ? fallbackSource ?? null : null,
  });
  const executorTag = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1];
  const skillTag = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1];
  const outputTag = notes.match(/\[agent_output:([^\]]+)\]/)?.[1];
  const targets = node.metrics_target && typeof node.metrics_target === "object" && !Array.isArray(node.metrics_target)
    ? Object.entries(node.metrics_target).filter(([key, value]) => !/token|secret|password|api|cookie/i.test(key) && ((typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim()))).map(([key, value]) => `${key}: ${value}`).join(" · ") : "";
  return {
    fields: [
      field("objective", "Objetivo", node.stage_role, "Papel cadastrado"), field("inputs", "Entradas"),
      { key: "executor", label: "Agente / executor", value: executorTag || node.executor_type || null, source: executorTag ? "Notas explícitas" : node.executor_type ? "Campo cadastrado" : null },
      { key: "skill", label: "Skill", value: skillTag || node.linked_skill_id || null, source: skillTag ? "Notas explícitas" : node.linked_skill_id ? "Campo cadastrado" : null },
      field("output", "Saída verificável", outputTag, "URL de entregável nas notas; disponibilidade não conferida"),
      field("ready", "Pronto quando"), field("frequency", "Frequência / gatilho"), field("dependencies", "Dependências declaradas"),
      field("metrics", "Métricas / metas", targets, "Metas cadastradas; coleta, janela e fuso não verificados"), field("failure", "Tratamento de falha"),
    ], checklist: node.checklist ?? [], operationalEvidence: "unverified",
  };
}

export interface HierarchyMap { id: string; name: string; parent_node_id?: string | null }
export interface HierarchyNode { id: string; map_id: string; label: string; linked_project_id?: string | null }
export function readMapHierarchy(mapId: string, maps: ReadonlyArray<HierarchyMap>, nodes: ReadonlyArray<HierarchyNode>) {
  const path: { map: HierarchyMap; viaNode: HierarchyNode | null }[] = [];
  const visited = new Set<string>();
  let current = maps.find(map => map.id === mapId);
  let issue: "cycle" | "orphan" | "unlinked" | null = null;
  while (current) {
    if (visited.has(current.id)) { issue = "cycle"; break; }
    visited.add(current.id);
    const parent = current.parent_node_id ? nodes.find(node => node.id === current?.parent_node_id) : null;
    path.unshift({ map: current, viaNode: parent ?? null });
    if (!current.parent_node_id) { if (path.length === 1) issue = "unlinked"; break; }
    if (!parent) { issue = "orphan"; break; }
    current = maps.find(map => map.id === parent.map_id);
    if (!current) issue = "orphan";
  }
  if (!path.length) issue = "orphan";
  return { path, issue, children: maps.filter(map => {
    const parent = nodes.find(node => node.id === map.parent_node_id);
    return parent?.map_id === mapId;
  }) };
}

export interface RoutineAnnotation {
  id: string; kind: string; text: string;
  style?: { accountId?: string; recurrence?: string; items?: ReadonlyArray<{ time: string; kind: string; label: string }> };
}
export function readProfileRoutines(annotations: ReadonlyArray<RoutineAnnotation>, edges: ReadonlyArray<{ source: string; target: string }>) {
  const accounts = annotations.filter(annotation => annotation.kind === "account");
  const schedules = annotations.filter(annotation => annotation.kind === "schedule");
  const connected = (a: string, b: string) => edges.some(edge =>
    (edge.source === `ann-${a}` && edge.target === `ann-${b}`) || (edge.source === `ann-${b}` && edge.target === `ann-${a}`));
  return {
    profiles: accounts.map(account => ({ account, schedules: account.style?.accountId ? schedules.filter(schedule => connected(account.id, schedule.id)) : [] })),
    unlinkedSchedules: schedules.filter(schedule => !accounts.some(account => account.style?.accountId && connected(account.id, schedule.id))),
  };
}
