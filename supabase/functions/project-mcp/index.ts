// Edge Function: project-mcp
// Servidor MCP (Model Context Protocol) e API REST para consulta, prontidão e desenho de fluxos
// Suporta Claude Desktop, Cursor, Agentes autônomos e scripts externos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { buildProjectMap, readStageContract, readAgentStatus } from "../_shared/project-map.ts";
import { checkMcpKey } from "../_shared/mcp-auth.ts";
import { CAPABILITY_TASKS, pickCapabilities, tasksForKind, type Capability } from "../_shared/capabilities.ts";
import { orderSteps } from "../_shared/map-order.ts";

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

type Supabase = ReturnType<typeof createClient>;

/** Catálogo ativo (imphq_capabilities). Falha de leitura vira lista vazia: sugestão de ferramenta nunca derruba a etapa. */
async function loadCapabilities(supabase: Supabase): Promise<Capability[]> {
  const { data, error } = await supabase.from("imphq_capabilities").select("*").eq("ativo", true);
  if (error) console.error("imphq_capabilities", error.message);
  return (data || []) as Capability[];
}

/** Ferramentas sugeridas para uma etapa, pelo tipo dela no mapa. */
function toolsForStep(caps: Capability[], kind: string | null) {
  return pickCapabilities(caps, tasksForKind(kind), 4).map((c) => ({ id: c.id, nome: c.nome, url: c.url, quando_usar: c.quando_usar }));
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
      },
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
];

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
            const { tarefa, busca, prioridade } = args || {};
            let caps = await loadCapabilities(supabase);
            if (tarefa) caps = pickCapabilities(caps, [tarefa], caps.length);
            if (prioridade) caps = caps.filter((c) => c.prioridade === prioridade);
            if (busca) {
              const b = String(busca).toLowerCase();
              caps = caps.filter((c) => [c.nome, c.categoria, c.quando_usar, c.descricao].some((v) => (v || "").toLowerCase().includes(b)));
            }
            const payload = {
              tarefas: CAPABILITY_TASKS,
              total: caps.length,
              ferramentas: caps.map((c) => ({ id: c.id, nome: c.nome, url: c.url, categoria: c.categoria, quando_usar: c.quando_usar, serve_para: c.serve_para, prioridade: c.prioridade, licenca: c.licenca_nota })),
            };
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } });
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

            const [waIncoming30d, waOutgoing30d, funnelEvents7d] = await Promise.all([
              count(supabase.from("imphq_wa_messages").select("id, imphq_wa_conversations!inner(jid_suffix)", { count: "exact", head: true }).eq("project_id", projectId).eq("direction", "incoming").gte("created_at", since30d).or("jid_suffix.is.null,jid_suffix.neq.g.us", { referencedTable: "imphq_wa_conversations" })),
              count(supabase.from("imphq_wa_messages").select("id, imphq_wa_conversations!inner(jid_suffix)", { count: "exact", head: true }).eq("project_id", projectId).eq("direction", "outgoing").gte("created_at", since30d).or("jid_suffix.is.null,jid_suffix.neq.g.us", { referencedTable: "imphq_wa_conversations" })),
              count(supabase.from("imphq_funnel_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", since7d)),
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
                funnelEvents7d,
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
            const { project_id, status = "open", executor } = args || {};
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
            const caps = await loadCapabilities(supabase);

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

              const executionStatus = readAgentStatus(notes);

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
                prompt,
                checklist: n.checklist || [],
                output_url,
                product_context: primaryProd,
                contract: readStageContract(n),
                // Print da página da etapa (scripts/map-prints.mjs): mostra como ela está hoje.
                print: printMeta ? { desktop: printMeta.desktop ?? null, mobile: printMeta.mobile ?? null, captured_at: printMeta.captured_at ?? null } : null,
                ferramentas: toolsForStep(caps, n.kind),
              };
            }).sort((a, b) => (a.step_number ?? 9999) - (b.step_number ?? 9999));

            let filtered = parsedSteps;
            if (status && status !== "all") {
              filtered = filtered.filter(s => status === "open" ? s.status !== "done" : s.status === status);
            }
            if (executor) {
              filtered = filtered.filter(s => s.executor.toLowerCase().includes(executor.toLowerCase()));
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
      const caps = await loadCapabilities(supabase);
      const parsedSteps = (rawNodes || []).map(n => {
        const notes = n.notes || "";
        const nExec = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || n.executor_type || "human_general";
        const nSkill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || n.linked_skill_id || "none";
        const executionStatus = readAgentStatus(notes);
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
          prompt,
          checklist: n.checklist || [],
          output_url,
          contract: readStageContract(n),
          ferramentas: toolsForStep(caps, n.kind),
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

      const updatePayload: Record<string, unknown> = { notes: notes.trim(), checklist: updatedChecklist };
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
    const caps = await loadCapabilities(supabase);
    const parsedSteps = (mapNodes || []).map(n => {
      const notes = n.notes || "";
      const nExec = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || n.executor_type || "human_general";
      const nSkill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || n.linked_skill_id || "none";
      const executionStatus = readAgentStatus(notes);
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
        prompt,
        checklist: n.checklist || [],
        output_url,
        contract: readStageContract(n),
        ferramentas: toolsForStep(caps, n.kind),
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
