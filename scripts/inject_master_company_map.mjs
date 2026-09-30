import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0Nzg5NSwiZXhwIjoyMDg4MTIzODk1fQ.X2xZ_6_zM0oZZHjKz_01YQ3H-4848g_L6zF325Y5V6k";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MAP_ID = "67f9f17a-e75e-45f6-a5e3-20198bfdd692"; // Mapa Principal

async function run() {
  console.log("Iniciando injeção do Fluxo Master da Empresa...");

  // 1. Limpa nós, edges e annotations antigas do Mapa Principal
  await supabase.from("imphq_company_map_edges").delete().eq("map_id", MAP_ID);
  await supabase.from("imphq_company_map_nodes").delete().eq("map_id", MAP_ID);
  await supabase.from("imphq_company_map_annotations").delete().eq("map_id", MAP_ID);

  // 2. Atualiza nome do mapa
  await supabase.from("imphq_company_maps").update({
    name: "⭐ Fluxo Master da Empresa — Império HQ",
    viewport: { x: 0, y: 0, zoom: 0.85 }
  }).eq("id", MAP_ID);

  // 3. Inserir Frames (Annotations)
  const annotations = [
    {
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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

  await supabase.from("imphq_company_map_annotations").insert(annotations);

  // 4. Inserir Nós Estruturados
  const nodes = [
    // --- Bloco 1: Máquina Orgânica ---
    {
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
      label: "Publicação Multicontas",
      kind: "canal",
      color: "#10b981",
      description: "3 a 5 posts diários em horários de pico.",
      position: { x: 790, y: 320 },
      stage_role: "Distribuir vídeos nas redes sociais",
      executor_type: "humano"
    },
    {
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
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
      map_id: MAP_ID,
      label: "Meta Pixel & CAPI + TikTok",
      kind: "processo",
      color: "#6366f1",
      description: "Rastreamento server-side sem perda de cookies iOS.",
      position: { x: 1150, y: 660 },
      stage_role: "Alimentar inteligência do algoritmo com dados reais",
      executor_type: "agente_ia"
    },
    {
      map_id: MAP_ID,
      label: "Zernio API (Meta Webhooks)",
      kind: "canal",
      color: "#8b5cf6",
      description: "Ponte oficial para Instagram DM e Facebook Messenger.",
      position: { x: 1390, y: 660 },
      stage_role: "Receber eventos de comentários e mensagens instantâneas",
      executor_type: "agente_ia"
    },
    {
      map_id: MAP_ID,
      label: "Evolution API (WhatsApp Chips)",
      kind: "canal",
      color: "#10b981",
      description: "Instâncias de chips com saúde monitorada a cada 10 min.",
      position: { x: 1630, y: 660 },
      stage_role: "Envio de mensagens, áudios e recuperação de leads",
      executor_type: "agente_ia"
    },
    {
      map_id: MAP_ID,
      label: "Webhook Central Pagamentos",
      kind: "processo",
      color: "#10b981",
      description: "Recebimento unificado de Kiwify, Hotmart, Ticto e Stripe.",
      position: { x: 1870, y: 660 },
      stage_role: "Notificar vendas, gerar leads e disparar integrações",
      executor_type: "agente_ia"
    },
    {
      map_id: MAP_ID,
      label: "GA4, UTMs & Cockpit Executivo",
      kind: "doc",
      color: "#64748b",
      description: "Rastreamento unificado de origem de tráfego e ROAS real.",
      position: { x: 1390, y: 880 },
      stage_role: "Exibir dashboards em tempo real para os sócios",
      executor_type: "humano"
    }
  ];

  const { data: insertedNodes, error: nodeErr } = await supabase
    .from("imphq_company_map_nodes")
    .insert(nodes)
    .select("id, label");

  if (nodeErr) {
    console.error("Erro inserindo nós:", nodeErr);
    return;
  }

  console.log(`Inseridos ${insertedNodes.length} nós com sucesso!`);

  // 5. Inserir Edges conectando as etapas
  const nodeMap = {};
  insertedNodes.forEach(n => { nodeMap[n.label] = n.id; });

  const edges = [
    // Bloco 1: Orgânico
    { map_id: MAP_ID, source_id: nodeMap["Ideação & Ângulos Virais"], target_id: nodeMap["Roteiro Comment-to-DM"], label: "Roteirizar" },
    { map_id: MAP_ID, source_id: nodeMap["Roteiro Comment-to-DM"], target_id: nodeMap["Geração de Vídeo / Biblioteca"], label: "Gerar Clipes" },
    { map_id: MAP_ID, source_id: nodeMap["Geração de Vídeo / Biblioteca"], target_id: nodeMap["Farm GeeLark (Cloud Phones)"], label: "Alimentar Farm" },
    { map_id: MAP_ID, source_id: nodeMap["Farm GeeLark (Cloud Phones)"], target_id: nodeMap["Publicação Multicontas"], label: "Postar Diário" },
    { map_id: MAP_ID, source_id: nodeMap["Publicação Multicontas"], target_id: nodeMap["Gatilho Comment-to-DM"], label: "Comentários" },
    { map_id: MAP_ID, source_id: nodeMap["Gatilho Comment-to-DM"], target_id: nodeMap["Zernio Direct Messenger"], label: "Webhook DM" },
    { map_id: MAP_ID, source_id: nodeMap["Zernio Direct Messenger"], target_id: nodeMap["Atendimento X1 Automático"], label: "Conversão IA" },

    // Bloco 2: JP Freitas
    { map_id: MAP_ID, source_id: nodeMap["Meta Ads (Transformação / Cortes)"], target_id: nodeMap["Página Código dos Cortes"], label: "Rota Low Ticket" },
    { map_id: MAP_ID, source_id: nodeMap["Página Código dos Cortes"], target_id: nodeMap["Checkout Kiwify + 2 Bumps"], label: "Comprar" },
    { map_id: MAP_ID, source_id: nodeMap["Checkout Kiwify + 2 Bumps"], target_id: nodeMap["Recuperação Evolution API"], label: "Abandono / Pix" },
    { map_id: MAP_ID, source_id: nodeMap["Meta Ads (Transformação / Cortes)"], target_id: nodeMap["Página Captura Formação"], label: "Rota Formação" },
    { map_id: MAP_ID, source_id: nodeMap["Página Captura Formação"], target_id: nodeMap["Obrigado + Forçar Grupo VIP"], label: "Opt-in" },
    { map_id: MAP_ID, source_id: nodeMap["Obrigado + Forçar Grupo VIP"], target_id: nodeMap["Webinar de Lançamento (5 Blocos)"], label: "Aquecimento" },

    // Bloco 3: Suplementos Bifi
    { map_id: MAP_ID, source_id: nodeMap["Tráfego Pago Internacional"], target_id: nodeMap["Rota 1: PDP Direta (PureLabs)"], label: "Frio / PDP" },
    { map_id: MAP_ID, source_id: nodeMap["Tráfego Pago Internacional"], target_id: nodeMap["Rota 2: Advertorial Editorial"], label: "Nativo / Notícia" },
    { map_id: MAP_ID, source_id: nodeMap["Tráfego Pago Internacional"], target_id: nodeMap["Rota 3: VSL Longa (20-35 min)"], label: "Causa Raiz" },
    { map_id: MAP_ID, source_id: nodeMap["Rota 2: Advertorial Editorial"], target_id: nodeMap["Rota 3: VSL Longa (20-35 min)"], label: "Assistir Vídeo" },
    { map_id: MAP_ID, source_id: nodeMap["Rota 3: VSL Longa (20-35 min)"], target_id: nodeMap["Checkout Internacional (Kits 1, 3 e 6)"], label: "Pitch Time" },
    { map_id: MAP_ID, source_id: nodeMap["Rota 1: PDP Direta (PureLabs)"], target_id: nodeMap["Checkout Internacional (Kits 1, 3 e 6)"], label: "Selecionar Kit" },
    { map_id: MAP_ID, source_id: nodeMap["Tráfego Pago Internacional"], target_id: nodeMap["Rota 4: Conversão X1 (Zernio)"], label: "Clique p/ Mensagem" },
    { map_id: MAP_ID, source_id: nodeMap["Rota 4: Conversão X1 (Zernio)"], target_id: nodeMap["Checkout Internacional (Kits 1, 3 e 6)"], label: "Link de Compra" },

    // Bloco 4: Conexões de Infraestrutura
    { map_id: MAP_ID, source_id: nodeMap["Checkout Kiwify + 2 Bumps"], target_id: nodeMap["Webhook Central Pagamentos"], label: "Venda / Carrinho" },
    { map_id: MAP_ID, source_id: nodeMap["Checkout Internacional (Kits 1, 3 e 6)"], target_id: nodeMap["Webhook Central Pagamentos"], label: "Order Placed" },
    { map_id: MAP_ID, source_id: nodeMap["Webhook Central Pagamentos"], target_id: nodeMap["Evolution API (WhatsApp Chips)"], label: "Boas-vindas" },
    { map_id: MAP_ID, source_id: nodeMap["Atendimento X1 Automático"], target_id: nodeMap["Zernio API (Meta Webhooks)"], label: "Direct Engine" }
  ];

  const validEdges = edges.filter(e => e.source_id && e.target_id);
  const { error: edgeErr } = await supabase.from("imphq_company_map_edges").insert(validEdges);

  if (edgeErr) {
    console.error("Erro inserindo edges:", edgeErr);
  } else {
    console.log(`Inseridas ${validEdges.length} conexões com sucesso!`);
  }

  console.log("Fluxo Master injetado com perfeição!");
}

run();
