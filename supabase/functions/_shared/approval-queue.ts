// Fila única "Aprovar" (UX1.3): tudo que espera um sim ou não de alguém do time, de qualquer origem.
// TS puro: tela /aprovar, contador do menu e (depois) MCP usam a mesma regra.

export type ApprovalSource = "etapa" | "acao_ia" | "conteudo" | "rascunho";

export interface ApprovalItem {
  key: string;
  source: ApprovalSource;
  id: string;
  title: string;
  detail: string | null;
  projectId: string | null;
  createdAt: string;
  /** Onde abrir o item com todo o contexto. */
  link: string;
  /** Imagem de prévia (capa do vídeo, print). */
  media: string | null;
  risk: "low" | "medium" | "high" | null;
  impactBrl: number | null;
  /** Aprovar aqui mesmo (false = só abre a tela de origem, ex.: rascunho que envia mensagem). */
  inline: boolean;
}

export const SOURCE_LABEL: Record<ApprovalSource, string> = {
  etapa: "Etapas para revisar",
  acao_ia: "Ações da IA",
  conteudo: "Conteúdo pronto",
  rascunho: "Respostas da IA",
};

export interface ReviewStepRow { id: string; map_id: string; label: string; description?: string | null; linked_project_id?: string | null; status_changed_at?: string | null; updated_at?: string | null; image_url?: string | null }
export interface AiActionRow { id: string; kind: string; title: string; reason?: string | null; risk_level?: string | null; impact_brl?: number | null; projeto_id?: string | null; created_at: string }
export interface ContentRow { id: string; project_id: string; title?: string | null; hook?: string | null; cover_url?: string | null; media_url?: string | null; batch?: string | null; updated_at?: string | null; created_at: string }
export interface DraftRow { id: string | null; project_id?: string | null; contact_name?: string | null; incoming_text?: string | null; suggested_text?: string | null; created_at?: string | null }

const RISK: Record<string, ApprovalItem["risk"]> = { low: "low", medium: "medium", high: "high" };
const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;
const SOURCE_ORDER: Record<ApprovalSource, number> = { rascunho: 0, etapa: 1, acao_ia: 2, conteudo: 3 };

const clip = (text: string | null | undefined, max = 160) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? (t.length > max ? `${t.slice(0, max - 1)}…` : t) : null;
};

export function buildApprovalQueue(input: {
  steps: ReadonlyArray<ReviewStepRow>;
  actions: ReadonlyArray<AiActionRow>;
  contents: ReadonlyArray<ContentRow>;
  drafts: ReadonlyArray<DraftRow>;
}): ApprovalItem[] {
  const items: ApprovalItem[] = [
    // Resposta para cliente esperando: o mais urgente (alguém está aguardando no WhatsApp/Instagram).
    ...input.drafts.filter((d) => d.id).map((d): ApprovalItem => ({
      key: `rascunho:${d.id}`, source: "rascunho", id: d.id as string,
      title: `Resposta para ${d.contact_name || "contato"}`,
      detail: clip(d.suggested_text) ?? clip(d.incoming_text),
      projectId: d.project_id ?? null, createdAt: d.created_at ?? "", link: "/rascunhos", media: null, risk: null, impactBrl: null, inline: false,
    })),
    ...input.steps.map((s): ApprovalItem => ({
      key: `etapa:${s.id}`, source: "etapa", id: s.id, title: s.label, detail: clip(s.description),
      projectId: s.linked_project_id ?? null, createdAt: s.status_changed_at || s.updated_at || "",
      link: `/funis?view=mapa&map=${s.map_id}&node=${s.id}`, media: s.image_url ?? null, risk: null, impactBrl: null, inline: true,
    })),
    ...input.actions.map((a): ApprovalItem => ({
      key: `acao_ia:${a.id}`, source: "acao_ia", id: a.id, title: a.title, detail: clip(a.reason),
      projectId: a.projeto_id ?? null, createdAt: a.created_at, link: "/imperius", media: null,
      risk: RISK[a.risk_level ?? ""] ?? null, impactBrl: a.impact_brl ?? null, inline: true,
    })),
    ...input.contents.map((c): ApprovalItem => ({
      key: `conteudo:${c.id}`, source: "conteudo", id: c.id, title: c.title || clip(c.hook, 80) || "Peça sem título",
      detail: [c.batch ? `Lote ${c.batch}` : null, clip(c.hook)].filter(Boolean).join(" · ") || null,
      projectId: c.project_id, createdAt: c.updated_at || c.created_at, link: c.media_url || "/rascunhos",
      media: c.cover_url ?? null, risk: null, impactBrl: null, inline: true,
    })),
  ];
  // Origem mais urgente primeiro; dentro dela, maior risco e depois o mais antigo (esperando há mais tempo).
  return items.sort((a, b) =>
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]
    || (a.risk ? RISK_ORDER[a.risk] : 3) - (b.risk ? RISK_ORDER[b.risk] : 3)
    || a.createdAt.localeCompare(b.createdAt));
}

/** Há quanto tempo o item espera, em texto curto ("3 h", "2 d"). */
export function waitingFor(createdAt: string, now: number = Date.now()): string {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return "";
  const h = Math.max(0, Math.floor((now - t) / 3_600_000));
  if (h < 1) return "agora";
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
