import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

export type RecoveryChannel = "whatsapp" | "email";
export type RecoveryBucketId = "pix_urgent" | "pix_cooling" | "boleto_due" | "abandoned_cart" | "refunds";
export type RecoveryTemplateType = "pix_2h" | "pix_24h" | "boleto" | "carrinho" | "reembolso";

type SaleRow = Pick<Database["public"]["Tables"]["imphq_vendas"]["Row"], "id" | "project_id" | "lead_id" | "produto_nome" | "status" | "valor" | "created_at" | "data_venda" | "data">;
type LeadRow = Pick<Database["public"]["Tables"]["imphq_leads"]["Row"], "id" | "project_id" | "nome" | "email" | "phone" | "status" | "criado_em" | "updated_at" | "data">;
type RecoveryLogRow = Pick<Database["public"]["Tables"]["imphq_recovery_logs"]["Row"], "id" | "project_id" | "lead_id" | "venda_id" | "bucket" | "status" | "valor" | "created_at"> & Partial<Pick<Database["public"]["Tables"]["imphq_recovery_logs"]["Row"], "acao">>;
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
  pixCode?: string | null;
  touchLevel?: 1 | 2 | 3;
  touchLabel?: string;
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
const APPROVED_STATUS = ["aprovado", "approved", "paid", "pago", "compra_aprovada", "pagamento_confirmado", "completed"];
const ABANDONED_STATUS = ["carrinho_abandonado", "inicio_checkout", "abandoned_cart", "started", "expirado", "expired", "recusado", "refused"];

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
    corpo: "Oi, {nome}! Vi que seu pedido de *{produto}* foi gerado e o Pix está reservado. Caso precise, aqui está o código Pix Copia e Cola para facilitar:\n\n{pix_code}\n\nOu conclua direto no link: {link_pagamento}\n\nFicou alguma dúvida ou teve algum problema na finalização? Me avisa aqui que te ajudo!",
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
    corpo: "Oi, {nome}! Passando para avisar que a sua vaga/reserva de *{produto}* ainda está segura com as condições especiais. Muitas alunas perguntam se têm acesso imediato: sim, pagando no Pix a liberação é na hora!\n\nLink para concluir: {link_pagamento}\n\nTeve alguma dúvida sobre o conteúdo ou o pagamento?",
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
    corpo: "Oi, {nome}! Seu boleto para *{produto}* está próximo do vencimento. Se preferir pagar no Pix para liberar o seu acesso na hora sem esperar compensação bancária, me avisa aqui! Ou use o link: {link_pagamento}",
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
    corpo: "Oi, {nome}! Vi que você chegou bem perto de garantir *{produto}*, mas o pedido não foi concluído. Ficou alguma dúvida sobre o conteúdo ou as formas de pagamento?\n\nSe quiser retomar de onde parou: {link_pagamento}",
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
    corpo: "Oi, {nome}. Vi que houve um pedido de reembolso/chargeback em *{produto}*. Quero entender o que aconteceu e te ajudar da melhor forma.",
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

  // TRAVA ANTI-DUPLICAÇÃO:
  // Coletar todos os IDs de lead, emails e telefones que já possuem QUALQUER venda aprovada/paga
  const approvedLeadIds = new Set<string>();
  const approvedEmails = new Set<string>();
  const approvedPhones = new Set<string>();

  vendas.forEach((sale) => {
    if (isApprovedSale(sale)) {
      if (sale.lead_id) approvedLeadIds.add(sale.lead_id);
      const email = (getStringFromJson(sale.data, ["email", "cliente_email", "buyer_email"]) || "").toLowerCase().trim();
      const phone = normalizePhone(getStringFromJson(sale.data, ["phone", "telefone", "whatsapp", "buyer_phone"]) || "");
      if (email) approvedEmails.add(email);
      if (phone.length >= 10) approvedPhones.add(phone);
    }
  });

  leads.forEach((lead) => {
    const st = normalize(lead.status);
    if (st.includes("cliente") || st.includes("aprovado") || st.includes("paid")) {
      approvedLeadIds.add(lead.id);
      if (lead.email) approvedEmails.add(lead.email.toLowerCase().trim());
      const p = normalizePhone(lead.phone || "");
      if (p.length >= 10) approvedPhones.add(p);
    }
  });

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
    if (isApprovedSale(sale)) return;

    const lead = sale.lead_id ? leadMap.get(sale.lead_id) || null : null;
    const saleEmail = (lead?.email || getStringFromJson(sale.data, ["email", "cliente_email", "buyer_email"]) || "").toLowerCase().trim();
    const rawSalePhone = lead?.phone || getStringFromJson(sale.data, ["phone", "telefone", "whatsapp", "buyer_phone"]) || "";
    const salePhone = normalizePhone(rawSalePhone);

    // Trava Anti-Duplicação: se o lead já possui compra aprovada em qualquer canal, sai do radar na hora!
    if (
      (sale.lead_id && approvedLeadIds.has(sale.lead_id)) ||
      (saleEmail && approvedEmails.has(saleEmail)) ||
      (salePhone.length >= 10 && approvedPhones.has(salePhone))
    ) {
      return;
    }

    const bucket = getSaleBucket(sale);
    if (!bucket) return;

    const latestLog = latestLogMap.get(`${bucket}|${sale.id}`) || (sale.lead_id ? latestLogMap.get(`${bucket}|${sale.lead_id}`) : undefined);
    const createdAt = getRelevantDate(sale) || sale.created_at;
    const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
    const { touchLevel, touchLabel } = computeTouch(ageHours);
    const pixCode = extractPixCode(sale.data) || (lead?.data ? extractPixCode(lead.data) : null);
    const paymentLink = extractPaymentLink(sale.data) || (lead?.data ? extractPaymentLink(lead.data) : null);

    itemsByBucket[bucket].push({
      id: `${bucket}-${sale.id}`,
      bucket,
      templateType: RECOVERY_BUCKET_META[bucket].templateType,
      projectId: sale.project_id,
      leadId: sale.lead_id,
      vendaId: sale.id,
      leadName: lead?.nome || getLeadNameFromSaleData(sale) || "Lead sem nome",
      email: saleEmail,
      phone: rawSalePhone,
      product: sale.produto_nome || getStringFromJson(sale.data, ["produto", "product_name"]) || "Produto não identificado",
      value: Number(sale.valor) || extractNumeric(sale.data, ["valor", "amount", "price", "valor_total"]),
      createdAt,
      ageLabel: getRelativeLabel(createdAt),
      lastContact: latestLog ? `${latestLog.acao} • ${getRelativeLabel(latestLog.created_at)}` : null,
      lastContactAt: latestLog?.created_at || null,
      paymentLink,
      pixCode,
      touchLevel,
      touchLabel,
      notes: bucket === "refunds" ? getStringFromJson(sale.data, ["refund_reason", "chargeback_reason", "motivo"]) : null,
    });
  });

  leads.forEach((lead) => {
    if (!isAbandonedCartLead(lead)) return;
    const leadEmail = (lead.email || "").toLowerCase().trim();
    const leadPhone = normalizePhone(lead.phone || "");

    // Trava Anti-Duplicação: se o lead já possui compra aprovada, ignora
    if (
      approvedLeadIds.has(lead.id) ||
      (leadEmail && approvedEmails.has(leadEmail)) ||
      (leadPhone.length >= 10 && approvedPhones.has(leadPhone))
    ) {
      return;
    }

    const eventAt = extractEventDate(lead) || lead.updated_at || lead.criado_em;
    if (!eventAt) return;
    const ageHours = Math.max(0, (Date.now() - new Date(eventAt).getTime()) / 3600000);
    const { touchLevel, touchLabel } = computeTouch(ageHours);
    const latestLog = latestLogMap.get(`abandoned_cart|${lead.id}`);
    const pixCode = extractPixCode(lead.data);
    const paymentLink = extractPaymentLink(lead.data);

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
      paymentLink,
      pixCode,
      touchLevel,
      touchLabel,
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

export function computeTouch(ageHours: number): { touchLevel: 1 | 2 | 3; touchLabel: string } {
  if (ageHours < 2) {
    return { touchLevel: 1, touchLabel: "Toque 1 (15m - Pix & Suporte)" };
  }
  if (ageHours < 24) {
    return { touchLevel: 2, touchLabel: "Toque 2 (2h - Reserva & Vaga)" };
  }
  return { touchLevel: 3, touchLabel: "Toque 3 (Urgente - Cancelamento)" };
}

export function getTouchCadenceMessage(item: RecoveryItem, baseCorpo: string): string {
  if (item.bucket === "pix_urgent" || item.bucket === "pix_cooling") {
    if (item.touchLevel === 3) {
      return `Oi, {nome}! Último aviso sobre o seu pedido de *{produto}*. O sistema vai cancelar o seu Pix/reserva em poucas horas e liberar a vaga.\n\nSe você ainda quer garantir o seu acesso com essa condição, conclua antes que expire:\n{link_pagamento}\n\nPosso segurar para você?`;
    }
    if (item.touchLevel === 2) {
      return `Oi, {nome}! Passando para avisar que a sua vaga/reserva de *{produto}* ainda está segura com as condições especiais. Muitas alunas perguntam se têm acesso imediato: sim, pagando no Pix a liberação é na hora!\n\nLink para concluir: {link_pagamento}\n\nTeve alguma dúvida sobre o conteúdo ou o pagamento?`;
    }
    if (item.touchLevel === 1) {
      return `Oi, {nome}! Vi que seu pedido de *{produto}* foi gerado e o Pix está reservado. Caso precise, aqui está o código Pix Copia e Cola para facilitar:\n\n{pix_code}\n\nOu link direto: {link_pagamento}\n\nFicou alguma dúvida ou teve algum problema na finalização? Me avisa aqui que te ajudo!`;
    }
  }
  return baseCorpo;
}

export function interpolateRecoveryTemplate(template: string, item: RecoveryItem) {
  const pixCode = item.pixCode || "";
  const paymentLink = item.paymentLink || "";

  let pixReplacement = pixCode;
  if (!pixReplacement) {
    pixReplacement = paymentLink ? `Link: ${paymentLink}` : "Código disponível no checkout";
  }

  let linkReplacement = paymentLink;
  if (!linkReplacement) {
    linkReplacement = pixCode ? "Pix Copia e Cola informado acima" : "link no seu e-mail";
  }

  return template
    .split("{nome}").join(item.leadName || "cliente")
    .split("{produto}").join(item.product || "produto")
    .split("{valor}").join(item.value > 0 ? formatCurrency(item.value) : "valor pendente")
    .split("{pix_code}").join(pixReplacement)
    .split("{link_pagamento}").join(linkReplacement);
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

  // Abandoned cart from imphq_vendas (started/abandoned/expired/refused within 7 days)
  if (matches(status, dataText, ABANDONED_STATUS) && ageHours <= 24 * 7) return "abandoned_cart";

  return null;
}

function isApprovedSale(sale: SaleRow) {
  const st = normalize(sale.status);
  if (APPROVED_STATUS.some((s) => st === s || st === `order_${s}`)) return true;

  // Se o status for pendente/aguardando/cancelado, nunca considerar aprovado
  if (["aguardando_pagamento", "pix_gerado", "boleto_gerado", "pendente", "pending", "recusado", "refused", "cancelado", "canceled", "expirado"].includes(st)) {
    return false;
  }

  const data = (sale.data || {}) as Record<string, unknown>;
  const orderStatus = normalize(data.order_status || data.status_pedido || data.status || "");
  if (APPROVED_STATUS.some((s) => orderStatus === s)) return true;

  return false;
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

export function extractPixCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const direct = getStringFromJson(record, [
    "pix_code",
    "pix_copia_cola",
    "pix_copiacola",
    "codigo_pix",
    "pix_payload",
    "pix_qr_code",
    "pix_qrcode",
    "qrcode_text",
    "qrcode",
    "pixText",
    "pix_string",
    "emv",
    "copia_cola",
    "copiaECola",
  ]);
  if (direct && direct.length >= 15) return direct;

  const nestedCandidates = ["pix", "payment", "pagamento", "checkout", "billing", "dados_pagamento", "qr_code", "bank_slip"];
  for (const key of nestedCandidates) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const nestedCode = extractPixCode(nested);
      if (nestedCode) return nestedCode;
    }
  }

  return null;
}

export function extractPaymentLink(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const direct = getStringFromJson(record, [
    "link_pagamento",
    "payment_link",
    "checkout_url",
    "checkout_link",
    "pix_link",
    "pix_url",
    "boleto_link",
    "boleto_url",
    "url",
    "url_checkout",
    "link",
    "invoice_url",
    "ticket_url",
  ]);
  if (direct && (direct.startsWith("http://") || direct.startsWith("https://"))) return direct;

  const nestedCandidates = ["links", "pagamento", "payment", "checkout", "billet", "boleto", "pix"];
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

export function normalizePhone(p: string): string {
  let s = (p || "").replace(/\D/g, "");
  if (s.length === 10 || s.length === 11) s = "55" + s;
  return s;
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
