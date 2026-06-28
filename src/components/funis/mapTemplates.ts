// Presets de Mapa da Empresa — nós + arestas posicionados
export interface TemplateNode {
  key: string; // chave local pra ligar edges
  label: string;
  kind: string;
  description?: string;
  position: { x: number; y: number };
  checklist?: { text: string }[];
}
export interface TemplateEdge { from: string; to: string; style?: "solid" | "dashed"; label?: string; }
export interface MapTemplate {
  id: string; name: string; description: string;
  nodes: TemplateNode[]; edges: TemplateEdge[];
}

export const MAP_TEMPLATES: MapTemplate[] = [
  {
    id: "infoprodutor",
    name: "Infoprodutor Solo",
    description: "5 verticais essenciais: Conteúdo, Tráfego, Produto, CRM e Financeiro.",
    nodes: [
      { key: "conteudo", kind: "vertical", label: "Conteúdo", description: "Geração de demanda orgânica", position: { x: 50, y: 50 } },
      { key: "trafego",  kind: "vertical", label: "Tráfego",  description: "Aquisição paga",                position: { x: 280, y: 50 } },
      { key: "produto",  kind: "vertical", label: "Produto",  description: "Oferta, entrega, sucesso",       position: { x: 510, y: 50 } },
      { key: "crm",      kind: "vertical", label: "CRM",      description: "Conversa, follow-up, vendas",    position: { x: 740, y: 50 } },
      { key: "fin",      kind: "vertical", label: "Financeiro", description: "Caixa, custos, lucro",         position: { x: 970, y: 50 } },

      { key: "reels",    kind: "canal",    label: "Reels/Instagram", position: { x: 50,  y: 250 } },
      { key: "ads",      kind: "canal",    label: "Meta Ads",        position: { x: 280, y: 250 } },
      { key: "vsl",      kind: "processo", label: "VSL + Checkout",  position: { x: 510, y: 250 } },
      { key: "wa",       kind: "canal",    label: "WhatsApp IA",     position: { x: 740, y: 250 } },
      { key: "dre",      kind: "doc",      label: "DRE mensal",      position: { x: 970, y: 250 } },

      { key: "meta_fat", kind: "meta",     label: "Meta de faturamento", description: "MRR / Mês", position: { x: 510, y: 450 } },
    ],
    edges: [
      { from: "conteudo", to: "reels" }, { from: "trafego", to: "ads" },
      { from: "produto", to: "vsl" }, { from: "crm", to: "wa" }, { from: "fin", to: "dre" },
      { from: "vsl", to: "meta_fat", style: "dashed", label: "alimenta" },
      { from: "wa", to: "meta_fat", style: "dashed", label: "converte" },
    ],
  },
  {
    id: "agencia",
    name: "Agência / Múltiplos Clientes",
    description: "Time central + uma vertical por cliente.",
    nodes: [
      { key: "core",     kind: "area",     label: "Time Central",   description: "Operações, criativo, mídia", position: { x: 450, y: 50 } },
      { key: "midia",    kind: "processo", label: "Mídia",          position: { x: 250, y: 200 } },
      { key: "criativo", kind: "processo", label: "Criativo",       position: { x: 450, y: 200 } },
      { key: "cs",       kind: "processo", label: "CS / Reuniões",  position: { x: 650, y: 200 } },
      { key: "c1",       kind: "vertical", label: "Cliente A",      position: { x: 100, y: 400 } },
      { key: "c2",       kind: "vertical", label: "Cliente B",      position: { x: 400, y: 400 } },
      { key: "c3",       kind: "vertical", label: "Cliente C",      position: { x: 700, y: 400 } },
    ],
    edges: [
      { from: "core", to: "midia" }, { from: "core", to: "criativo" }, { from: "core", to: "cs" },
      { from: "midia", to: "c1" }, { from: "midia", to: "c2" }, { from: "midia", to: "c3" },
      { from: "criativo", to: "c1", style: "dashed" }, { from: "criativo", to: "c2", style: "dashed" }, { from: "criativo", to: "c3", style: "dashed" },
    ],
  },
  {
    id: "lancador",
    name: "Lançador",
    description: "Fases clássicas: Pré, CPL, Carrinho, Pós e Recorrência.",
    nodes: [
      { key: "pre",   kind: "vertical", label: "Pré-lançamento", position: { x: 50,  y: 100 } },
      { key: "cpl",   kind: "vertical", label: "CPLs",           position: { x: 280, y: 100 } },
      { key: "cart",  kind: "vertical", label: "Carrinho Aberto",position: { x: 510, y: 100 } },
      { key: "pos",   kind: "vertical", label: "Pós-carrinho",   position: { x: 740, y: 100 } },
      { key: "rec",   kind: "vertical", label: "Recorrência",    position: { x: 970, y: 100 } },
      { key: "capt",  kind: "canal",    label: "Captação Ads",   position: { x: 50,  y: 300 } },
      { key: "live",  kind: "canal",    label: "Lives/Aulas",    position: { x: 280, y: 300 } },
      { key: "ck",    kind: "processo", label: "Checkout + Upsell", position: { x: 510, y: 300 } },
      { key: "rec_wa",kind: "canal",    label: "WA Recuperação", position: { x: 740, y: 300 } },
      { key: "ascend",kind: "oferta",   label: "Ascensão / High Ticket", position: { x: 970, y: 300 } },
    ],
    edges: [
      { from: "pre", to: "capt" }, { from: "cpl", to: "live" },
      { from: "cart", to: "ck" }, { from: "pos", to: "rec_wa" }, { from: "rec", to: "ascend" },
      { from: "capt", to: "live", style: "dashed" }, { from: "live", to: "ck", style: "dashed" }, { from: "ck", to: "rec_wa", style: "dashed" },
    ],
  },
];
