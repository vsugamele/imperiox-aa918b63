// Fila única "Aprovar" (UX1.3): tudo que espera um sim ou não de alguém do time, de qualquer origem.
// TS puro: tela /aprovar, contador do menu e (depois) MCP usam a mesma regra.

export type ApprovalSource = "pix_travado" | "suporte" | "semaforo_ads" | "duvida_bot" | "rascunho" | "leva" | "etapa" | "acao_ia" | "conteudo";

export interface ApprovalMetadata {
  // Pix
  customerName?: string;
  customerPhone?: string;
  productName?: string;
  recoveryMessage?: string;
  recoveryLevel?: number;
  whatsappUrl?: string;

  // Semáforo Ads
  entityId?: string;
  entityName?: string;
  entityType?: "ad" | "adset" | "campaign";
  spendBrl?: number;
  cpaBrl?: number;
  metaCpaBrl?: number;
  purchases?: number;
  clicks?: number;
  recommendation?: "pausar" | "escalar" | "alerta";

  // Dúvida Bot / Base de Conhecimento
  question?: string;
  suggestedAnswer?: string;
  knowledgeId?: string;
  sourceType?: string;

  // Suporte JP (a chave da conversa é canal + id)
  channel?: "whatsapp" | "instagram";
  conversationId?: string;
}

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
  metadata?: ApprovalMetadata;
}

export const SOURCE_LABEL: Record<ApprovalSource, string> = {
  pix_travado: "Pix Travados",
  suporte: "Suporte parado",
  semaforo_ads: "Semáforo Ads",
  duvida_bot: "Dúvidas do Bot",
  rascunho: "Respostas da IA",
  leva: "Levas de criativos",
  etapa: "Etapas para revisar",
  acao_ia: "Ações da IA",
  conteudo: "Conteúdo pronto",
};

export interface ReviewStepRow { id: string; map_id: string; label: string; description?: string | null; linked_project_id?: string | null; status_changed_at?: string | null; updated_at?: string | null; image_url?: string | null }
export interface AiActionRow { id: string; kind: string; title: string; reason?: string | null; risk_level?: string | null; impact_brl?: number | null; projeto_id?: string | null; created_at: string; payload?: unknown }
export interface ContentRow { id: string; project_id: string; title?: string | null; hook?: string | null; cover_url?: string | null; media_url?: string | null; batch?: string | null; updated_at?: string | null; created_at: string }
export interface DraftRow { id: string | null; project_id?: string | null; contact_name?: string | null; incoming_text?: string | null; suggested_text?: string | null; created_at?: string | null }
export interface PixRow {
  id: string;
  project_id?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  product_name?: string | null;
  valor: number;
  created_at: string;
  recovery_level?: number;
  recovery_message?: string;
}
export interface SemaforoRow {
  id: string;
  title: string;
  reason?: string | null;
  risk_level?: string | null;
  impact_brl?: number | null;
  projeto_id?: string | null;
  created_at: string;
  entity_id?: string | null;
  entity_name?: string | null;
  spend_brl?: number | null;
  cpa_brl?: number | null;
  meta_cpa_brl?: number | null;
  purchases?: number;
  clicks?: number;
  recommendation?: "pausar" | "escalar" | "alerta" | null;
}
export interface KnowledgeGapRow {
  id: string;
  project_id: string;
  pergunta: string;
  resposta?: string | null;
  created_at: string;
  source?: string | null;
}

export interface LevaRow { id: string; project_id: string; nome?: string | null; status: string; total_planejado?: number | null; created_at: string; updated_at?: string | null }
export interface SupportRow {
  channel: "whatsapp" | "instagram";
  conversation_id: string;
  project_id?: string | null;
  support_kind?: string | null;
  support_status: string | null;
  support_opened_at?: string | null;
  latest_message_at?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  last_message?: string | null;
}

const RISK: Record<string, ApprovalItem["risk"]> = { low: "low", medium: "medium", high: "high" };
const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;
const SOURCE_ORDER: Record<ApprovalSource, number> = {
  pix_travado: 0,
  suporte: 1,
  semaforo_ads: 2,
  duvida_bot: 3,
  rascunho: 4,
  leva: 5,
  etapa: 6,
  acao_ia: 7,
  conteudo: 8,
};

const clip = (text: string | null | undefined, max = 160) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? (t.length > max ? `${t.slice(0, max - 1)}…` : t) : null;
};

export function buildApprovalQueue(input: {
  steps?: ReadonlyArray<ReviewStepRow>;
  actions?: ReadonlyArray<AiActionRow>;
  contents?: ReadonlyArray<ContentRow>;
  drafts?: ReadonlyArray<DraftRow>;
  pix?: ReadonlyArray<PixRow>;
  semaforo?: ReadonlyArray<SemaforoRow>;
  knowledge?: ReadonlyArray<KnowledgeGapRow>;
  levas?: ReadonlyArray<LevaRow>;
  support?: ReadonlyArray<SupportRow>;
}): ApprovalItem[] {
  const items: ApprovalItem[] = [
    // 1. Pix travados: conversão imediata de quem tentou pagar e precisa de estímulo
    ...(input.pix ?? []).map((p): ApprovalItem => {
      const cleanPhone = (p.customer_phone || "").replace(/\D/g, "");
      const waUrl = cleanPhone
        ? `https://wa.me/${cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone}?text=${encodeURIComponent(p.recovery_message || `Oi ${p.customer_name || ""}! Vi que o pagamento de *${p.product_name || "seu pedido"}* ficou pendente. Quer ajuda para concluir?`)}`
        : "/vendas";
      return {
        key: `pix_travado:${p.id}`,
        source: "pix_travado",
        id: p.id,
        title: `Pix travado · R$ ${Number(p.valor || 0).toFixed(2).replace(".", ",")} — ${p.customer_name || "Cliente"}`,
        detail: [
          p.product_name ? `Produto: ${p.product_name}` : null,
          p.customer_phone ? `Tel: ${p.customer_phone}` : "Sem telefone",
          p.recovery_message ? `Mensagem: "${clip(p.recovery_message, 90)}"` : null,
        ].filter(Boolean).join(" · "),
        projectId: p.project_id ?? null,
        createdAt: p.created_at,
        link: waUrl,
        media: null,
        risk: "high",
        impactBrl: Number(p.valor || 0),
        inline: true,
        metadata: {
          customerName: p.customer_name || undefined,
          customerPhone: p.customer_phone || undefined,
          productName: p.product_name || undefined,
          recoveryMessage: p.recovery_message || undefined,
          recoveryLevel: p.recovery_level || 1,
          whatsappUrl: waUrl,
        },
      };
    }),

    // 1b. Suporte parado: cliente esperando alguém do time (a IA passou adiante ou não resolveu)
    ...(input.support ?? []).filter((t) => t.support_status === "handoff" || t.support_status === "pending").map((t): ApprovalItem => {
      const canal = t.channel === "instagram" ? "Instagram" : "WhatsApp";
      const phone = (t.contact_phone ?? "").replace(/\D/g, "");
      return {
        key: `suporte:${t.channel}:${t.conversation_id}`,
        source: "suporte",
        id: `${t.channel}:${t.conversation_id}`,
        title: `Suporte ${t.support_status === "handoff" ? "passado para a equipe" : "sem resposta"} · ${t.contact_name || "cliente"} (${canal})`,
        detail: [
          t.support_kind === "access" ? "Acesso à área de membros" : "Outro assunto",
          t.last_message ? `Última mensagem: "${clip(t.last_message, 100)}"` : null,
        ].filter(Boolean).join(" · "),
        projectId: t.project_id ?? null,
        createdAt: t.support_opened_at || t.latest_message_at || "",
        link: t.channel === "whatsapp" && phone ? `/inbox?tab=whatsapp&phone=${encodeURIComponent(phone)}` : `/inbox?tab=${t.channel}`,
        media: null,
        risk: t.support_status === "handoff" ? "high" : "medium",
        impactBrl: null,
        inline: true,
        metadata: { channel: t.channel, conversationId: t.conversation_id, customerName: t.contact_name || undefined },
      };
    }),

    // 2. Semáforo de anúncios: pausar ad caro ou escalar vencedor
    ...(input.semaforo ?? []).map((s): ApprovalItem => ({
      key: `semaforo_ads:${s.id}`,
      source: "semaforo_ads",
      id: s.id,
      title: s.title,
      detail: s.reason || (s.spend_brl ? `Gasto: R$ ${s.spend_brl.toFixed(2)} | Compras: ${s.purchases ?? 0}` : null),
      projectId: s.projeto_id ?? null,
      createdAt: s.created_at,
      link: "/gerenciador-ads",
      media: null,
      risk: s.risk_level === "high" ? "high" : s.risk_level === "medium" ? "medium" : "low",
      impactBrl: s.impact_brl ?? s.spend_brl ?? null,
      inline: true,
      metadata: {
        entityId: s.entity_id || undefined,
        entityName: s.entity_name || undefined,
        spendBrl: s.spend_brl ?? undefined,
        cpaBrl: s.cpa_brl ?? undefined,
        metaCpaBrl: s.meta_cpa_brl ?? undefined,
        purchases: s.purchases ?? undefined,
        clicks: s.clicks ?? undefined,
        recommendation: s.recommendation ?? (s.title.toLowerCase().includes("pausar") ? "pausar" : "escalar"),
      },
    })),

    // 3. Dúvidas do Bot: perguntas sem resposta para virar acervo RAG
    ...(input.knowledge ?? []).map((k): ApprovalItem => ({
      key: `duvida_bot:${k.id}`,
      source: "duvida_bot",
      id: k.id,
      title: `Dúvida do lead: "${clip(k.pergunta, 80)}"`,
      detail: k.resposta ? `Resposta sugerida: "${clip(k.resposta, 120)}"` : "Pergunta não respondida pelo bot. Cadastre ou aprove a resposta para o acervo.",
      projectId: k.project_id ?? null,
      createdAt: k.created_at,
      link: "/acervo",
      media: null,
      risk: "medium",
      impactBrl: null,
      inline: true,
      metadata: {
        question: k.pergunta,
        suggestedAnswer: k.resposta || "",
        knowledgeId: k.id,
        sourceType: k.source || undefined,
      },
    })),

    // 4. Respostas para cliente esperando (WhatsApp/Instagram)
    ...(input.drafts ?? []).filter((d) => d.id).map((d): ApprovalItem => ({
      key: `rascunho:${d.id}`, source: "rascunho", id: d.id as string,
      title: `Resposta para ${d.contact_name || "contato"}`,
      detail: clip(d.suggested_text) ?? clip(d.incoming_text),
      projectId: d.project_id ?? null, createdAt: d.created_at ?? "", link: "/rascunhos", media: null, risk: null, impactBrl: null, inline: false,
    })),

    // 4b. Levas de criativos: planejada espera o sim; aprovada espera alguém gerar as artes na Fábrica
    ...(input.levas ?? []).filter((l) => l.status === "planejado" || l.status === "aprovado").map((l): ApprovalItem => {
      const planejada = l.status === "planejado";
      return {
        key: `leva:${l.id}`, source: "leva", id: l.id,
        title: planejada ? `Leva para aprovar: ${l.nome || "sem nome"}` : `Leva aprovada esperando gerar as artes: ${l.nome || "sem nome"}`,
        detail: [
          l.total_planejado ? `${l.total_planejado} criativo(s)` : null,
          planejada ? "Aprovar libera a geração (gerar continua sendo um clique na Fábrica)" : "Abra a Fábrica e clique em gerar",
        ].filter(Boolean).join(" · "),
        projectId: l.project_id, createdAt: l.updated_at || l.created_at, link: "/fabrica#passo-leva",
        media: null, risk: null, impactBrl: null, inline: planejada,
      };
    }),

    // 5. Etapas para revisar
    ...(input.steps ?? []).map((s): ApprovalItem => ({
      key: `etapa:${s.id}`, source: "etapa", id: s.id, title: s.label, detail: clip(s.description),
      projectId: s.linked_project_id ?? null, createdAt: s.status_changed_at || s.updated_at || "",
      link: `/funis?view=mapa&map=${s.map_id}&node=${s.id}`, media: s.image_url ?? null, risk: null, impactBrl: null, inline: true,
    })),

    // 6. Ações da IA genéricas
    ...(input.actions ?? []).map((a): ApprovalItem => ({
      key: `acao_ia:${a.id}`, source: "acao_ia", id: a.id, title: a.title, detail: clip(a.reason),
      projectId: a.projeto_id ?? null, createdAt: a.created_at, link: "/imperius", media: null,
      risk: RISK[a.risk_level ?? ""] ?? null, impactBrl: a.impact_brl ?? null, inline: true,
    })),

    // 7. Conteúdos prontos
    ...(input.contents ?? []).map((c): ApprovalItem => ({
      key: `conteudo:${c.id}`, source: "conteudo", id: c.id, title: c.title || clip(c.hook, 80) || "Peça sem título",
      detail: [c.batch ? `Lote ${c.batch}` : null, clip(c.hook)].filter(Boolean).join(" · ") || null,
      projectId: c.project_id, createdAt: c.updated_at || c.created_at, link: c.media_url || "/rascunhos",
      media: c.cover_url ?? null, risk: null, impactBrl: null, inline: true,
    })),
  ];

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
