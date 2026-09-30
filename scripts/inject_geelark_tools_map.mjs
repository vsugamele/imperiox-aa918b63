import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODQ3Njg0OCwiZXhwIjoyMDU0MDUyODQ4fQ.RsPVUl1Rvae1pycX7O3r9_VrFIFx6_l7fKBsW8CnL4s";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const MAP_ID = "67f9f17a-e75e-45f6-a5e3-20198bfdd692";

async function run() {
  console.log("Injetando Frames 5 e 6 (GeeLark e Ferramentas)...");

  // 1. Inserir Anotações (Frames)
  const annotations = [
    {
      id: "55555555-5555-5555-5555-000000000001",
      map_id: MAP_ID,
      kind: "frame",
      x: 30,
      y: 1150,
      width: 1040,
      height: 480,
      text: "📱 Fazenda de Perfis GeeLark & Redes Sociais (Cloud Phones + Instagram + TikTok)",
      style: {
        borderColor: "#06B6D4",
        bgColor: "rgba(6, 182, 212, 0.05)",
        fontSize: 14
      },
      z_index: 0
    },
    {
      id: "66666666-6666-6666-6666-000000000001",
      map_id: MAP_ID,
      kind: "frame",
      x: 1110,
      y: 1150,
      width: 1040,
      height: 480,
      text: "🔑 Central de Acessos & Ferramentas Integradas (Cofre Seguro da Operação)",
      style: {
        borderColor: "#F59E0B",
        bgColor: "rgba(245, 158, 11, 0.05)",
        fontSize: 14
      },
      z_index: 0
    }
  ];

  for (const ann of annotations) {
    const { error } = await supabase.from("imphq_company_map_annotations").upsert(ann);
    if (error) console.error("Erro ao inserir anotação:", error);
  }

  // 2. Inserir Nós
  const nodes = [
    // Frame 5: GeeLark & Perfis
    {
      id: "b5000000-0000-0000-0000-000000000001",
      map_id: MAP_ID,
      label: "📱 GeeLark Aparelho 04",
      kind: "canal",
      color: "#06B6D4",
      description: "Cloud phone com proxy residencial. Roda perfis do JP Freitas e aquecimento.",
      stage_role: "Cloud Phone Ativo",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "geelark", device_id: "629793833273524550", nome: "04", status: "ativo" },
      position: { x: 70, y: 1210 }
    },
    {
      id: "b5000000-0000-0000-0000-000000000002",
      map_id: MAP_ID,
      label: "📱 GeeLark Aparelho 05",
      kind: "canal",
      color: "#06B6D4",
      description: "Cloud phone com proxy móvel dedicado (168.158.146.135). Roda perfis DTC de Saúde.",
      stage_role: "Cloud Phone Ativo",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "geelark", device_id: "630251923160695048", nome: "05", proxy: "168.158.146.135:12324", status: "ativo" },
      position: { x: 310, y: 1210 }
    },
    {
      id: "b5000000-0000-0000-0000-000000000003",
      map_id: MAP_ID,
      label: "📸 @Jpfreitas_cortes (IG)",
      kind: "canal",
      color: "#EC4899",
      description: "Perfil ativo no Instagram focado em cortes, transformações e tração orgânica.",
      stage_role: "Perfil Orgânico Principal",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { handle: "@Jpfreitas_cortes", tipo: "instagram", status: "ativo", cloud_phone: "04" },
      position: { x: 550, y: 1210 }
    },
    {
      id: "b5000000-0000-0000-0000-000000000004",
      map_id: MAP_ID,
      label: "📸 @tudo.sobre.intestino (IG)",
      kind: "canal",
      color: "#EC4899",
      description: "Perfil de nicho de saúde intestinal, desinchaço e longevidade. Alimenta o LinfaFlow e MemoFlow.",
      stage_role: "Canal de Conteúdo DTC",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { handle: "@tudo.sobre.intestino", tipo: "instagram", status: "ativo", cloud_phone: "05" },
      position: { x: 790, y: 1210 }
    },
    {
      id: "b5000000-0000-0000-0000-000000000005",
      map_id: MAP_ID,
      label: "📸 @chloeharper.of (Aquecendo)",
      kind: "canal",
      color: "#F59E0B",
      description: "Conta em esteira de aquecimento progressivo de 10 dias sem link na bio.",
      stage_role: "Aquecimento de Conta",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { handle: "@chloeharper.of", status: "aquecendo", cloud_phone: "04" },
      position: { x: 70, y: 1400 }
    },
    {
      id: "b5000000-0000-0000-0000-000000000006",
      map_id: MAP_ID,
      label: "📸 @marysievert (DTC Saúde)",
      kind: "canal",
      color: "#EC4899",
      description: "Canal de autoridade em saúde e rotina matinal. Modelo para criativos de UGC.",
      stage_role: "Referência & UGC Orgânico",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { handle: "@marysievert", nicho: "Saúde Intestinal", cloud_phone: "05" },
      position: { x: 310, y: 1400 }
    },

    // Frame 6: Central de Ferramentas & Acessos
    {
      id: "b6000000-0000-0000-0000-000000000001",
      map_id: MAP_ID,
      label: "🤖 Evolution API (WhatsApp Engine)",
      kind: "processo",
      color: "#10B981",
      description: "Servidor WhatsApp dedicado com multi-instâncias (jpfreitas, linfaflow) e monitor de saúde ativo.",
      stage_role: "Disparos & Atendimento SDR",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "evolution_api", url: "https://darkadvanced-evolution-api.llxtug.easypanel.host", status: "conectado" },
      position: { x: 1150, y: 1210 }
    },
    {
      id: "b6000000-0000-0000-0000-000000000002",
      map_id: MAP_ID,
      label: "⚡ Zernio Meta Gateway",
      kind: "canal",
      color: "#3B82F6",
      description: "Automação oficial de Instagram Direct, resposta de stories e captura de comentários de anúncios.",
      stage_role: "Automação Direct & Comentários",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "zernio", status: "ativo", webhook: "/instagram-api" },
      position: { x: 1390, y: 1210 }
    },
    {
      id: "b6000000-0000-0000-0000-000000000003",
      map_id: MAP_ID,
      label: "🔄 N8N Pipeline Runner",
      kind: "processo",
      color: "#F59E0B",
      description: "Orquestrador de webhooks, filas assíncronas e disparo de campanhas entre plataformas.",
      stage_role: "Orquestrador Central de Webhooks",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "n8n", url: "https://darkadvanced-n8n.llxtug.easypanel.host", login: "vsugamele@gmail.com" },
      position: { x: 1630, y: 1210 }
    },
    {
      id: "b6000000-0000-0000-0000-000000000004",
      map_id: MAP_ID,
      label: "💳 Gateways Kiwify & Ticto",
      kind: "processo",
      color: "#8B5CF6",
      description: "Checkout transparente, Pix com baixa instantânea, recuperação de carrinho e split de comissões.",
      stage_role: "Processamento de Pagamento",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "gateways", providers: ["kiwify", "ticto", "hotmart"] },
      position: { x: 1870, y: 1210 }
    },
    {
      id: "b6000000-0000-0000-0000-000000000005",
      map_id: MAP_ID,
      label: "📊 Meta Ads Manager & CAPI",
      kind: "canal",
      color: "#3B82F6",
      description: "Campanhas C1 e C2, sincronização de ROAS a cada 6h e upload de conversões offline.",
      stage_role: "Gestor de Anúncios e CAPI",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "meta_ads", pixel: "fb_pixel_id", sync: "facebook-ads-sync-all" },
      position: { x: 1150, y: 1400 }
    },
    {
      id: "b6000000-0000-0000-0000-000000000006",
      map_id: MAP_ID,
      label: "🧠 OpenRouter / OpenAI (Cérebro IA)",
      kind: "processo",
      color: "#D6FF4B",
      description: "Modelos Claude 3.5 Sonnet, GPT-4o e Gemini para copywriters, roteiristas e agentes SDR.",
      stage_role: "Inteligência Artificial Central",
      executor_type: "EXTERNAL_TOOL",
      api_binding: { service: "openrouter", models: ["claude-3-5-sonnet", "gpt-4o-mini"] },
      position: { x: 1390, y: 1400 }
    }
  ];

  for (const node of nodes) {
    const { error } = await supabase.from("imphq_company_map_nodes").upsert(node);
    if (error) console.error("Erro ao inserir nó:", error);
  }

  // 3. Inserir Edges (Conexões)
  const edges = [
    // GeeLark 04 alimenta JP Freitas Cortes
    {
      id: "e5000000-0000-0000-0000-000000000001",
      map_id: MAP_ID,
      source_id: "b5000000-0000-0000-0000-000000000001",
      target_id: "b5000000-0000-0000-0000-000000000003",
      label: "hospeda perfil",
      style: { stroke: "#06B6D4" }
    },
    // GeeLark 05 alimenta Tudo Sobre Intestino
    {
      id: "e5000000-0000-0000-0000-000000000002",
      map_id: MAP_ID,
      source_id: "b5000000-0000-0000-0000-000000000002",
      target_id: "b5000000-0000-0000-0000-000000000004",
      label: "hospeda perfil",
      style: { stroke: "#06B6D4" }
    },
    // JP Cortes conecta ao Comment-to-DM da Máquina Orgânica
    {
      id: "e5000000-0000-0000-0000-000000000003",
      map_id: MAP_ID,
      source_id: "b5000000-0000-0000-0000-000000000003",
      target_id: "a1000000-0000-0000-0000-000000000006",
      label: "dispara comment-to-dm",
      style: { stroke: "#EC4899" }
    },
    // Intestino conecta ao Advertorial de Saúde DTC
    {
      id: "e5000000-0000-0000-0000-000000000004",
      map_id: MAP_ID,
      source_id: "b5000000-0000-0000-0000-000000000004",
      target_id: "a3000000-0000-0000-0000-000000000003",
      label: "link na bio / story",
      style: { stroke: "#EC4899" }
    },
    // Evolution API conecta na Recuperação de Carrinho JP
    {
      id: "e6000000-0000-0000-0000-000000000001",
      map_id: MAP_ID,
      source_id: "b6000000-0000-0000-0000-000000000001",
      target_id: "a2000000-0000-0000-0000-000000000004",
      label: "envia 3 toques Pix",
      style: { stroke: "#10B981" }
    },
    // Zernio conecta na DM do Instagram
    {
      id: "e6000000-0000-0000-0000-000000000002",
      map_id: MAP_ID,
      source_id: "b6000000-0000-0000-0000-000000000002",
      target_id: "a1000000-0000-0000-0000-000000000007",
      label: "webhook direto",
      style: { stroke: "#3B82F6" }
    },
    // Kiwify & Ticto conecta no Checkout Código dos Cortes
    {
      id: "e6000000-0000-0000-0000-000000000003",
      map_id: MAP_ID,
      source_id: "b6000000-0000-0000-0000-000000000004",
      target_id: "a2000000-0000-0000-0000-000000000003",
      label: "processa checkout",
      style: { stroke: "#8B5CF6" }
    }
  ];

  for (const edge of edges) {
    const { error } = await supabase.from("imphq_company_map_edges").upsert(edge);
    if (error) console.error("Erro ao inserir edge:", error);
  }

  console.log("Sucesso! 2 novos frames, 12 novos nós e 7 conexões inseridos.");
}

run();
