// Regra única de "etapa executável" do mapa: status, quem executa, prompt e progresso.
// TS puro e sem dependências: usada pela tela Hoje, pelo canvas (/funis) e pelo project-mcp.
// O estado da execução mora nas notas da etapa em marcações [agent_*] e na checklist.

export type StepStatus = "pending" | "in_progress" | "ready_review" | "done";
export type ExecutorGroup = "ia" | "automatico" | "ferramenta" | "humano";

export interface AgentNotes {
  executor: string;
  skill: string;
  status: StepStatus;
  prompt: string;
  output_url: string;
}

export interface ChecklistEntry { id?: string; text?: string; done?: boolean }

export interface StepNode {
  notes?: string | null;
  checklist?: unknown;
  executor_type?: string | null;
  linked_skill_id?: string | null;
}

const STATUSES: StepStatus[] = ["pending", "in_progress", "ready_review", "done"];

/** Lê as marcações [agent_*] das notas. Sem marcação: executor "human_general", skill "none", status "pending". */
export function readAgentNotes(notes?: string | null): AgentNotes {
  const text = notes || "";
  const rawStatus = text.match(/\[agent_status:([^\]]+)\]/)?.[1] as StepStatus | undefined;
  const multi = text.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
  const single = text.match(/\[agent_prompt:([^\]]+)\]/);
  return {
    executor: text.match(/\[agent_executor:([^\]]+)\]/)?.[1] || "human_general",
    skill: text.match(/\[agent_skill:([^\]]+)\]/)?.[1] || "none",
    status: rawStatus && STATUSES.includes(rawStatus) ? rawStatus : "pending",
    prompt: (multi?.[1] ?? single?.[1] ?? "").trim(),
    output_url: text.match(/\[agent_output:([^\]]+)\]/)?.[1] || "",
  };
}

/** Regrava as marcações [agent_*] preservando o texto livre das notas. */
export function writeAgentNotes(notes: string | null | undefined, data: Partial<AgentNotes>): string {
  const text = (notes || "")
    .replace(/\[agent_executor:[^\]]*\]/g, "")
    .replace(/\[agent_skill:[^\]]*\]/g, "")
    .replace(/\[agent_status:[^\]]*\]/g, "")
    .replace(/\[agent_output:[^\]]*\]/g, "")
    .replace(/\[agent_prompt:[^\]]*\]/g, "")
    .replace(/\[agent_prompt_start\][\s\S]*?\[agent_prompt_end\]/g, "")
    .trim();
  const updated: AgentNotes = { ...readAgentNotes(notes), ...data };
  const tags: string[] = [];
  if (updated.executor && updated.executor !== "human_general") tags.push(`[agent_executor:${updated.executor}]`);
  if (updated.skill && updated.skill !== "none") tags.push(`[agent_skill:${updated.skill}]`);
  if (updated.status && updated.status !== "pending") tags.push(`[agent_status:${updated.status}]`);
  if (updated.output_url) tags.push(`[agent_output:${updated.output_url}]`);
  if (updated.prompt) tags.push(`[agent_prompt_start]\n${updated.prompt.trim()}\n[agent_prompt_end]`);
  if (!tags.length) return text;
  return text ? `${text}\n\n${tags.join("\n")}` : tags.join("\n");
}

export function checklistOf(value: unknown): ChecklistEntry[] {
  return Array.isArray(value) ? value.filter((c): c is ChecklistEntry => !!c && typeof c === "object") : [];
}

export function checklistProgress(value: unknown): { done: number; total: number } {
  const list = checklistOf(value);
  return { done: list.filter((c) => c.done === true).length, total: list.length };
}

/**
 * Status da etapa: marcação explícita nas notas vence; sem ela, a checklist decide
 * (toda feita = done, parte feita = in_progress); sem checklist = pending.
 */
export function stepStatus(node: StepNode): StepStatus {
  const marked = (node.notes || "").match(/\[agent_status:([^\]]+)\]/)?.[1] as StepStatus | undefined;
  if (marked && STATUSES.includes(marked)) return marked;
  const { done, total } = checklistProgress(node.checklist);
  if (total > 0 && done === total) return "done";
  if (done > 0) return "in_progress";
  return "pending";
}

/** Quem executa, agrupado. Aceita os vários vocabulários já gravados (AI_SKILL, agente_ia, ai_higgsfield, humano...). */
export function executorGroup(node: StepNode): ExecutorGroup {
  const marked = readAgentNotes(node.notes).executor;
  const raw = (marked !== "human_general" ? marked : node.executor_type || "").toLowerCase();
  if (!raw || raw.startsWith("human") || raw === "humano" || raw === "hibrido") return "humano";
  if (raw === "api_autonomous" || raw === "openflow" || raw.includes("autom")) return "automatico";
  if (raw === "external_tool" || raw.includes("tool") || raw.includes("ferramenta")) return "ferramenta";
  if (raw.startsWith("ai") || raw.includes("agente") || raw.includes("skill") || raw.includes("ia")) return "ia";
  return "humano";
}

/** Skill vinculada: marcação nas notas vence o campo da etapa. */
export function stepSkill(node: StepNode): string | null {
  const marked = readAgentNotes(node.notes).skill;
  if (marked !== "none") return marked;
  return node.linked_skill_id || null;
}

export const EXECUTOR_LABEL: Record<ExecutorGroup, string> = {
  ia: "IA executa",
  automatico: "Automático",
  ferramenta: "Ferramenta externa",
  humano: "Você",
};

export const STATUS_LABEL_STEP: Record<StepStatus, string> = {
  pending: "A fazer",
  in_progress: "Em andamento",
  ready_review: "Revisar",
  done: "Feito",
};
