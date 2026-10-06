// Linhas do banco → linhas da fila Aprovar (pix travado, semáforo de anúncios, dúvidas do bot).
// TS puro: a tela /aprovar e o project-mcp montam a fila com a mesma regra (IA1.1).
import type { AiActionRow, KnowledgeGapRow, PixRow, SemaforoRow } from "./approval-queue.ts";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function firstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? ` ${first}` : "";
}

/** Mensagem de recuperação do pix conforme a idade do pedido (até 2 h, até 24 h, depois). */
export function buildPixRecoveryMessage(name: string | null | undefined, product: string | null | undefined, ageMin: number): string {
  const p = product || "seu pedido";
  const n = firstName(name);
  if (ageMin < 120) return `Oi${n}! Vi que o pagamento de *${p}* não rolou ainda. Travou em algo? Me fala que resolvo aqui.`;
  if (ageMin < 1440) return `Oi${n}! Ainda dá tempo de fechar o *${p}*. Se ficou alguma dúvida em preço ou formato, me responde por aqui.`;
  return `Oi${n}! Última chamada — sua condição especial para *${p}* expira hoje. Quer que eu segure para você?`;
}

export interface PendingSaleRow { id: string; lead_id: string | null; project_id: string | null; valor: number | null; produto_nome: string | null; data: unknown; nome: string | null; created_at: string }

/**
 * A régua automática já está cuidando deste Pix? (hot-lead-responder respondeu ou algum nível da recuperação foi enviado
 * e o último envio não falhou). Nesse caso o card não vai para a fila: a pessoa só vê o que a automação não resolveu.
 */
export function autoRecoveryActive(data: unknown): boolean {
  const d = obj(data);
  const last = obj(d.recovery_last);
  if (last.ok === false) return false;
  const levels = Array.isArray(d.recovery_sent_levels) ? d.recovery_sent_levels : [];
  return d.hot_lead_responder_ok === true || levels.length > 0;
}

export function pixRowsFromSales(
  sales: ReadonlyArray<PendingSaleRow>,
  leads: Readonly<Record<string, { nome?: string | null; phone?: string | null }>>,
  now: number = Date.now(),
): PixRow[] {
  return sales.filter((v) => !autoRecoveryActive(v.data)).map((v) => {
    const lead = v.lead_id ? leads[v.lead_id] : undefined;
    const data = obj(v.data);
    const customerName = v.nome || lead?.nome || str(data.nome) || "Cliente";
    const ageMin = Math.max(0, Math.floor((now - Date.parse(v.created_at)) / 60_000));
    return {
      id: v.id,
      project_id: v.project_id,
      lead_id: v.lead_id,
      customer_name: customerName,
      customer_phone: lead?.phone || str(data.phone) || str(data.telefone),
      product_name: v.produto_nome,
      valor: Number(v.valor) || 0,
      created_at: v.created_at,
      recovery_level: ageMin < 120 ? 1 : ageMin < 1440 ? 2 : 3,
      recovery_message: buildPixRecoveryMessage(customerName, v.produto_nome, ageMin),
    };
  });
}

export type RawAction = AiActionRow & { source?: string | null };

/** Separa as ações de anúncio (semáforo: pausar/escalar) das demais ações da IA. */
export function splitAdsActions(actions: ReadonlyArray<RawAction>): { semaforo: SemaforoRow[]; generic: AiActionRow[] } {
  const semaforo: SemaforoRow[] = [];
  const generic: AiActionRow[] = [];
  for (const a of actions) {
    const title = a.title.toLowerCase();
    const isAds = a.source === "ads-rules-engine" || ["pauseAd", "adjustBudget", "scaleAd"].includes(a.kind) || title.includes("pausar ad") || title.includes("escalar");
    if (!isAds) { generic.push(a); continue; }
    const p = obj(a.payload);
    semaforo.push({
      id: a.id, title: a.title, reason: a.reason, risk_level: a.risk_level, impact_brl: a.impact_brl, projeto_id: a.projeto_id, created_at: a.created_at,
      entity_id: str(p.entity_id) ?? undefined,
      entity_name: str(p.entity_name) ?? a.title,
      spend_brl: num(p.spend_brl) ?? a.impact_brl ?? null,
      cpa_brl: num(p.cpa_brl),
      meta_cpa_brl: num(p.meta_cpa_brl),
      purchases: num(p.purchases),
      clicks: num(p.clicks),
      recommendation: a.kind === "adjustBudget" || title.includes("escalar") ? "escalar" : "pausar",
    });
  }
  return { semaforo, generic };
}

export interface KnowledgeRow { id: string; project_id: string | null; pergunta: string | null; resposta: string | null; source?: string | null; created_at: string }

export function knowledgeGapRows(rows: ReadonlyArray<KnowledgeRow>): KnowledgeGapRow[] {
  return rows.map((k) => ({ id: k.id, project_id: k.project_id ?? "", pergunta: k.pergunta ?? "", resposta: k.resposta, created_at: k.created_at, source: k.source }));
}
