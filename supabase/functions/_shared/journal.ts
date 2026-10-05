// Diário do projeto (IA1.1): cada registro de imphq_activity_log vira uma frase legível.
// TS puro; os registros vêm dos gatilhos do banco (migração 20261005_imphq_project_journal_autonomy.sql).

export interface JournalRow { created_at: string; action: string; actor: string | null; entity_name: string | null; details: unknown }

const STATUS: Record<string, string> = { pending: "A fazer", in_progress: "Em andamento", ready_review: "Revisar", done: "Feito" };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** Frase do que aconteceu, sem o autor (o autor aparece à parte). */
export function journalText(row: JournalRow): string {
  const d = obj(row.details);
  const what = row.entity_name ?? "";
  switch (row.action) {
    case "etapa_status": return `${what}: ${STATUS[String(d.de)] ?? "sem status"} → ${STATUS[String(d.para)] ?? "sem status"}`;
    case "etapa_responsavel": return `${what}: responsável ${txt(d.de)} → ${txt(d.para)}`;
    case "etapa_prazo": return `${what}: prazo ${txt(d.de)} → ${txt(d.para)}`;
    case "venda_aprovada": return `Venda aprovada: ${what}${d.valor ? ` (${d.valor})` : ""}`;
    case "recuperacao_descartada": return `Recuperação descartada: ${what}`;
    case "estrategia_aplicada": return `Estratégia aplicada: ${what}`;
    case "conteudo_aprovado": return `Conteúdo aprovado: ${what}`;
    case "conteudo_reprovado": return `Conteúdo reprovado: ${what}`;
    case "resposta_bot_aprovada": return `Resposta do bot aprovada: ${what}`;
    case "acao_ia_approved": return `Ação da IA aprovada: ${what}`;
    case "acao_ia_executed": return `Ação da IA executada: ${what}`;
    case "acao_ia_rejected": return `Ação da IA rejeitada: ${what}`;
    case "acao_ia_failed": return `Ação da IA falhou: ${what}${d.erro ? ` (${d.erro})` : ""}`;
    case "acao_ia_reverted": return `Ação da IA revertida: ${what}`;
    default: return `${row.action.replace(/_/g, " ")}${what ? `: ${what}` : ""}`;
  }
}

/** Quem fez, curto: e-mail vira o nome antes do @; "ia (OK de X) via mcp" vira "IA · OK de X". */
export function journalActor(actor: string | null): string {
  if (!actor || actor === "sistema") return "Automação";
  const ok = actor.match(/OK de ([^)]+)\)/);
  if (actor.startsWith("ia")) return ok ? `IA · OK de ${ok[1].split(/\s+/)[0]}` : "IA";
  if (actor.includes("@")) return actor.split("@")[0];
  return actor;
}
