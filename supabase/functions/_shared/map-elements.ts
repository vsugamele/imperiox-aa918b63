// Catálogo único dos tipos de elemento do Mapa (canvas, motor de lacunas e MCP).
// TS puro e sem dependências. As chaves existentes nunca mudam: os mapas já salvos continuam válidos.

export type ElementFamily =
  | "estrutura" | "trafego" | "paginas" | "ofertas" | "acoes" | "comunicacao" | "integracoes" | "midia";

/** Fase do funil em que o elemento atua; "operacao" = não é etapa do cliente (estrutura, integração, mídia). */
export type FunnelPhase = "aquisicao" | "conversao" | "ascensao" | "relacionamento" | "operacao";

export interface MapElementType {
  key: string;
  label: string;
  family: ElementFamily;
  phase: FunnelPhase;
  color: string;
  /** Nome do ícone lucide-react; o frontend resolve (fallback por família). */
  icon: string;
}

export const ELEMENT_FAMILIES: Array<{ key: ElementFamily; label: string }> = [
  { key: "trafego", label: "Tráfego e redes" },
  { key: "paginas", label: "Páginas" },
  { key: "ofertas", label: "Ofertas e produto" },
  { key: "acoes", label: "Ações e eventos" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "integracoes", label: "Integrações" },
  { key: "estrutura", label: "Estrutura" },
  { key: "midia", label: "Mídia" },
];

export const FUNNEL_PHASES: Array<{ key: FunnelPhase; label: string }> = [
  { key: "aquisicao", label: "Aquisição" },
  { key: "conversao", label: "Conversão" },
  { key: "ascensao", label: "Ascensão" },
  { key: "relacionamento", label: "Relacionamento" },
  { key: "operacao", label: "Operação" },
];

const el = (key: string, label: string, family: ElementFamily, phase: FunnelPhase, color: string, icon: string): MapElementType =>
  ({ key, label, family, phase, color, icon });

export const MAP_ELEMENTS: MapElementType[] = [
  // ── Estrutura (chaves existentes)
  el("vertical", "Vertical / Unidade", "estrutura", "operacao", "#c9922a", "Building2"),
  el("area", "Área / Time", "estrutura", "operacao", "#3b82f6", "Users"),
  el("processo", "Processo", "estrutura", "operacao", "#8b5cf6", "Wrench"),
  el("meta", "Meta / KPI", "estrutura", "operacao", "#ef4444", "Target"),
  el("doc", "Documento", "estrutura", "operacao", "#64748b", "FileText"),

  // ── Tráfego e redes
  el("anuncio", "Anúncio / Tráfego", "trafego", "aquisicao", "#eab308", "Target"),
  el("meta_ads", "Meta Ads", "trafego", "aquisicao", "#1877f2", "Megaphone"),
  el("google_ads", "Google Ads", "trafego", "aquisicao", "#4285f4", "Search"),
  el("youtube_ads", "YouTube Ads", "trafego", "aquisicao", "#ff0000", "Youtube"),
  el("tiktok_ads", "TikTok Ads", "trafego", "aquisicao", "#25f4ee", "Music2"),
  el("kwai", "Kwai", "trafego", "aquisicao", "#ff7a00", "Film"),
  el("native_ads", "Native Ads (Taboola/Outbrain)", "trafego", "aquisicao", "#0ea5e9", "Newspaper"),
  el("trafego_organico", "Tráfego orgânico", "trafego", "aquisicao", "#22c55e", "Sprout"),
  el("seo", "Busca (SEO)", "trafego", "aquisicao", "#16a34a", "Search"),
  el("influenciador", "Influenciador / Parceria", "trafego", "aquisicao", "#db2777", "UserCheck"),
  el("instagram", "Instagram", "trafego", "aquisicao", "#e1306c", "Instagram"),
  el("reels", "Reels", "trafego", "aquisicao", "#e1306c", "Clapperboard"),
  el("stories", "Stories", "trafego", "aquisicao", "#c13584", "CircleDashed"),
  el("live", "Live", "trafego", "aquisicao", "#ef4444", "Radio"),
  el("facebook", "Facebook", "trafego", "aquisicao", "#1877f2", "Facebook"),
  el("youtube", "YouTube", "trafego", "aquisicao", "#ff0000", "Youtube"),
  el("tiktok", "TikTok", "trafego", "aquisicao", "#000000", "Music2"),
  el("linkedin", "LinkedIn", "trafego", "aquisicao", "#0a66c2", "Linkedin"),
  el("twitter", "X / Twitter", "trafego", "aquisicao", "#1da1f2", "Twitter"),

  // ── Páginas
  el("captura", "Captura / Optin", "paginas", "aquisicao", "#06b6d4", "MousePointerClick"),
  el("advertorial", "Advertorial", "paginas", "aquisicao", "#f59e0b", "Newspaper"),
  el("quiz", "Quiz / Pesquisa", "paginas", "aquisicao", "#14b8a6", "ListChecks"),
  el("webinar", "Página de Webinar", "paginas", "aquisicao", "#6366f1", "Presentation"),
  el("replay", "Replay de Webinar", "paginas", "conversao", "#818cf8", "PlayCircle"),
  el("vsl", "VSL", "paginas", "conversao", "#ec4899", "Film"),
  el("pagina_vendas", "Página de Vendas", "paginas", "conversao", "#f97316", "Globe"),
  el("agendar_reuniao", "Agendar reunião", "paginas", "conversao", "#0ea5e9", "CalendarClock"),
  el("checkout", "Checkout", "paginas", "conversao", "#84cc16", "CreditCard"),
  el("pagina_oto", "Página OTO", "paginas", "ascensao", "#22c55e", "Zap"),
  el("obrigado", "Página de Obrigado", "paginas", "relacionamento", "#10b981", "PartyPopper"),
  el("area_membros", "Área de Membros", "paginas", "relacionamento", "#a855f7", "GraduationCap"),
  el("comunidade", "Comunidade", "paginas", "relacionamento", "#8b5cf6", "Users"),
  el("blog", "Blog / Conteúdo", "paginas", "aquisicao", "#64748b", "BookOpen"),

  // ── Ofertas e produto
  el("oferta", "Oferta / Produto", "ofertas", "conversao", "#10b981", "ShoppingCart"),
  el("isca", "Isca / Lead magnet", "ofertas", "aquisicao", "#06b6d4", "Gift"),
  el("orderbump", "Orderbump", "ofertas", "ascensao", "#fbbf24", "PackagePlus"),
  el("upsell", "Upsell", "ofertas", "ascensao", "#22c55e", "TrendingUp"),
  el("downsell", "Downsell", "ofertas", "ascensao", "#f43f5e", "TrendingDown"),
  el("app", "APP / Produto", "ofertas", "relacionamento", "#0ea5e9", "Smartphone"),
  el("assinatura", "Assinatura / Recorrência", "ofertas", "relacionamento", "#a855f7", "Repeat"),

  // ── Ações e eventos (podem ser ligados a dados reais)
  el("lead", "Lead capturado", "acoes", "aquisicao", "#06b6d4", "UserPlus"),
  el("carrinho_abandonado", "Carrinho abandonado", "acoes", "conversao", "#f97316", "ShoppingCart"),
  el("gerou_pix", "Gerou PIX", "acoes", "conversao", "#14b8a6", "QrCode"),
  el("boleto", "Emissão de boleto", "acoes", "conversao", "#64748b", "Receipt"),
  el("compra", "Compra aprovada", "acoes", "conversao", "#22c55e", "BadgeCheck"),
  el("recusou", "Recusou oferta", "acoes", "ascensao", "#f43f5e", "XCircle"),
  el("reembolso", "Reembolso", "acoes", "relacionamento", "#ef4444", "Undo2"),
  el("recuperacao", "Recuperação", "acoes", "conversao", "#f59e0b", "LifeBuoy"),
  el("remarketing", "Remarketing", "acoes", "aquisicao", "#eab308", "RotateCcw"),
  el("follow_up", "Follow-up", "acoes", "relacionamento", "#8b5cf6", "MessageSquareReply"),
  el("tag", "Tag", "acoes", "operacao", "#94a3b8", "Tag"),
  el("esperar", "Esperar", "acoes", "operacao", "#94a3b8", "Hourglass"),
  el("condicao", "Se / ou (condição)", "acoes", "operacao", "#94a3b8", "GitFork"),

  // ── Comunicação
  el("whatsapp", "WhatsApp", "comunicacao", "relacionamento", "#25d366", "MessageCircle"),
  el("whatsapp_sequencia", "Sequência de WhatsApp", "comunicacao", "relacionamento", "#25d366", "MessagesSquare"),
  el("grupo_whatsapp", "Grupo de WhatsApp", "comunicacao", "relacionamento", "#128c7e", "Users"),
  el("email", "E-mail / Nurture", "comunicacao", "relacionamento", "#818cf8", "Mail"),
  el("email_avulso", "E-mail avulso", "comunicacao", "relacionamento", "#a5b4fc", "Send"),
  el("dm_instagram", "DM Instagram", "comunicacao", "relacionamento", "#e1306c", "Send"),
  el("sms", "SMS", "comunicacao", "relacionamento", "#64748b", "MessageSquare"),
  el("ligacao", "Ligação", "comunicacao", "conversao", "#22c55e", "Phone"),
  el("canal", "Canal (genérico)", "comunicacao", "operacao", "#f59e0b", "Megaphone"),

  // ── Integrações
  el("ticto", "Ticto", "integracoes", "operacao", "#6d28d9", "Plug"),
  el("kiwify", "Kiwify", "integracoes", "operacao", "#16a34a", "Plug"),
  el("hotmart", "Hotmart", "integracoes", "operacao", "#f04e23", "Plug"),
  el("eduzz", "Eduzz", "integracoes", "operacao", "#0055ff", "Plug"),
  el("perfectpay", "PerfectPay", "integracoes", "operacao", "#2563eb", "Plug"),
  el("braip", "Braip", "integracoes", "operacao", "#0f766e", "Plug"),
  el("monetizze", "Monetizze", "integracoes", "operacao", "#0284c7", "Plug"),
  el("stripe", "Stripe", "integracoes", "operacao", "#635bff", "Plug"),
  el("whop", "Whop", "integracoes", "operacao", "#ff6243", "Plug"),
  el("mercado_pago", "Mercado Pago", "integracoes", "operacao", "#00b1ea", "Plug"),
  el("evolution_api", "WhatsApp API (Evolution)", "integracoes", "operacao", "#25d366", "Plug"),
  el("manychat", "ManyChat", "integracoes", "operacao", "#0084ff", "Bot"),
  el("pixel_meta", "Pixel Meta", "integracoes", "operacao", "#1877f2", "Crosshair"),
  el("utmify", "UTMify", "integracoes", "operacao", "#f97316", "Crosshair"),
  el("google_analytics", "Google Analytics / GTM", "integracoes", "operacao", "#f9ab00", "BarChart3"),
  el("vturb", "VTurb", "integracoes", "operacao", "#7c3aed", "PlayCircle"),
  el("panda_video", "Panda Video", "integracoes", "operacao", "#10b981", "PlayCircle"),
  el("n8n", "n8n", "integracoes", "operacao", "#ea4b71", "Workflow"),
  el("zapier", "Zapier / Make", "integracoes", "operacao", "#ff4a00", "Workflow"),
  el("calendly", "Calendly", "integracoes", "operacao", "#006bff", "Calendar"),
  el("activecampaign", "ActiveCampaign / RD", "integracoes", "operacao", "#356ae6", "Mail"),
  el("memberkit", "MemberKit / Cademí", "integracoes", "operacao", "#a855f7", "GraduationCap"),
  el("supabase", "Supabase / Banco", "integracoes", "operacao", "#3ecf8e", "Database"),
  el("vercel", "Vercel / Hospedagem", "integracoes", "operacao", "#e5e7eb", "Triangle"),
  el("ia", "IA (Claude/GPT/Gemini)", "integracoes", "operacao", "#d97757", "Sparkles"),

  // ── Mídia
  el("imagem", "Imagem", "midia", "operacao", "#c9922a", "Image"),
];

const BY_KEY: Record<string, MapElementType> = Object.fromEntries(MAP_ELEMENTS.map((e) => [e.key, e]));

export function elementType(key: string | null | undefined): MapElementType | undefined {
  return key ? BY_KEY[key] : undefined;
}

export function phaseOf(key: string | null | undefined): FunnelPhase {
  return elementType(key)?.phase ?? "operacao";
}
