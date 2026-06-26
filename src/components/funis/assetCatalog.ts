export type AssetItem = { id: string; label: string; intent: string; promptHint: string };
export type AssetCategory = { id: string; label: string; color: ColorKey; items: AssetItem[] };

export type ColorKey =
  | "emerald" | "amber" | "sky" | "violet" | "rose" | "pink" | "cyan" | "indigo" | "fuchsia";

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: "produto", label: "Produto", color: "emerald", items: [
      { id: "order_bump", label: "Order Bump", intent: "criativo_imperador", promptHint: "Crie um Order Bump irresistível para o produto (nome + copy + preço sugerido)." },
      { id: "upsell", label: "Upsell", intent: "criativo_imperador", promptHint: "Crie um Upsell de alta conversão (oferta + copy + objeções quebradas)." },
      { id: "downsell", label: "Downsell", intent: "criativo_imperador", promptHint: "Crie um Downsell para recuperar quem recusou o Upsell." },
    ]
  },
  {
    id: "ofertas", label: "Ofertas", color: "amber", items: [
      { id: "tripwire", label: "Tripwire", intent: "diagnostico_imperador", promptHint: "Desenhe uma oferta Tripwire (R$7-97) específica para este produto, com formato, preço-âncora, copy e quick win." },
      { id: "core", label: "Core Offer", intent: "diagnostico_imperador", promptHint: "Desenhe a Core Offer principal (entrega + bônus + garantia + preço)." },
      { id: "premium", label: "Oferta Premium", intent: "diagnostico_imperador", promptHint: "Desenhe a Oferta Premium / High Ticket." },
      { id: "bonus", label: "Bônus", intent: "criativo_imperador", promptHint: "Liste 5 bônus poderosos para empilhar valor (nome + valor percebido + descrição)." },
    ]
  },
  {
    id: "publico", label: "Público-alvo", color: "sky", items: [
      { id: "avatar_4", label: "Avatar 4 Camadas", intent: "diagnostico_imperador", promptHint: "Mapeie o avatar em 4 camadas: superficial, emocional, identidade, espiritual." },
      { id: "dores", label: "Dores", intent: "diagnostico_imperador", promptHint: "Liste as 7 dores latentes mais profundas do avatar (frase em primeira pessoa)." },
      { id: "desejos", label: "Desejos", intent: "diagnostico_imperador", promptHint: "Liste 7 desejos ardentes do avatar." },
      { id: "objecoes", label: "Objeções", intent: "diagnostico_imperador", promptHint: "Liste as 10 objeções mais comuns e como quebrar cada uma." },
    ]
  },
  {
    id: "estrategias", label: "Estratégias", color: "violet", items: [
      { id: "escada_valor", label: "Escada de Valor", intent: "diagnostico_imperador", promptHint: "Desenhe a Escada de Valor completa: isca → tripwire → core → premium → recorrente." },
      { id: "mapa_funil", label: "Mapa de Funil", intent: "diagnostico_imperador", promptHint: "Desenhe o funil completo (tráfego → lead → pitch → venda → upsell)." },
      { id: "reposicionamento", label: "Reposicionamento", intent: "diagnostico_imperador", promptHint: "Reposicione o produto contra os concorrentes mais óbvios." },
    ]
  },
  {
    id: "ads", label: "Ativos para Anúncios", color: "rose", items: [
      { id: "copy_anuncio", label: "Copy para Anúncio", intent: "criativo_imperador", promptHint: "Crie 5 copies de anúncio (Meta) curtas e devastadoras com headline + corpo + CTA." },
      { id: "criativos", label: "Criativos", intent: "criativo_imperador", promptHint: "Descreva 5 conceitos visuais de criativos (imagem/vídeo) com hook visual e legenda." },
      { id: "headlines", label: "Headlines", intent: "criativo_imperador", promptHint: "Liste 15 headlines de impacto para anúncios." },
      { id: "ganchos_impactantes", label: "Ganchos Impactantes", intent: "criativo_imperador", promptHint: "Liste 10 ganchos de abertura impactantes (3s)." },
      { id: "verdade_devastadora", label: "Verdade Devastadora", intent: "criativo_imperador", promptHint: "Escreva 5 verdades devastadoras que rompem padrão e geram identificação imediata." },
      { id: "tormento_real", label: "Tormento Real", intent: "criativo_imperador", promptHint: "Descreva o tormento real diário do avatar em primeira pessoa (cenas concretas)." },
      { id: "ganchos_agressivos", label: "Ganchos Agressivos", intent: "criativo_imperador", promptHint: "10 ganchos agressivos e polêmicos." },
      { id: "arma_curiosidade", label: "Arma da Curiosidade", intent: "criativo_imperador", promptHint: "10 aberturas que geram curiosidade impossível de ignorar." },
    ]
  },
  {
    id: "copy", label: "Copywriting", color: "pink", items: [
      { id: "nomes_viciantes", label: "Nomes Viciantes", intent: "criativo_imperador", promptHint: "Crie 10 nomes viciantes para o produto/método (com marca ©/®)." },
      { id: "promessas", label: "Promessas", intent: "criativo_imperador", promptHint: "Crie 7 promessas específicas e mensuráveis (resultado + prazo)." },
      { id: "mecanismos", label: "Mecanismos", intent: "criativo_imperador", promptHint: "Crie o Mecanismo Único do produto (nome + como funciona em 5 passos)." },
      { id: "metodologia", label: "Metodologia", intent: "diagnostico_imperador", promptHint: "Estruture a metodologia em pilares (3-5 pilares com nome próprio)." },
      { id: "oferta_devastadora", label: "Oferta Devastadora", intent: "diagnostico_imperador", promptHint: "Empilhe a oferta devastadora: entrega + bônus + garantia + preço + urgência." },
      { id: "proposta_unica", label: "Proposta Única", intent: "criativo_imperador", promptHint: "Escreva a USP em 1 frase + 3 variações." },
    ]
  },
  {
    id: "scripts", label: "Scripts", color: "cyan", items: [
      { id: "reels", label: "Reels", intent: "post_ig", promptHint: "Roteiros para 5 Reels virais de 30s com hook + entrega + CTA." },
      { id: "stories", label: "Stories", intent: "post_ig", promptHint: "Sequência de 10 stories de aquecimento + pitch." },
      { id: "lives", label: "Lives", intent: "vsl", promptHint: "Roteiro de live de aquecimento (45min) com blocos e CTA." },
      { id: "dm", label: "DM / Mensagens", intent: "conversa_imperador", promptHint: "Sequência de 5 DMs consultivas para fechar venda." },
    ]
  },
  {
    id: "emails", label: "Gerador de Emails", color: "indigo", items: [
      { id: "boas_vindas", label: "Boas-vindas", intent: "email_nutricao", promptHint: "Email de boas-vindas (assunto + corpo) com história + promessa." },
      { id: "nutricao", label: "Sequência de Nutrição", intent: "email_nutricao", promptHint: "Sequência de 5 emails de nutrição (assunto + corpo + CTA por email)." },
      { id: "pitch", label: "Email de Pitch", intent: "email_nutricao", promptHint: "Email de pitch direto com CTA forte." },
      { id: "recuperacao", label: "Recuperação de Carrinho", intent: "email_nutricao", promptHint: "Sequência de 3 emails de recuperação de carrinho." },
    ]
  },
  {
    id: "vsl", label: "Scripts para VSL", color: "fuchsia", items: [
      { id: "vsl_7blocos", label: "VSL 7 Blocos", intent: "vsl_imperador", promptHint: "Estruture VSL completa em 7 blocos (hook → CTA) com timing." },
      { id: "hero", label: "Hero", intent: "vsl_imperador", promptHint: "Bloco Hero (60s) com promessa central." },
      { id: "promessa", label: "Promessa", intent: "vsl_imperador", promptHint: "Bloco Promessa (mecanismo + transformação)." },
      { id: "mecanismo_vsl", label: "Mecanismo", intent: "vsl_imperador", promptHint: "Bloco Mecanismo único explicado em 3min." },
      { id: "prova", label: "Prova", intent: "vsl_imperador", promptHint: "Bloco Prova (cases, autoridade, escassez)." },
      { id: "cta", label: "CTA", intent: "vsl_imperador", promptHint: "Bloco CTA com fechamento devastador." },
    ]
  },
];

export const COLOR_TOKENS: Record<ColorKey, { border: string; bg: string; text: string; header: string; soft: string }> = {
  emerald: { border: "border-emerald-500/50", bg: "bg-emerald-500/5", text: "text-emerald-300", header: "bg-emerald-900/40 text-emerald-200", soft: "bg-emerald-500/10" },
  amber:   { border: "border-amber-500/50",   bg: "bg-amber-500/5",   text: "text-amber-300",   header: "bg-amber-900/40 text-amber-200",   soft: "bg-amber-500/10" },
  sky:     { border: "border-sky-500/50",     bg: "bg-sky-500/5",     text: "text-sky-300",     header: "bg-sky-900/40 text-sky-200",       soft: "bg-sky-500/10" },
  violet:  { border: "border-violet-500/50",  bg: "bg-violet-500/5",  text: "text-violet-300",  header: "bg-violet-900/40 text-violet-200", soft: "bg-violet-500/10" },
  rose:    { border: "border-rose-500/50",    bg: "bg-rose-500/5",    text: "text-rose-300",    header: "bg-rose-900/40 text-rose-200",     soft: "bg-rose-500/10" },
  pink:    { border: "border-pink-500/50",    bg: "bg-pink-500/5",    text: "text-pink-300",    header: "bg-pink-900/40 text-pink-200",     soft: "bg-pink-500/10" },
  cyan:    { border: "border-cyan-500/50",    bg: "bg-cyan-500/5",    text: "text-cyan-300",    header: "bg-cyan-900/40 text-cyan-200",     soft: "bg-cyan-500/10" },
  indigo:  { border: "border-indigo-500/50",  bg: "bg-indigo-500/5",  text: "text-indigo-300",  header: "bg-indigo-900/40 text-indigo-200", soft: "bg-indigo-500/10" },
  fuchsia: { border: "border-fuchsia-500/50", bg: "bg-fuchsia-500/5", text: "text-fuchsia-300", header: "bg-fuchsia-900/40 text-fuchsia-200", soft: "bg-fuchsia-500/10" },
};

export function findItem(catId: string, itemId: string) {
  const cat = ASSET_CATEGORIES.find(c => c.id === catId);
  const item = cat?.items.find(i => i.id === itemId);
  return cat && item ? { cat, item } : null;
}
