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
];
