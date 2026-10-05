// Níveis de autonomia da IA (IA1.1): o que ela faz sozinha, o que precisa do OK de alguém do time, o que nunca faz.
// TS puro. O banco (imphq_ai_policy.autonomy, scope 'mcp') pode mudar o padrão, mas nunca passar do teto daqui.

export type AutonomyLevel = "auto" | "aprovar" | "nunca";

export interface AutonomyRule {
  key: string;
  label: string;
  /** Nível mais solto permitido, mesmo que o banco peça mais. */
  teto: AutonomyLevel;
  padrao: AutonomyLevel;
  motivo: string;
}

export const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  auto: "IA faz sozinha",
  aprovar: "Precisa do OK de alguém do time",
  nunca: "IA nunca faz",
};

export const AUTONOMY_RULES: AutonomyRule[] = [
  // Fila Aprovar
  { key: "etapa:approve", label: "Marcar etapa revisada como feita", teto: "aprovar", padrao: "aprovar", motivo: "A IA não aprova o próprio trabalho." },
  { key: "etapa:reject", label: "Devolver etapa para ajuste", teto: "auto", padrao: "auto", motivo: "Devolver não muda nada fora do sistema." },
  { key: "acao_ia:approve", label: "Executar ação proposta pela IA", teto: "aprovar", padrao: "aprovar", motivo: "Pode mandar mensagem, criar tarefa ou mexer em fluxo." },
  { key: "acao_ia:reject", label: "Rejeitar ação proposta", teto: "auto", padrao: "auto", motivo: "Rejeitar não tem efeito externo." },
  { key: "semaforo_ads:approve", label: "Pausar ou escalar anúncio", teto: "aprovar", padrao: "aprovar", motivo: "Mexe em verba." },
  { key: "semaforo_ads:reject", label: "Ignorar sugestão de anúncio", teto: "auto", padrao: "auto", motivo: "Mantém o anúncio como está." },
  { key: "pix_travado:approve", label: "Registrar recuperação de pix enviada", teto: "nunca", padrao: "nunca", motivo: "O envio é o clique no WhatsApp; a IA registraria um envio que não aconteceu." },
  { key: "pix_travado:mark_paid", label: "Marcar pix como pago", teto: "aprovar", padrao: "aprovar", motivo: "Muda o registro de venda; só com comprovante visto por alguém." },
  { key: "pix_travado:reject", label: "Descartar recuperação do pix", teto: "aprovar", padrao: "aprovar", motivo: "Desiste de um dinheiro em aberto." },
  { key: "duvida_bot:approve", label: "Aprovar resposta no acervo do bot", teto: "aprovar", padrao: "aprovar", motivo: "A resposta passa a ser dita a clientes." },
  { key: "duvida_bot:reject", label: "Descartar dúvida do bot", teto: "auto", padrao: "auto", motivo: "Só tira da fila." },
  { key: "conteudo:approve", label: "Aprovar conteúdo para publicar", teto: "aprovar", padrao: "aprovar", motivo: "Vai para a esteira de publicação." },
  { key: "conteudo:reject", label: "Reprovar conteúdo", teto: "auto", padrao: "auto", motivo: "Só tira da esteira." },
  { key: "rascunho:approve", label: "Enviar resposta da IA ao cliente", teto: "nunca", padrao: "nunca", motivo: "Envio para cliente acontece na tela de Rascunhos." },
  { key: "rascunho:reject", label: "Descartar resposta da IA", teto: "nunca", padrao: "nunca", motivo: "Decidido na tela de Rascunhos." },
  // Outras ações do MCP
  { key: "step:assign", label: "Atribuir responsável e prazo", teto: "auto", padrao: "auto", motivo: "Organização interna." },
  { key: "playbook:apply", label: "Desenhar estratégia no mapa", teto: "aprovar", padrao: "aprovar", motivo: "Muda o mapa de operação de um projeto." },
];

const ORDER: Record<AutonomyLevel, number> = { nunca: 0, aprovar: 1, auto: 2 };
const BY_KEY = new Map(AUTONOMY_RULES.map((r) => [r.key, r]));

export function autonomyRule(key: string): AutonomyRule | null {
  return BY_KEY.get(key) ?? null;
}

/** Nível efetivo: o do banco (ou o padrão), limitado pelo teto. Ação desconhecida = nunca. */
export function effectiveAutonomy(key: string, override?: string | null): AutonomyLevel {
  const rule = BY_KEY.get(key);
  if (!rule) return "nunca";
  const wanted: AutonomyLevel = override === "auto" || override === "aprovar" || override === "nunca" ? override : rule.padrao;
  return ORDER[wanted] > ORDER[rule.teto] ? rule.teto : wanted;
}

export type AutonomyCheck =
  | { ok: true; level: AutonomyLevel; actor: string }
  | { ok: false; level: AutonomyLevel; reason: string };

/**
 * Pode executar? "auto" passa; "aprovar" exige o nome de quem do time deu o OK (fica no diário); "nunca" bloqueia.
 * `team` = nomes/e-mails válidos do time.
 */
export function checkAutonomy(key: string, override: string | null | undefined, confirmedBy: string | null | undefined, team: ReadonlyArray<{ id: string; name: string; email?: string | null }>): AutonomyCheck {
  const level = effectiveAutonomy(key, override);
  const rule = BY_KEY.get(key);
  if (level === "nunca") return { ok: false, level, reason: rule ? `${rule.label}: a IA nunca faz isso. ${rule.motivo}` : `Ação desconhecida (${key}).` };
  if (level === "auto") return { ok: true, level, actor: "ia" };
  const who = (confirmedBy ?? "").trim().toLowerCase();
  const member = who ? team.find((m) => m.id === who || m.email?.toLowerCase() === who || m.name.toLowerCase() === who || m.name.toLowerCase().split(/\s+/)[0] === who) : undefined;
  if (!member) return { ok: false, level, reason: `${rule?.label ?? key} precisa do OK de alguém do time: informe confirmado_por (${team.map((m) => m.name).join(", ")}).` };
  return { ok: true, level, actor: `ia (OK de ${member.name})` };
}
