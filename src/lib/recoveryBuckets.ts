import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

export type RecoveryChannel = "whatsapp" | "email";
export type RecoveryBucketId = "pix_urgent" | "pix_cooling" | "boleto_due" | "abandoned_cart" | "refunds";
export type RecoveryTemplateType = "pix_2h" | "pix_24h" | "boleto" | "carrinho" | "reembolso";

type SaleRow = Database["public"]["Tables"]["imphq_vendas"]["Row"];
type LeadRow = Database["public"]["Tables"]["imphq_leads"]["Row"];
type RecoveryLogRow = Database["public"]["Tables"]["imphq_recovery_logs"]["Row"];
type RecoveryTemplateRow = Database["public"]["Tables"]["imphq_recovery_templates"]["Row"];

export interface RecoveryItem {
  id: string;
  bucket: RecoveryBucketId;
  templateType: RecoveryTemplateType;
  projectId: string | null;
  leadId: string | null;
  vendaId: string | null;
  leadName: string;
  email: string;
  phone: string;
  product: string;
  value: number;
  createdAt: string;
  ageLabel: string;
  lastContact: string | null;
  lastContactAt: string | null;
  paymentLink: string | null;
  notes?: string | null;
}

export interface RecoveryBucketSummary {
  id: RecoveryBucketId;
  title: string;
  shortTitle: string;
  description: string;
  templateType: RecoveryTemplateType;
  items: RecoveryItem[];
  totalValue: number;
  recoveryRate: number;
  recoveredCount: number;
  attemptsCount: number;
}

export interface RecoveryTemplateDraft {
  key: string;
  projectId: string;
  tipo: RecoveryTemplateType;
  canal: RecoveryChannel;
  assunto: string;
  corpo: string;
  ativo: boolean;
  id?: string;
}

const CHECKOUT_EVENTS = [
  "checkout",
  "checkout_iniciado",
  "checkout_initiated",
  "inicio_checkout",
  "initiate_checkout",
  "purchase_out_of_shopping_cart",
  "checkout_started",
];

const REFUND_STATUS = ["reembolso", "refund", "chargeback", "chargedback", "estornado", "reembolsado"];
const PIX_STATUS = ["pix", "aguardando_pagamento", "waiting_payment", "pending", "pendente"];
const BOLETO_STATUS = ["boleto", "billet", "purchase_billet_printed"];
const APPROVED_STATUS = ["aprovado", "approved", "paid", "compra_aprovada"];

export const RECOVERY_BUCKET_META: Record<RecoveryBucketId, { title: string; shortTitle: string; description: string; templateType: RecoveryTemplateType }> = {
  pix_urgent: {
    title: "PIX urgente",
    shortTitle: "PIX 0–2h",
    description: "Pagamentos gerados há pouco tempo, ainda com alta intenção.",
    templateType: "pix_2h",
  },
  pix_cooling: {
    title: "PIX esfriando",
    shortTitle: "PIX 2–24h",
    description: "Leads que geraram PIX e precisam de follow-up antes de esfriar.",
    templateType: "pix_24h",
  },
  boleto_due: {
    title: "Boleto a vencer",
    shortTitle: "Boleto 48h",
    description: "Boletos recentes ou próximos do vencimento que ainda podem converter.",
    templateType: "boleto",
  },
  abandoned_cart: {
    title: "Carrinho abandonado",
    shortTitle: "Carrinho",
    description: "Checkout iniciado sem compra aprovada nos últimos dias.",
    templateType: "carrinho",
  },
  refunds: {
    title: "Reembolso / Chargeback",
    shortTitle: "Reembolso",
    description: "Casos recentes para análise de causa e prevenção.",
    templateType: "reembolso",
  },
};

export const DEFAULT_RECOVERY_TEMPLATES: Array<Omit<RecoveryTemplateDraft, "projectId" | "id">> = [
  {
    key: "pix_2h:whatsapp",
    tipo: "pix_2h",
    canal: "whatsapp",
    assunto: "",
    ativo: true,
    corpo: "Oi, {nome}. Vi que o PIX do produto {produto} foi gerado e ainda está em aberto. Se fizer sentido, aqui está o link para concluir: {link_pagamento}",
  },
  {
    key: "pix_2h:email",
    tipo: "pix_2h",
    canal: "email",
    assunto: "Seu acesso ao produto {produto} ainda está disponível",
    ativo: true,
    corpo: "Olá, {nome}. Seu pagamento de {valor} para {produto} ainda está pendente. Você pode concluir aqui: {link_pagamento}",
  },
  {
    key: "pix_24h:whatsapp",
    tipo: "pix_24h",
    canal: "whatsapp",
    assunto: "",
    ativo: true,
    corpo: "{nome}, passando para te lembrar que sua condição para {produto} ainda pode ser concluída. Se quiser ativar agora, use este link: {link_pagamento}",
  },
  {
    key: "pix_24h:email",
    tipo: "pix_24h",
    canal: "email",
    assunto: "Ainda dá tempo de concluir {produto}",
    ativo: true,
    corpo: "Olá, {nome}. Sua compra de {produto} segue reservada por mais um período. Para concluir o pagamento de {valor}, use este link: {link_pagamento}",
  },
  {
    key: "boleto:whatsapp",
    tipo: "boleto",
    canal: "whatsapp",
    assunto: "",
    ativo: true,
    corpo: "Oi, {nome}. Seu boleto para {produto} está próximo do vencimento. Se quiser garantir a condição atual, segue o link: {link_pagamento}",
  },
  {
    key: "boleto:email",
    tipo: "boleto",
    canal: "email",
    assunto: "Seu boleto de {produto} está próximo do vencimento",
    ativo: true,
    corpo: "Olá, {nome}. O boleto referente a {produto} está perto do vencimento. Para concluir o pagamento de {valor}, acesse: {link_pagamento}",
  },
  {
    key: "carrinho:whatsapp",
    tipo: "carrinho",
    canal: "whatsapp",
    assunto: "",
    ativo: true,
    corpo: "Oi, {nome}. Vi que você chegou bem perto de concluir {produto}. Se quiser retomar do ponto em que parou, aqui está seu link: {link_pagamento}",
  },
  {
    key: "carrinho:email",
    tipo: "carrinho",
    canal: "email",
    assunto: "Você deixou {produto} no carrinho",
    ativo: true,
    corpo: "Olá, {nome}. Você iniciou o checkout de {produto}, mas não concluiu. Seu link para retomar está aqui: {link_pagamento}",
  },
  {
    key: "reembolso:whatsapp",
    tipo: "reembolso",
    canal: "whatsapp",
    assunto: "",
    ativo: true,
    corpo: "Oi, {nome}. Vi que houve um pedido de reembolso/chargeback em {produto}. Quero entender o que aconteceu e te ajudar da melhor forma.",
  },
  {
    key: "reembolso:email",
    tipo: "reembolso",
    canal: "email",
    assunto: "Quero entender sua experiência com {produto}",
    ativo: true,
    corpo: "Olá, {nome}. Identificamos um reembolso ou chargeback relacionado a {produto}. Se puder, responda este e-mail para nos contar o motivo.",
  },
];

export function buildRecoveryBuckets({
  vendas,
  leads,
  logs,
}: {
  vendas: SaleRow[];
  leads: LeadRow[];
  logs: RecoveryLogRow[];
}): RecoveryBucketSummary[] {
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const approvedLeadIds = new Set(
    vendas.filter((sale) => isApprovedSale(sale)).map((sale) => sale.lead_id).filter(Boolean) as string[],
  );

  const latestLogMap = new Map<string, RecoveryLogRow>();
  logs.forEach((log) => {
    const key = `${log.bucket}|${log.venda_id || log.lead_id || log.id}`;
    const current = latestLogMap.get(key);
    if (!current || new Date(log.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestLogMap.set(key, log);
    }
  });

  const itemsByBucket: Record<RecoveryBucketId, RecoveryItem[]> = {
    pix_urgent: [],
    pix_cooling: [],
    boleto_due: [],
    abandoned_cart: [],
    refunds: [],
  };

  vendas.forEach((sale) => {
    if (!sale.created_at) return;
    const bucket = getSaleBucket(sale);
    if (!bucket) return;

    const lead = sale.lead_id ? leadMap.get(sale.lead_id) || null : null;
    const latestLog = latestLogMap.get(`${bucket}|${sale.id}`) || (sale.lead_id ? latestLogMap.get(`${bucket}|${sale.lead_id}`) : undefined);
    const createdAt = getRelevantDate(sale) || sale.created_at;

    itemsByBucket[bucket].push({
      id: `${bucket}-${sale.id}`,
      bucket,
      templateType: RECOVERY_BUCKET_META[bucket].templateType,
      projectId: sale.project_id,
      leadId: sale.lead_id,
      vendaId: sale.id,
      leadName: lead?.nome || getLeadNameFromSaleData(sale) || "Lead sem nome",
      email: lead?.email || getStringFromJson(sale.data, ["email", "cliente_email"]) || "",
      phone: lead?.phone || getStringFromJson(sale.data, ["phone", "telefone", "whatsapp"]) || "",
      product: sale.produto_nome || getStringFromJson(sale.data, ["produto", "product_name"]) || "Produto não identificado",
      value: Number(sale.valor) || extractNumeric(sale.data, ["valor", "amount", "price", "valor_total"]),
      createdAt,
      ageLabel: getRelativeLabel(createdAt),
      lastContact: latestLog ? `${latestLog.acao} • ${getRelativeLabel(latestLog.created_at)}` : null,
      lastContactAt: latestLog?.created_at || null,
      paymentLink: extractPaymentLink(sale.data) || lead?.data ? extractPaymentLink(lead?.data || null) : null,
      notes: bucket === "refunds" ? getStringFromJson(sale.data, ["refund_reason", "chargeback_reason", "motivo"]) : null,
    });
  });

  leads.forEach((lead) => {
    if (!isAbandonedCartLead(lead) || approvedLeadIds.has(lead.id)) return;
    const eventAt = extractEventDate(lead) || lead.updated_at || lead.criado_em;
    if (!eventAt) return;
    const latestLog = latestLogMap.get(`abandoned_cart|${lead.id}`);

    itemsByBucket.abandoned_cart.push({
      id: `abandoned-${lead.id}`,
      bucket: "abandoned_cart",
      templateType: "carrinho",
      projectId: lead.project_id,
      leadId: lead.id,
      vendaId: null,
      leadName: lead.nome || "Lead sem nome",
      email: lead.email || "",
      phone: lead.phone || "",
      product: extractProductFromLead(lead) || "Produto não identificado",
      value: extractLeadValue(lead),
      createdAt: eventAt,
      ageLabel: getRelativeLabel(eventAt),
      lastContact: latestLog ? `${latestLog.acao} • ${getRelativeLabel(latestLog.created_at)}` : null,
      lastContactAt: latestLog?.created_at || null,
      paymentLink: extractPaymentLink(lead.data) || null,
      notes: null,
    });
  });

  (Object.keys(itemsByBucket) as RecoveryBucketId[]).forEach((bucketId) => {
    itemsByBucket[bucketId].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  return (Object.keys(RECOVERY_BUCKET_META) as RecoveryBucketId[]).map((id) => {
    const bucketLogs = logs.filter((log) => log.bucket === id);
    const attemptsCount = bucketLogs.length;
    const recoveredCount = bucketLogs.filter((log) => normalize(log.status).includes("recuperado")).length;
    const totalValue = itemsByBucket[id].reduce((sum, item) => sum + item.value, 0);
    return {
      id,
      title: RECOVERY_BUCKET_META[id].title,
      shortTitle: RECOVERY_BUCKET_META[id].shortTitle,
      description: RECOVERY_BUCKET_META[id].description,
      templateType: RECOVERY_BUCKET_META[id].templateType,
      items: itemsByBucket[id],
      totalValue,
      recoveryRate: attemptsCount > 0 ? Math.round((recoveredCount / attemptsCount) * 100) : 0,
      recoveredCount,
      attemptsCount,
    };
  });
}

export function mergeRecoveryTemplates(projectId: string, stored: RecoveryTemplateRow[]): RecoveryTemplateDraft[] {
  return DEFAULT_RECOVERY_TEMPLATES.map((defaultTemplate) => {
    const existing = stored.find((item) => item.project_id === projectId && item.tipo === defaultTemplate.tipo && item.canal === defaultTemplate.canal);
    return {
      key: defaultTemplate.key,
      projectId,
      tipo: defaultTemplate.tipo,
      canal: defaultTemplate.canal,
      assunto: existing?.assunto ?? defaultTemplate.assunto,
      corpo: existing?.corpo ?? defaultTemplate.corpo,
      ativo: existing?.ativo ?? defaultTemplate.ativo,
      id: existing?.id,
    };
  });
}

export function getTemplateForBucket(
  templates: RecoveryTemplateDraft[],
  projectId: string | null,
  bucket: RecoveryBucketId,
  channel: RecoveryChannel,
): RecoveryTemplateDraft | null {
  if (!projectId) return null;
  const tipo = RECOVERY_BUCKET_META[bucket].templateType;
  return templates.find((template) => template.projectId === projectId && template.tipo === tipo && template.canal === channel) || null;
}

export function interpolateRecoveryTemplate(template: string, item: RecoveryItem) {
  return template
    .split("{nome}").join(item.leadName || "cliente")
    .split("{produto}").join(item.product || "produto")
    .split("{valor}").join(item.value > 0 ? formatCurrency(item.value) : "valor pendente")
    .split("{link_pagamento}").join(item.paymentLink || "link indisponível");
}

export function getAutomationBlueprint(bucket: RecoveryBucketId, message: string) {
  const triggerMap: Record<RecoveryBucketId, string> = {
    pix_urgent: "aguardando_pagamento",
    pix_cooling: "aguardando_pagamento",
    boleto_due: "aguardando_pagamento",
    abandoned_cart: "carrinho_abandonado",
    refunds: "reembolso",
  };

  const retryMap: Record<RecoveryBucketId, { initialDelay: number; retryDelay: number; channel: RecoveryChannel }> = {
    pix_urgent: { initialDelay: 15, retryDelay: 120, channel: "whatsapp" },
    pix_cooling: { initialDelay: 30, retryDelay: 240, channel: "whatsapp" },
    boleto_due: { initialDelay: 60, retryDelay: 720, channel: "email" },
    abandoned_cart: { initialDelay: 20, retryDelay: 180, channel: "whatsapp" },
    refunds: { initialDelay: 60, retryDelay: 0, channel: "email" },
  };

  const meta = retryMap[bucket];
  const acoes = [
    { tipo: meta.channel, template: convertToOpenFlowTemplate(message), delay_min: meta.initialDelay },
  ] as Array<Record<string, unknown>>;

  if (meta.retryDelay > 0) {
    acoes.push({ tipo: "aguardar", template: "", delay_min: meta.retryDelay });
    acoes.push({ tipo: meta.channel, template: convertToOpenFlowTemplate(message), delay_min: 0 });
  }

  return { triggerTipo: triggerMap[bucket], acoes };
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getSaleBucket(sale: SaleRow): RecoveryBucketId | null {
  const status = normalize(sale.status);
  const dataText = normalizeJson(sale.data);
  const createdAt = getRelevantDate(sale);
  if (!createdAt) return null;
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);

  if (matches(status, dataText, REFUND_STATUS) && ageHours <= 24 * 30) return "refunds";
  if (isApprovedSale(sale)) return null;

  const isBoleto = matches(status, dataText, BOLETO_STATUS);
  const isPix = !isBoleto && matches(status, dataText, PIX_STATUS);

  if (isPix && ageHours <= 2) return "pix_urgent";
  if (isPix && ageHours <= 24) return "pix_cooling";

  const dueDate = extractDueDate(sale.data);
  const dueDiff = dueDate ? (new Date(dueDate).getTime() - Date.now()) / 3600000 : null;
  if (isBoleto && ((dueDiff !== null && dueDiff <= 48 && dueDiff >= -12) || ageHours <= 48)) return "boleto_due";

  return null;
}

function isApprovedSale(sale: SaleRow) {
  return matches(normalize(sale.status), normalizeJson(sale.data), APPROVED_STATUS);
}

function isAbandonedCartLead(lead: LeadRow) {
  const data = (lead.data || {}) as Record<string, unknown>;
  const event = normalize(String(data.ultimo_evento || ""));
  if (!CHECKOUT_EVENTS.some((item) => event.includes(item))) return false;
  const eventAt = extractEventDate(lead) || lead.updated_at || lead.criado_em;
  if (!eventAt) return false;
  const ageDays = (Date.now() - new Date(eventAt).getTime()) / 86400000;
  return ageDays <= 7;
}

function extractEventDate(lead: LeadRow) {
  return getStringFromJson(lead.data, ["ultimo_evento_em", "checkout_iniciado_em", "updated_at"]) || null;
}

function extractProductFromLead(lead: LeadRow) {
  const data = (lead.data || {}) as Record<string, unknown>;
  return getStringFromJson(data, ["produto", "produto_nome", "product_name", "oferta"]);
}

function extractLeadValue(lead: LeadRow) {
  return extractNumeric(lead.data, ["valor", "amount", "checkout_valor", "ticket", "preco"]);
}

function getLeadNameFromSaleData(sale: SaleRow) {
  return getStringFromJson(sale.data, ["nome", "name", "cliente_nome"]);
}

function extractPaymentLink(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const direct = getStringFromJson(record, [
    "link_pagamento",
    "payment_link",
    "checkout_url",
    "checkout_link",
    "pix_link",
    "boleto_link",
    "url",
  ]);
  if (direct) return direct;

  const nestedCandidates = ["links", "pagamento", "payment", "checkout"];
  for (const key of nestedCandidates) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const nestedLink = extractPaymentLink(nested);
      if (nestedLink) return nestedLink;
    }
  }

  return null;
}

function extractDueDate(data: unknown) {
  if (!data || typeof data !== "object") return null;
  return getStringFromJson(data as Record<string, unknown>, ["vencimento", "due_date", "expire_at", "expiration_date", "boleto_vencimento"]);
}

function extractNumeric(data: unknown, keys: string[]) {
  if (!data || typeof data !== "object") return 0;
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const normalizedValue = Number(value.replace(/[^0-9,.-]/g, "").replace(",", "."));
      if (!Number.isNaN(normalizedValue)) return normalizedValue;
    }
  }
  return 0;
}

function getStringFromJson(data: unknown, keys: string[]) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function getRelevantDate(sale: SaleRow) {
  return sale.created_at || sale.data_venda || null;
}

function getRelativeLabel(date: string) {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: ptBR });
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase();
}

function normalizeJson(data: unknown) {
  return JSON.stringify(data || {}).toLowerCase();
}

function matches(status: string, dataText: string, needles: string[]) {
  const haystack = `${status} ${dataText}`;
  return needles.some((needle) => haystack.includes(needle));
}

function convertToOpenFlowTemplate(message: string) {
  return message
    .split("{nome}").join("{{nome}}")
    .split("{produto}").join("{{produto}}")
    .split("{valor}").join("{{valor}}")
    .split("{link_pagamento}").join("{{link}}");
}
