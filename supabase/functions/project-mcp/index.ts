// Edge Function: project-mcp
// Servidor MCP (Model Context Protocol) e API REST para consulta, prontidão e desenho de fluxos
// Suporta Claude Desktop, Cursor, Agentes autônomos e scripts externos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { buildProjectMap, readStageContract, readStepStatus } from "../_shared/project-map.ts";
import { dueState, localDate, writeAgentNotes, type TeamMember } from "../_shared/map-steps.ts";
import { checkMcpKey } from "../_shared/mcp-auth.ts";
import { CAPABILITY_TASKS, capabilitiesForSkill, pickCapabilities, pickStepCapabilities, type Capability } from "../_shared/capabilities.ts";
import { orderSteps } from "../_shared/map-order.ts";
import { FAMILY_LABEL, planPlaybook } from "../_shared/playbooks.ts";
import { findProjectMap, playbookFromRows, writePlaybookPlan, type PlaybookRow, type PlaybookStepRow } from "../_shared/playbook-apply.ts";
import { buildApprovalQueue, SOURCE_LABEL, type AiActionRow, type ApprovalItem, type ApprovalSource, type ContentRow, type DraftRow, type ReviewStepRow } from "../_shared/approval-queue.ts";
import { approvalCounts, approvalLine, buildProjectBriefing, mcpDecisions, type JournalEntry, type PaymentPulse } from "../_shared/project-briefing.ts";
import { knowledgeGapRows, pixRowsFromSales, splitAdsActions, type KnowledgeRow, type PendingSaleRow, type RawAction } from "../_shared/approval-rows.ts";
import { decideApproval as applyDecision, DECISIONS_BY_SOURCE, type ApprovalDecision, type ApprovalStore } from "../_shared/approval-decide.ts";
import { AUTONOMY_LABEL, AUTONOMY_RULES, checkAutonomy, effectiveAutonomy } from "../_shared/autonomy.ts";
import { cutAllowed, evaluateTestOrder, launchSteps, planTestOrder, type TestOrderInput, type VariantReading } from "../_shared/test-order.ts";
import { buildTodayBoard, type BoardNode, type BoardSale } from "../_shared/today-board.ts";
import { evaluateScale, hypothesisBoard } from "../_shared/scale-ladder.ts";
import { ACCESS_BY_KEY, ACCESS_STATUS_LABEL, CHANNELS, accessChecklist, channelsFromPlaybooks, parseChannels, type DeclaredAccess } from "../_shared/launch-kit.ts";
import { launchPreview, planLaunch, writeLaunch } from "../_shared/launch-plan.ts";
import { adsSyncHealth, liveDelta, type AdsSyncHealthRow, type LivePanel } from "../_shared/live-panel.ts";
import { brtDay, loadProjectLivePanel, type LiveDb } from "../_shared/live-panel-load.ts";
import { liveReadings, type LiveOrder, type LiveVariant, type SaleRow, type SpendRow } from "../_shared/test-live.ts";
import { methodScoreboard, normalizeMetodo, type ScoreBy, type ScoreInput } from "../_shared/method-scoreboard.ts";
import { normalizeVariants, pageKey, slugify, splitReport, type PageMetricValues } from "../_shared/page-split.ts";
import { buildFunnelLive, type AdsRow as FunnelAdsRow, type PageRow as FunnelPageRow, type SaleRow as FunnelSaleRow } from "../_shared/funnel-live.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-id, x-mcp-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Tipo do cliente como ele é criado aqui (o genérico padrão de createClient não aceita o cliente real).
const makeAdminClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
type Supabase = ReturnType<typeof makeAdminClient>;

/** Catálogo ativo (imphq_capabilities). Falha de leitura vira lista vazia: sugestão de ferramenta nunca derruba a etapa. */
async function loadCapabilities(supabase: Supabase): Promise<Capability[]> {
  const { data, error } = await supabase.from("imphq_capabilities").select("*").eq("ativo", true);
  if (error) console.error("imphq_capabilities", error.message);
  return (data || []) as Capability[];
}

/** Time ativo: quem pode ser responsável por etapa. Falha de leitura vira lista vazia. */
async function loadTeam(supabase: Supabase): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("imphq_team_members").select("id, name, email, user_id").or("is_active.eq.true,is_active.is.null");
  if (error) console.error("imphq_team_members", error.message);
  return (data || []) as TeamMember[];
}

/** Acha o membro por id, e-mail ou primeiro nome (sem acento, sem caixa). */
function findMember(team: TeamMember[], who: string): TeamMember | null {
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const w = norm(who);
  return team.find((m) => m.id === who || norm(m.email || "") === w || norm(m.name) === w || norm(m.name).split(/\s+/)[0] === w) ?? null;
}

/** Responsável e prazo da etapa no formato das respostas do MCP. */
function ownerFields(n: { owner_member_id?: string | null; due_date?: string | null }, team: TeamMember[], status: string) {
  const owner = n.owner_member_id ? team.find((m) => m.id === n.owner_member_id) : null;
  return {
    responsavel: owner ? { id: owner.id, nome: owner.name } : null,
    prazo: n.due_date ?? null,
    situacao_prazo: dueState(n.due_date, localDate(), status as "pending" | "in_progress" | "ready_review" | "done"),
  };
}

/** Ferramentas sugeridas para uma etapa: as ligadas à skill dela primeiro, depois as do tipo no mapa. */
function toolsForStep(caps: Capability[], kind: string | null, skill: string | null) {
  return pickStepCapabilities(caps, kind, skill, 4).map((c) => ({ id: c.id, nome: c.nome, url: c.url, quando_usar: c.quando_usar }));
}

function parseJson(val: unknown) {
  if (val && typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

const KIND_COLORS: Record<string, string> = {
  anuncio: "#eab308",
  captura: "#06b6d4",
  pagina_vendas: "#f97316",
  vsl: "#ec4899",
  checkout: "#84cc16",
  orderbump: "#fbbf24",
  upsell: "#22c55e",
  downsell: "#f43f5e",
  whatsapp: "#25d366",
  email: "#818cf8",
  area_membros: "#a855f7",
  app: "#0ea5e9",
  vertical: "#c9922a",
  area: "#3b82f6",
  processo: "#8b5cf6",
  meta: "#ef4444",
  doc: "#64748b",
  canal: "#f59e0b",
  instagram: "#e1306c",
  facebook: "#1877f2",
  youtube: "#ff0000",
  tiktok: "#000000",
};

function getColumnForKind(kind: string, customCol?: number): number {
  if (customCol != null && customCol >= 0) return customCol;
  switch (kind) {
    case "anuncio":
    case "canal":
    case "instagram":
    case "facebook":
    case "youtube":
    case "tiktok":
      return 0; // Tráfego
    case "captura":
    case "vsl":
    case "pagina_vendas":
    case "doc":
      return 1; // Página / VSL
    case "checkout":
    case "orderbump":
      return 2; // Checkout & Bump
    case "upsell":
    case "downsell":
    case "area_membros":
    case "app":
      return 3; // Pós-Venda
    case "whatsapp":
    case "email":
    case "processo":
    case "meta":
      return 4; // Recuperação / X1
    default:
      return 1;
  }
}

interface DraftNode {
  key: string;
  kind: string;
  label: string;
  description?: string;
  product_name?: string;
  url?: string;
  checklist?: string[];
  col?: number;
  row?: number;
  executor?: string;
  skill?: string;
  prompt?: string;
}

interface DraftEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

function buildStrategyPreset(
  preset: string,
  projectName: string,
  primaryProduct?: string
): { nodes: DraftNode[]; edges: DraftEdge[] } {
  const prod = primaryProduct || "Produto Principal";

  if (preset === "lancamento_whatsapp") {
    return {
      nodes: [
        {
          key: "ad_convite",
          kind: "anuncio",
          label: "Meta Ads · Convite Grupo VIP",
          description: "Criativos de atração com foco no evento / condição secreta",
          checklist: ["Roteiro de convite aprovado", "Gravar 3 variações de gancho", "Subir campanha de tráfego"],
          col: 0,
          row: 0,
          executor: "ai_higgsfield",
          skill: "skill-black-belt",
          prompt: `Gerar 3 criativos em vídeo 9:16 chamando para o grupo VIP do produto ${prod}. Gancho de curiosidade, condição secreta e revelação exclusiva.`,
        },
        {
          key: "optin_page",
          kind: "captura",
          label: "Página de Captura / Inscrição",
          description: "Redirecionamento automático com link do WhatsApp",
          checklist: ["Headline de curiosidade", "Botão de redirecionamento para o Grupo VIP", "Pixel de Lead ativo"],
          col: 1,
          row: 0,
          executor: "ai_copywriter",
          skill: "rebel-copy",
          prompt: `Escrever headline de alta conversão para página de captura com redirecionamento direto para o Grupo VIP do WhatsApp para ${prod}.`,
        },
        {
          key: "wa_vip",
          kind: "whatsapp",
          label: "Grupos VIP WhatsApp (D-7 a D0)",
          description: "Régua cronometrada de aquecimento e antecipação",
          checklist: ["Criar grupos 01 a 05", "Agendar mensagens de D-7 a D-1", "Áudios de bastidores do expert"],
          col: 2,
          row: 0,
          executor: "openflow",
          skill: "roteiros-virais-comment-to-dm",
          prompt: `Montar cronograma de aquecimento D-7 a D0 nos Grupos VIP com áudios de bastidores, avisos de horário e antecipação da oferta.`,
        },
        {
          key: "live_pitch",
          kind: "youtube",
          label: "Live de Abertura / Pitch",
          description: "Apresentação da oportunidade, ancoragem e abertura",
          checklist: ["Slides de apresentação finalizados", "Stack de bônus exclusivos", "Link da transmissão privado"],
          col: 3,
          row: 0,
          executor: "ai_copywriter",
          skill: "mecanismo-vsl",
          prompt: `Estruturar roteiro de pitch ao vivo (Slide a Slide) com ancoragem, mecanismo único do produto e stack de bônus exclusivos.`,
        },
        {
          key: "checkout_abertura",
          kind: "checkout",
          label: `Abertura de Carrinho · ${prod}`,
          product_name: prod,
          description: "Link exclusivo liberado nos grupos com tempo limitado",
          checklist: ["Liberar link com cupom ou desconto exclusivo", "Timer de encerramento em 24h/48h", "Testar compra teste"],
          col: 4,
          row: 0,
          executor: "human_traffic",
          skill: "briefing-gestor-trafego",
          prompt: `Configurar checkout com cupom especial de abertura, timer regressivo e disparo de evento de compra no pixel.`,
        },
        {
          key: "wa_suporte",
          kind: "whatsapp",
          label: "Plantão X1 · Dúvidas e Pix",
          description: "Recuperação no 1 a 1 para quem gerou Pix ou travou",
          checklist: ["IA ou operadores no WhatsApp", "Scripts para quebra de objeções de cartão/limite"],
          col: 4,
          row: 1,
          executor: "openflow",
          skill: "roteiros-virais-comment-to-dm",
          prompt: `Plantão 1 a 1 de recuperação de Pix gerado e quebra de objeções de limite de cartão no WhatsApp.`,
        },
      ],
      edges: [
        { from: "ad_convite", to: "optin_page", label: "Clique no Anúncio" },
        { from: "optin_page", to: "wa_vip", label: "Entrou no Grupo VIP" },
        { from: "wa_vip", to: "live_pitch", label: "Link da Live (D0)" },
        { from: "live_pitch", to: "checkout_abertura", label: "Abertura de Carrinho" },
        { from: "checkout_abertura", to: "wa_suporte", label: "Dúvida / Pix Gerado", style: "dashed" },
      ],
    };
  }

  if (preset === "high_ticket_x1") {
    return {
      nodes: [
        {
          key: "ad_direct",
          kind: "anuncio",
          label: "Meta / Reels · Direto para WhatsApp",
          description: "Anúncio focado em filtro de qualificação do cliente ideal",
          checklist: ["Criativo de filtro de faturamento/perfil", "Link wa.me com mensagem inicial pronta"],
          col: 0,
          row: 0,
          executor: "ai_higgsfield",
          skill: "skill-black-belt",
          prompt: `Criativo direto de filtro e qualificação para mentoria/consultoria de ${prod}. Foco em empresários/profissionais prontos para avançar.`,
        },
        {
          key: "wa_sdr",
          kind: "whatsapp",
          label: "WhatsApp SDR IA · Triagem & SPIN",
          description: "Qualificação consultiva automática antes da proposta",
          checklist: ["Configurar IA consultiva no OpenFlow", "Definir perguntas de qualificação", "Simular 3 testes"],
          col: 1,
          row: 0,
          executor: "openflow",
          skill: "roteiros-virais-comment-to-dm",
          prompt: `Configurar fluxo de qualificação SPIN Selling com IA no OpenFlow: faturamento, gargalo atual, urgência e triagem de score > 70.`,
        },
        {
          key: "proposta",
          kind: "processo",
          label: "Apresentação de Proposta / Closer",
          description: "Sessão de diagnóstico ou chamada de fechamento",
          checklist: ["Script de ancoragem de valor", "Superação de objeções de garantia"],
          col: 2,
          row: 0,
          executor: "ai_copywriter",
          skill: "rebel-copy",
          prompt: `Deck e roteiro de apresentação de proposta irresistível com garantia de resultado e ancoragem de investimento.`,
        },
        {
          key: "checkout_vip",
          kind: "checkout",
          label: `Link de Pagamento VIP · ${prod}`,
          product_name: prod,
          description: "Condição exclusiva de adesão imediata",
          checklist: ["Gerar link de pagamento único", "Termo de compromisso / onboarding"],
          col: 3,
          row: 0,
          executor: "human_traffic",
          skill: "briefing-gestor-trafego",
          prompt: `Gerar link de pagamento exclusivo com condição negociada no X1 e ativação imediata.`,
        },
        {
          key: "onboarding",
          kind: "area_membros",
          label: "Onboarding VIP & Kick-off",
          description: "Acolhimento imediato e primeira entrega de valor",
          checklist: ["Formulário de diagnóstico inicial", "Agendamento da sessão individual"],
          col: 4,
          row: 0,
          executor: "openflow",
          skill: "openflow",
          prompt: `Disparo imediato de formulário de diagnóstico e boas-vindas do expert após confirmação de pagamento.`,
        },
      ],
      edges: [
        { from: "ad_direct", to: "wa_sdr", label: "Iniciou conversa" },
        { from: "wa_sdr", to: "proposta", label: "Qualificado (Score > 70)" },
        { from: "proposta", to: "checkout_vip", label: "Proposta Aceita" },
        { from: "checkout_vip", to: "onboarding", label: "Pagamento Confirmado" },
      ],
    };
  }

  if (preset === "tripwire_ascensao") {
    return {
      nodes: [
        {
          key: "ad_tripwire",
          kind: "anuncio",
          label: "Meta Ads · Isca / Oferta Irresistível",
          description: "Produto de entrada de R$ 19 a R$ 47 com baixo atrito",
          checklist: ["Criativo focado em solução rápida de dor", "Subir tráfego para conversão de compra"],
          col: 0,
          row: 0,
          executor: "ai_higgsfield",
          skill: "skill-black-belt",
          prompt: `Criativo de alta atração para produto de entrada de R$ 27 focado na solução rápida de uma dor aguda de ${prod}.`,
        },
        {
          key: "checkout_front",
          kind: "checkout",
          label: `Checkout Front-End (R$ 27) · ${prod}`,
          product_name: prod,
          checklist: ["Página de checkout limpa com depoimentos", "Garantia incondicional de 7 dias"],
          col: 1,
          row: 0,
          executor: "human_traffic",
          skill: "briefing-gestor-trafego",
          prompt: `Página de checkout de conversão com selos de segurança, garantia de 7 dias e depoimentos em carrossel.`,
        },
        {
          key: "bump_acelerador",
          kind: "orderbump",
          label: "Orderbump · Acelerador / Template",
          description: "Oferta complementar de R$ 17 para elevar o ticket médio",
          checklist: ["Copy do bump", "Preço complementar R$ 17 - R$ 27"],
          col: 1,
          row: 1,
          executor: "ai_copywriter",
          skill: "tripwire-matador-v2",
          prompt: `Copy do Orderbump de R$ 17 a R$ 27: Acelerador ou template que complementa o produto de entrada.`,
        },
        {
          key: "upsell_core",
          kind: "upsell",
          label: "1-Click Upsell · Treinamento Completo",
          description: "Oferta principal (Core Offer R$ 197 - R$ 497)",
          checklist: ["Vídeo de 90s do upsell", "Configurar 1-click automático na plataforma"],
          col: 2,
          row: 0,
          executor: "ai_copywriter",
          skill: "rebel-copy",
          prompt: `Vídeo de 90 segundos de 1-Click Upsell apresentando o treinamento completo ou protocolo mestre de R$ 297.`,
        },
        {
          key: "downsell_core",
          kind: "downsell",
          label: "Downsell · Versão Essencial",
          description: "Parcelamento estendido ou versão sem bônus",
          checklist: ["Página alternativa de downsell"],
          col: 2,
          row: 1,
          executor: "ai_copywriter",
          skill: "rebel-copy",
          prompt: `Copy de downsell facilitado com parcelamento estendido ou versão essencial para recuperar a recusa do upsell.`,
        },
        {
          key: "comunidade",
          kind: "area_membros",
          label: "Área de Membros & Boas-Vindas",
          description: "Entrega imediata dos acessos e nivelamento",
          checklist: ["Envio de acesso por e-mail e WhatsApp", "Vídeo de boas-vindas liberado"],
          col: 3,
          row: 0,
          executor: "openflow",
          skill: "openflow",
          prompt: `Régua de entrega de acessos no WhatsApp e boas-vindas na área de membros.`,
        },
      ],
      edges: [
        { from: "ad_tripwire", to: "checkout_front", label: "Clique" },
        { from: "checkout_front", to: "bump_acelerador", label: "Adicionou Bump" },
        { from: "checkout_front", to: "upsell_core", label: "Compra Aprovada" },
        { from: "upsell_core", to: "downsell_core", label: "Recusou Upsell", style: "dashed" },
        { from: "upsell_core", to: "comunidade", label: "Aceitou Upsell" },
        { from: "downsell_core", to: "comunidade", label: "Concluiu Compra" },
      ],
    };
  }

  // Padrão: VSL Perpétuo com Bump, Upsell e WhatsApp Abandono
  return {
    nodes: [
      {
        key: "ad_dor",
        kind: "anuncio",
        label: "Meta Ads · Gancho de Dor Aguda",
        description: "Criativo focado no sintoma e frustração imediata",
        checklist: ["Roteiro aprovado", "Gravar criativo", "Subir no Meta Ads"],
        col: 0,
        row: 0,
        executor: "ai_higgsfield",
        skill: "skill-black-belt",
        prompt: `Vídeo 9:16 vertical atacando o sintoma mais doloroso e frustrante do avatar de ${prod}. Seedance 2.0 / Veo 3 com legendas de retenção.`,
      },
      {
        key: "ad_vilao",
        kind: "anuncio",
        label: "Meta Ads · Inimigo Oculto",
        description: "Ângulo do mecanismo único que desmascara métodos velhos",
        checklist: ["Roteiro aprovado", "Gravar criativo", "Subir no Meta Ads"],
        col: 0,
        row: 1,
        executor: "ai_higgsfield",
        skill: "skill-black-belt",
        prompt: `Vídeo 9:16 revelando o Inimigo Oculto e explicando por que métodos convencionais falharam antes de ${prod}.`,
      },
      {
        key: "ad_ugc",
        kind: "anuncio",
        label: "Meta Ads · Depoimento UGC",
        description: "Prova social de quem já obteve o resultado desejado",
        checklist: ["Separar print/vídeo real", "Subir no Meta Ads"],
        col: 0,
        row: 2,
        executor: "ai_google_flow",
        skill: "pipeline-video-viral",
        prompt: `Vídeo depoimento estilo UGC espontâneo com pessoa real mostrando a transformação após usar ${prod}.`,
      },
      {
        key: "page_vsl",
        kind: "vsl",
        label: "Página de Vendas / Advertorial VSL",
        description: "Página de alta conversão com narrativa e pitch",
        checklist: ["Hospedar vídeo VSL", "Configurar delay do botão CTA", "Validar carregamento no mobile"],
        col: 1,
        row: 0,
        executor: "ai_copywriter",
        skill: "mecanismo-vsl",
        prompt: `Página advertorial e roteiro de VSL com pitch irresistível, delay de botão CTA sincronizado e quebra de objeções.`,
      },
      {
        key: "checkout_main",
        kind: "checkout",
        label: `Checkout · ${prod}`,
        product_name: prod,
        description: "Página de pagamento segura com garantias",
        checklist: ["Configurar pixel de conversão", "Garantia incondicional de 30 dias", "Fazer compra teste"],
        col: 2,
        row: 0,
        executor: "human_traffic",
        skill: "briefing-gestor-trafego",
        prompt: `Configurar produto ${prod} na Kiwify/Hotmart, cadastrar pixel de compra e testar checkout no mobile.`,
      },
      {
        key: "bump_extra",
        kind: "orderbump",
        label: "Orderbump · Pote Extra / Guia Rápido",
        description: "Oferta complementar de impulso (R$ 27 - R$ 47)",
        checklist: ["Headline persuasiva do bump", "Preço R$ 27 - R$ 47"],
        col: 2,
        row: 1,
        executor: "ai_copywriter",
        skill: "tripwire-matador-v2",
        prompt: `Copy de impulso do Orderbump: Oferta de 1 pote extra ou guia de receitas aceleradoras por R$ 27 a R$ 47.`,
      },
      {
        key: "upsell_anual",
        kind: "upsell",
        label: "1-Click Upsell · Kit Completo",
        description: "Alavanca imediata de ticket médio (AOV)",
        checklist: ["Vídeo de 60s do upsell", "Configurar 1-click na plataforma de pagamento"],
        col: 3,
        row: 0,
        executor: "ai_copywriter",
        skill: "rebel-copy",
        prompt: `Página e roteiro de 1-Click Upsell imediato para kit anual com maior margem de lucro e ancoragem brutal.`,
      },
      {
        key: "downsell_leve",
        kind: "downsell",
        label: "Downsell · Condição Facilitada",
        description: "Opção parcelada ou quantidade reduzida",
        checklist: ["Página alternativa de downsell"],
        col: 3,
        row: 1,
        executor: "ai_copywriter",
        skill: "rebel-copy",
        prompt: `Oferta alternativa de downsell com menor barreira de entrada para quem recusa o upsell anual.`,
      },
      {
        key: "wa_recuperacao",
        kind: "whatsapp",
        label: "WhatsApp X1 · Resgate de Abandono",
        description: "Disparo automático após 15min / 2h de carrinho abandonado",
        checklist: ["Conectar instância WhatsApp", "Ativar régua no OpenFlow", "Testar mensagem de 15min"],
        col: 2,
        row: 2,
        executor: "openflow",
        skill: "roteiros-virais-comment-to-dm",
        prompt: `Automação no OpenFlow: Mensagem amigável de suporte 15min após abandono de carrinho e lembrete de Pix em 2h.`,
      },
    ],
    edges: [
      { from: "ad_dor", to: "page_vsl", label: "Clique no Anúncio" },
      { from: "ad_vilao", to: "page_vsl", label: "Clique no Anúncio" },
      { from: "ad_ugc", to: "page_vsl", label: "Clique no Anúncio" },
      { from: "page_vsl", to: "checkout_main", label: "Clique no CTA" },
      { from: "checkout_main", to: "bump_extra", label: "Adicionou Bump" },
      { from: "checkout_main", to: "upsell_anual", label: "Compra Aprovada" },
      { from: "upsell_anual", to: "downsell_leve", label: "Recusou Upsell", style: "dashed" },
      { from: "checkout_main", to: "wa_recuperacao", label: "Abandono de Carrinho / Pix", style: "dashed" },
    ],
  };
}

// ── MCP Tool Definitions ──
const MCP_TOOLS = [
  {
    name: "get_company_flow",
    description: "Retorna o mapa visual e operacional do projeto: todos os nós (etapas do funil, anúncios, checkout, WhatsApp, status), conexões (edges), links de checkout e produtos vinculados.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto (ex: 'jp_freitas', 'slimsoda')" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "create_company_flow",
    description: "Desenha ou atualiza o mapa visual e operacional do projeto. Calcula posições (x, y) automáticas em colunas (Tráfego -> VSL -> Checkout -> Pós-Venda -> WhatsApp), conecta as arestas, vincula produtos e grava checklists de tarefas.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        map_name: { type: "string", description: "Nome opcional do mapa (padrão: 'Mapa · [Nome do Projeto]')" },
        strategy_preset: {
          type: "string",
          enum: ["vsl_perpetuo", "lancamento_whatsapp", "high_ticket_x1", "tripwire_ascensao", "custom"],
          description: "Modelo pré-definido de funil ou 'custom' para passar nós manuais",
        },
        product_primary: { type: "string", description: "Nome do produto a ser vinculado às etapas de checkout" },
        nodes: {
          type: "array",
          description: "Lista de nós customizados (usado quando strategy_preset é 'custom')",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Identificador único ou alias do nó" },
              label: { type: "string", description: "Título do nó" },
              kind: {
                type: "string",
                enum: ["anuncio", "captura", "vsl", "pagina_vendas", "checkout", "orderbump", "upsell", "downsell", "whatsapp", "email", "area_membros", "app", "processo", "meta"],
              },
              description: { type: "string" },
              product_name: { type: "string" },
              url: { type: "string" },
              checklist: { type: "array", items: { type: "string" } },
              col: { type: "number" },
              row: { type: "number" },
            },
            required: ["key", "label", "kind"],
          },
        },
        edges: {
          type: "array",
          description: "Conexões entre nós",
          items: {
            type: "object",
            properties: {
              from: { type: "string", description: "Chave ou ID do nó de origem" },
              to: { type: "string", description: "Chave ou ID do nó de destino" },
              label: { type: "string" },
              style: { type: "string", enum: ["solid", "dashed"] },
            },
            required: ["from", "to"],
          },
        },
        replace_existing: { type: "boolean", description: "Se true, limpa os nós anteriores deste mapa (padrão: true)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_readiness",
    description: "Raio-X operacional completo para sócios: analisa o que o projeto tem pronto, o status de cada etapa do funil e o checklist exato do que precisa ser feito HOJE para rodar tráfego e vender.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_map",
    description: "Mapa da Empresa de um projeto (mesma regra da tela /mapa): status de cada área (produtos, avatar, mecanismo, concorrentes, funil, ativos, atendimento) como falta/desenhado/construído/rodando, com a evidência de cada status e as lacunas priorizadas (crítica/importante/sugestão) com a ação e a skill sugeridas. Use para decidir o que construir ou ajustar a seguir.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_context",
    description: "Retorna o dossiê completo de um projeto: identidade, avatar, dores, desejos, mecanismo único, produtos, preços, links de checkout e esteira de criativos.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_metrics",
    description: "Retorna o pulso operacional de hoje e do mês do projeto: leads hoje, vendas, faturamento, carrinhos pendentes, ROAS e status do WhatsApp.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_projects",
    description: "Lista todos os projetos cadastrados no sistema com nome, categoria, status e readiness score.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_project_leads",
    description: "Retorna leads do projeto filtrados por status ('lead', 'quente', 'cliente') ou score de interesse.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        status: { type: "string", description: "Filtro de status opcional ('quente', 'lead', 'qualificado')" },
        limit: { type: "number", description: "Limite de registros (padrão: 20)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "update_project_layer",
    description: "Atualiza uma camada estratégica do projeto (avatar, mecanismo_unico, pesquisa, briefing ou produtos) direto no banco.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        layer: {
          type: "string",
          enum: ["avatar", "mecanismo_unico", "pesquisa", "produtos", "notes"],
          description: "Camada a ser atualizada",
        },
        content: {
          type: "object",
          description: "Conteúdo JSON a ser mesclado ou substituído na camada",
        },
      },
      required: ["project_id", "layer", "content"],
    },
  },
  {
    name: "get_executable_steps",
    description: "Lista as etapas do mapa de operação do projeto, já na ordem do fluxo (step_number), executáveis por IA ou que aguardam ação humana. Cada etapa traz o contrato (objetivo, entrada, saída, pronto quando, métricas, dependências, frequência, se falhar), o prompt, a skill, o status declarado, o print da página e as ferramentas sugeridas.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        status: {
          type: "string",
          enum: ["open", "pending", "in_progress", "ready_review", "done", "all"],
          description: "Filtrar por status da etapa. Padrão 'open' = tudo que não está feito (a fazer, em andamento, revisar).",
        },
        executor: {
          type: "string",
          description: "Filtrar por executor (ex: 'ai_higgsfield', 'ai_copywriter', 'openflow', 'human_traffic')",
        },
        responsavel: {
          type: "string",
          description: "Só as etapas desta pessoa (nome, e-mail ou id do time) ou 'sem_dono'.",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_capabilities",
    description: "Catálogo de ferramentas de produção (libs de vídeo, imagem, áudio, páginas, dashboards, ícones, 3D) com quando usar cada uma e a licença. Consulte antes de produzir criativo, página ou automação. Filtre por tarefa: " + CAPABILITY_TASKS.map((t) => t.key).join(", ") + ".",
    inputSchema: {
      type: "object",
      properties: {
        tarefa: { type: "string", enum: CAPABILITY_TASKS.map((t) => t.key), description: "Tarefa a executar (opcional)" },
        busca: { type: "string", description: "Texto livre em nome, categoria ou quando usar (opcional)" },
        prioridade: { type: "string", enum: ["alta", "media", "baixa"], description: "Só esta prioridade (opcional)" },
        skill: { type: "string", description: "Slug da skill: só as ferramentas ligadas a ela (opcional)" },
      },
    },
  },
  {
    name: "list_playbooks",
    description: "Biblioteca de estratégias de marketing (X1, anúncio direto, webinar, lançamento pago e gratuito, canal orgânico, SEO): quando usar, quando evitar, métrica principal, KPIs com meta e riscos. Com 'id', devolve as etapas com contrato, executor, skill e métrica. Consulte antes de propor uma estratégia para um projeto.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Slug do playbook para ver as etapas (opcional)" },
        familia: { type: "string", enum: Object.keys(FAMILY_LABEL), description: "Só esta família (opcional)" },
      },
    },
  },
  {
    name: "apply_playbook",
    description: "Desenha um playbook no mapa de operação do projeto: uma seção por fase, etapas com contrato, executor, skill, métrica e checklist, e setas na ordem. Etapas equivalentes que já existem no mapa são ligadas, não duplicadas. Sem confirmar=true só mostra o plano; com confirmar=true faz backup do mapa e grava.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID do projeto" },
        playbook_id: { type: "string", description: "Slug do playbook (ver list_playbooks)" },
        map_id: { type: "string", description: "Mapa de destino (opcional; padrão: o mapa de operação do projeto)" },
        produto: { type: "string", description: "Nome do produto nas etapas (opcional; padrão: o nome do projeto)" },
        plataforma: { type: "string", description: "Plataforma do canal (ex.: Instagram, TikTok) — para o canal orgânico" },
        conta: { type: "string", description: "@ da conta — para o canal orgânico" },
        confirmar: { type: "boolean", description: "true grava no mapa; padrão false = só o plano" },
      },
      required: ["project_id", "playbook_id"],
    },
  },
  {
    name: "assign_step",
    description: "Define o responsável (alguém do time) e/ou o prazo de uma etapa do mapa. A etapa passa a aparecer no 'Meu dia' da pessoa na tela Hoje.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string", description: "ID da etapa no mapa" },
        responsavel: { type: "string", description: "Nome, e-mail ou id do membro do time; 'ninguem' tira o responsável" },
        prazo: { type: "string", description: "Data AAAA-MM-DD; vazio tira o prazo" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "complete_step",
    description: "Atualiza o status de execução de uma etapa do funil no mapa, anexa o entregável gerado (ex: URL do vídeo gerado no Higgsfield, link do Google Drive, doc da copy) e marca tarefas da checklist.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string", description: "ID do nó no mapa" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "ready_review", "done"],
          description: "Novo status da etapa (padrão: 'done')",
        },
        output_url: { type: "string", description: "URL do entregável gerado (ex: link do vídeo no storage, link do YouTube, doc da copy)" },
        notes_append: { type: "string", description: "Texto ou resumo adicional para anexar às notas do nó" },
        mark_checklist_done: { type: "boolean", description: "Se true, marca todos os itens de checklist do nó como concluídos" },
      },
      required: ["node_id"],
    },
  },
  {
    name: "get_approvals",
    description: "Fila única 'Aprovar' (mesma da tela /aprovar): pix travados, semáforo de anúncios, dúvidas do bot, respostas da IA para clientes, etapas para revisar, ações propostas pela IA e conteúdo pronto. Mais urgente primeiro. Cada item traz a 'key' de decide_approval, as decisões possíveis pelo MCP e quais precisam do OK de alguém do time.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Filtra por projeto (opcional; sem ele, todos)" },
        limit: { type: "number", description: "Máximo de itens (padrão 30)" },
      },
    },
  },
  {
    name: "decide_approval",
    description: "Decide um item da fila 'Aprovar' dentro dos níveis de autonomia (veja get_autonomy). Decisões 'auto' a IA faz sozinha; as de nível 'aprovar' (executar ação, pausar/escalar anúncio, marcar pix pago, aprovar resposta do bot ou conteúdo, marcar etapa feita) só com confirmado_por = alguém do time que deu o OK nesta conversa. Nunca: registrar recuperação de pix e responder cliente (feitos na tela). Tudo vai para o diário do projeto com quem decidiu.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Chave do item vinda de get_approvals (ex.: 'etapa:<id>', 'acao_ia:<id>', 'pix_travado:<id>')" },
        decision: { type: "string", enum: ["approve", "reject", "mark_paid"], description: "approve, reject ou mark_paid (só pix)" },
        confirmado_por: { type: "string", description: "Nome ou e-mail de quem do time autorizou (obrigatório nas decisões de nível 'aprovar')" },
        motivo: { type: "string", description: "Motivo (opcional; vai para as notas da etapa e para o diário)" },
        resposta: { type: "string", description: "Dúvidas do bot: resposta a gravar no acervo (opcional; padrão = sugestão atual)" },
      },
      required: ["key", "decision"],
    },
  },
  {
    name: "get_autonomy",
    description: "Níveis de autonomia da IA: o que ela faz sozinha, o que precisa do OK de alguém do time e o que nunca faz, com o motivo. Consulte antes de executar qualquer coisa que mude algo fora do sistema.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_journal",
    description: "Diário do projeto: o que mudou e quem fez (pessoa, IA com o OK de quem, ou automação) — etapas (status, responsável, prazo), ações da IA, vendas aprovadas, estratégias aplicadas, conteúdo e respostas do bot aprovados. Mais recente primeiro.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID do projeto" },
        dias: { type: "number", description: "Janela em dias (padrão 7, máx. 90)" },
        limit: { type: "number", description: "Máximo de linhas (padrão 50, máx. 300)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "evaluate_scale",
    description: "Esteira de Escala DTC (playbook 'esteira-escala-dtc'): dá o veredito e a ação de cada fase a partir dos números. fase 'parametros' = tetos e lances; 'p1' = concepts (gasto, ic, vendas, hipotese) com placar de hipóteses; 'p2' = dias acumulados, checkpoint do dia 2 e conjuntos; 'p3' = rotina de verba/lance, escada do lance e ângulos ativos; 'p4' = cemitério. Sem fase, devolve as regras do método.",
    inputSchema: {
      type: "object",
      properties: {
        fase: { type: "string", enum: ["regras", "parametros", "p1", "p2", "p3", "p4"], description: "Fase a avaliar (padrão 'regras')" },
        payout: { type: "number", description: "Quanto entra por venda (breakeven do CPA)" },
        cpa_alvo: { type: "number", description: "CPA alvo" },
        ics_por_venda: { type: "number", description: "Checkouts iniciados por venda (padrão 8)" },
        concepts: { type: "array", description: "p1: [{ concept, hipotese, gasto, ic, vendas }]", items: { type: "object" } },
        dias: { type: "array", description: "p2: [{ gasto, vendas }] por dia, agregado dos conjuntos", items: { type: "object" } },
        checkpoint: { type: "object", description: "p2: { gasto2d, ic, pageviews } dos 2 primeiros dias" },
        conjuntos: { type: "array", description: "p2: [{ nome, gasto, vendas }] no dia 3", items: { type: "object" } },
        verba: { type: "number", description: "p3: verba da campanha hoje" },
        gasto_ontem: { type: "number", description: "p3: gasto de ontem" },
        lances: { type: "array", description: "p3: [{ lance, cresceu: true|false|null }]", items: { type: "object" } },
        angulos: { type: "array", description: "p3: [{ nome, gasto7, vendas7, diasSemGastar }]; p4: [{ nome, gasto7, vendas7, diasSeguidosNoCpa }]", items: { type: "object" } },
      },
    },
  },
  {
    name: "get_scale_rounds",
    description: "Rodadas da Esteira de Escala lançadas nas etapas do mapa do projeto (P1–P4): parâmetros, números, veredito salvo e o placar de hipóteses acumulado (confirmadas, parciais, refutadas). Use antes de propor novos concepts ou mexer em verba.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        fase: { type: "string", enum: ["parametros", "p1", "p2", "p3", "p4"], description: "Filtra por fase (opcional)" },
        limit: { type: "number", description: "Máximo de rodadas (padrão 10)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "launch_project",
    description: "Lança um projeto novo a partir da ideia: cria o projeto e o mapa de operação, aplica os playbooks dos canais pedidos (YouTube, SEO, tráfego direto, X1, orgânico social, webinar) reaproveitando etapas comuns, e cria a etapa 'Kit de acessos' com o que só uma pessoa faz. Padrão: só mostra o plano; confirmar=true grava (se algo falhar no meio, desfaz).",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do projeto (ex.: 'Crypto Signals')" },
        canais: { type: "string", description: "Canais em texto livre, ex.: 'youtube, seo, tráfego direto, x1'" },
        id: { type: "string", description: "Id do projeto (opcional; sai do nome)" },
        mercado: { type: "string", description: "Mercado e idioma (padrão 'EUA (EN)')" },
        produto: { type: "string", description: "Nome do produto/oferta (opcional)" },
        confirmar: { type: "boolean", description: "true grava; padrão false = só o plano" },
      },
      required: ["nome", "canais"],
    },
  },
  {
    name: "get_project_kit",
    description: "Kit de operação do projeto: canais (YouTube, SEO, tráfego direto, X1, orgânico social, webinar), os acessos que cada um exige com status (falta, em andamento, conectado, não se aplica; o Império também detecta WhatsApp ativo, gasto sincronizado, tracker e vendas), o que está travado por outro acesso, os próximos passos humanos e as ferramentas. Sem 'canais', usa os playbooks aplicados no projeto.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        canais: { type: "string", description: "Canais em texto livre, ex.: 'youtube, seo, tráfego direto, x1' (opcional)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "set_project_access",
    description: "Marca o status de um acesso do projeto (ex.: dominio conectado). Nunca envie senha, token ou chave: só status, nota e responsável.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
        acesso: { type: "string", description: "Chave do acesso (veja get_project_kit)" },
        status: { type: "string", enum: ["falta", "em_andamento", "conectado", "nao_se_aplica"] },
        nota: { type: "string", description: "Observação curta (sem segredos)" },
        responsavel: { type: "string", description: "Nome, e-mail ou id de quem cuida da pendência" },
      },
      required: ["project_id", "acesso", "status"],
    },
  },
  {
    name: "create_test_order",
    description: "Ordem de teste de criativos (Esteira P1): registra projeto, oferta, página, conta de anúncio e as variantes (ângulo + hipótese + arte + texto), monta UTM por variante, nomes e verba, e devolve os passos para lançar na Meta. Variantes podem vir de um lote de referências (referencias_lote): arte e ângulo saem da referência, o texto você completa. Sem confirmar=true só mostra o plano; com confirmar=true grava ('pronto' se não houver problema, senão 'rascunho'). Nada vai para a Meta por aqui.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        nome: { type: "string", description: "Nome curto do teste (ex.: 'CCP ângulos Grok')" },
        oferta: { type: "string", description: "Produto/oferta (ex.: 'Código dos Cortes Perfeitos R$ 47')" },
        tipo_pagina: { type: "string", enum: ["pagina_vendas", "vsl", "pdp", "captura", "quiz", "advertorial", "checkout", "whatsapp"] },
        pagina_url: { type: "string", description: "Destino https (as UTMs são acrescentadas por variante)" },
        checkout_url: { type: "string" },
        ad_account_id: { type: "string", description: "Conta de anúncio (numérica, sem act_)" },
        page_id: { type: "string", description: "Página do Facebook que assina os anúncios" },
        pixel_id: { type: "string" },
        verba_dia_conjunto: { type: "number", description: "Reais por dia em cada conjunto (ABO, 1 conjunto por ângulo)" },
        payout: { type: "number", description: "Quanto entra por venda (breakeven do CPA)" },
        cpa_alvo: { type: "number" },
        ics_por_venda: { type: "number", description: "Checkouts iniciados por venda (padrão 8)" },
        utm_campaign: { type: "string", description: "Opcional; padrão sai do nome + data" },
        variantes: { type: "array", items: { type: "object" }, description: "[{ angulo, hipotese, image_url, texto, headline, cta?, referencia_id? }]" },
        referencias_lote: { type: "string", description: "Monta as variantes a partir das referências deste lote do projeto (ignorado se 'variantes' vier)" },
        creative_batch_id: { type: "string", description: "Monta as variantes a partir das artes prontas deste lote da fábrica (com copy)" },
        confirmar: { type: "boolean", description: "true grava a ordem; padrão false = só o plano" },
      },
      required: ["project_id", "nome", "oferta", "pagina_url", "ad_account_id", "verba_dia_conjunto", "payout", "cpa_alvo"],
    },
  },
  {
    name: "generate_creative_variations",
    description: "Fábrica de criativos: pega uma arte (ex.: o ângulo vencedor de um teste) e gera de 1 a 6 variações nos eixos da Esteira P2 (headline, avatar, gancho empilhado, fatia de público). Para cada uma a IA escreve a copy (arte + anúncio) e o Gemini 3 Pro Image recria a peça mantendo pessoa e estilo. Roda em segundo plano: devolve batch_id; acompanhe com get_creative_batch. A base pode ser uma variante de teste (test_order_id + ordem) ou uma imagem/referência.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        test_order_id: { type: "string", description: "Usa a variante deste teste como base (com 'ordem')" },
        ordem: { type: "number" },
        base_image_url: { type: "string", description: "Arte base (https) se não vier de um teste" },
        angulo: { type: "string" },
        hipotese: { type: "string" },
        oferta: { type: "string" },
        publico: { type: "string" },
        marca_topo: { type: "string", description: "Texto fixo no topo da arte (ex.: 'O CÓDIGO DOS CORTES PERFEITOS')" },
        quantidade: { type: "number", description: "1 a 6 (padrão 2)" },
        eixos: { type: "array", items: { type: "string", enum: ["headline", "avatar", "gancho", "publico"] } },
        pedido_por: { type: "string", description: "Nome ou e-mail de quem do time pediu (padrão: primeiro do time)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_creative_batch",
    description: "Lote da fábrica de criativos: status, quantas artes saíram e, para cada uma, imagem, eixo, headline e texto do anúncio. Artes prontas podem virar variantes de um teste com create_test_order (creative_batch_id).",
    inputSchema: { type: "object", properties: { batch_id: { type: "string" } }, required: ["batch_id"] },
  },
  {
    name: "get_test_order",
    description: "Uma ordem de teste: dados, variantes (com links, ids da Meta, última leitura e veredito), passos para lançar e a última avaliação.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "get_funnel_live",
    description: "Painel ao vivo do funil de um projeto (e produto): anúncio (gasto, CTR, CPC) → página (visitas do rastreador) → checkout → venda (vendas, ticket, CPA) → bump/upsell → recuperação no WhatsApp, com a conversão entre etapas, o status de cada uma (ok, atenção, gargalo, sem dado, medição incompleta) e o gargalo. Totais: gasto, faturamento, líquido, saldo, ROAS e CPA.",
    inputSchema: {
      type: "object",
      properties: { project_id: { type: "string" }, produto: { type: "string", description: "Nome exato do produto (opcional)" }, dias: { type: "number", description: "Janela em dias (padrão 7)" } },
      required: ["project_id"],
    },
  },
  {
    name: "create_page_split",
    description: "Cria um teste A/B/C de página: um link único (para usar no anúncio) que divide o tráfego entre 2 ou 3 páginas pelo peso, mantém UTMs e fbclid e devolve a pessoa sempre à mesma página. Só grava no Império; nada vai para a Meta.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" }, nome: { type: "string" },
        variantes: { type: "array", items: { type: "object" }, description: "[{ url, peso }] — 2 ou 3 páginas com link completo" },
      },
      required: ["project_id", "nome", "variantes"],
    },
  },
  {
    name: "get_page_splits",
    description: "Testes A/B/C de página do projeto com a leitura por variante: pessoas enviadas, visitas, cliques e checkouts medidos pelo rastreador, conversão e vencedora (mínimo 100 visitas por página e 20% de vantagem).",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] },
  },
  {
    name: "end_page_split",
    description: "Encerra um teste de página. Com vencedor (A, B ou C), o mesmo link passa a mandar 100% para a vencedora, sem trocar o anúncio.",
    inputSchema: { type: "object", properties: { slug: { type: "string" }, vencedor: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "get_copy_library",
    description: "Biblioteca de copy do Império (@renanmsap): 78 ângulos, 24 objeções, 34 provas, 10 tipos de mecanismo e o processo de uso, nas camadas problema/solução/produto/oferta. Use antes de escrever ou variar anúncio: escolha o ângulo (id, ex. angulo-22), a objeção a quebrar e a prova que quebra. Sem filtros devolve a lista curta (id, nome, categoria); com ids ou completo=true devolve explicação, exemplo, como usar e prompt.",
    inputSchema: {
      type: "object",
      properties: {
        biblioteca: { type: "string", enum: ["angulo", "objecao", "prova", "mecanismo", "processo"] },
        categoria: { type: "string", enum: ["problema", "solucao", "produto", "oferta", "generico", "angulo", "objecao", "prova", "mecanismo"] },
        busca: { type: "string", description: "Trecho do nome ou da explicação" },
        ids: { type: "array", items: { type: "string" } },
        completo: { type: "boolean" },
      },
    },
  },
  {
    name: "tag_test_variants",
    description: "Etiqueta variantes de um teste com o método que escreveu a copy (ex.: derick:native-ads, imperio:variacoes, grok:minerado, h&w:controle, humano) e o ângulo da biblioteca (copy_lib_id, ex. angulo-22). Só grava metadados no Império; é o que alimenta o placar por método e por ângulo.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        variantes: { type: "array", items: { type: "object" }, description: "[{ ordem, metodo?, copy_lib_id? }]" },
      },
      required: ["order_id", "variantes"],
    },
  },
  {
    name: "get_method_scoreboard",
    description: "Placar dos testes de criativos agrupado por método, por ângulo da biblioteca ou por categoria (problema/solução/produto/oferta): anúncios, quantos venderam, gasto (Zernio), IC, vendas reais (UTM), CPA, líquido e saldo. Responde 'qual jeito de escrever e qual tipo de ângulo vende neste projeto'.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        por: { type: "string", enum: ["metodo", "angulo", "categoria"] },
        order_id: { type: "string", description: "Só um teste" },
      },
    },
  },
  {
    name: "list_mining_sources",
    description: "Fontes da mineração diária da Biblioteca de Anúncios da Meta (palavra-chave, página de concorrente ou link de busca), por projeto, com o resultado da última rodada (vistos, novos, erro).",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } } },
  },
  {
    name: "add_mining_source",
    description: "Adiciona uma fonte de mineração. Todo dia às 6h o sistema pega os anúncios há mais tempo no ar e com mais variações, guarda a mídia e manda para o pipeline de referências (transcrição, leitura, ângulo). Custa ~US$0,006 por anúncio.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        tipo: { type: "string", enum: ["palavra", "pagina", "url"] },
        valor: { type: "string", description: "Palavra-chave, link/ID da página ou link da busca na Biblioteca" },
        pais: { type: "string", description: "BR, US, PT ou ALL (só para palavra). Padrão BR" },
        limite: { type: "number", description: "Novos por rodada, 1-50. Padrão 15" },
      },
      required: ["project_id", "tipo", "valor"],
    },
  },
  {
    name: "run_mining",
    description: "Roda a mineração agora para uma fonte (source_id). Leva até 2 minutos e devolve quantos anúncios viu e quantos gravou.",
    inputSchema: { type: "object", properties: { source_id: { type: "string" } }, required: ["source_id"] },
  },
  {
    name: "list_test_orders",
    description: "Ordens de teste (mais recentes primeiro), com status, verba, dias no ar e resumo da última avaliação.",
    inputSchema: { type: "object", properties: { project_id: { type: "string" }, status: { type: "string", enum: ["rascunho", "pronto", "no_ar", "encerrado", "cancelado"] } } },
  },
  {
    name: "record_test_launch",
    description: "Grava o que foi criado na Meta para uma ordem de teste: campanha e, por variante, conjunto, criativo e anúncio. Com ativado=true marca o teste como no ar (exige confirmado_por: quem do time deu o OK para ligar). corte_autorizado_por/corte_ate permitem à IA pausar sozinha as variantes que a Esteira matar.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        campaign_id: { type: "string" },
        variantes: { type: "array", items: { type: "object" }, description: "[{ ordem, adset_id, creative_id, ad_id }]" },
        ativado: { type: "boolean" },
        confirmado_por: { type: "string" },
        corte_autorizado_por: { type: "string", description: "Quem autorizou o corte automático (nome do time)" },
        corte_ate: { type: "string", description: "AAAA-MM-DD; padrão 9 dias depois de ativar" },
      },
      required: ["id"],
    },
  },
  {
    name: "evaluate_test_order",
    description: "Avalia um teste no ar pela Esteira P1 com as leituras da Meta (por variante: gasto, checkouts iniciados, compras). Soma as vendas do Império pela UTM (se o pixel perdeu a compra, o ângulo não morre), só decide pausar a partir do fim do dia 2, grava a leitura, o veredito e a rodada P1 (placar de hipóteses). Com aplicar_pausas=true marca as mortas como 'morto' e devolve os conjuntos a pausar na Meta — só se o teste tem corte autorizado ou com confirmado_por.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        leituras: { type: "array", items: { type: "object" }, description: "[{ ordem | adset_id, gasto, ic, vendas }]" },
        aplicar_pausas: { type: "boolean" },
        confirmado_por: { type: "string" },
      },
      required: ["id", "leituras"],
    },
  },
  {
    name: "get_live_panel",
    description: "Painel ao vivo do projeto hoje (mesmo da tela): funil (visitas → checkout iniciado → checkout preenchido → pedidos), gasto, faturamento, vendas, CPA com zona da Esteira (ESCALA/LUCRATIVA/MAGRA/PREJUÍZO), ROAS, lucro, ritmo e projeção do dia, alertas de rastreio, fonte de cada número, variação desde a última leitura gravada (a cada 15 min) e as leituras do dia.",
    inputSchema: {
      type: "object",
      properties: { project_id: { type: "string", description: "ID único do projeto" } },
      required: ["project_id"],
    },
  },
  {
    name: "get_briefing",
    description: "Resumo do projeto em uma chamada: vendas, faturamento e leads de hoje, faturamento do mês, leads quentes, etapas do dia (revisar, confirmar, esperando o time, prontas para IA, atrasadas, com responsável e prazo) e a fila de aprovações do projeto.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID único do projeto" },
      },
      required: ["project_id"],
    },
  },
];

/** Fila "Aprovar" com as mesmas origens e regras da tela /aprovar (useApprovals), mais as etapas para revisar. */
async function loadApprovals(supabase: Supabase, projectId?: string | null): Promise<ApprovalItem[]> {
  const cutoff48h = new Date(Date.now() - 48 * 3600000).toISOString();
  const [stepsRes, actionsRes, contentsRes, draftsRes, archivedRes, salesRes, knowledgeRes] = await Promise.all([
    supabase.from("imphq_company_map_nodes")
      .select("id, map_id, label, description, linked_project_id, status_changed_at, updated_at, image_url")
      .eq("step_status", "ready_review"),
    supabase.from("imphq_ai_actions")
      .select("id, kind, title, reason, risk_level, impact_brl, projeto_id, created_at, source, payload")
      .eq("status", "proposed").order("created_at", { ascending: false }).limit(100),
    supabase.from("imphq_content_items")
      .select("id, project_id, title, hook, cover_url, media_url, batch, updated_at, created_at")
      .eq("status", "pronto").limit(100),
    supabase.from("imphq_v_ai_drafts")
      .select("id, project_id, contact_name, incoming_text, suggested_text, created_at")
      .eq("status", "pending").limit(100),
    supabase.from("imphq_company_maps").select("id").not("archived_at", "is", null),
    supabase.from("imphq_vendas")
      .select("id, lead_id, project_id, valor, produto_nome, data, nome, created_at")
      .in("status", ["aguardando_pagamento", "pix_gerado", "pendente"]).gte("created_at", cutoff48h)
      .order("created_at", { ascending: false }).limit(30),
    supabase.from("imphq_wa_knowledge")
      .select("id, project_id, pergunta, resposta, source, created_at")
      .eq("aprovada", false).eq("answered", false).not("resposta", "is", null).neq("resposta", "").order("created_at", { ascending: false }).limit(30),
  ]);
  for (const res of [stepsRes, actionsRes, contentsRes, draftsRes, archivedRes]) if (res.error) throw res.error;
  const archived = new Set((archivedRes.data ?? []).map((m) => m.id));
  const sales = (salesRes.data ?? []) as PendingSaleRow[];
  const leadIds = sales.map((v) => v.lead_id).filter((v): v is string => !!v);
  const leads: Record<string, { nome?: string | null; phone?: string | null }> = {};
  if (leadIds.length) {
    const { data: rows } = await supabase.from("imphq_leads").select("id, nome, phone").in("id", leadIds.slice(0, 50));
    for (const l of rows ?? []) leads[l.id] = { nome: l.nome, phone: l.phone };
  }
  const { semaforo, generic } = splitAdsActions((actionsRes.data ?? []) as RawAction[]);
  const items = buildApprovalQueue({
    steps: ((stepsRes.data ?? []) as ReviewStepRow[]).filter((s) => !archived.has(s.map_id)),
    actions: generic,
    contents: (contentsRes.data ?? []) as ContentRow[],
    drafts: (draftsRes.data ?? []) as DraftRow[],
    pix: pixRowsFromSales(sales, leads),
    semaforo,
    knowledge: knowledgeGapRows((knowledgeRes.data ?? []) as KnowledgeRow[]),
  });
  return projectId ? items.filter((i) => i.projectId === projectId) : items;
}

/** Diário do projeto (imphq_activity_log, preenchido por gatilhos): mais recente primeiro. */
async function loadJournal(supabase: Supabase, projectId: string, days: number, limit: number): Promise<JournalEntry[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from("imphq_activity_log")
    .select("created_at, action, actor, entity_name, details")
    .eq("project_id", projectId).gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as JournalEntry[];
}

/** Último aviso de pagamento por plataforma nos últimos 90 dias. */
async function loadPaymentPulse(supabase: Supabase, projectId: string): Promise<PaymentPulse[]> {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data, error } = await supabase.from("imphq_webhooks").select("plataforma, created_at")
    .eq("project_id", projectId).gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  const by = new Map<string, PaymentPulse>();
  for (const w of data ?? []) {
    const k = w.plataforma || "?";
    const cur = by.get(k);
    if (cur) cur.total_90d++;
    else by.set(k, { plataforma: k, ultima: w.created_at, total_90d: 1 });
  }
  return [...by.values()];
}

/** Ajustes de autonomia gravados no banco (imphq_ai_policy, scope 'mcp'). */
async function loadAutonomyOverrides(supabase: Supabase): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("imphq_ai_policy").select("kind, autonomy").eq("scope", "mcp").not("autonomy", "is", null);
  if (error) console.error("imphq_ai_policy", error.message);
  return new Map((data ?? []).map((r) => [String(r.kind), String(r.autonomy)]));
}

/**
 * Decide um item da fila com a regra compartilhada (_shared/approval-decide.ts), dentro dos níveis de autonomia:
 * "auto" a IA decide; "aprovar" exige confirmado_por (alguém do time, vai para o diário); "nunca" bloqueia.
 * As escritas levam o cabeçalho x-imperio-actor, então o diário registra quem decidiu.
 */
async function decideApproval(supabase: Supabase, key: string, decision: ApprovalDecision, opts: { motivo?: string; confirmadoPor?: string; resposta?: string } = {}) {
  const [source, ...rest] = key.split(":");
  const itemId = rest.join(":");
  if (!itemId || !(source in SOURCE_LABEL)) throw new Error(`key inválida: '${key}'. Use a key de get_approvals.`);
  const src = source as ApprovalSource;
  if (!DECISIONS_BY_SOURCE[src].includes(decision)) {
    throw new Error(src === "rascunho" ? "Resposta para cliente é decidida na tela /rascunhos." : `Para ${SOURCE_LABEL[src]} use: ${DECISIONS_BY_SOURCE[src].join(", ")}.`);
  }
  const ruleKey = `${src}:${decision}`;
  const [overrides, team] = await Promise.all([loadAutonomyOverrides(supabase), loadTeam(supabase)]);
  const check = checkAutonomy(ruleKey, overrides.get(ruleKey), opts.confirmadoPor, team);
  if (!check.ok) throw new Error(check.reason);
  const actor = check.actor === "ia" ? "ia (mcp)" : `${check.actor} via mcp`;
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { "x-imperio-actor": actor } } });
  const now = new Date().toISOString();
  const must = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) throw error; };

  // O item ainda está esperando? (e o título para a resposta)
  let titulo = "";
  let metadata: { recoveryLevel?: number; suggestedAnswer?: string } = {};
  if (src === "etapa") {
    const { data: node } = await db.from("imphq_company_map_nodes").select("label, step_status").eq("id", itemId).maybeSingle();
    if (!node) throw new Error(`Etapa '${itemId}' não encontrada`);
    if (node.step_status !== "ready_review") throw new Error(`A etapa '${node.label}' não está esperando revisão (status: ${node.step_status ?? "pending"}).`);
    titulo = node.label;
  } else if (src === "conteudo") {
    const { data: item } = await db.from("imphq_content_items").select("title, status").eq("id", itemId).maybeSingle();
    if (!item) throw new Error(`Conteúdo '${itemId}' não encontrado`);
    if (item.status !== "pronto") throw new Error(`Este conteúdo não está esperando aprovação (status: ${item.status}).`);
    titulo = item.title;
  } else if (src === "acao_ia" || src === "semaforo_ads") {
    const { data: action } = await db.from("imphq_ai_actions").select("title, status").eq("id", itemId).maybeSingle();
    if (!action) throw new Error(`Ação '${itemId}' não encontrada`);
    if (action.status !== "proposed") throw new Error(`Esta ação não está proposta (status: ${action.status}).`);
    titulo = action.title;
  } else if (src === "pix_travado") {
    const { data: sale } = await db.from("imphq_vendas").select("produto_nome, nome, status, created_at").eq("id", itemId).maybeSingle();
    if (!sale) throw new Error(`Venda '${itemId}' não encontrada`);
    if (!["aguardando_pagamento", "pix_gerado", "pendente"].includes(String(sale.status))) throw new Error(`Esta venda não está com pix pendente (status: ${sale.status}).`);
    titulo = `${sale.nome || "Cliente"} · ${sale.produto_nome || "pedido"}`;
    const ageMin = (Date.now() - Date.parse(sale.created_at)) / 60000;
    metadata = { recoveryLevel: ageMin < 120 ? 1 : ageMin < 1440 ? 2 : 3 };
  } else if (src === "duvida_bot") {
    const { data: k } = await db.from("imphq_wa_knowledge").select("pergunta, resposta, aprovada, answered").eq("id", itemId).maybeSingle();
    if (!k) throw new Error(`Dúvida '${itemId}' não encontrada`);
    if (k.aprovada && k.answered) throw new Error("Esta dúvida já foi decidida.");
    if (decision === "approve" && !(opts.resposta ?? k.resposta ?? "").trim()) throw new Error("Informe a resposta para o acervo (campo resposta).");
    titulo = k.pergunta ?? "";
    metadata = { suggestedAnswer: k.resposta ?? undefined };
  }

  const store: ApprovalStore = {
    async getSaleData(id) {
      const { data } = await db.from("imphq_vendas").select("data").eq("id", id).maybeSingle();
      return data?.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data as Record<string, unknown> : {};
    },
    updateSale: (id, patch) => must(db.from("imphq_vendas").update(patch).eq("id", id)),
    updateAiAction: (id, patch) => must(db.from("imphq_ai_actions").update(patch).eq("id", id)),
    async executeAiAction(id) {
      // Chamada interna com a chave de serviço (o executor aceita além do login de alguém do time).
      const res = await fetch(`${SUPABASE_URL}/functions/v1/imperius-executor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "x-imperio-actor": actor },
        body: JSON.stringify({ action_id: id, mode: "execute" }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || out?.message || `imperius-executor respondeu ${res.status}`);
    },
    updateKnowledge: (id, patch) => must(db.from("imphq_wa_knowledge").update(patch).eq("id", id)),
    async setStepStatus(id, status) {
      const { data: node } = await db.from("imphq_company_map_nodes").select("notes").eq("id", id).single();
      let notes = writeAgentNotes(node?.notes, { status });
      if (opts.motivo) notes = `${notes}\n\n${status === "done" ? "Aprovada" : "Devolvida"} pelo MCP (${actor}): ${opts.motivo}`;
      await must(db.from("imphq_company_map_nodes").update({ step_status: status, status_changed_at: now, status_changed_by: actor, notes }).eq("id", id));
    },
    updateContent: (id, patch) => must(db.from("imphq_content_items").update(patch).eq("id", id)),
  };

  const resultado = await applyDecision({ source: src, id: itemId, metadata }, decision, store, { now, customAnswer: opts.resposta });
  return { key, titulo, resultado, autonomia: AUTONOMY_LABEL[check.level], quem: actor };
}

// ── Ordem de teste de criativos (TST1.1) ─────────────────────────────────────

interface TestOrderRow {
  id: string; project_id: string; nome: string; oferta: string; tipo_pagina: string; pagina_url: string; checkout_url: string | null;
  ad_account_id: string; page_id: string | null; pixel_id: string | null; verba_dia_conjunto: number; payout: number; cpa_alvo: number;
  ics_por_venda: number; utm_campaign: string; status: string; meta_campaign_id: string | null; ativado_em: string | null;
  corte_autorizado_por: string | null; corte_ate: string | null; scale_round_id: string | null; ultima_avaliacao: unknown; created_at: string;
}
interface TestVariantRow {
  id: string; order_id: string; ordem: number; angulo: string; hipotese: string | null; referencia_id: string | null; image_url: string;
  texto: string | null; headline: string | null; cta: string; utm_content: string; link_url: string; meta_adset_id: string | null;
  meta_creative_id: string | null; meta_ad_id: string | null; status: string; ultima_leitura: unknown; veredito: string | null;
}

const todayBrt = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const num = (v: unknown) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const actorClient = (actor: string) => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { "x-imperio-actor": actor } } });

/** Placar por método/ângulo/categoria a partir das leituras ao vivo (Zernio + vendas por UTM) de todos os testes do recorte. */
async function loadMethodScoreboard(supabase: Supabase, args: Record<string, unknown>) {
  const por = (["metodo", "angulo", "categoria"].includes(String(args.por)) ? String(args.por) : "metodo") as ScoreBy;
  let q = supabase.from("imphq_test_orders").select("*").neq("status", "cancelado");
  if (args.project_id) q = q.eq("project_id", String(args.project_id));
  if (args.order_id) q = q.eq("id", String(args.order_id));
  const { data: orders, error } = await q;
  if (error) throw error;
  if (!orders?.length) return { por, testes: 0, placar: [] };
  const ids = orders.map((o: { id: string }) => o.id);
  const { data: variants, error: vErr } = await supabase.from("imphq_test_variants").select("order_id, ordem, angulo, hipotese, status, utm_content, meta_ad_id, metodo, copy_lib_id").in("order_id", ids);
  if (vErr) throw vErr;
  const adIds = (variants ?? []).map((v: { meta_ad_id: string | null }) => v.meta_ad_id).filter(Boolean) as string[];
  const [{ data: spend }, { data: sales }, { data: lib }] = await Promise.all([
    adIds.length ? supabase.from("imphq_ads_spend").select("ad_id, spend, init_checkout, link_clicks, impressoes, purchases, effective_status, created_at, date").in("ad_id", adIds) : Promise.resolve({ data: [] }),
    supabase.from("imphq_vendas").select("utm_campaign, utm_content, status, valor, valor_liquido, tipo_venda").in("utm_campaign", orders.map((o: { utm_campaign: string }) => o.utm_campaign)),
    supabase.from("imphq_copy_library").select("id, nome, categoria, numero").eq("biblioteca", "angulo"),
  ]);
  const rows: ScoreInput[] = [];
  for (const o of orders) {
    const vs = (variants ?? []).filter((v: { order_id: string }) => v.order_id === o.id) as Array<LiveVariant & { metodo: string | null; copy_lib_id: string | null }>;
    const since = String(o.ativado_em ?? o.created_at).slice(0, 10);
    const sp = ((spend ?? []) as Array<SpendRow & { date: string | null }>).filter((r) => String(r.date ?? "") >= since);
    const readings = liveReadings(o as LiveOrder, vs, sp, (sales ?? []) as SaleRow[]);
    for (const r of readings) {
      const v = vs.find((x) => x.ordem === r.ordem);
      rows.push({ metodo: v?.metodo ?? null, copy_lib_id: v?.copy_lib_id ?? null, gasto: r.gasto, ic: r.ic, vendas: r.vendas, receita_liquida: r.receita_liquida });
    }
  }
  return { por, testes: orders.length, anuncios: rows.length, placar: methodScoreboard(rows, por, (lib ?? []) as Array<{ id: string; nome: string; categoria: string; numero: number }>) };
}

async function loadTestOrder(supabase: Supabase, id: string) {
  const [orderRes, variantsRes] = await Promise.all([
    supabase.from("imphq_test_orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("imphq_test_variants").select("*").eq("order_id", id).order("ordem"),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (variantsRes.error) throw variantsRes.error;
  if (!orderRes.data) throw new Error(`Ordem de teste '${id}' não encontrada`);
  return { order: orderRes.data as TestOrderRow, variants: (variantsRes.data ?? []) as TestVariantRow[] };
}

async function createTestOrder(supabase: Supabase, args: Record<string, unknown>) {
  const projectId = String(args.project_id ?? "");
  let variantes = Array.isArray(args.variantes) ? (args.variantes as Array<Record<string, unknown>>) : [];
  if (!variantes.length && args.creative_batch_id) {
    const { data: assets, error } = await supabase.from("imphq_creative_assets").select("id, angulo, image_url, headline_copy, metadata, reprovado")
      .eq("batch_id", String(args.creative_batch_id)).order("created_at");
    if (error) throw error;
    variantes = (assets ?? []).filter((a) => !a.reprovado && String(a.image_url).startsWith("http")).map((a) => {
      const meta = (a.metadata && typeof a.metadata === "object" ? a.metadata : {}) as Record<string, unknown>;
      const copy = (meta.copy && typeof meta.copy === "object" ? meta.copy : {}) as Record<string, unknown>;
      return {
        angulo: `${a.angulo}${meta.eixo ? ` · ${meta.eixo}` : ""}`, hipotese: meta.hipotese ?? null, image_url: a.image_url,
        texto: copy.texto_anuncio ?? null, headline: copy.headline_anuncio ?? a.headline_copy ?? null, creative_asset_id: a.id,
      };
    });
  }
  if (!variantes.length && args.referencias_lote) {
    const { data: refs, error } = await supabase.from("imphq_referencias").select("id, titulo, image_url, tags")
      .eq("project_id", projectId).eq("lote", String(args.referencias_lote)).order("titulo");
    if (error) throw error;
    variantes = (refs ?? [])
      .filter((r) => !(r.tags ?? []).includes("angulo:duplicado") && r.image_url)
      .map((r) => ({ angulo: ((r.tags ?? []).find((t: string) => t.startsWith("angulo:")) ?? "").replace("angulo:", "") || r.titulo, hipotese: null, image_url: r.image_url, headline: null, texto: null, referencia_id: r.id }));
  }
  const input: TestOrderInput = {
    project_id: projectId, nome: String(args.nome ?? ""), oferta: String(args.oferta ?? ""), tipo_pagina: args.tipo_pagina ? String(args.tipo_pagina) : undefined,
    pagina_url: String(args.pagina_url ?? ""), checkout_url: args.checkout_url ? String(args.checkout_url) : null,
    ad_account_id: String(args.ad_account_id ?? "").replace(/^act_/, ""), page_id: args.page_id ? String(args.page_id) : null, pixel_id: args.pixel_id ? String(args.pixel_id) : null,
    verba_dia_conjunto: num(args.verba_dia_conjunto), payout: num(args.payout), cpa_alvo: num(args.cpa_alvo), ics_por_venda: num(args.ics_por_venda) || undefined,
    utm_campaign: args.utm_campaign ? String(args.utm_campaign) : null,
    variantes: variantes.map((v) => ({
      angulo: String(v.angulo ?? ""), hipotese: v.hipotese ? String(v.hipotese) : null, image_url: String(v.image_url ?? ""),
      texto: v.texto ? String(v.texto) : null, headline: v.headline ? String(v.headline) : null, cta: v.cta ? String(v.cta) : null,
      referencia_id: v.referencia_id ? String(v.referencia_id) : null, creative_asset_id: v.creative_asset_id ? String(v.creative_asset_id) : null,
    })),
  };
  const plan = planTestOrder(input, todayBrt());
  const passos = launchSteps(input, plan);
  if (args.confirmar !== true) return { modo: "plano (nada foi gravado)", plano: plan, passos, proximo_passo: "Para gravar, chame create_test_order de novo com confirmar=true." };

  const db = actorClient("ia (mcp)");
  const { data: order, error } = await db.from("imphq_test_orders").insert({
    project_id: input.project_id, nome: input.nome, oferta: input.oferta, tipo_pagina: input.tipo_pagina ?? "pagina_vendas",
    pagina_url: input.pagina_url, checkout_url: input.checkout_url, ad_account_id: input.ad_account_id, page_id: input.page_id, pixel_id: input.pixel_id,
    verba_dia_conjunto: input.verba_dia_conjunto, payout: input.payout, cpa_alvo: input.cpa_alvo, ics_por_venda: input.ics_por_venda ?? 8,
    utm_campaign: plan.utm_campaign, status: plan.problemas.length ? "rascunho" : "pronto", created_by: "mcp",
  }).select("id, status").single();
  if (error) throw new Error(error.message.includes("imphq_test_orders_utm_idx") ? `Já existe teste com utm_campaign '${plan.utm_campaign}' neste projeto.` : error.message);
  const { error: vErr } = await db.from("imphq_test_variants").insert(plan.variantes.map((v) => ({
    order_id: order.id, ordem: v.ordem, angulo: v.angulo, hipotese: v.hipotese ?? null, referencia_id: v.referencia_id ?? null, creative_asset_id: v.creative_asset_id ?? null,
    image_url: v.image_url, texto: v.texto ?? null, headline: v.headline ?? null, cta: v.cta, utm_content: v.utm_content, link_url: v.link_url,
  })));
  if (vErr) { await db.from("imphq_test_orders").delete().eq("id", order.id); throw vErr; }
  return { success: true, id: order.id, status: order.status, plano: plan, passos };
}

async function generateCreativeVariations(supabase: Supabase, args: Record<string, unknown>) {
  const projectId = String(args.project_id ?? "");
  let base = args.base_image_url ? String(args.base_image_url) : "";
  let angulo = args.angulo ? String(args.angulo) : "";
  let hipotese = args.hipotese ? String(args.hipotese) : null;
  let oferta = args.oferta ? String(args.oferta) : "";
  let textoBase: string | null = null;
  if (args.test_order_id) {
    const { order, variants } = await loadTestOrder(supabase, String(args.test_order_id));
    const v = variants.find((x) => x.ordem === num(args.ordem));
    if (!v) throw new Error(`Variante ${args.ordem} não existe no teste ${order.nome}`);
    base = base || v.image_url;
    angulo = angulo || v.angulo;
    hipotese = hipotese ?? v.hipotese;
    oferta = oferta || order.oferta;
    textoBase = v.texto;
  }
  if (!base.startsWith("http") || !angulo || !oferta) throw new Error("Informe a base (test_order_id + ordem, ou base_image_url), o ângulo e a oferta.");
  const team = await loadTeam(supabase);
  const who = args.pedido_por ? findMember(team, String(args.pedido_por)) : team.find((m) => m.user_id);
  if (!who?.user_id) throw new Error("Ninguém do time com login para registrar o lote (pedido_por).");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-factory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({
      action: "variations", user_id: who.user_id, project_id: projectId, base_image_url: base, angulo, hipotese, oferta,
      publico: args.publico ?? null, marca_topo: args.marca_topo ?? null, texto_base: textoBase,
      quantidade: num(args.quantidade) || 2, eixos: Array.isArray(args.eixos) ? args.eixos : null,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.batch_id) throw new Error(out?.error || `creative-factory respondeu ${res.status}`);
  return { success: true, batch_id: out.batch_id, quantidade: out.quantidade, base_image_url: base, angulo, pedido_por: who.name, proximo_passo: "Acompanhe com get_creative_batch; cada arte leva de 20 a 60 s." };
}

async function getCreativeBatch(supabase: Supabase, batchId: string) {
  const [bRes, aRes] = await Promise.all([
    supabase.from("imphq_creative_batches").select("id, project_id, nome, status, total_planejado, total_gerado, error_message, briefing, created_at").eq("id", batchId).maybeSingle(),
    supabase.from("imphq_creative_assets").select("id, angulo, image_url, headline_copy, metadata, reprovado, aprovado, created_at").eq("batch_id", batchId).order("created_at"),
  ]);
  if (bRes.error) throw bRes.error;
  if (aRes.error) throw aRes.error;
  if (!bRes.data) throw new Error(`Lote '${batchId}' não encontrado`);
  const artes = (aRes.data ?? []).filter((a) => !a.reprovado && String(a.image_url).startsWith("http")).map((a) => {
    const meta = (a.metadata && typeof a.metadata === "object" ? a.metadata : {}) as Record<string, unknown>;
    return { asset_id: a.id, image_url: a.image_url, eixo: meta.eixo ?? null, copy: meta.copy ?? null, headline: a.headline_copy };
  });
  return { lote: { ...bRes.data, briefing: undefined }, artes, pronto: ["completed", "failed"].includes(String(bRes.data.status)) };
}

async function recordTestLaunch(supabase: Supabase, args: Record<string, unknown>) {
  const { order, variants } = await loadTestOrder(supabase, String(args.id));
  let actor = "ia (mcp)";
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.ativado === true) {
    const [overrides, team] = await Promise.all([loadAutonomyOverrides(supabase), loadTeam(supabase)]);
    const check = checkAutonomy("teste:ativar", overrides.get("teste:ativar"), args.confirmado_por ? String(args.confirmado_por) : null, team);
    if (!check.ok) throw new Error(check.reason);
    actor = `${check.actor} via mcp`;
    const ativadoEm = new Date();
    patch.status = "no_ar";
    patch.ativado_em = ativadoEm.toISOString();
    if (args.corte_autorizado_por) {
      const member = findMember(team, String(args.corte_autorizado_por));
      if (!member) throw new Error(`corte_autorizado_por '${args.corte_autorizado_por}' não está no time`);
      patch.corte_autorizado_por = member.name;
      patch.corte_ate = args.corte_ate ? String(args.corte_ate) : new Date(ativadoEm.getTime() + 9 * 86400000).toISOString().slice(0, 10);
    }
  }
  if (args.campaign_id) patch.meta_campaign_id = String(args.campaign_id);
  const db = actorClient(actor);
  const { error } = await db.from("imphq_test_orders").update(patch).eq("id", order.id);
  if (error) throw error;
  const updates = Array.isArray(args.variantes) ? (args.variantes as Array<Record<string, unknown>>) : [];
  for (const u of updates) {
    const v = variants.find((x) => x.ordem === num(u.ordem));
    if (!v) throw new Error(`Variante de ordem ${u.ordem} não existe neste teste`);
    const vp: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (u.adset_id) vp.meta_adset_id = String(u.adset_id);
    if (u.creative_id) vp.meta_creative_id = String(u.creative_id);
    if (u.ad_id) vp.meta_ad_id = String(u.ad_id);
    const { error: e } = await db.from("imphq_test_variants").update(vp).eq("id", v.id);
    if (e) throw e;
  }
  if (args.ativado === true) {
    for (const v of variants.filter((x) => x.status === "planejado")) {
      const { error: e } = await db.from("imphq_test_variants").update({ status: "no_ar", updated_at: new Date().toISOString() }).eq("id", v.id);
      if (e) throw e;
    }
  }
  return { success: true, id: order.id, status: patch.status ?? order.status, variantes_atualizadas: updates.length, quem: actor };
}

async function evaluateTestOrderTool(supabase: Supabase, args: Record<string, unknown>) {
  const { order, variants } = await loadTestOrder(supabase, String(args.id));
  const leituras = Array.isArray(args.leituras) ? (args.leituras as Array<Record<string, unknown>>) : [];
  // Vendas aprovadas no Império com a UTM do teste, por utm_content.
  const { data: sales, error: sErr } = await supabase.from("imphq_vendas").select("utm_content")
    .eq("project_id", order.project_id).eq("status", "aprovado").eq("utm_campaign", order.utm_campaign).limit(2000);
  if (sErr) throw sErr;
  const vendasPorUtm = new Map<string, number>();
  for (const s of sales ?? []) if (s.utm_content) vendasPorUtm.set(s.utm_content, (vendasPorUtm.get(s.utm_content) ?? 0) + 1);
  const readings: VariantReading[] = [];
  for (const l of leituras) {
    const v = l.ordem !== undefined ? variants.find((x) => x.ordem === num(l.ordem)) : variants.find((x) => x.meta_adset_id && x.meta_adset_id === String(l.adset_id));
    if (!v) throw new Error(`Leitura sem variante correspondente: ${JSON.stringify(l)}`);
    readings.push({ ordem: v.ordem, gasto: num(l.gasto), ic: num(l.ic), vendas: num(l.vendas), vendas_imperio: vendasPorUtm.get(v.utm_content) ?? 0 });
  }
  const diasNoAr = order.ativado_em ? (Date.now() - Date.parse(order.ativado_em)) / 86400000 : 0;
  const result = evaluateTestOrder(order, variants.map((v) => ({ ordem: v.ordem, angulo: v.angulo, hipotese: v.hipotese, status: v.status })), readings, diasNoAr);

  let actor = "ia (mcp)";
  let pausasAplicadas = false;
  let corte = cutAllowed(order, todayBrt());
  if (args.aplicar_pausas === true && result.pausar.length) {
    if (!corte.ok && args.confirmado_por) {
      const [overrides, team] = await Promise.all([loadAutonomyOverrides(supabase), loadTeam(supabase)]);
      const check = checkAutonomy("teste:pausar_variante", overrides.get("teste:pausar_variante"), String(args.confirmado_por), team);
      corte = check.ok ? { ok: true, motivo: `OK de ${check.actor}` } : { ok: false, motivo: check.reason };
      if (check.ok) actor = `${check.actor} via mcp`;
    } else if (corte.ok) actor = `ia (corte autorizado por ${order.corte_autorizado_por}) via mcp`;
    pausasAplicadas = corte.ok;
  }

  const db = actorClient(actor);
  const lidoEm = new Date().toISOString();
  for (const a of result.avaliacoes) {
    const v = variants.find((x) => x.ordem === a.ordem)!;
    const r = readings.find((x) => x.ordem === a.ordem);
    const vp: Record<string, unknown> = { veredito: `${a.rotulo}: ${a.motivo}`, updated_at: lidoEm };
    if (r) vp.ultima_leitura = { gasto: r.gasto, ic: r.ic, vendas: r.vendas, vendas_imperio: r.vendas_imperio ?? 0, lido_em: lidoEm };
    if (pausasAplicadas && a.decisao === "pausar") vp.status = "morto";
    if (a.decisao === "vencedor" && v.status === "no_ar") vp.status = "vencedor";
    const { error } = await db.from("imphq_test_variants").update(vp).eq("id", v.id);
    if (error) throw error;
  }
  const resumo = { lido_em: lidoEm, dias_no_ar: Math.round(diasNoAr * 10) / 10, gasto_total: result.gasto_total, vendas_total: result.vendas_total, cpa_geral: result.cpa_geral, pausar: result.pausar, vencedores: result.vencedores };
  const roundRow = {
    project_id: order.project_id, fase: "p1", rodada: order.nome, params: { payout: Number(order.payout), cpa_alvo: Number(order.cpa_alvo), ics_por_venda: order.ics_por_venda },
    data: result.rodada_p1, resultado: { placar_hipoteses: result.placar_hipoteses, investimento: result.gasto_total, vendas: result.vendas_total },
    resumo: `Teste ${order.nome}: ${result.vendas_total} venda(s), R$ ${result.gasto_total} gastos, ${result.vencedores.length} vencedor(es), ${result.pausar.length} a pausar.`,
    created_by: `teste:${order.id}`, updated_at: lidoEm,
  };
  let scaleRoundId = order.scale_round_id;
  if (scaleRoundId) {
    const { error } = await db.from("imphq_scale_rounds").update(roundRow).eq("id", scaleRoundId);
    if (error) throw error;
  } else {
    const { data, error } = await db.from("imphq_scale_rounds").insert(roundRow).select("id").single();
    if (error) throw error;
    scaleRoundId = data.id;
  }
  const { error: oErr } = await db.from("imphq_test_orders").update({ ultima_avaliacao: resumo, scale_round_id: scaleRoundId, updated_at: lidoEm }).eq("id", order.id);
  if (oErr) throw oErr;

  const paraPausar = result.pausar.map((o) => { const v = variants.find((x) => x.ordem === o)!; return { ordem: o, angulo: v.angulo, adset_id: v.meta_adset_id }; });
  return {
    ...resumo,
    avaliacoes: result.avaliacoes,
    placar_hipoteses: result.placar_hipoteses,
    corte: pausasAplicadas
      ? { aplicado: true, motivo: corte.motivo, pausar_na_meta: paraPausar, instrucao: "Pause cada conjunto na Meta (ads_update_entity, status PAUSED). No Império elas já estão como 'morto'." }
      : { aplicado: false, motivo: args.aplicar_pausas === true ? corte.motivo : "Só recomendação (aplicar_pausas não foi pedido).", recomendado_pausar: paraPausar },
  };
}

/** Lançador (LAUNCH1.3) pelo MCP: plano por padrão; com confirmar, grava e desfaz tudo se algo falhar no meio. */
async function launchProject(supabase: Supabase, args: Record<string, unknown>) {
  const nome = String(args.nome ?? "").trim();
  const parsed = parseChannels(String(args.canais ?? ""));
  if (parsed.invalidos.length) throw new Error(`Canais desconhecidos: ${parsed.invalidos.join(", ")}. Use: ${CHANNELS.map((c) => c.key).join(", ")}`);
  const [pbRes, stRes, projRes] = await Promise.all([
    supabase.from("imphq_playbooks").select("*").eq("ativo", true),
    supabase.from("imphq_playbook_steps").select("*").order("ordem"),
    supabase.from("imphq_projects").select("id"),
  ]);
  for (const res of [pbRes, stRes, projRes]) if (res.error) throw res.error;
  const library = ((pbRes.data ?? []) as PlaybookRow[]).map((p) => playbookFromRows(p, ((stRes.data ?? []) as PlaybookStepRow[]).filter((s) => (s as { playbook_id?: string }).playbook_id === p.id)));
  const launch = planLaunch({
    nome, canais: parsed.canais, id: args.id ? String(args.id) : null, mercado: args.mercado ? String(args.mercado) : null, produto: args.produto ? String(args.produto) : null,
  }, library, (projRes.data ?? []).map((p) => p.id));
  const preview = launchPreview(launch);
  if (args.confirmar !== true) return { modo: "plano (nada foi gravado)", ...preview, proximo_passo: "Para criar, chame launch_project de novo com confirmar=true." };

  let mapId: string | null = null;
  const must = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) throw error; };
  try {
    const result = await writeLaunch(launch, { appliedBy: "mcp", newId: () => crypto.randomUUID(), today: new Date().toISOString().slice(0, 10) }, {
      insertProject: (row) => must(supabase.from("imphq_projects").insert(row)),
      insertMap: (row) => { mapId = row.id; return must(supabase.from("imphq_company_maps").insert(row)); },
      insertFrame: (row) => must(supabase.from("imphq_company_map_annotations").insert(row)),
      insertNode: async (row) => {
        const { data, error } = await supabase.from("imphq_company_map_nodes").insert(row).select("id").single();
        if (error) throw error;
        return data.id as string;
      },
      insertEdge: (row) => must(supabase.from("imphq_company_map_edges").insert(row)),
      insertApplication: (row) => must(supabase.from("imphq_playbook_applications").insert(row)),
      upsertAccess: (row) => must(supabase.from("imphq_project_access").upsert(row, { onConflict: "project_id,access_key", ignoreDuplicates: true })),
    });
    return { success: true, ...preview, criado: result, proximo_passo: `Kit de acessos: get_project_kit project_id=${result.projectId}` };
  } catch (err) {
    // Desfaz: o mapa leva etapas, setas e molduras em cascata; aplicações, acessos e o projeto saem à parte.
    await supabase.from("imphq_playbook_applications").delete().eq("project_id", launch.projectId);
    await supabase.from("imphq_project_access").delete().eq("project_id", launch.projectId);
    if (mapId) await supabase.from("imphq_company_maps").delete().eq("id", mapId);
    await supabase.from("imphq_projects").delete().eq("id", launch.projectId);
    throw new Error(`Lançamento falhou e foi desfeito: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Kit de operação: canais pedidos (ou pelos playbooks aplicados), acessos declarados e evidência vista no banco. */
async function loadProjectKit(supabase: Supabase, projectId: string, canaisText: string | null) {
  const { data: project } = await supabase.from("imphq_projects").select("id, name").eq("id", projectId).single();
  if (!project) throw new Error(`Projeto '${projectId}' não encontrado`);
  let canais = canaisText ? parseChannels(canaisText).canais : [];
  const invalidos = canaisText ? parseChannels(canaisText).invalidos : [];
  if (!canaisText) {
    const { data: apps } = await supabase.from("imphq_playbook_applications").select("playbook_id").eq("project_id", projectId);
    canais = channelsFromPlaybooks((apps ?? []).map((a) => a.playbook_id));
  }
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const month = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: igAccounts } = await supabase.from("imphq_ig_accounts").select("id").eq("project_id", projectId).eq("status", "active");
  const igIds = (igAccounts ?? []).map((a) => a.id);
  const [declaredRes, waRes, adsRes, eventsRes, salesRes, healthRes, dmRes] = await Promise.all([
    supabase.from("imphq_project_access").select("access_key, status, nota, owner_member_id, updated_at").eq("project_id", projectId),
    supabase.from("imphq_wa_providers").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_active", true),
    supabase.from("imphq_ads_spend").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("data_ref", week.slice(0, 10)),
    supabase.from("imphq_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", week),
    supabase.from("imphq_vendas").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", month),
    supabase.from("imphq_v_ads_sync_health").select("*").eq("project_id", projectId).maybeSingle(),
    igIds.length
      ? supabase.from("imphq_ig_conversations").select("id", { count: "exact", head: true }).in("account_id", igIds).gte("last_message_at", week)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (declaredRes.error) throw declaredRes.error;
  const kit = accessChecklist(canais, (declaredRes.data ?? []) as DeclaredAccess[], {
    whatsapp: (waRes.count ?? 0) > 0, instagram_dm: (dmRes.count ?? 0) > 0, ads_sync: (adsRes.count ?? 0) > 0, tracker: (eventsRes.count ?? 0) > 0, vendas: (salesRes.count ?? 0) > 0,
  });
  return {
    projeto: project, ...kit, canais_invalidos: invalidos,
    saude_sync_anuncios: healthRes.error ? null : adsSyncHealth(healthRes.data as AdsSyncHealthRow | null),
    canais_detalhe: CHANNELS.filter((c) => canais.includes(c.key)).map((c) => ({ key: c.key, label: c.label, playbooks: c.playbooks, ferramentas: c.ferramentas })),
    observacao: canais.length ? null : "Nenhum canal: informe 'canais' ou aplique um playbook no projeto.",
  };
}

/** Início do dia em Brasília (UTC-3), em ISO. */
function brtDayStart(daysAgo = 0): string {
  const brt = new Date(Date.now() - 3 * 3600000);
  const day = brt.toISOString().slice(0, 10);
  return new Date(Date.parse(`${day}T03:00:00.000Z`) - daysAgo * 86400000).toISOString();
}

function byCurrency(rows: ReadonlyArray<{ valor: number | null; data: unknown }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const d = r.data && typeof r.data === "object" ? (r.data as { moeda?: unknown }).moeda : null;
    const cur = typeof d === "string" && d.trim() ? d.trim().toUpperCase() : "BRL";
    out[cur] = Math.round(((out[cur] ?? 0) + Number(r.valor || 0)) * 100) / 100;
  }
  return out;
}

async function loadBriefing(supabase: Supabase, projectId: string) {
  const { data: project } = await supabase.from("imphq_projects").select("id, name").eq("id", projectId).single();
  if (!project) throw new Error(`Projeto '${projectId}' não encontrado`);
  const dayStart = brtDayStart();
  const monthStart = `${dayStart.slice(0, 7)}-01T03:00:00.000Z`;
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();

  const [nodesRes, archivedRes, salesRes, leadsRes, monthRes, hotRes, team, approvals] = await Promise.all([
    supabase.from("imphq_company_map_nodes")
      .select("id, map_id, label, kind, description, notes, checklist, position, executor_type, linked_skill_id, linked_project_id, stage_role, step_status, owner_member_id, due_date"),
    supabase.from("imphq_company_maps").select("id").not("archived_at", "is", null),
    supabase.from("imphq_vendas").select("project_id, valor, data").eq("project_id", projectId).eq("status", "aprovado").gte("data_venda", dayStart),
    supabase.from("imphq_leads").select("project_id").eq("project_id", projectId).gte("created_at", dayStart),
    supabase.from("imphq_vendas").select("valor, data").eq("project_id", projectId).eq("status", "aprovado").gte("data_venda", monthStart),
    supabase.from("imphq_vendas").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "aprovado").gte("data->>last_intent_at", twoHoursAgo),
    loadTeam(supabase),
    loadApprovals(supabase, projectId),
  ]);
  for (const res of [nodesRes, archivedRes, salesRes, leadsRes, monthRes]) if (res.error) throw res.error;
  const [journal, payments, adsRes] = await Promise.all([
    loadJournal(supabase, projectId, 7, 10),
    loadPaymentPulse(supabase, projectId),
    supabase.from("imphq_v_ads_sync_health").select("*").eq("project_id", projectId).maybeSingle(),
  ]);
  const archived = new Set((archivedRes.data ?? []).map((m) => m.id));
  const [board] = buildTodayBoard({
    projects: [project],
    nodes: ((nodesRes.data ?? []) as BoardNode[]).filter((n) => !archived.has(n.map_id)),
    salesToday: (salesRes.data ?? []) as BoardSale[],
    leadsToday: leadsRes.data ?? [],
    today: dayStart.slice(0, 10),
  });
  return buildProjectBriefing({
    project, board: board ?? null, approvals, team,
    numbers: { revenueMonth: byCurrency(monthRes.data ?? []), hotLeads: hotRes.count ?? 0 },
    journal, payments,
    ads: adsRes.error ? null : adsSyncHealth(adsRes.data as AdsSyncHealthRow | null),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Esta função usa a chave de administrador do banco: só atende quem tem a chave do MCP.
  const auth = checkMcpKey(req.headers, Deno.env.get("MCP_API_KEYS"));
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── 1. Tratamento MCP JSON-RPC ou REST via POST ──
  if (req.method === "POST") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-RPC/REST payload; each tool destructures and validates its own arguments
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    // Se for chamada JSON-RPC do protocolo MCP
    if (body.jsonrpc === "2.0") {
      const { id, method, params } = body;

      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: { tools: MCP_TOOLS },
        });
      }

      if (method === "tools/call") {
        const { name, arguments: args } = params || {};

        try {
          // TOOL: get_company_flow
          if (name === "get_company_flow") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const { data: proj } = await supabase.from("imphq_projects").select("id, name").eq("id", projectId).single();
            if (!proj) throw new Error(`Projeto '${projectId}' não encontrado`);

            const expectedMapName = `Mapa · ${proj.name}`;
            const { data: maps } = await supabase.from("imphq_company_maps").select("id, name");
            const targetMap = (maps || []).find(m => m.name.toLowerCase() === expectedMapName.toLowerCase() || m.name.toLowerCase().includes(proj.name.toLowerCase()));

            if (!targetMap) {
              return json({
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      message: `Nenhum mapa encontrado para o projeto '${proj.name}'. Você pode criar usando a ferramenta 'create_company_flow'.`,
                      projectId,
                      nodes: [],
                      edges: [],
                    }, null, 2),
                  }],
                },
              });
            }

            const [nodesRes, edgesRes] = await Promise.all([
              supabase.from("imphq_company_map_nodes").select("*").eq("map_id", targetMap.id),
              supabase.from("imphq_company_map_edges").select("*").eq("map_id", targetMap.id),
            ]);

            const flowData = {
              mapId: targetMap.id,
              mapName: targetMap.name,
              projectId,
              totalNodes: (nodesRes.data || []).length,
              totalEdges: (edgesRes.data || []).length,
              nodes: (nodesRes.data || []).map(n => ({
                id: n.id,
                label: n.label,
                kind: n.kind,
                color: n.color,
                description: n.description,
                product_name: (n.notes || "").match(/\[product_name:([^\]]+)\]/)?.[1] || null,
                url: n.url,
                position: n.position,
                checklist: n.checklist || [],
              })),
              edges: (edgesRes.data || []).map(e => ({
                id: e.id,
                source_id: e.source_id,
                target_id: e.target_id,
                label: e.label,
                style: e.style,
              })),
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(flowData, null, 2) }] },
            });
          }

          // TOOL: create_company_flow
          if (name === "create_company_flow") {
            const { project_id, map_name, strategy_preset, product_primary, nodes, edges, replace_existing = true } = args || {};
            if (!project_id) throw new Error("project_id é obrigatório");

            const { data: proj, error: projErr } = await supabase.from("imphq_projects").select("id, name, data").eq("id", project_id).single();
            if (projErr || !proj) throw new Error(`Projeto '${project_id}' não encontrado`);

            const finalMapName = map_name || `Mapa · ${proj.name}`;
            const projData = parseJson(proj.data);
            const availableProds = Array.isArray(projData.produtos) ? projData.produtos : [];
            const primaryProdName = product_primary || availableProds[0]?.nome || availableProds[0]?.name || proj.name;

            // 1. Encontra ou cria o mapa
            const { data: existingMaps } = await supabase.from("imphq_company_maps").select("id, name");
            let targetMapId = existingMaps?.find(m => m.name.toLowerCase() === finalMapName.toLowerCase())?.id;

            if (!targetMapId) {
              const { data: newMap, error: mapErr } = await supabase.from("imphq_company_maps").insert({ name: finalMapName }).select("id").single();
              if (mapErr || !newMap) throw new Error("Erro ao criar mapa no banco: " + mapErr?.message);
              targetMapId = newMap.id;
            }

            // 2. Se replace_existing, limpa nós e arestas anteriores
            if (replace_existing) {
              await supabase.from("imphq_company_map_edges").delete().eq("map_id", targetMapId);
              await supabase.from("imphq_company_map_nodes").delete().eq("map_id", targetMapId);
            }

            // 3. Monta rascunho de nós e arestas
            let draftNodes: DraftNode[] = [];
            let draftEdges: DraftEdge[] = [];

            if (strategy_preset && strategy_preset !== "custom") {
              const generated = buildStrategyPreset(strategy_preset, proj.name, primaryProdName);
              draftNodes = generated.nodes;
              draftEdges = generated.edges;
            } else if (Array.isArray(nodes) && nodes.length > 0) {
              draftNodes = nodes;
              draftEdges = Array.isArray(edges) ? edges : [];
            } else {
              const generated = buildStrategyPreset("vsl_perpetuo", proj.name, primaryProdName);
              draftNodes = generated.nodes;
              draftEdges = generated.edges;
            }

            // 4. Calcula coordenadas automáticas (Layout limpo em colunas)
            const colCounts: Record<number, number> = {};
            const keyToNodeId: Record<string, string> = {};
            const insertedNodesList: unknown[] = [];

            for (const dn of draftNodes) {
              const col = dn.col ?? getColumnForKind(dn.kind);
              const row = dn.row ?? (colCounts[col] || 0);
              colCounts[col] = row + 1;

              const x = col * 360 + 60;
              const y = row * 180 + 60;

              let finalNotes = "";
              const prodName = dn.product_name || (dn.kind === "checkout" ? primaryProdName : null);
              if (prodName) finalNotes += `[product_name:${prodName}]\n`;
              if (dn.executor) finalNotes += `[agent_executor:${dn.executor}]\n`;
              if (dn.skill) finalNotes += `[agent_skill:${dn.skill}]\n`;
              if (dn.prompt) finalNotes += `[agent_prompt_start]\n${dn.prompt}\n[agent_prompt_end]\n`;
              if (dn.description) finalNotes += dn.description;

              const checklistPayload = (dn.checklist || []).map(text => ({
                id: crypto.randomUUID(),
                text,
                done: false,
              }));

              const { data: createdNode, error: nodeErr } = await supabase.from("imphq_company_map_nodes").insert({
                map_id: targetMapId,
                label: dn.label,
                kind: dn.kind,
                color: KIND_COLORS[dn.kind] || "#c9922a",
                description: dn.description || null,
                notes: finalNotes.trim() || null,
                url: dn.url || null,
                position: { x, y },
                size: "M",
                checklist: checklistPayload,
                linked_project_id: project_id,
                show_live_kpis: true,
              }).select("id, label, kind, position").single();

              if (nodeErr) throw nodeErr;
              if (createdNode) {
                keyToNodeId[dn.key] = createdNode.id;
                keyToNodeId[dn.label] = createdNode.id; // alias
                insertedNodesList.push(createdNode);
              }
            }

            // 5. Conecta arestas
            const insertedEdgesList: unknown[] = [];
            for (const de of draftEdges) {
              const srcId = keyToNodeId[de.from] || keyToNodeId[de.from.toLowerCase()];
              const tgtId = keyToNodeId[de.to] || keyToNodeId[de.to.toLowerCase()];
              if (!srcId || !tgtId) continue;

              const { data: createdEdge } = await supabase.from("imphq_company_map_edges").insert({
                map_id: targetMapId,
                source_id: srcId,
                target_id: tgtId,
                label: de.label || null,
                style: de.style || "solid",
              }).select("id, source_id, target_id, label").single();

              if (createdEdge) insertedEdgesList.push(createdEdge);
            }

            return json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    message: `Mapa '${finalMapName}' gerado com sucesso para o projeto '${proj.name}'.`,
                    mapId: targetMapId,
                    totalNodes: insertedNodesList.length,
                    totalEdges: insertedEdgesList.length,
                    nodes: insertedNodesList,
                  }, null, 2),
                }],
              },
            });
          }

          // TOOL: get_project_map
          if (name === "get_capabilities") {
            const { tarefa, busca, prioridade, skill } = args || {};
            let caps = await loadCapabilities(supabase);
            if (skill) caps = capabilitiesForSkill(caps, String(skill));
            if (tarefa) caps = pickCapabilities(caps, [tarefa], caps.length);
            if (prioridade) caps = caps.filter((c) => c.prioridade === prioridade);
            if (busca) {
              const b = String(busca).toLowerCase();
              caps = caps.filter((c) => [c.nome, c.categoria, c.quando_usar, c.descricao].some((v) => (v || "").toLowerCase().includes(b)));
            }
            const payload = {
              tarefas: CAPABILITY_TASKS,
              total: caps.length,
              ferramentas: caps.map((c) => ({ id: c.id, nome: c.nome, url: c.url, categoria: c.categoria, quando_usar: c.quando_usar, serve_para: c.serve_para, skills: c.skills || [], prioridade: c.prioridade, licenca: c.licenca_nota })),
            };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } });
          }

          if (name === "list_playbooks") {
            const { id: playbookId, familia } = args || {};
            if (playbookId) {
              const [pbRes, stRes, apRes] = await Promise.all([
                supabase.from("imphq_playbooks").select("*").eq("id", playbookId).maybeSingle(),
                supabase.from("imphq_playbook_steps").select("*").eq("playbook_id", playbookId).order("ordem"),
                supabase.from("imphq_playbook_applications").select("project_id, map_id, status, created_at").eq("playbook_id", playbookId),
              ]);
              for (const res of [pbRes, stRes, apRes]) if (res.error) throw res.error;
              if (!pbRes.data) throw new Error(`Playbook '${playbookId}' não encontrado`);
              const pb = playbookFromRows(pbRes.data as PlaybookRow, (stRes.data || []) as PlaybookStepRow[]);
              return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ ...pb, aplicacoes: apRes.data || [] }, null, 2) }] } });
            }
            let q = supabase.from("imphq_playbooks").select("id, nome, familia, resumo, quando_usar, quando_evitar, horizonte, north_star, kpis, riscos, imphq_playbook_steps(count)").eq("ativo", true).order("familia");
            if (familia) q = q.eq("familia", familia);
            const [{ data: pbs, error: pbErr }, { data: apps, error: apErr }] = await Promise.all([
              q,
              supabase.from("imphq_playbook_applications").select("playbook_id, project_id, status"),
            ]);
            if (pbErr) throw pbErr;
            if (apErr) throw apErr;
            const payload = (pbs || []).map(({ imphq_playbook_steps: steps, ...p }) => ({
              ...p,
              familia_nome: FAMILY_LABEL[p.familia as keyof typeof FAMILY_LABEL] ?? p.familia,
              etapas: Array.isArray(steps) ? Number(steps[0]?.count ?? 0) : 0,
              aplicado_em: (apps || []).filter((a) => a.playbook_id === p.id).map((a) => ({ project_id: a.project_id, status: a.status })),
            }));
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } });
          }

          if (name === "apply_playbook") {
            const { project_id, playbook_id, map_id, produto, plataforma, conta, confirmar = false } = args || {};
            if (!project_id || !playbook_id) throw new Error("project_id e playbook_id são obrigatórios");
            const [projRes, pbRes, stRes, mapsRes] = await Promise.all([
              supabase.from("imphq_projects").select("id, name, data").eq("id", project_id).maybeSingle(),
              supabase.from("imphq_playbooks").select("*").eq("id", playbook_id).maybeSingle(),
              supabase.from("imphq_playbook_steps").select("*").eq("playbook_id", playbook_id).order("ordem"),
              supabase.from("imphq_company_maps").select("id, name, archived_at"),
            ]);
            for (const res of [projRes, pbRes, stRes, mapsRes]) if (res.error) throw res.error;
            if (!projRes.data) throw new Error(`Projeto '${project_id}' não encontrado`);
            if (!pbRes.data) throw new Error(`Playbook '${playbook_id}' não encontrado`);
            const proj = projRes.data;
            const map = map_id ? (mapsRes.data || []).find((m) => m.id === map_id) ?? null : findProjectMap(mapsRes.data || [], proj.name);
            if (!map) throw new Error(`Nenhum mapa de operação encontrado para '${proj.name}'. Informe map_id.`);

            const params: Record<string, string> = Object.fromEntries(
              Object.entries({ projeto: proj.name, produto: produto || proj.name, plataforma, conta }).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== ""),
            );

            const [nodesRes, framesRes, edgesRes] = await Promise.all([
              supabase.from("imphq_company_map_nodes").select("id, label, kind, position, height").eq("map_id", map.id),
              supabase.from("imphq_company_map_annotations").select("y, height").eq("map_id", map.id).eq("kind", "frame"),
              supabase.from("imphq_company_map_edges").select("source_id, target_id").eq("map_id", map.id),
            ]);
            for (const res of [nodesRes, framesRes, edgesRes]) if (res.error) throw res.error;
            const playbook = playbookFromRows(pbRes.data as PlaybookRow, (stRes.data || []) as PlaybookStepRow[]);
            const existingNodes = (nodesRes.data || []).map((n) => ({ id: n.id, label: n.label, kind: n.kind, position: parseJson(n.position), height: n.height }));
            const plan = planPlaybook(playbook, { nodes: existingNodes, frames: framesRes.data || [] }, params);
            const labelOf = new Map(existingNodes.map((n) => [n.id, n.label]));

            if (!confirmar) {
              const preview = {
                modo: "plano (nada foi gravado)",
                playbook: { id: playbook.id, nome: playbook.nome, north_star: playbook.north_star, kpis: playbook.kpis, riscos: playbook.riscos },
                mapa: { id: map.id, nome: map.name },
                parametros: params,
                secoes: plan.frames.map((f) => f.text),
                etapas: plan.nodes.map((n) => ({ ordem: n.stepOrdem, secao: n.stage_role, etapa: n.label, tipo: n.kind, executor: n.executor_type, skill: n.linked_skill_id, metrica: n.metrics_target, reaproveita: n.existingId ? labelOf.get(n.existingId) ?? n.existingId : null })),
                novas: plan.created,
                reaproveitadas: plan.reused,
                proximo_passo: "Para gravar no mapa, chame apply_playbook de novo com confirmar=true.",
              };
              return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(preview, null, 2) }] } });
            }

            const { error: snapErr } = await supabase.rpc("imphq_snapshot_company_map", { p_map_id: map.id, p_reason: `Antes de aplicar o playbook ${playbook.id} (MCP)` });
            if (snapErr) throw snapErr;
            const result = await writePlaybookPlan(plan, {
              playbook, mapId: map.id, projectId: proj.id, params, appliedBy: "mcp",
              existingEdges: new Set((edgesRes.data || []).map((e) => `${e.source_id}>${e.target_id}`)),
              newId: () => crypto.randomUUID(),
            }, {
              insertFrame: async (row) => { const { error } = await supabase.from("imphq_company_map_annotations").insert(row); if (error) throw error; },
              insertNode: async (row) => {
                const { data, error } = await supabase.from("imphq_company_map_nodes").insert(row).select("id").single();
                if (error) throw error;
                return data.id as string;
              },
              insertEdge: async (row) => { const { error } = await supabase.from("imphq_company_map_edges").insert(row); if (error) throw error; },
              insertApplication: async (row) => { const { error } = await supabase.from("imphq_playbook_applications").insert(row); if (error) throw error; },
            });
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ success: true, mapa: { id: map.id, nome: map.name }, ...result, backup: "snapshot do mapa salvo antes da gravação" }, null, 2) }] } });
          }

          if (name === "get_project_map") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");
            const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
            const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
            const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
              const { count: n, error } = await q;
              if (error) throw error;
              return n ?? 0;
            };

            const [projRes, compRes, nodesRes, salesRes, provRes, aiRes] = await Promise.all([
              supabase.from("imphq_projects").select("id, name, data, avatar").eq("id", projectId).maybeSingle(),
              supabase.from("imphq_competitors").select("name, url, oferta_principal, preco, mecanismo_unico, headline, paginas_funil").eq("project_id", projectId),
              supabase.from("imphq_company_map_nodes").select("label, url, kind, image_url").eq("linked_project_id", projectId),
              supabase.from("imphq_vendas").select("produto_nome").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", since30d),
              supabase.from("imphq_wa_providers").select("is_active").eq("project_id", projectId),
              supabase.from("imphq_wa_ai_config").select("enabled, draft_mode").eq("project_id", projectId),
            ]);
            for (const res of [projRes, compRes, nodesRes, salesRes, provRes, aiRes]) if (res.error) throw res.error;
            if (!projRes.data) throw new Error(`Projeto '${projectId}' não encontrado`);

            const [waIncoming30d, waOutgoing30d, funnelSessions7d] = await Promise.all([
              count(supabase.from("imphq_wa_messages").select("id, imphq_wa_conversations!inner(jid_suffix)", { count: "exact", head: true }).eq("project_id", projectId).eq("direction", "incoming").gte("created_at", since30d).or("jid_suffix.is.null,jid_suffix.neq.g.us", { referencedTable: "imphq_wa_conversations" })),
              count(supabase.from("imphq_wa_messages").select("id, imphq_wa_conversations!inner(jid_suffix)", { count: "exact", head: true }).eq("project_id", projectId).eq("direction", "outgoing").gte("created_at", since30d).or("jid_suffix.is.null,jid_suffix.neq.g.us", { referencedTable: "imphq_wa_conversations" })),
              // Sessões reais do funil (heartbeat não conta).
              supabase.rpc("imphq_funnel_sessions", { p_project_id: projectId, p_since: since7d }).then(({ data, error }) => {
                if (error) throw error;
                return Number(data ?? 0);
              }),
            ]);

            const sales: Record<string, number> = {};
            for (const s of salesRes.data || []) if (s.produto_nome) sales[s.produto_nome] = (sales[s.produto_nome] || 0) + 1;
            const aiConfigs = aiRes.data || [];

            const map = buildProjectMap({
              project: projRes.data,
              competitors: compRes.data || [],
              mapNodes: nodesRes.data || [],
              activity: {
                approvedSales30dByProduct: sales,
                waIncoming30d,
                waOutgoing30d,
                funnelSessions7d,
                activeWaProviders: (provRes.data || []).filter((p) => p.is_active).length,
                aiEnabled: aiConfigs.length ? aiConfigs.some((c) => c.enabled) : null,
                aiDraftMode: aiConfigs.length ? aiConfigs.every((c) => c.draft_mode) : null,
              },
            });

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(map, null, 2) }] },
            });
          }

          // TOOL: get_project_readiness
          if (name === "get_project_readiness") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const { data: proj } = await supabase.from("imphq_projects").select("id, name, category, data").eq("id", projectId).single();
            if (!proj) throw new Error(`Projeto '${projectId}' não encontrado`);

            const projData = parseJson(proj.data);
            const prods = Array.isArray(projData.produtos) ? projData.produtos : [];

            // Busca nós do mapa
            const { data: mapNodes } = await supabase.from("imphq_company_map_nodes").select("*").eq("linked_project_id", projectId);
            const { data: autos } = await supabase.from("imphq_automacoes").select("id, nome, ativo, trigger_tipo").eq("project_id", projectId);

            const hasMap = (mapNodes || []).length > 0;
            const hasProducts = prods.length > 0;
            const prodsWithCheckout = prods.filter((p) => p.checkout_url || p.link);
            const activeAutos = (autos || []).filter(a => a.ativo);

            // Coleta checklist de tarefas pendentes nos nós
            const pendingTasks: { node: string; task: string }[] = [];
            let totalTasks = 0;
            let doneTasks = 0;

            (mapNodes || []).forEach(n => {
              const list = Array.isArray(n.checklist) ? n.checklist : [];
              list.forEach((c) => {
                totalTasks++;
                if (c.done) doneTasks++;
                else pendingTasks.push({ node: n.label, task: c.text });
              });
            });

            // Score de prontidão (0 a 100)
            let score = 0;
            if (hasMap) score += 20;
            if (hasProducts) score += 15;
            if (prodsWithCheckout.length > 0) score += 25;
            if (activeAutos.length > 0) score += 20;
            if (totalTasks > 0) {
              score += Math.round((doneTasks / totalTasks) * 20);
            } else if (hasMap) {
              score += 20;
            }

            const readinessReport = {
              projectId,
              projectName: proj.name,
              category: proj.category,
              readinessScore: `${score}%`,
              status: score >= 80 ? "🟢 Pronto para Tráfego" : score >= 50 ? "🟡 Pendências Críticas" : "🔴 Em Estruturação",
              ativosProntos: {
                funilMapeado: hasMap ? `Sim (${(mapNodes || []).length} etapas)` : "Não mapeado ainda",
                produtosCadastrados: prods.map((p) => `${p.nome || p.name} (R$ ${p.preco || p.price || "—"})`),
                checkoutsAtivos: prodsWithCheckout.map((p) => ({ produto: p.nome || p.name, url: p.checkout_url || p.link })),
                automacoesWhatsAppAtivas: activeAutos.map(a => a.nome),
              },
              tarefasParaRodarTrafegoHoje: pendingTasks.length > 0 ? pendingTasks : [
                ...(!hasMap ? [{ node: "Funil", task: "Desenhar mapa do funil operacional" }] : []),
                ...(prodsWithCheckout.length === 0 ? [{ node: "Checkout", task: "Configurar URL de checkout do produto principal" }] : []),
                ...(activeAutos.length === 0 ? [{ node: "WhatsApp", task: "Ativar régua de recuperação de carrinho no OpenFlow" }] : []),
              ],
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(readinessReport, null, 2) }] },
            });
          }

          if (name === "list_projects") {
            const { data: projects, error } = await supabase
              .from("imphq_projects")
              .select("id, name, category, description, created_at, updated_at")
              .order("name");
            if (error) throw error;
            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] },
            });
          }

          if (name === "get_project_context") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const { data: project, error } = await supabase.from("imphq_projects").select("*").eq("id", projectId).single();
            if (error || !project) throw new Error(`Projeto '${projectId}' não encontrado`);

            const projectData = parseJson(project.data);
            const avatarData = parseJson(project.avatar);

            const dossier = {
              id: project.id,
              name: project.name,
              category: project.category,
              description: project.description,
              avatar: avatarData,
              mecanismo_unico: projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || null,
              produtos: projectData.produtos || [],
              checkouts: {
                links: projectData.links || [],
                checkout_principal: projectData.checkout_url || projectData.link_checkout || null,
              },
              pesquisa_voc: projectData.pesquisa || projectData.dossie || null,
              criativos: projectData.criativos || projectData.roteiros || null,
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(dossier, null, 2) }] },
            });
          }

          if (name === "get_project_metrics") {
            const projectId = args?.project_id;
            if (!projectId) throw new Error("project_id é obrigatório");

            const todayStr = new Date().toISOString().split("T")[0];
            const dayStartUtc = `${todayStr}T03:00:00.000Z`;

            const [leadsRes, vendasRes, waRes] = await Promise.all([
              supabase.from("imphq_leads").select("id, status, score", { count: "exact" }).eq("project_id", projectId).gte("criado_em", dayStartUtc),
              supabase.from("imphq_vendas").select("id, status, valor, produto_nome").eq("project_id", projectId).gte("created_at", dayStartUtc),
              supabase.from("imphq_wa_conversations").select("id, status, unread_count").eq("project_id", projectId),
            ]);

            const vendasHoje = vendasRes.data || [];
            const aprovadas = vendasHoje.filter(v => (v.status || "").toLowerCase() === "aprovado");
            const pendentes = vendasHoje.filter(v => (v.status || "").toLowerCase().includes("pend") || (v.status || "").toLowerCase().includes("pix"));
            const carrinhos = vendasHoje.filter(v => (v.status || "").toLowerCase().includes("carrinho"));

            const metrics = {
              projectId,
              hoje: {
                data: todayStr,
                leads_novos: leadsRes.count || 0,
                vendas_aprovadas: aprovadas.length,
                faturamento_hoje: aprovadas.reduce((s, v) => s + (Number(v.valor) || 0), 0),
                pix_pendentes: pendentes.length,
                carrinhos_abandonados: carrinhos.length,
              },
              whatsapp: {
                total_conversas: waRes.data?.length || 0,
                conversas_nao_lidas: (waRes.data || []).filter(c => (c.unread_count || 0) > 0).length,
              },
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }] },
            });
          }

          if (name === "get_project_leads") {
            const { project_id, status, limit = 20 } = args || {};
            let q = supabase
              .from("imphq_leads")
              .select("id, nome, telefone, status, score, criado_em, data")
              .eq("project_id", project_id)
              .order("criado_em", { ascending: false })
              .limit(limit);

            if (status) q = q.eq("status", status);
            const { data: leads, error } = await q;
            if (error) throw error;

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(leads || [], null, 2) }] },
            });
          }

          if (name === "update_project_layer") {
            const { project_id, layer, content } = args || {};
            const { data: project, error: getErr } = await supabase
              .from("imphq_projects")
              .select("data, avatar")
              .eq("id", project_id)
              .single();
            if (getErr || !project) throw new Error(`Projeto '${project_id}' não encontrado`);

            if (layer === "avatar") {
              const currentAvatar = parseJson(project.avatar);
              const updated = { ...currentAvatar, ...content };
              await supabase.from("imphq_projects").update({ avatar: updated }).eq("id", project_id);
            } else {
              const currentData = parseJson(project.data);
              const updated = { ...currentData, [layer]: content };
              await supabase.from("imphq_projects").update({ data: updated }).eq("id", project_id);
            }

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: `Camada '${layer}' do projeto '${project_id}' atualizada com sucesso.` }] },
            });
          }

          if (name === "get_executable_steps") {
            const { project_id, status = "open", executor, responsavel } = args || {};
            if (!project_id) throw new Error("project_id é obrigatório");

            const { data: proj } = await supabase.from("imphq_projects").select("id, name, data").eq("id", project_id).single();
            if (!proj) throw new Error(`Projeto '${project_id}' não encontrado`);

            const projData = parseJson(proj.data);
            const prods = Array.isArray(projData.produtos) ? projData.produtos : [];
            const primaryProd = prods[0]?.nome || prods[0]?.name || proj.name;

            const expectedMapName = `Mapa · ${proj.name}`;
            const { data: maps } = await supabase.from("imphq_company_maps").select("id, name");
            const targetMap = (maps || []).find(m => m.name.toLowerCase() === expectedMapName.toLowerCase() || m.name.toLowerCase().includes(proj.name.toLowerCase()));

            let q = supabase.from("imphq_company_map_nodes").select("*");
            if (targetMap) {
              q = q.or(`linked_project_id.eq.${project_id},map_id.eq.${targetMap.id}`);
            } else {
              q = q.eq("linked_project_id", project_id);
            }

            const { data: rawNodes, error: nodeErr } = await q;
            if (nodeErr) throw nodeErr;
            const [caps, team] = await Promise.all([loadCapabilities(supabase), loadTeam(supabase)]);

            // Número de cada etapa na ordem do fluxo (mesma regra do canvas: setas primeiro, depois posição).
            const stepMapIds = [...new Set((rawNodes || []).map(n => n.map_id))];
            const { data: rawEdges } = stepMapIds.length
              ? await supabase.from("imphq_company_map_edges").select("source_id, target_id, source_kind, target_kind").in("map_id", stepMapIds)
              : { data: [] };
            const stepOrder = orderSteps(
              (rawNodes || []).map(n => ({ id: n.id, kind: n.kind, position: n.position })),
              (rawEdges || [])
                .filter(e => e.source_kind !== "annotation" && e.target_kind !== "annotation")
                .map(e => ({ source: e.source_id, target: e.target_id })),
            );

            const parsedSteps = (rawNodes || []).map(n => {
              const notes = n.notes || "";
              // Ordem: marcação nas notas → campo da etapa (canvas / Flow Brain) → palpite pelo tipo.
              const nExec = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || n.executor_type ||
                (n.kind === "anuncio" ? "ai_higgsfield" :
                 n.kind === "vsl" || n.kind === "pagina_vendas" ? "ai_copywriter" :
                 n.kind === "whatsapp" ? "openflow" :
                 n.kind === "checkout" ? "human_traffic" : "human_general");

              const nSkill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || n.linked_skill_id ||
                (nExec === "ai_higgsfield" ? "skill-black-belt" :
                 nExec === "ai_copywriter" ? "rebel-copy" :
                 nExec === "openflow" ? "roteiros-virais-comment-to-dm" :
                 nExec === "human_traffic" ? "briefing-gestor-trafego" : "none");

              const executionStatus = readStepStatus(n);

              const multiPrompt = notes.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
              const singlePrompt = notes.match(/\[agent_prompt:([^\]]+)\]/);
              const prompt = multiPrompt ? multiPrompt[1].trim() : singlePrompt ? singlePrompt[1].trim() :
                `Executar etapa '${n.label}' para o produto '${primaryProd}'. Objetivo: ${n.description || n.label}`;

              const output_url = notes.match(/\[agent_output:([^\]]+)\]/)?.[1] || n.url || null;

              const printMeta = n.print_meta && typeof n.print_meta === "object" ? n.print_meta : null;
              return {
                step_number: stepOrder.get(n.id) ?? null,
                node_id: n.id,
                label: n.label,
                kind: n.kind,
                stage_role: n.stage_role || null,
                executor: nExec,
                skill: nSkill,
                ...executionStatus,
                ...ownerFields(n, team, executionStatus.status),
                prompt,
                checklist: n.checklist || [],
                output_url,
                product_context: primaryProd,
                contract: readStageContract(n),
                // Print da página da etapa (scripts/map-prints.mjs): mostra como ela está hoje.
                print: printMeta ? { desktop: printMeta.desktop ?? null, mobile: printMeta.mobile ?? null, captured_at: printMeta.captured_at ?? null } : null,
                ferramentas: toolsForStep(caps, n.kind, nSkill),
              };
            }).sort((a, b) => (a.step_number ?? 9999) - (b.step_number ?? 9999));

            let filtered = parsedSteps;
            if (status && status !== "all") {
              filtered = filtered.filter(s => status === "open" ? s.status !== "done" : s.status === status);
            }
            if (executor) {
              filtered = filtered.filter(s => s.executor.toLowerCase().includes(executor.toLowerCase()));
            }
            if (responsavel) {
              const who = String(responsavel);
              const member = who === "sem_dono" ? null : findMember(team, who);
              if (who !== "sem_dono" && !member) throw new Error(`Responsável '${who}' não está no time (imphq_team_members)`);
              filtered = filtered.filter(s => (member ? s.responsavel?.id === member.id : !s.responsavel));
            }

            const responsePayload = {
              projectId: project_id,
              projectName: proj.name,
              totalSteps: parsedSteps.length,
              pendingCount: parsedSteps.filter(s => s.status === "pending").length,
              steps: filtered,
            };

            return json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(responsePayload, null, 2) }] },
            });
          }

          if (name === "assign_step") {
            const { node_id, responsavel, prazo } = args || {};
            if (!node_id) throw new Error("node_id é obrigatório");
            if (responsavel === undefined && prazo === undefined) throw new Error("Informe responsavel e/ou prazo");
            const patch: Record<string, unknown> = {};
            let team: TeamMember[] = [];
            if (responsavel !== undefined) {
              const who = String(responsavel).trim();
              if (!who || who.toLowerCase() === "ninguem" || who.toLowerCase() === "ninguém") patch.owner_member_id = null;
              else {
                team = await loadTeam(supabase);
                const member = findMember(team, who);
                if (!member) throw new Error(`Responsável '${who}' não está no time. Time: ${team.map((m) => m.name).join(", ")}`);
                patch.owner_member_id = member.id;
              }
            }
            if (prazo !== undefined) {
              const day = String(prazo).trim();
              if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("prazo deve ser AAAA-MM-DD");
              patch.due_date = day || null;
            }
            const { data: updated, error: updErr } = await supabase.from("imphq_company_map_nodes").update(patch).eq("id", node_id)
              .select("id, label, owner_member_id, due_date, step_status").maybeSingle();
            if (updErr) throw updErr;
            if (!updated) throw new Error(`Etapa '${node_id}' não encontrada`);
            if (!team.length) team = await loadTeam(supabase);
            const payload = { success: true, etapa: updated.label, ...ownerFields(updated, team, updated.step_status || "pending") };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } });
          }

          if (name === "complete_step") {
            const { node_id, status = "done", output_url, notes_append, mark_checklist_done = true } = args || {};
            if (!node_id) throw new Error("node_id é obrigatório");

            const { data: node, error: getErr } = await supabase.from("imphq_company_map_nodes").select("*").eq("id", node_id).single();
            if (getErr || !node) throw new Error(`Nó '${node_id}' não encontrado`);

            let notes = node.notes || "";
            notes = notes.replace(/\[agent_status:[^\]]*\]/g, "").replace(/\[agent_output:[^\]]*\]/g, "").trim();
            notes += `\n[agent_status:${status}]`;
            if (output_url) notes += `\n[agent_output:${output_url}]`;
            if (notes_append) notes += `\n\n${notes_append}`;

            let updatedChecklist = node.checklist;
            if (mark_checklist_done && Array.isArray(node.checklist)) {
              updatedChecklist = node.checklist.map((c) => ({ ...c, done: true }));
            }

            const updatePayload: Record<string, unknown> = {
              notes: notes.trim(),
              checklist: updatedChecklist,
              step_status: status,
              status_changed_at: new Date().toISOString(),
              status_changed_by: "mcp",
            };
            if (output_url && !node.url) {
              updatePayload.url = output_url;
            }

            const { data: updatedNode, error: updateErr } = await supabase
              .from("imphq_company_map_nodes")
              .update(updatePayload)
              .eq("id", node_id)
              .select("id, label, kind, notes, checklist, url")
              .single();

            if (updateErr) throw updateErr;

            return json({
              jsonrpc: "2.0",
              id,
              result: {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    node_id,
                    label: updatedNode.label,
                    status,
                    output_url: output_url || updatedNode.url,
                    message: `Etapa '${updatedNode.label}' atualizada para status '${status}' com sucesso!`,
                  }, null, 2),
                }],
              },
            });
          }

          if (name === "get_approvals") {
            const items = await loadApprovals(supabase, args?.project_id || null);
            const limit = Math.max(1, Math.min(Number(args?.limit) || 30, 200));
            const result = { total: items.length, por_origem: approvalCounts(items), itens: items.slice(0, limit).map((i) => approvalLine(i)) };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "decide_approval") {
            const { key, decision, motivo, confirmado_por, resposta } = args || {};
            if (!key || !["approve", "reject", "mark_paid"].includes(String(decision))) throw new Error("key e decision ('approve', 'reject' ou 'mark_paid') são obrigatórios");
            const result = await decideApproval(supabase, String(key), decision as ApprovalDecision, {
              motivo: motivo ? String(motivo) : undefined,
              confirmadoPor: confirmado_por ? String(confirmado_por) : undefined,
              resposta: resposta ? String(resposta) : undefined,
            });
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ success: true, ...result }, null, 2) }] } });
          }

          if (name === "get_autonomy") {
            const overrides = await loadAutonomyOverrides(supabase);
            const result = {
              niveis: AUTONOMY_LABEL,
              regra: "auto = a IA decide; aprovar = só com confirmado_por (alguém do time que deu o OK); nunca = só na tela, por uma pessoa.",
              acoes: AUTONOMY_RULES.map((r) => {
                const nivel = effectiveAutonomy(r.key, overrides.get(r.key));
                return { acao: r.key, o_que: r.label, nivel, nivel_texto: AUTONOMY_LABEL[nivel], teto: r.teto, motivo: r.motivo };
              }),
            };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_journal") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const dias = Math.max(1, Math.min(Number(args.dias) || 7, 90));
            const limit = Math.max(1, Math.min(Number(args.limit) || 50, 300));
            const rows = await loadJournal(supabase, String(args.project_id), dias, limit);
            const result = { project_id: args.project_id, dias, total: rows.length, diario: rows.map((j) => ({ quando: j.created_at, acao: j.action, quem: j.actor, o_que: j.entity_name, detalhes: j.details })) };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }


          if (name === "evaluate_scale") {
            const result = evaluateScale(args || {});
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_scale_rounds") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const limit = Math.max(1, Math.min(Number(args.limit) || 10, 50));
            let query = supabase.from("imphq_scale_rounds").select("id, node_id, fase, rodada, params, data, resultado, resumo, created_by, updated_at")
              .eq("project_id", String(args.project_id)).order("updated_at", { ascending: false }).limit(limit);
            if (args.fase) query = query.eq("fase", String(args.fase));
            const { data: rounds, error } = await query;
            if (error) throw error;
            const result = { project_id: args.project_id, rodadas: rounds ?? [], placar_hipoteses: hypothesisBoard(rounds ?? []) };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "launch_project") {
            const result = await launchProject(supabase, args || {});
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_project_kit") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const result = await loadProjectKit(supabase, String(args.project_id), args.canais ? String(args.canais) : null);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "set_project_access") {
            const { project_id, acesso, status, nota, responsavel } = args || {};
            if (!project_id || !acesso || !status) throw new Error("project_id, acesso e status são obrigatórios");
            if (!ACCESS_BY_KEY.has(String(acesso))) throw new Error(`Acesso '${acesso}' desconhecido. Chaves: ${[...ACCESS_BY_KEY.keys()].join(", ")}`);
            if (!(String(status) in ACCESS_STATUS_LABEL)) throw new Error(`Status inválido: use ${Object.keys(ACCESS_STATUS_LABEL).join(", ")}`);
            let ownerId: string | undefined;
            if (responsavel) {
              const member = findMember(await loadTeam(supabase), String(responsavel));
              if (!member) throw new Error(`Ninguém do time com '${responsavel}'`);
              ownerId = member.id;
            }
            const row: Record<string, unknown> = { project_id: String(project_id), access_key: String(acesso), status: String(status), updated_by: "mcp", updated_at: new Date().toISOString() };
            if (nota) row.nota = String(nota);
            if (ownerId) row.owner_member_id = ownerId;
            const { error } = await supabase.from("imphq_project_access").upsert(row, { onConflict: "project_id,access_key" });
            if (error) throw error;
            const result = { success: true, acesso: ACCESS_BY_KEY.get(String(acesso))?.label, status: ACCESS_STATUS_LABEL[String(status) as keyof typeof ACCESS_STATUS_LABEL] };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "create_test_order") {
            const result = await createTestOrder(supabase, args || {});
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "generate_creative_variations") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const result = await generateCreativeVariations(supabase, args);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_creative_batch") {
            if (!args?.batch_id) throw new Error("batch_id é obrigatório");
            const result = await getCreativeBatch(supabase, String(args.batch_id));
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_test_order") {
            if (!args?.id) throw new Error("id é obrigatório");
            const { order, variants } = await loadTestOrder(supabase, String(args.id));
            const plan = { nome_campanha: `[${order.project_id}] ${order.nome} — teste de ângulos ABO`, variantes: variants.map((v) => ({ ...v, nome_conjunto: `${String(v.ordem).padStart(2, "0")} ${v.angulo}`, nome_anuncio: v.utm_content })) };
            const result = { ordem: order, variantes: variants, passos: launchSteps({ ...order, verba_dia_conjunto: Number(order.verba_dia_conjunto) }, plan as unknown as Parameters<typeof launchSteps>[1]), dias_no_ar: order.ativado_em ? Math.round(((Date.now() - Date.parse(order.ativado_em)) / 86400000) * 10) / 10 : 0 };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "create_page_split") {
            if (!args?.project_id || !args?.nome || !Array.isArray(args.variantes)) throw new Error("project_id, nome e variantes são obrigatórios");
            const list = normalizeVariants((args.variantes as Array<Record<string, unknown>>).map((v, i) => ({ key: String.fromCharCode(65 + i), url: v.url, peso: v.peso ?? 1 }))).slice(0, 3);
            if (list.length < 2) throw new Error("Pelo menos 2 páginas com link completo (https://…)");
            const slug = `${slugify(String(args.nome))}-${Math.random().toString(36).slice(2, 6)}`;
            const { error } = await supabase.from("imphq_page_splits").insert({ project_id: String(args.project_id), slug, nome: String(args.nome), variantes: list, created_by: "claude (MCP)" });
            if (error) throw error;
            const link = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/split/${slug}`;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ slug, link, variantes: list, aviso: "As páginas precisam do rastreador do Império para medir visitas e cliques." }, null, 2) }] } });
          }

          if (name === "get_page_splits") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const pid = String(args.project_id);
            const { data: splits, error } = await supabase.from("imphq_page_splits").select("id, slug, nome, status, vencedor, variantes, created_at").eq("project_id", pid).order("created_at", { ascending: false }).limit(20);
            if (error) throw error;
            if (!splits?.length) return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total: 0, testes: [] }) }] } });
            const since = splits.reduce((m: string, x: { created_at: string }) => (x.created_at < m ? x.created_at : m), splits[0].created_at);
            const [countsRes, pagesRes] = await Promise.all([
              supabase.rpc("imphq_split_counts", { p_split_ids: splits.map((x: { id: string }) => x.id) }),
              supabase.rpc("imphq_page_metrics", { p_project_id: pid, p_since: since }),
            ]);
            const counts = (countsRes.data ?? []) as Array<{ split_id: string; variante: string; enviados: number }>;
            const pages: Record<string, PageMetricValues> = Object.fromEntries((((pagesRes.data as { pages?: Array<{ url: string; values: PageMetricValues }> } | null)?.pages) ?? []).map((p) => [pageKey(p.url), p.values]));
            const testes = splits.map((x: { id: string; slug: string; nome: string; status: string; vencedor: string | null; variantes: unknown }) => {
              const v = normalizeVariants(x.variantes);
              const hits = Object.fromEntries(counts.filter((c) => c.split_id === x.id).map((c) => [c.variante, Number(c.enviados)]));
              return { slug: x.slug, nome: x.nome, status: x.status, vencedor_definido: x.vencedor, link: `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/split/${x.slug}`, ...splitReport(v, hits, pages) };
            });
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total: testes.length, testes }, null, 2) }] } });
          }

          if (name === "end_page_split") {
            if (!args?.slug) throw new Error("slug é obrigatório");
            const vencedor = args.vencedor ? String(args.vencedor).toUpperCase() : null;
            const { data, error } = await supabase.from("imphq_page_splits").update({ status: "encerrado", vencedor, updated_at: new Date().toISOString() }).eq("slug", String(args.slug)).select("slug, status, vencedor");
            if (error) throw error;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ atualizado: data ?? [] }, null, 2) }] } });
          }

          if (name === "get_funnel_live") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const pid = String(args.project_id);
            const dias = Math.min(90, Math.max(1, Number(args.dias) || 7));
            const since = new Date(Date.now() - dias * 86400000).toISOString();
            const [adsRes, salesRes, pagesRes] = await Promise.all([
              supabase.from("imphq_ads_spend").select("spend, impressoes, link_clicks, cliques, init_checkout, purchases").eq("project_id", pid).gte("date", since.slice(0, 10)).limit(5000),
              supabase.from("imphq_vendas").select("status, valor, valor_liquido, tipo_venda, produto_nome, data, external_transaction_id").eq("project_id", pid).gte("created_at", since).limit(5000),
              supabase.rpc("imphq_page_metrics", { p_project_id: pid, p_since: since }),
            ]);
            if (adsRes.error) throw adsRes.error;
            if (salesRes.error) throw salesRes.error;
            const all = (salesRes.data ?? []) as FunnelSaleRow[];
            const txs = new Set(all.filter((v) => v.produto_nome === String(args.produto)).map((v) => v.external_transaction_id).filter(Boolean));
            const sales = args.produto ? all.filter((v) => v.produto_nome === String(args.produto) || ((v.tipo_venda ?? "principal") !== "principal" && txs.has(v.external_transaction_id))) : all;
            const pages = ((pagesRes.data as { pages?: FunnelPageRow[] } | null)?.pages ?? []).filter((p) => Number(p.values?.sessoes_pagina ?? 0) > 0);
            const result = { projeto: pid, produto: args.produto ?? "todos", dias, produtos: [...new Set(all.map((v) => v.produto_nome).filter(Boolean))], ...buildFunnelLive({ ads: (adsRes.data ?? []) as FunnelAdsRow[], pages, sales }) };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_copy_library") {
            const full = args?.completo === true || (Array.isArray(args?.ids) && args.ids.length > 0);
            let q = supabase.from("imphq_copy_library").select(full ? "*" : "id, biblioteca, numero, categoria, nome").order("ordem");
            if (args?.biblioteca) q = q.eq("biblioteca", String(args.biblioteca));
            if (args?.categoria) q = q.eq("categoria", String(args.categoria));
            if (Array.isArray(args?.ids) && args.ids.length) q = q.in("id", args.ids.map(String));
            if (args?.busca) {
              const b = String(args.busca).replace(/[%,()]/g, " ").trim();
              if (b) q = q.or(`nome.ilike.%${b}%,explicacao.ilike.%${b}%`);
            }
            const { data, error } = await q;
            if (error) throw error;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total: (data ?? []).length, fonte: "@renanmsap (uso interno)", itens: data ?? [] }, null, 2) }] } });
          }

          if (name === "tag_test_variants") {
            if (!args?.order_id || !Array.isArray(args.variantes)) throw new Error("order_id e variantes são obrigatórios");
            const libIds = args.variantes.map((v: { copy_lib_id?: string }) => v.copy_lib_id).filter(Boolean).map(String);
            if (libIds.length) {
              const { data: found } = await supabase.from("imphq_copy_library").select("id").in("id", libIds);
              const missing = libIds.filter((x: string) => !(found ?? []).some((f: { id: string }) => f.id === x));
              if (missing.length) throw new Error(`Ângulo(s) fora da biblioteca: ${missing.join(", ")}. Consulte get_copy_library.`);
            }
            const updated: Array<Record<string, unknown>> = [];
            for (const v of args.variantes as Array<{ ordem: number; metodo?: string; copy_lib_id?: string }>) {
              const patch: Record<string, unknown> = {};
              if (v.metodo !== undefined) patch.metodo = normalizeMetodo(v.metodo);
              if (v.copy_lib_id !== undefined) patch.copy_lib_id = v.copy_lib_id || null;
              if (!Object.keys(patch).length) continue;
              const { data, error } = await supabase.from("imphq_test_variants").update(patch).eq("order_id", String(args.order_id)).eq("ordem", Number(v.ordem)).select("ordem, angulo, metodo, copy_lib_id");
              if (error) throw error;
              updated.push(...(data ?? []));
            }
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ atualizadas: updated.length, variantes: updated }, null, 2) }] } });
          }

          if (name === "get_method_scoreboard") {
            const result = await loadMethodScoreboard(supabase, (args ?? {}) as Record<string, unknown>);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "list_mining_sources") {
            let q = supabase.from("imphq_mining_sources").select("id, project_id, tipo, valor, pais, limite, ativo, ultima_execucao, ultimo_resultado").order("created_at", { ascending: false });
            if (args?.project_id) q = q.eq("project_id", String(args.project_id));
            const { data, error } = await q;
            if (error) throw error;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total: (data ?? []).length, fontes: data ?? [] }, null, 2) }] } });
          }

          if (name === "add_mining_source") {
            const valor = String(args?.valor ?? "").trim();
            if (!args?.project_id || !valor || !["palavra", "pagina", "url"].includes(String(args?.tipo))) throw new Error("project_id, tipo (palavra|pagina|url) e valor são obrigatórios");
            const limite = Math.min(50, Math.max(1, Number(args?.limite) || 15));
            const { data, error } = await supabase.from("imphq_mining_sources").insert({ project_id: String(args.project_id), tipo: String(args.tipo), valor, pais: String(args?.pais ?? "BR").toUpperCase(), limite, created_by: "mcp" }).select("id, project_id, tipo, valor, pais, limite").single();
            if (error) throw new Error(error.code === "23505" ? "Essa fonte já existe neste projeto" : error.message);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ criada: data, proxima_rodada: "diária às 06:15 BRT (ou run_mining agora)" }, null, 2) }] } });
          }

          if (name === "run_mining") {
            if (!args?.source_id) throw new Error("source_id é obrigatório");
            const { data, error } = await supabase.functions.invoke("ref-mining", { body: { modo: "source", source_id: String(args.source_id) } });
            if (error) throw error;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } });
          }

          if (name === "list_test_orders") {
            let q = supabase.from("imphq_test_orders").select("id, project_id, nome, oferta, status, verba_dia_conjunto, utm_campaign, meta_campaign_id, ativado_em, corte_autorizado_por, corte_ate, ultima_avaliacao, created_at").order("created_at", { ascending: false }).limit(50);
            if (args?.project_id) q = q.eq("project_id", String(args.project_id));
            if (args?.status) q = q.eq("status", String(args.status));
            const { data, error } = await q;
            if (error) throw error;
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ total: (data ?? []).length, testes: data ?? [] }, null, 2) }] } });
          }

          if (name === "record_test_launch") {
            if (!args?.id) throw new Error("id é obrigatório");
            const result = await recordTestLaunch(supabase, args);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "evaluate_test_order") {
            if (!args?.id || !Array.isArray(args.leituras)) throw new Error("id e leituras são obrigatórios");
            const result = await evaluateTestOrderTool(supabase, args);
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_live_panel") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const projectId = String(args.project_id);
            const [panel, snaps] = await Promise.all([
              loadProjectLivePanel(supabase as unknown as LiveDb, projectId),
              supabase.from("imphq_live_snapshots").select("taken_at, gasto, faturamento, vendas, cpa, zona, painel")
                .eq("project_id", projectId).eq("dia", brtDay().day).order("taken_at", { ascending: true }).limit(200),
            ]);
            if (snaps.error) throw snaps.error;
            const rows = snaps.data ?? [];
            const current = JSON.stringify(panel.parcial);
            const base = [...rows].reverse().find((r) => JSON.stringify((r.painel as LivePanel).parcial) !== current) ?? null;
            const result = {
              projeto: projectId, ...panel,
              variacao: base ? { desde: base.taken_at, ...liveDelta(panel, base.painel as LivePanel) } : null,
              leituras_do_dia: rows.map(({ painel: _p, ...r }) => r),
            };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          if (name === "get_briefing") {
            if (!args?.project_id) throw new Error("project_id é obrigatório");
            const result = await loadBriefing(supabase, String(args.project_id));
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
          }

          throw new Error(`Ferramenta desconhecida: ${name}`);
        } catch (err) {
          return json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: (err instanceof Error ? err.message : "") || "Internal error" },
          });
        }
      }
    }

    // ── Chamadas REST Diretas via POST ──
    const action = url.searchParams.get("action") || body.action;
    const projectId = url.searchParams.get("project_id") || body.project_id;

    if (action === "create_flow" && projectId) {
      const { strategy_preset = "vsl_perpetuo", product_primary, map_name, replace_existing = true } = body;
      const { data: proj } = await supabase.from("imphq_projects").select("id, name, data").eq("id", projectId).single();
      if (!proj) return json({ error: "Projeto não encontrado" }, 404);

      const finalMapName = map_name || `Mapa · ${proj.name}`;
      const { data: existingMaps } = await supabase.from("imphq_company_maps").select("id, name");
      let targetMapId = existingMaps?.find(m => m.name.toLowerCase() === finalMapName.toLowerCase())?.id;

      if (!targetMapId) {
        const { data: newMap } = await supabase.from("imphq_company_maps").insert({ name: finalMapName }).select("id").single();
        targetMapId = newMap?.id;
      }

      if (replace_existing && targetMapId) {
        await supabase.from("imphq_company_map_edges").delete().eq("map_id", targetMapId);
        await supabase.from("imphq_company_map_nodes").delete().eq("map_id", targetMapId);
      }

      const generated = buildStrategyPreset(strategy_preset, proj.name, product_primary);
      const keyToId: Record<string, string> = {};
      const createdNodes = [];

      for (const dn of generated.nodes) {
        const col = dn.col ?? 0;
        const row = dn.row ?? 0;
        const x = col * 360 + 60;
        const y = row * 180 + 60;

        let notes = dn.product_name ? `[product_name:${dn.product_name}]\n` : "";
        if (dn.executor) notes += `[agent_executor:${dn.executor}]\n`;
        if (dn.skill) notes += `[agent_skill:${dn.skill}]\n`;
        if (dn.prompt) notes += `[agent_prompt_start]\n${dn.prompt}\n[agent_prompt_end]\n`;
        if (dn.description) notes += dn.description;

        const { data: n } = await supabase.from("imphq_company_map_nodes").insert({
          map_id: targetMapId,
          label: dn.label,
          kind: dn.kind,
          color: KIND_COLORS[dn.kind] || "#c9922a",
          description: dn.description || null,
          notes: notes.trim() || null,
          position: { x, y },
          size: "M",
          checklist: (dn.checklist || []).map(t => ({ id: crypto.randomUUID(), text: t, done: false })),
          linked_project_id: projectId,
          show_live_kpis: true,
        }).select("id, label, kind, position").single();

        if (n) {
          keyToId[dn.key] = n.id;
          createdNodes.push(n);
        }
      }

      for (const de of generated.edges) {
        const srcId = keyToId[de.from];
        const tgtId = keyToId[de.to];
        if (srcId && tgtId) {
          await supabase.from("imphq_company_map_edges").insert({
            map_id: targetMapId,
            source_id: srcId,
            target_id: tgtId,
            label: de.label || null,
            style: de.style || "solid",
          });
        }
      }

      return json({
        success: true,
        mapId: targetMapId,
        mapName: finalMapName,
        nodesCreated: createdNodes.length,
      });
    }

    if (action === "update" && projectId) {
      const { layer, content } = body;
      const { data: project } = await supabase.from("imphq_projects").select("data, avatar").eq("id", projectId).single();
      if (!project) return json({ error: "Projeto não encontrado" }, 404);

      if (layer === "avatar") {
        await supabase.from("imphq_projects").update({ avatar: { ...parseJson(project.avatar), ...content } }).eq("id", projectId);
      } else {
        await supabase.from("imphq_projects").update({ data: { ...parseJson(project.data), [layer]: content } }).eq("id", projectId);
      }
      return json({ success: true, message: `Camada ${layer} atualizada` });
    }

    if (action === "executable_steps" && projectId) {
      const { status = "open", executor } = body;
      const { data: proj } = await supabase.from("imphq_projects").select("id, name").eq("id", projectId).single();
      const expectedMapName = proj ? `Mapa · ${proj.name}` : "";
      const { data: maps } = await supabase.from("imphq_company_maps").select("id, name");
      const targetMap = (maps || []).find(m => m.name.toLowerCase() === expectedMapName.toLowerCase() || (proj && m.name.toLowerCase().includes(proj.name.toLowerCase())));

      let q = supabase.from("imphq_company_map_nodes").select("*");
      if (targetMap) {
        q = q.or(`linked_project_id.eq.${projectId},map_id.eq.${targetMap.id}`);
      } else {
        q = q.eq("linked_project_id", projectId);
      }

      const { data: rawNodes } = await q;
      const [caps, team] = await Promise.all([loadCapabilities(supabase), loadTeam(supabase)]);
      const parsedSteps = (rawNodes || []).map(n => {
        const notes = n.notes || "";
        const nExec = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || n.executor_type || "human_general";
        const nSkill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || n.linked_skill_id || "none";
        const executionStatus = readStepStatus(n);
        const multiPrompt = notes.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
        const singlePrompt = notes.match(/\[agent_prompt:([^\]]+)\]/);
        const prompt = multiPrompt ? multiPrompt[1].trim() : singlePrompt ? singlePrompt[1].trim() : n.description || n.label;
        const output_url = notes.match(/\[agent_output:([^\]]+)\]/)?.[1] || n.url || null;

        return {
          node_id: n.id,
          label: n.label,
          kind: n.kind,
          executor: nExec,
          skill: nSkill,
          ...executionStatus,
                ...ownerFields(n, team, executionStatus.status),
          prompt,
          checklist: n.checklist || [],
          output_url,
          contract: readStageContract(n),
          ferramentas: toolsForStep(caps, n.kind, nSkill),
        };
      });

      let filtered = parsedSteps;
      if (status && status !== "all") filtered = filtered.filter(s => status === "open" ? s.status !== "done" : s.status === status);
      if (executor) filtered = filtered.filter(s => s.executor.toLowerCase().includes(executor.toLowerCase()));

      return json({
        projectId,
        totalSteps: parsedSteps.length,
        pendingCount: parsedSteps.filter(s => s.status === "pending").length,
        steps: filtered,
      });
    }

    if (action === "complete_step") {
      const { node_id, status = "done", output_url, notes_append, mark_checklist_done = true } = body;
      if (!node_id) return json({ error: "node_id é obrigatório" }, 400);

      const { data: node } = await supabase.from("imphq_company_map_nodes").select("*").eq("id", node_id).single();
      if (!node) return json({ error: "Nó não encontrado" }, 404);

      let notes = node.notes || "";
      notes = notes.replace(/\[agent_status:[^\]]*\]/g, "").replace(/\[agent_output:[^\]]*\]/g, "").trim();
      notes += `\n[agent_status:${status}]`;
      if (output_url) notes += `\n[agent_output:${output_url}]`;
      if (notes_append) notes += `\n\n${notes_append}`;

      let updatedChecklist = node.checklist;
      if (mark_checklist_done && Array.isArray(node.checklist)) {
        updatedChecklist = node.checklist.map((c) => ({ ...c, done: true }));
      }

      const updatePayload: Record<string, unknown> = {
        notes: notes.trim(), checklist: updatedChecklist,
        step_status: status, status_changed_at: new Date().toISOString(), status_changed_by: "mcp",
      };
      if (output_url && !node.url) updatePayload.url = output_url;

      const { data: updatedNode, error: updateErr } = await supabase
        .from("imphq_company_map_nodes")
        .update(updatePayload)
        .eq("id", node_id)
        .select("*")
        .single();

      if (updateErr) return json({ error: updateErr.message }, 500);

      return json({ success: true, node: updatedNode });
    }

    return json({ error: "Ação não suportada" }, 400);
  }

  // ── 2. Tratamento REST via GET ──
  const projectId = url.searchParams.get("project_id");
  const action = url.searchParams.get("action") || "context";

  if (!projectId) {
    const { data: projects } = await supabase.from("imphq_projects").select("id, name, category, description").order("name");
    return json({
      endpoints: {
        mcp_post: `${SUPABASE_URL}/functions/v1/project-mcp`,
        context_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=context`,
        readiness_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=readiness`,
        flow_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=flow`,
        prompt_get: `${SUPABASE_URL}/functions/v1/project-mcp?project_id={id}&action=markdown`,
      },
      projects: projects || [],
    });
  }

  const { data: project } = await supabase.from("imphq_projects").select("*").eq("id", projectId).single();
  if (!project) return json({ error: `Projeto '${projectId}' não encontrado` }, 404);

  const projectData = parseJson(project.data);
  const avatarData = parseJson(project.avatar);

  // Retorna Prontidão Operacional
  if (action === "readiness") {
    const prods = Array.isArray(projectData.produtos) ? projectData.produtos : [];
    const { data: mapNodes } = await supabase.from("imphq_company_map_nodes").select("*").eq("linked_project_id", projectId);
    const { data: autos } = await supabase.from("imphq_automacoes").select("id, nome, ativo, trigger_tipo").eq("project_id", projectId);

    const hasMap = (mapNodes || []).length > 0;
    const prodsWithCheckout = prods.filter((p) => p.checkout_url || p.link);
    const activeAutos = (autos || []).filter(a => a.ativo);

    const pendingTasks: { node: string; task: string }[] = [];
    let totalTasks = 0;
    let doneTasks = 0;

    (mapNodes || []).forEach(n => {
      const list = Array.isArray(n.checklist) ? n.checklist : [];
      list.forEach((c) => {
        totalTasks++;
        if (c.done) doneTasks++;
        else pendingTasks.push({ node: n.label, task: c.text });
      });
    });

    let score = 0;
    if (hasMap) score += 20;
    if (prods.length > 0) score += 15;
    if (prodsWithCheckout.length > 0) score += 25;
    if (activeAutos.length > 0) score += 20;
    if (totalTasks > 0) score += Math.round((doneTasks / totalTasks) * 20);
    else if (hasMap) score += 20;

    return json({
      project: { id: project.id, name: project.name, category: project.category },
      readinessScore: `${score}%`,
      status: score >= 80 ? "🟢 Pronto para Tráfego" : score >= 50 ? "🟡 Pendências Críticas" : "🔴 Em Estruturação",
      tarefasParaRodarTrafegoHoje: pendingTasks,
      ativos: {
        funilMapeado: hasMap,
        totalEtapasFunil: (mapNodes || []).length,
        produtos: prods,
        checkouts: prodsWithCheckout,
        automacoesAtivas: activeAutos,
      },
    });
  }

  // Retorna Fluxo do Mapa
  if (action === "flow") {
    const { data: mapNodes } = await supabase.from("imphq_company_map_nodes").select("*").eq("linked_project_id", projectId);
    return json({
      projectId,
      projectName: project.name,
      nodes: mapNodes || [],
    });
  }

  // Retorna Etapas Executáveis por IA (Agentic SOP / Runbook)
  if (action === "executable_steps") {
    const { data: mapNodes } = await supabase.from("imphq_company_map_nodes").select("*").eq("linked_project_id", projectId);
    const [caps, team] = await Promise.all([loadCapabilities(supabase), loadTeam(supabase)]);
    const parsedSteps = (mapNodes || []).map(n => {
      const notes = n.notes || "";
      const nExec = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || n.executor_type || "human_general";
      const nSkill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || n.linked_skill_id || "none";
      const executionStatus = readStepStatus(n);
      const multiPrompt = notes.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
      const singlePrompt = notes.match(/\[agent_prompt:([^\]]+)\]/);
      const prompt = multiPrompt ? multiPrompt[1].trim() : singlePrompt ? singlePrompt[1].trim() : n.description || n.label;
      const output_url = notes.match(/\[agent_output:([^\]]+)\]/)?.[1] || n.url || null;

      return {
        node_id: n.id,
        label: n.label,
        kind: n.kind,
        executor: nExec,
        skill: nSkill,
        ...executionStatus,
                ...ownerFields(n, team, executionStatus.status),
        prompt,
        checklist: n.checklist || [],
        output_url,
        contract: readStageContract(n),
        ferramentas: toolsForStep(caps, n.kind, nSkill),
      };
    });

    return json({
      projectId,
      projectName: project.name,
      totalSteps: parsedSteps.length,
      pendingCount: parsedSteps.filter(s => s.status === "pending").length,
      steps: parsedSteps,
    });
  }

  // Retorno Markdown Estruturado
  if (action === "markdown") {
    const md = `# Dossiê Executivo do Projeto: ${project.name} (ID: ${project.id})
**Categoria:** ${project.category || "N/A"}
**Descrição:** ${project.description || "N/A"}

---

## 1. Avatar & Psicologia de Compra
- **Nome/Perfil:** ${avatarData.nome || avatarData.name || "Não definido"}
- **Dores Principais:** ${JSON.stringify(avatarData.dores || avatarData.pain_points || "Não mapeado")}
- **Desejos Profundos:** ${JSON.stringify(avatarData.desejos || avatarData.desejos_proibidos || "Não mapeado")}
- **Crenças e Objeções:** ${JSON.stringify(avatarData.crencas || avatarData.objecoes || "Não mapeado")}

---

## 2. Mecanismo Único & Tese de Conversão
${projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || "Mecanismo único ainda não estruturado."}

---

## 3. Oferta & Checkouts
${Array.isArray(projectData.produtos) && projectData.produtos.length > 0
  ? projectData.produtos.map((p) => `- **${p.nome || p.name}**: R$ ${p.preco || p.price || "—"} (${p.tipo || "principal"}) | Link: ${p.checkout_url || p.link || "Sem link"}`).join("\n")
  : "Nenhum produto cadastrado no briefing."}

---

## 4. Tráfego & Ângulos Persuasivos
${projectData.criativos ? JSON.stringify(projectData.criativos, null, 2) : "Criativos e ganchos em fase de esteira."}
`;
    return new Response(md, {
      headers: { ...corsHeaders, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return json({
    project: {
      id: project.id,
      name: project.name,
      category: project.category,
      description: project.description,
      avatar: avatarData,
      mecanismo: projectData.mecanismo || projectData.mecanismo_unico || projectData.tese || null,
      produtos: projectData.produtos || [],
      links: projectData.links || [],
      pesquisa: projectData.pesquisa || null,
      updated_at: project.updated_at,
    },
  });
});
