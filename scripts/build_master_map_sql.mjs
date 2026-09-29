import fs from "fs";

const MAP_ID = "67f9f17a-e75e-45f6-a5e3-20198bfdd692"; // Mapa Principal

const annotations = [
  {
    kind: "frame",
    x: 30,
    y: 30,
    width: 1040,
    height: 520,
    style: {
      heading: "🌾 1. MÁQUINA ORGÂNICA MULTICANAL (TikTok, Reels, Shorts & GeeLark)",
      borderColor: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.03)"
    }
  },
  {
    kind: "frame",
    x: 1110,
    y: 30,
    width: 1040,
    height: 520,
    style: {
      heading: "💈 2. ECOSSISTEMA JP FREITAS (Low Ticket & Formação Profissional)",
      borderColor: "#3b82f6",
      bgColor: "rgba(59, 130, 246, 0.03)"
    }
  },
  {
    kind: "frame",
    x: 30,
    y: 590,
    width: 1040,
    height: 520,
    style: {
      heading: "💊 3. SUPLEMENTOS DTC BIFI (4 Rotas de Aquisição Internacional)",
      borderColor: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.03)"
    }
  },
  {
    kind: "frame",
    x: 1110,
    y: 590,
    width: 1040,
    height: 520,
    style: {
      heading: "⚙️ 4. INFRAESTRUTURA TÉCNICA CENTRAL, RASTREAMENTO & WEBHOOKS",
      borderColor: "#8b5cf6",
      bgColor: "rgba(139, 92, 246, 0.03)"
    }
  }
];

const nodes = [
  // --- Bloco 1: Máquina Orgânica ---
  {
    id: "a1000000-0000-0000-0000-000000000001",
    label: "Ideação & Ângulos Virais",
    kind: "processo",
    color: "#10b981",
    description: "Mineração de padrões virais e batismo do par Vilão + Solução.",
    position: { x: 70, y: 100 },
    stage_role: "Definir ganchos 0-3s e par de mecanismos",
    executor_type: "agente_ia",
    linked_skill_id: "angulos-criativos",
    metrics_target: { hook_rate_target: "35%" }
  },
  {
    id: "a1000000-0000-0000-0000-000000000002",
    label: "Roteiro Comment-to-DM",
    kind: "doc",
    color: "#10b981",
    description: "Roteirização segundo a segundo com retenção da solução para a DM.",
    position: { x: 310, y: 100 },
    stage_role: "Escrever roteiro 9:16 com chamada para comentário",
    executor_type: "agente_ia",
    linked_skill_id: "roteiros-virais-comment-to-dm"
  },
  {
    id: "a1000000-0000-0000-0000-000000000003",
    label: "Geração de Vídeo / Biblioteca",
    kind: "processo",
    color: "#10b981",
    description: "Produção de Roleta, UGC e cortes com narração.",
    position: { x: 550, y: 100 },
    stage_role: "Renderizar vídeo local ou via IA",
    executor_type: "hibrido",
    linked_skill_id: "video-roleta-sorteio"
  },
  {
    id: "a1000000-0000-0000-0000-000000000004",
    label: "Farm GeeLark (Cloud Phones)",
    kind: "processo",
    color: "#f59e0b",
    description: "Fazenda de contas TikTok/Instagram aquecidas com proxies 4G.",
    position: { x: 790, y: 100 },
    stage_role: "Aquecer contas por 10 dias sem links na bio",
    executor_type: "humano",
    linked_skill_id: "organic-reels-factory"
  },
  {
    id: "a1000000-0000-0000-0000-000000000005",
    label: "Publicação Multicontas",
    kind: "canal",
    color: "#10b981",
    description: "3 a 5 posts diários em horários de pico.",
    position: { x: 790, y: 320 },
    stage_role: "Distribuir vídeos nas redes sociais",
    executor_type: "humano"
  },
  {
    id: "a1000000-0000-0000-0000-000000000006",
    label: "Gatilho Comment-to-DM",
    kind: "processo",
    color: "#8b5cf6",
    description: "Leitor comenta palavra-chave ('QUERO') no post.",
    position: { x: 550, y: 320 },
    stage_role: "Capturar comentário e disparar webhook",
    executor_type: "agente_ia",
    linked_skill_id: "roteiros-virais-comment-to-dm"
  },
  {
    id: "a1000000-0000-0000-0000-000000000007",
    label: "Zernio Direct Messenger",
    kind: "canal",
    color: "#8b5cf6",
    description: "Ponte de automação oficial Meta para Instagram DM.",
    position: { x: 310, y: 320 },
    stage_role: "Enviar primeira mensagem da árvore na DM",
    executor_type: "agente_ia",
    api_binding: { service: "zernio", endpoint: "/messages" }
  },
  {
    id: "a1000000-0000-0000-0000-000000000008",
    label: "Atendimento X1 Automático",
    kind: "processo",
    color: "#8b5cf6",
    description: "Árvore de 4 mensagens de qualificação e envio do link de compra.",
    position: { x: 70, y: 320 },
    stage_role: "Fechar venda 1 a 1 no chat",
    executor_type: "agente_ia",
    linked_skill_id: "rebel-copy"
  },

  // --- Bloco 2: JP Freitas ---
  {
    id: "a2000000-0000-0000-0000-000000000001",
    label: "Meta Ads (Transformação / Cortes)",
    kind: "canal",
    color: "#3b82f6",
    description: "Campanhas de conversão no Instagram/Facebook.",
    position: { x: 1150, y: 100 },
    stage_role: "Atrair barbeiros e cabeleireiros",
    executor_type: "humano",
    linked_skill_id: "briefing-gestor-trafego",
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000002",
    label: "Página Código dos Cortes",
    kind: "processo",
    color: "#10b981",
    description: "Página de vendas direta do curso de R$ 47.",
    position: { x: 1390, y: 100 },
    stage_role: "Converter front-end impulsivo",
    executor_type: "agente_ia",
    linked_skill_id: "tripwire-matador-v2",
    url: "https://codigodoscortesperfeitos.vercel.app",
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000003",
    label: "Checkout Kiwify + 2 Bumps",
    kind: "processo",
    color: "#10b981",
    description: "Curso R$ 47 + Bump Tesoura R$ 27 + Bump Fade R$ 19,90.",
    position: { x: 1630, y: 100 },
    stage_role: "Maximizar ticket médio (AOV ~ R$ 60)",
    executor_type: "humano",
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000004",
    label: "Recuperação Evolution API",
    kind: "processo",
    color: "#f59e0b",
    description: "Disparo automático de Pix/Boleto em 15 minutos.",
    position: { x: 1870, y: 100 },
    stage_role: "Resgatar até 35% dos pedidos abandonados",
    executor_type: "agente_ia",
    api_binding: { service: "evolution_api", instance: "jpfreitas" },
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000005",
    label: "Página Captura Formação",
    kind: "processo",
    color: "#3b82f6",
    description: "Inscrição gratuita para o Webinar / Masterclass.",
    position: { x: 1390, y: 320 },
    stage_role: "Coletar Nome, WhatsApp e E-mail",
    executor_type: "agente_ia",
    linked_skill_id: "lp-persuasiva-v2",
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000006",
    label: "Obrigado + Forçar Grupo VIP",
    kind: "processo",
    color: "#3b82f6",
    description: "Redirecionamento obrigatório para o Grupo de WhatsApp.",
    position: { x: 1630, y: 320 },
    stage_role: "Reter mais de 75% dos inscritos no grupo",
    executor_type: "agente_ia",
    linked_project_id: "jp_freitas"
  },
  {
    id: "a2000000-0000-0000-0000-000000000007",
    label: "Webinar de Lançamento (5 Blocos)",
    kind: "processo",
    color: "#3b82f6",
    description: "Aula magna com pitch da Formação R$ 997 a R$ 2.997.",
    position: { x: 1870, y: 320 },
    stage_role: "Gerar pico de faturamento e autoridade",
    executor_type: "hibrido",
    linked_skill_id: "webinar-blocks",
    linked_project_id: "jp_freitas"
  },

  // --- Bloco 3: Suplementos Bifi ---
  {
    id: "a3000000-0000-0000-0000-000000000001",
    label: "Tráfego Pago Internacional",
    kind: "canal",
    color: "#ef4444",
    description: "Campanhas agressivas de causa raiz nos EUA (Meta/TikTok).",
    position: { x: 70, y: 660 },
    stage_role: "Gerar tráfego qualificado de alta escala",
    executor_type: "humano",
    linked_skill_id: "angulos-criativos"
  },
  {
    id: "a3000000-0000-0000-0000-000000000002",
    label: "Rota 1: PDP Direta (PureLabs)",
    kind: "processo",
    color: "#06b6d4",
    description: "Página de produto direto com kits de 1, 3 e 6 frascos.",
    position: { x: 310, y: 660 },
    stage_role: "Conversão direta para público consciente da solução",
    executor_type: "agente_ia",
    linked_project_id: "slimsoda"
  },
  {
    id: "a3000000-0000-0000-0000-000000000003",
    label: "Rota 2: Advertorial Editorial",
    kind: "processo",
    color: "#f59e0b",
    description: "Artigo estilo jornal investigativo (The Honey Trick / Melissa McCarthy).",
    position: { x: 550, y: 660 },
    stage_role: "Desarmar ceticismo em tráfego nativo",
    executor_type: "agente_ia",
    linked_skill_id: "breakthrough-techniques",
    linked_project_id: "memoflow"
  },
  {
    id: "a3000000-0000-0000-0000-000000000004",
    label: "Rota 3: VSL Longa (20-35 min)",
    kind: "processo",
    color: "#8b5cf6",
    description: "Vídeo de vendas hipnótico com botão revelado no pitch time.",
    position: { x: 790, y: 660 },
    stage_role: "Venda emocional em massa via mecanismo único",
    executor_type: "agente_ia",
    linked_skill_id: "mecanismo-vsl"
  },
  {
    id: "a3000000-0000-0000-0000-000000000005",
    label: "Rota 4: Conversão X1 (Zernio)",
    kind: "processo",
    color: "#10b981",
    description: "Atendimento 1 a 1 com IA especializada (LinfaFlowX1 / CinnaShieldX1).",
    position: { x: 550, y: 880 },
    stage_role: "Converter leads quentes e tirar dúvidas de saúde",
    executor_type: "agente_ia",
    linked_skill_id: "rebel-copy"
  },
  {
    id: "a3000000-0000-0000-0000-000000000006",
    label: "Checkout Internacional (Kits 1, 3 e 6)",
    kind: "processo",
    color: "#10b981",
    description: "Página de pagamento segura com $294 no kit máximo.",
    position: { x: 790, y: 880 },
    stage_role: "Processar pedido e emitir ordem de envio",
    executor_type: "humano"
  },

  // --- Bloco 4: Infraestrutura Técnica ---
  {
    id: "a4000000-0000-0000-0000-000000000001",
    label: "Meta Pixel & CAPI + TikTok",
    kind: "processo",
    color: "#6366f1",
    description: "Rastreamento server-side sem perda de cookies iOS.",
    position: { x: 1150, y: 660 },
    stage_role: "Alimentar inteligência do algoritmo com dados reais",
    executor_type: "agente_ia"
  },
  {
    id: "a4000000-0000-0000-0000-000000000002",
    label: "Zernio API (Meta Webhooks)",
    kind: "canal",
    color: "#8b5cf6",
    description: "Ponte oficial para Instagram DM e Facebook Messenger.",
    position: { x: 1390, y: 660 },
    stage_role: "Receber eventos de comentários e mensagens instantâneas",
    executor_type: "agente_ia"
  },
  {
    id: "a4000000-0000-0000-0000-000000000003",
    label: "Evolution API (WhatsApp Chips)",
    kind: "canal",
    color: "#10b981",
    description: "Instâncias de chips com saúde monitorada a cada 10 min.",
    position: { x: 1630, y: 660 },
    stage_role: "Envio de mensagens, áudios e recuperação de leads",
    executor_type: "agente_ia"
  },
  {
    id: "a4000000-0000-0000-0000-000000000004",
    label: "Webhook Central Pagamentos",
    kind: "processo",
    color: "#10b981",
    description: "Recebimento unificado de Kiwify, Hotmart, Ticto e Stripe.",
    position: { x: 1870, y: 660 },
    stage_role: "Notificar vendas, gerar leads e disparar integrações",
    executor_type: "agente_ia"
  },
  {
    id: "a4000000-0000-0000-0000-000000000005",
    label: "GA4, UTMs & Cockpit Executivo",
    kind: "doc",
    color: "#64748b",
    description: "Rastreamento unificado de origem de tráfego e ROAS real.",
    position: { x: 1390, y: 880 },
    stage_role: "Exibir dashboards em tempo real para os sócios",
    executor_type: "humano"
  }
];

const edges = [
  // Orgânico
  { id: "e1000000-0000-0000-0000-000000000001", source_id: "a1000000-0000-0000-0000-000000000001", target_id: "a1000000-0000-0000-0000-000000000002", label: "Roteirizar" },
  { id: "e1000000-0000-0000-0000-000000000002", source_id: "a1000000-0000-0000-0000-000000000002", target_id: "a1000000-0000-0000-0000-000000000003", label: "Gerar Clipes" },
  { id: "e1000000-0000-0000-0000-000000000003", source_id: "a1000000-0000-0000-0000-000000000003", target_id: "a1000000-0000-0000-0000-000000000004", label: "Alimentar Farm" },
  { id: "e1000000-0000-0000-0000-000000000004", source_id: "a1000000-0000-0000-0000-000000000004", target_id: "a1000000-0000-0000-0000-000000000005", label: "Postar Diário" },
  { id: "e1000000-0000-0000-0000-000000000005", source_id: "a1000000-0000-0000-0000-000000000005", target_id: "a1000000-0000-0000-0000-000000000006", label: "Comentários" },
  { id: "e1000000-0000-0000-0000-000000000006", source_id: "a1000000-0000-0000-0000-000000000006", target_id: "a1000000-0000-0000-0000-000000000007", label: "Webhook DM" },
  { id: "e1000000-0000-0000-0000-000000000007", source_id: "a1000000-0000-0000-0000-000000000007", target_id: "a1000000-0000-0000-0000-000000000008", label: "Conversão IA" },

  // JP Freitas
  { id: "e2000000-0000-0000-0000-000000000001", source_id: "a2000000-0000-0000-0000-000000000001", target_id: "a2000000-0000-0000-0000-000000000002", label: "Rota Low Ticket" },
  { id: "e2000000-0000-0000-0000-000000000002", source_id: "a2000000-0000-0000-0000-000000000002", target_id: "a2000000-0000-0000-0000-000000000003", label: "Comprar" },
  { id: "e2000000-0000-0000-0000-000000000003", source_id: "a2000000-0000-0000-0000-000000000003", target_id: "a2000000-0000-0000-0000-000000000004", label: "Abandono / Pix" },
  { id: "e2000000-0000-0000-0000-000000000004", source_id: "a2000000-0000-0000-0000-000000000001", target_id: "a2000000-0000-0000-0000-000000000005", label: "Rota Formação" },
  { id: "e2000000-0000-0000-0000-000000000005", source_id: "a2000000-0000-0000-0000-000000000005", target_id: "a2000000-0000-0000-0000-000000000006", label: "Opt-in" },
  { id: "e2000000-0000-0000-0000-000000000006", source_id: "a2000000-0000-0000-0000-000000000006", target_id: "a2000000-0000-0000-0000-000000000007", label: "Aquecimento" },

  // Suplementos Bifi
  { id: "e3000000-0000-0000-0000-000000000001", source_id: "a3000000-0000-0000-0000-000000000001", target_id: "a3000000-0000-0000-0000-000000000002", label: "Frio / PDP" },
  { id: "e3000000-0000-0000-0000-000000000002", source_id: "a3000000-0000-0000-0000-000000000001", target_id: "a3000000-0000-0000-0000-000000000003", label: "Nativo / Notícia" },
  { id: "e3000000-0000-0000-0000-000000000003", source_id: "a3000000-0000-0000-0000-000000000001", target_id: "a3000000-0000-0000-0000-000000000004", label: "Causa Raiz" },
  { id: "e3000000-0000-0000-0000-000000000004", source_id: "a3000000-0000-0000-0000-000000000003", target_id: "a3000000-0000-0000-0000-000000000004", label: "Assistir Vídeo" },
  { id: "e3000000-0000-0000-0000-000000000005", source_id: "a3000000-0000-0000-0000-000000000004", target_id: "a3000000-0000-0000-0000-000000000006", label: "Pitch Time" },
  { id: "e3000000-0000-0000-0000-000000000006", source_id: "a3000000-0000-0000-0000-000000000002", target_id: "a3000000-0000-0000-0000-000000000006", label: "Selecionar Kit" },
  { id: "e3000000-0000-0000-0000-000000000007", source_id: "a3000000-0000-0000-0000-000000000001", target_id: "a3000000-0000-0000-0000-000000000005", label: "Mensagem" },
  { id: "e3000000-0000-0000-0000-000000000008", source_id: "a3000000-0000-0000-0000-000000000005", target_id: "a3000000-0000-0000-0000-000000000006", label: "Link Compra" },

  // Infraestrutura
  { id: "e4000000-0000-0000-0000-000000000001", source_id: "a2000000-0000-0000-0000-000000000003", target_id: "a4000000-0000-0000-0000-000000000004", label: "Venda / Carrinho" },
  { id: "e4000000-0000-0000-0000-000000000002", source_id: "a3000000-0000-0000-0000-000000000006", target_id: "a4000000-0000-0000-0000-000000000004", label: "Order Placed" },
  { id: "e4000000-0000-0000-0000-000000000003", source_id: "a4000000-0000-0000-0000-000000000004", target_id: "a4000000-0000-0000-0000-000000000003", label: "Boas-vindas" },
  { id: "e4000000-0000-0000-0000-000000000004", source_id: "a1000000-0000-0000-0000-000000000008", target_id: "a4000000-0000-0000-0000-000000000002", label: "Direct Engine" }
];

let sql = `
-- Limpeza anterior do Mapa Principal
DELETE FROM imphq_company_map_edges WHERE map_id = '${MAP_ID}';
DELETE FROM imphq_company_map_nodes WHERE map_id = '${MAP_ID}';
DELETE FROM imphq_company_map_annotations WHERE map_id = '${MAP_ID}';

UPDATE imphq_company_maps
SET name = '⭐ Fluxo Master da Empresa — Império HQ',
    viewport = '{"x": 0, "y": 0, "zoom": 0.85}'::jsonb,
    updated_at = NOW()
WHERE id = '${MAP_ID}';

-- Inserir Annotations (Frames)
`;

annotations.forEach(a => {
  sql += `INSERT INTO imphq_company_map_annotations (id, map_id, kind, x, y, width, height, text, style, z_index)
VALUES (gen_random_uuid(), '${MAP_ID}', '${a.kind}', ${a.x}, ${a.y}, ${a.width}, ${a.height}, '', '${JSON.stringify(a.style)}'::jsonb, 0);\n`;
});

sql += `\n-- Inserir Nós\n`;

nodes.forEach(n => {
  const pos = JSON.stringify(n.position);
  const proj = n.linked_project_id ? `'${n.linked_project_id}'` : "NULL";
  const skill = n.linked_skill_id ? `'${n.linked_skill_id}'` : "NULL";
  const api = n.api_binding ? `'${JSON.stringify(n.api_binding)}'::jsonb` : "NULL";
  const metrics = n.metrics_target ? `'${JSON.stringify(n.metrics_target)}'::jsonb` : "NULL";
  const url = n.url ? `'${n.url}'` : "NULL";

  sql += `INSERT INTO imphq_company_map_nodes (id, map_id, label, kind, color, description, position, stage_role, executor_type, linked_skill_id, api_binding, metrics_target, linked_project_id, url)
VALUES ('${n.id}', '${MAP_ID}', '${n.label.replace(/'/g, "''")}', '${n.kind}', '${n.color}', '${n.description.replace(/'/g, "''")}', '${pos}'::jsonb, '${n.stage_role.replace(/'/g, "''")}', '${n.executor_type}', ${skill}, ${api}, ${metrics}, ${proj}, ${url});\n`;
});

sql += `\n-- Inserir Conexões (Edges)\n`;

edges.forEach(e => {
  sql += `INSERT INTO imphq_company_map_edges (id, map_id, source_id, target_id, label)
VALUES ('${e.id}', '${MAP_ID}', '${e.source_id}', '${e.target_id}', '${e.label}');\n`;
});

fs.writeFileSync("scripts/inject_master_company_map.sql", sql);
console.log("SQL gerado com sucesso em scripts/inject_master_company_map.sql (" + sql.length + " bytes)");
