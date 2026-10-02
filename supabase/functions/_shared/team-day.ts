// Seção "Dia de cada um" do resumo diário no WhatsApp (UX1.2): o que cada pessoa do time tem para andar,
// o que está atrasado, o que está sem dono e o que a IA pode executar. Mesma regra da tela Hoje.
import { firstName, type TeamMember } from "./map-steps.ts";
import type { BoardStep, ProjectBoard } from "./today-board.ts";

const MAX_PER_PERSON = 4;

interface PersonItem { step: BoardStep; project: string; rank: number }

const DUE_TEXT = (s: BoardStep) => {
  if (!s.due) return "";
  const [, m, d] = s.due.slice(0, 10).split("-");
  if (s.dueState === "atrasada") return ` — ⏰ venceu ${d}/${m}`;
  if (s.dueState === "hoje") return " — vence hoje";
  return ` — até ${d}/${m}`;
};

/** Prioridade para o resumo: atrasada, vence hoje, revisar, em andamento, confirmar, com prazo, resto. */
function rank(s: BoardStep, group: "review" | "inProgress" | "toConfirm" | "waitingYou" | "aiReady"): number {
  if (s.dueState === "atrasada") return 0;
  if (s.dueState === "hoje") return 1;
  if (group === "review") return 2;
  if (group === "inProgress") return 3;
  if (group === "toConfirm") return 4;
  if (s.due) return 5;
  return 6;
}

const GROUPS = ["review", "inProgress", "toConfirm", "waitingYou", "aiReady"] as const;

export function buildTeamDaySection(boards: ReadonlyArray<ProjectBoard>, members: ReadonlyArray<TeamMember>, appUrl: string): string[] {
  const byOwner = new Map<string, PersonItem[]>();
  let unowned = 0, aiReady = 0, review = 0;
  for (const b of boards) {
    for (const g of GROUPS) {
      for (const s of b[g]) {
        if (g === "review") review++;
        if (g === "aiReady" && !s.ownerId) { aiReady++; continue; }
        if (!s.ownerId) { if (s.executor === "humano" || s.executor === "ferramenta") unowned++; continue; }
        const list = byOwner.get(s.ownerId) ?? [];
        list.push({ step: s, project: b.projectName, rank: rank(s, g) });
        byOwner.set(s.ownerId, list);
      }
    }
  }

  const lines: string[] = ["📋 *Dia de cada um*"];
  for (const m of members) {
    const items = (byOwner.get(m.id) ?? []).sort((a, b) => a.rank - b.rank);
    const late = items.filter((i) => i.step.dueState === "atrasada").length;
    if (!items.length) { lines.push(`👤 *${firstName(m.name)}* — nada pendente`); continue; }
    lines.push(`👤 *${firstName(m.name)}* — ${items.length} etapa(s)${late ? ` (${late} atrasada${late > 1 ? "s" : ""})` : ""}`);
    for (const i of items.slice(0, MAX_PER_PERSON)) lines.push(`  • ${i.step.label} (${i.project})${DUE_TEXT(i.step)}`);
    if (items.length > MAX_PER_PERSON) lines.push(`  • + ${items.length - MAX_PER_PERSON} no Hoje`);
  }
  if (unowned) lines.push(`❔ *Sem dono:* ${unowned} etapa(s) do time — atribuir no Hoje`);
  if (review) lines.push(`👀 *Para revisar:* ${review}`);
  if (aiReady) lines.push(`🤖 *IA pode executar:* ${aiReady} etapa(s)`);
  lines.push(`🔗 ${appUrl.replace(/\/$/, "")}/hoje`);
  return lines;
}
