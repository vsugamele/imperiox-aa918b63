// Feed "A IA fez" (IA2.1): junta o que a IA fez sozinha nas últimas horas (respostas no WhatsApp, recuperação de Pix,
// aprovações no acervo do bot e ações automáticas) num formato único para o time revisar depois. TS puro.

export type FeedKind = "resposta_wa" | "recuperacao_pix" | "acervo" | "acao_auto";

export interface FeedItem {
  kind: FeedKind;
  id: string;
  project_id: string | null;
  at: string;
  titulo: string;
  contexto: string | null;
  feito: string;
  resultado: string | null;
  feedback: { verdict: "ok" | "diferente"; correcao: string | null } | null;
}

export const FEED_KIND_LABEL: Record<FeedKind, string> = {
  resposta_wa: "Resposta no WhatsApp",
  recuperacao_pix: "Recuperação de Pix",
  acervo: "Acervo do bot",
  acao_auto: "Ação automática",
};

export interface WaMessageRow { id: string; conversation_id: string | null; project_id: string | null; content: string | null; created_at: string; sent_by: string | null; direction: string | null; phone?: string | null }
export interface SaleRow { id: string; project_id: string | null; nome?: string | null; produto_nome: string | null; valor: number | string | null; status: string | null; data: unknown; created_at: string }
export interface KnowledgeRow { id: string; project_id: string | null; pergunta: string | null; resposta: string | null; aprovada: boolean | null; triado_em: string | null; triagem: unknown }
export interface ActionRow { id: string; projeto_id: string | null; kind: string; title: string | null; reason: string | null; status: string; created_at: string }
export interface FeedbackRow { item_kind: string; item_id: string; verdict: "ok" | "diferente"; correcao: string | null }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const clip = (s: string | null | undefined, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const PAID = new Set(["aprovado", "approved", "paid", "pago", "completed"]);

/** Texto do que a IA fez, por tipo de ação automática. */
const ACTION_DONE: Record<string, string> = {
  grantAccess: "Liberei o acesso na área de membros e mandei o link de entrada na conversa.",
  grantAccessSilent: "Liberei o acesso de uma compra paga que não tinha chegado à área de membros (sem mensagem para a pessoa).",
  supportReply: "Respondi quem estava esperando o suporte de acesso, com o link de entrada quando o acesso estava ok.",
  pauseAd: "Pausei o anúncio.",
};

/** Última mensagem do lead antes da resposta da IA, na mesma conversa. */
function leadBefore(ai: WaMessageRow, incoming: ReadonlyArray<WaMessageRow>): WaMessageRow | null {
  let best: WaMessageRow | null = null;
  for (const m of incoming) {
    if (m.conversation_id !== ai.conversation_id || m.created_at > ai.created_at) continue;
    if (!best || m.created_at > best.created_at) best = m;
  }
  return best;
}

export interface FeedInput {
  aiMessages: ReadonlyArray<WaMessageRow>;
  incoming: ReadonlyArray<WaMessageRow>;
  sales: ReadonlyArray<SaleRow>;
  knowledge: ReadonlyArray<KnowledgeRow>;
  actions: ReadonlyArray<ActionRow>;
  feedback: ReadonlyArray<FeedbackRow>;
  since: string;
}

export function buildAiFeed(input: FeedInput): FeedItem[] {
  const fb = new Map(input.feedback.map((f) => [`${f.item_kind}:${f.item_id}`, { verdict: f.verdict, correcao: f.correcao }]));
  const withFb = (kind: FeedKind, id: string) => fb.get(`${kind}:${id}`) ?? null;
  const items: FeedItem[] = [];

  for (const m of input.aiMessages) {
    if (m.created_at < input.since || !m.content) continue;
    const lead = leadBefore(m, input.incoming);
    items.push({
      kind: "resposta_wa", id: m.id, project_id: m.project_id, at: m.created_at,
      titulo: "Respondi um lead no WhatsApp",
      contexto: lead?.content ? clip(lead.content, 280) : null,
      feito: clip(m.content, 600), resultado: null, feedback: withFb("resposta_wa", m.id),
    });
  }

  for (const s of input.sales) {
    const d = obj(s.data);
    const last = obj(d.recovery_last);
    const levels = Array.isArray(d.recovery_sent_levels) ? (d.recovery_sent_levels as unknown[]).map(Number) : [];
    const firstReply = typeof d.hot_lead_responder_sent === "string" ? d.hot_lead_responder_sent : null;
    const lastAt = typeof last.at === "string" ? last.at : firstReply;
    if (!lastAt || lastAt < input.since) continue;
    const passos = [firstReply ? "respondi na hora em que o Pix foi gerado" : null, levels.length ? `mandei a régua de recuperação (nível ${levels.join(", ")})` : null].filter(Boolean).join(" e ");
    if (!passos) continue;
    const pago = PAID.has(String(s.status ?? "").toLowerCase());
    items.push({
      kind: "recuperacao_pix", id: s.id, project_id: s.project_id, at: lastAt,
      titulo: `Pix de R$ ${Number(s.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${s.produto_nome ?? "produto"}`,
      contexto: `${s.nome ?? "Cliente"} gerou o Pix e não pagou.`,
      feito: `${passos.charAt(0).toUpperCase()}${passos.slice(1)}.`,
      resultado: pago ? "Pagou depois ✓" : last.ok === false ? `Último envio falhou (${String(last.error ?? "erro")})` : "Ainda não pagou",
      feedback: withFb("recuperacao_pix", s.id),
    });
  }

  for (const k of input.knowledge) {
    if (!k.triado_em || k.triado_em < input.since || !k.aprovada) continue;
    const t = obj(k.triagem);
    items.push({
      kind: "acervo", id: k.id, project_id: k.project_id, at: k.triado_em,
      titulo: "Ensinei uma resposta nova ao bot",
      contexto: clip(k.pergunta, 280),
      feito: clip(k.resposta, 600),
      resultado: typeof t.decidido_por === "string" ? `Decidido por ${t.decidido_por}` : `Jev: reutilizável ${Math.round(Number(t.reutilizavel ?? 0) * 100)}%`,
      feedback: withFb("acervo", k.id),
    });
  }

  for (const a of input.actions) {
    if (a.created_at < input.since) continue;
    items.push({
      kind: "acao_auto", id: a.id, project_id: a.projeto_id, at: a.created_at,
      titulo: a.title ?? a.kind, contexto: a.reason ? clip(a.reason, 280) : null,
      feito: ACTION_DONE[a.kind] ?? `Executei sozinha (${a.kind}).`, resultado: a.status === "failed" ? "Falhou" : null,
      feedback: withFb("acao_auto", a.id),
    });
  }

  return items.sort((x, y) => y.at.localeCompare(x.at));
}

/** Quantos itens ainda sem revisão, por tipo: o número que importa no topo do feed. */
export function feedCounts(items: ReadonlyArray<FeedItem>) {
  const pendentes = items.filter((i) => !i.feedback);
  return {
    total: items.length,
    sem_revisao: pendentes.length,
    diferente: items.filter((i) => i.feedback?.verdict === "diferente").length,
    por_tipo: Object.fromEntries((Object.keys(FEED_KIND_LABEL) as FeedKind[]).map((k) => [k, items.filter((i) => i.kind === k).length])) as Record<FeedKind, number>,
  };
}
