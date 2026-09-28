// Edge Function: project-mcp
// Servidor MCP (Model Context Protocol) e API REST para consulta, prontidão e desenho de fluxos
// Suporta Claude Desktop, Cursor, Agentes autônomos e scripts externos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-project-id",
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
        },
        {
          key: "optin_page",
          kind: "captura",
          label: "Página de Captura / Inscrição",
          description: "Redirecionamento automático com link do WhatsApp",
          checklist: ["Headline de curiosidade", "Botão de redirecionamento para o Grupo VIP", "Pixel de Lead ativo"],
          col: 1,
          row: 0,
        },
        {
          key: "wa_vip",
          kind: "whatsapp",
          label: "Grupos VIP WhatsApp (D-7 a D0)",
          description: "Régua cronometrada de aquecimento e antecipação",
          checklist: ["Criar grupos 01 a 05", "Agendar mensagens de D-7 a D-1", "Áudios de bastidores do expert"],
          col: 2,
          row: 0,
        },
        {
          key: "live_pitch",
          kind: "youtube",
          label: "Live de Abertura / Pitch",
          description: "Apresentação da oportunidade, ancoragem e abertura",
          checklist: ["Slides de apresentação finalizados", "Stack de bônus exclusivos", "Link da transmissão privado"],
          col: 3,
          row: 0,
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
        },
        {
          key: "wa_suporte",
          kind: "whatsapp",
          label: "Plantão X1 · Dúvidas e Pix",
          description: "Recuperação no 1 a 1 para quem gerou Pix ou travou",
          checklist: ["IA ou operadores no WhatsApp", "Scripts para quebra de objeções de cartão/limite"],
          col: 4,
          row: 1,
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
        },
        {
          key: "wa_sdr",
          kind: "whatsapp",
          label: "WhatsApp SDR IA · Triagem & SPIN",
          description: "Qualificação consultiva automática antes da proposta",
          checklist: ["Configurar IA consultiva no OpenFlow", "Definir perguntas de qualificação", "Simular 3 testes"],
          col: 1,
          row: 0,
        },
        {
          key: "proposta",
          kind: "processo",
          label: "Apresentação de Proposta / Closer",
          description: "Sessão de diagnóstico ou chamada de fechamento",
          checklist: ["Script de ancoragem de valor", "Superação de objeções de garantia"],
          col: 2,
          row: 0,
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
        },
        {
          key: "onboarding",
          kind: "area_membros",
          label: "Onboarding VIP & Kick-off",
          description: "Acolhimento imediato e primeira entrega de valor",
          checklist: ["Formulário de diagnóstico inicial", "Agendamento da sessão individual"],
          col: 4,
          row: 0,
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
        },
        {
          key: "checkout_front",
          kind: "checkout",
          label: `Checkout Front-End (R$ 27) · ${prod}`,
          product_name: prod,
          checklist: ["Página de checkout limpa com depoimentos", "Garantia incondicional de 7 dias"],
          col: 1,
          row: 0,
        },
        {
          key: "bump_acelerador",
          kind: "orderbump",
          label: "Orderbump · Acelerador / Template",
          description: "Oferta complementar de R$ 17 para elevar o ticket médio",
          checklist: ["Copy do bump", "Preço complementar R$ 17 - R$ 27"],
          col: 1,
          row: 1,
        },
        {
          key: "upsell_core",
          kind: "upsell",
          label: "1-Click Upsell · Treinamento Completo",
          description: "Oferta principal (Core Offer R$ 197 - R$ 497)",
          checklist: ["Vídeo de 90s do upsell", "Configurar 1-click automático na plataforma"],
          col: 2,
          row: 0,
        },
        {
          key: "downsell_core",
          kind: "downsell",
          label: "Downsell · Versão Essencial",
          description: "Parcelamento estendido ou versão sem bônus",
          checklist: ["Página alternativa de downsell"],
          col: 2,
          row: 1,
        },
        {
          key: "comunidade",
          kind: "area_membros",
          label: "Área de Membros & Boas-Vindas",
          description: "Entrega imediata dos acessos e nivelamento",
          checklist: ["Envio de acesso por e-mail e WhatsApp", "Vídeo de boas-vindas liberado"],
          col: 3,
          row: 0,
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
      },
      {
        key: "ad_vilao",
        kind: "anuncio",
        label: "Meta Ads · Inimigo Oculto",
        description: "Ângulo do mecanismo único que desmascara métodos velhos",
        checklist: ["Roteiro aprovado", "Gravar criativo", "Subir no Meta Ads"],
        col: 0,
        row: 1,
      },
      {
        key: "ad_ugc",
        kind: "anuncio",
        label: "Meta Ads · Depoimento UGC",
        description: "Prova social de quem já obteve o resultado desejado",
        checklist: ["Separar print/vídeo real", "Subir no Meta Ads"],
        col: 0,
        row: 2,
      },
      {
        key: "page_vsl",
        kind: "vsl",
        label: "Página de Vendas / Advertorial VSL",
        description: "Página de alta conversão com narrativa e pitch",
        checklist: ["Hospedar vídeo VSL", "Configurar delay do botão CTA", "Validar carregamento no mobile"],
        col: 1,
        row: 0,
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
      },
      {
        key: "bump_extra",
        kind: "orderbump",
        label: "Orderbump · Pote Extra / Guia Rápido",
        description: "Oferta complementar de impulso (R$ 27 - R$ 47)",
        checklist: ["Headline persuasiva do bump", "Preço R$ 27 - R$ 47"],
        col: 2,
        row: 1,
      },
      {
        key: "upsell_anual",
        kind: "upsell",
        label: "1-Click Upsell · Kit Completo",
        description: "Alavanca imediata de ticket médio (AOV)",
        checklist: ["Vídeo de 60s do upsell", "Configurar 1-click na plataforma de pagamento"],
        col: 3,
        row: 0,
      },
      {
        key: "downsell_leve",
        kind: "downsell",
        label: "Downsell · Condição Facilitada",
        description: "Opção parcelada ou quantidade reduzida",
        checklist: ["Página alternativa de downsell"],
        col: 3,
        row: 1,
      },
      {
        key: "wa_recuperacao",
        kind: "whatsapp",
        label: "WhatsApp X1 · Resgate de Abandono",
        description: "Disparo automático após 15min / 2h de carrinho abandonado",
        checklist: ["Conectar instância WhatsApp", "Ativar régua no OpenFlow", "Testar mensagem de 15min"],
        col: 2,
        row: 2,
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
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── 1. Tratamento MCP JSON-RPC ou REST via POST ──
  if (req.method === "POST") {
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
            const insertedNodesList: any[] = [];

            for (const dn of draftNodes) {
              const col = dn.col ?? getColumnForKind(dn.kind);
              const row = dn.row ?? (colCounts[col] || 0);
              colCounts[col] = row + 1;

              const x = col * 360 + 60;
              const y = row * 180 + 60;

              let finalNotes = "";
              const prodName = dn.product_name || (dn.kind === "checkout" ? primaryProdName : null);
              if (prodName) finalNotes += `[product_name:${prodName}]\n`;
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
            const insertedEdgesList: any[] = [];
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
            const prodsWithCheckout = prods.filter((p: any) => p.checkout_url || p.link);
            const activeAutos = (autos || []).filter(a => a.ativo);

            // Coleta checklist de tarefas pendentes nos nós
            const pendingTasks: { node: string; task: string }[] = [];
            let totalTasks = 0;
            let doneTasks = 0;

            (mapNodes || []).forEach(n => {
              const list = Array.isArray(n.checklist) ? n.checklist : [];
              list.forEach((c: any) => {
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
                produtosCadastrados: prods.map((p: any) => `${p.nome || p.name} (R$ ${p.preco || p.price || "—"})`),
                checkoutsAtivos: prodsWithCheckout.map((p: any) => ({ produto: p.nome || p.name, url: p.checkout_url || p.link })),
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

          throw new Error(`Ferramenta desconhecida: ${name}`);
        } catch (err: any) {
          return json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: err?.message || "Internal error" },
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
    const prodsWithCheckout = prods.filter((p: any) => p.checkout_url || p.link);
    const activeAutos = (autos || []).filter(a => a.ativo);

    const pendingTasks: { node: string; task: string }[] = [];
    let totalTasks = 0;
    let doneTasks = 0;

    (mapNodes || []).forEach(n => {
      const list = Array.isArray(n.checklist) ? n.checklist : [];
      list.forEach((c: any) => {
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
  ? projectData.produtos.map((p: any) => `- **${p.nome || p.name}**: R$ ${p.preco || p.price || "—"} (${p.tipo || "principal"}) | Link: ${p.checkout_url || p.link || "Sem link"}`).join("\n")
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
