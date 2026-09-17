// Pacotes pré-configurados de ativos para o Product Hub

export interface AssetPackage {
  id: string;
  label: string;
  description: string;
  emoji: string;
  items: Array<{ catId: string; itemId: string }>;
  // Conexões pré-definidas entre ativos (chaves catId:itemId)
  edges?: Array<{ from: string; to: string; label?: string }>;
}

export const ASSET_PACKAGES: AssetPackage[] = [
  {
    id: "lancamento",
    label: "Lançamento Completo",
    description: "VSL + copies + emails + ads para lançamento",
    emoji: "🚀",
    items: [
      { catId: "vsl", itemId: "vsl_7blocos" },
      { catId: "vsl", itemId: "hero" },
      { catId: "vsl", itemId: "cta" },
      { catId: "ads", itemId: "copy_anuncio" },
      { catId: "ads", itemId: "criativos" },
      { catId: "ads", itemId: "headlines" },
      { catId: "ads", itemId: "ganchos_impactantes" },
      { catId: "copy", itemId: "promessas" },
      { catId: "copy", itemId: "mecanismos" },
      { catId: "copy", itemId: "oferta_devastadora" },
      { catId: "emails", itemId: "nutricao" },
      { catId: "emails", itemId: "pitch" },
      { catId: "emails", itemId: "recuperacao" },
      { catId: "publico", itemId: "avatar_4" },
      { catId: "publico", itemId: "objecoes" },
    ],
  },
  {
    id: "perpetuo",
    label: "Perpétuo (Escada)",
    description: "Tripwire + Core + Upsell + Recuperação",
    emoji: "♻️",
    items: [
      { catId: "ofertas", itemId: "tripwire" },
      { catId: "ofertas", itemId: "core" },
      { catId: "ofertas", itemId: "premium" },
      { catId: "ofertas", itemId: "bonus" },
      { catId: "produto", itemId: "order_bump" },
      { catId: "produto", itemId: "upsell" },
      { catId: "produto", itemId: "downsell" },
      { catId: "estrategias", itemId: "escada_valor" },
      { catId: "emails", itemId: "recuperacao" },
    ],
  },
  {
    id: "organico_reels",
    label: "Tráfego Orgânico (Reels)",
    description: "Reels + Stories + Headlines + Ganchos",
    emoji: "🎬",
    items: [
      { catId: "scripts", itemId: "reels" },
      { catId: "scripts", itemId: "stories" },
      { catId: "ads", itemId: "headlines" },
      { catId: "ads", itemId: "ganchos_impactantes" },
      { catId: "ads", itemId: "ganchos_agressivos" },
      { catId: "ads", itemId: "arma_curiosidade" },
      { catId: "ads", itemId: "verdade_devastadora" },
    ],
  },
  {
    id: "diagnostico",
    label: "Diagnóstico Profundo",
    description: "Avatar, dores, desejos, objeções, reposicionamento",
    emoji: "🔬",
    items: [
      { catId: "publico", itemId: "avatar_4" },
      { catId: "publico", itemId: "dores" },
      { catId: "publico", itemId: "desejos" },
      { catId: "publico", itemId: "objecoes" },
      { catId: "estrategias", itemId: "reposicionamento" },
      { catId: "estrategias", itemId: "mapa_funil" },
      { catId: "ads", itemId: "tormento_real" },
    ],
  },
  {
    id: "dm_consultiva",
    label: "DM / WhatsApp Consultivo",
    description: "Scripts de mensagem + objeções + oferta",
    emoji: "💬",
    items: [
      { catId: "scripts", itemId: "dm" },
      { catId: "publico", itemId: "objecoes" },
      { catId: "copy", itemId: "oferta_devastadora" },
      { catId: "copy", itemId: "promessas" },
    ],
  },
  {
    id: "escada_valor_full",
    label: "Escada de Valor Completa",
    description: "Tripwire → Core → OrderBump → Upsell → Downsell conectados",
    emoji: "🪜",
    items: [
      { catId: "ofertas", itemId: "tripwire" },
      { catId: "ofertas", itemId: "core" },
      { catId: "produto", itemId: "order_bump" },
      { catId: "produto", itemId: "upsell" },
      { catId: "produto", itemId: "downsell" },
    ],
    edges: [
      { from: "ofertas:tripwire", to: "ofertas:core", label: "upsell" },
      { from: "ofertas:core", to: "produto:order_bump", label: "bump" },
      { from: "produto:order_bump", to: "produto:upsell", label: "pós-compra" },
      { from: "produto:upsell", to: "produto:downsell", label: "se recusar" },
    ],
  },
  {
    id: "lancamento_fluxo_wa",
    label: "Lançamento + Fluxo WhatsApp",
    description: "Ads → VSL → Checkout → Scripts WA pós-pagamento",
    emoji: "📲",
    items: [
      { catId: "ads", itemId: "copy_anuncio" },
      { catId: "vsl", itemId: "vsl_7blocos" },
      { catId: "vsl", itemId: "cta" },
      { catId: "eventos_wa", itemId: "pix_gerado" },
      { catId: "eventos_wa", itemId: "boleto_gerado" },
      { catId: "eventos_wa", itemId: "compra_aprovada" },
      { catId: "eventos_wa", itemId: "pagamento_recusado" },
    ],
    edges: [
      { from: "ads:copy_anuncio", to: "vsl:vsl_7blocos" },
      { from: "vsl:vsl_7blocos", to: "vsl:cta", label: "cta" },
      { from: "vsl:cta", to: "eventos_wa:pix_gerado", label: "pix" },
      { from: "vsl:cta", to: "eventos_wa:boleto_gerado", label: "boleto" },
      { from: "eventos_wa:pix_gerado", to: "eventos_wa:compra_aprovada", label: "ok" },
      { from: "eventos_wa:boleto_gerado", to: "eventos_wa:compra_aprovada", label: "ok" },
      { from: "vsl:cta", to: "eventos_wa:pagamento_recusado", label: "falhou" },
    ],
  },
  {
    id: "recuperacao_multi",
    label: "Recuperação Multi-canal",
    description: "Carrinho abandonado → Email + WA em paralelo",
    emoji: "🔁",
    items: [
      { catId: "eventos_email", itemId: "email_carrinho" },
      { catId: "eventos_wa", itemId: "checkout_abandonado" },
      { catId: "eventos_email", itemId: "email_pix" },
      { catId: "eventos_wa", itemId: "pix_gerado" },
      { catId: "eventos_email", itemId: "email_boleto" },
      { catId: "eventos_wa", itemId: "boleto_gerado" },
    ],
    edges: [
      { from: "eventos_email:email_carrinho", to: "eventos_wa:checkout_abandonado", label: "+30min" },
      { from: "eventos_email:email_pix", to: "eventos_wa:pix_gerado", label: "lembrete" },
      { from: "eventos_email:email_boleto", to: "eventos_wa:boleto_gerado", label: "lembrete" },
    ],
  },
];

