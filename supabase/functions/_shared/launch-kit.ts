// Kit de operação (LAUNCH1.1): canais que um projeto pode rodar, o que cada um exige de acesso e de ferramenta,
// e quais playbooks aplica. TS puro: CLI (scripts/launch.mjs), MCP (get_project_kit) e o lançador usam a mesma regra.
// Senha nunca entra aqui: o Império guarda só o status do acesso e quem é o dono da pendência.

export type ChannelKey = "youtube" | "seo" | "ads_direto" | "x1" | "organico_social" | "webinar";
export type AccessStatus = "falta" | "em_andamento" | "conectado" | "nao_se_aplica";

export interface AccessRequirement {
  key: string;
  label: string;
  /** Como criar ou conectar (passo humano). */
  como: string;
  /** Precisa existir antes (chaves de outros acessos). */
  depende_de: string[];
  /** Ferramenta do catálogo ligada a este acesso. */
  ferramenta: string | null;
  /** Evidência que o Império consegue ver sozinho (detectAccess). */
  evidencia: "whatsapp" | "ads_sync" | "tracker" | "vendas" | null;
}

export interface Channel {
  key: ChannelKey;
  label: string;
  resumo: string;
  playbooks: string[];
  /** Acessos obrigatórios para o canal rodar. */
  acessos: string[];
  /** Acessos que ajudam mas não travam. */
  opcionais: string[];
  ferramentas: string[];
}

export const ACCESS: AccessRequirement[] = [
  { key: "google_conta", label: "Conta Google do projeto", como: "Criar uma conta Google só do projeto (e-mail do projeto), com verificação em 2 etapas e telefone de recuperação do time.", depende_de: [], ferramenta: null, evidencia: null },
  { key: "youtube_canal", label: "Canal do YouTube verificado", como: "Criar o canal na conta Google do projeto (conta de marca), verificar por telefone para liberar vídeos longos e thumbnails personalizadas.", depende_de: ["google_conta"], ferramenta: "youtube-studio", evidencia: null },
  { key: "youtube_api", label: "Acesso de leitura do YouTube (métricas)", como: "Autorizar a YouTube Data/Analytics API para o Império ler views, CTR e retenção.", depende_de: ["youtube_canal"], ferramenta: "youtube-studio", evidencia: null },
  { key: "dominio", label: "Domínio e DNS", como: "Registrar o domínio do projeto e apontar o DNS para a hospedagem.", depende_de: [], ferramenta: "vercel", evidencia: null },
  { key: "site", label: "Site/páginas publicados", como: "Publicar o site ou as páginas (Vercel ou WordPress) no domínio do projeto.", depende_de: ["dominio"], ferramenta: "vercel", evidencia: null },
  { key: "tracker", label: "Tracker do Império nas páginas", como: "Instalar o tracker do Império com o id do projeto em todas as páginas.", depende_de: ["site"], ferramenta: null, evidencia: "tracker" },
  { key: "search_console", label: "Google Search Console", como: "Verificar o domínio no Search Console (registro DNS) e enviar o sitemap.", depende_de: ["dominio", "google_conta"], ferramenta: "search-console", evidencia: null },
  { key: "ga4", label: "Google Analytics 4", como: "Criar a propriedade GA4 e instalar a tag nas páginas.", depende_de: ["site", "google_conta"], ferramenta: "ga4", evidencia: null },
  { key: "meta_bm", label: "Business Manager e conta de anúncio", como: "Criar o Business Manager, a conta de anúncio com forma de pagamento e a página do Facebook/Instagram do projeto.", depende_de: [], ferramenta: "meta-ads", evidencia: null },
  { key: "pixel_capi", label: "Pixel e API de Conversões", como: "Criar o pixel, instalar nas páginas e ligar a API de Conversões (compra e checkout iniciado).", depende_de: ["meta_bm", "site"], ferramenta: "meta-ads", evidencia: null },
  { key: "ads_sync", label: "Gasto de anúncio sincronizado no Império", como: "Ligar a conta de anúncio ao sync do Império (facebook-ads-sync) para gasto, checkouts e compras por conjunto.", depende_de: ["meta_bm"], ferramenta: "meta-ads", evidencia: "ads_sync" },
  { key: "checkout", label: "Checkout com webhook no Império", como: "Criar o produto no checkout (Ticto, Hotmart, Whop, ClickBank ou Stripe) e apontar o webhook para o Império.", depende_de: [], ferramenta: null, evidencia: "vendas" },
  { key: "whatsapp", label: "Número de WhatsApp conectado", como: "Número dedicado conectado na Evolution e cadastrado em imphq_wa_providers com o projeto.", depende_de: [], ferramenta: "evolution-api", evidencia: "whatsapp" },
  { key: "social_contas", label: "Contas sociais do projeto (TikTok/Instagram)", como: "Criar as contas e aquecer; cadastrar com scripts/content.mjs account:add.", depende_de: [], ferramenta: "geelark", evidencia: null },
  { key: "geelark_aparelho", label: "Aparelho na GeeLark", como: "Um aparelho (env) por conta, com proxy do país do mercado; GEELARK_API_TOKEN configurado.", depende_de: ["social_contas"], ferramenta: "geelark", evidencia: null },
  { key: "voz_ia", label: "Voz de IA (ElevenLabs)", como: "Voz escolhida e créditos no plano para narração.", depende_de: [], ferramenta: "elevenlabs", evidencia: null },
  { key: "plataforma_webinar", label: "Plataforma de webinar/aula", como: "Sala ou player com horário fixo e página de inscrição.", depende_de: ["site"], ferramenta: null, evidencia: null },
];

export const CHANNELS: Channel[] = [
  { key: "youtube", label: "YouTube (vídeos longos + Shorts)", resumo: "Canal de audiência com vídeos longos buscáveis e Shorts derivados, levando para oferta, captura ou X1.",
    playbooks: ["youtube-canal"], acessos: ["google_conta", "youtube_canal"], opcionais: ["youtube_api", "voz_ia", "site", "tracker"],
    ferramentas: ["youtube-studio", "vidiq", "elevenlabs", "capcut", "higgsfield"] },
  { key: "seo", label: "SEO e conteúdo", resumo: "Site com artigos para buscas do nicho, medido no Search Console e com chamadas para a oferta.",
    playbooks: ["seo-conteudo"], acessos: ["google_conta", "dominio", "site", "search_console", "tracker"], opcionais: ["ga4"],
    ferramentas: ["search-console", "ga4", "vercel", "ahrefs-webmaster"] },
  { key: "ads_direto", label: "Tráfego direto (anúncio → página → checkout)", resumo: "Anúncio pago para pré-venda e checkout, com a esteira de escala decidindo a verba.",
    playbooks: ["ads-direto-dtc", "esteira-escala-dtc"], acessos: ["meta_bm", "dominio", "site", "pixel_capi", "checkout", "tracker"], opcionais: ["ads_sync", "ga4"],
    ferramentas: ["meta-ads", "meta-ad-library", "vercel", "higgsfield", "capcut"] },
  { key: "x1", label: "X1 (conversa no WhatsApp)", resumo: "Anúncio ou conteúdo para conversa 1 a 1, com IA de atendimento e venda no chat.",
    playbooks: ["x1-conversa"], acessos: ["whatsapp", "checkout"], opcionais: ["meta_bm", "ads_sync"],
    ferramentas: ["evolution-api", "meta-ads"] },
  { key: "organico_social", label: "Orgânico social (TikTok/Instagram)", resumo: "Contas em fazenda de aparelhos publicando em lote aprovado.",
    playbooks: ["canal-organico"], acessos: ["social_contas", "geelark_aparelho"], opcionais: ["voz_ia"],
    ferramentas: ["geelark", "capcut", "elevenlabs"] },
  { key: "webinar", label: "Webinar perpétuo", resumo: "Inscrição, lembretes, aula com horário e oferta com prazo real.",
    playbooks: ["webinar-perpetuo"], acessos: ["site", "plataforma_webinar", "checkout", "tracker"], opcionais: ["whatsapp"],
    ferramentas: ["vercel", "evolution-api"] },
];

/** Ferramentas de operação semeadas em imphq_capabilities (fonte 'kit de operação'). */
export const OPS_TOOLS: Array<{ id: string; nome: string; url: string; categoria: string; quando_usar: string; serve_para: string[]; prioridade: "alta" | "media" | "baixa" }> = [
  { id: "youtube-studio", nome: "YouTube Studio", url: "https://studio.youtube.com", categoria: "Operação · YouTube", quando_usar: "Subir vídeo, título, descrição, capítulos, thumbnail e ler CTR e retenção.", serve_para: ["criativo_video", "dashboard"], prioridade: "alta" },
  { id: "vidiq", nome: "vidIQ", url: "https://vidiq.com", categoria: "Operação · YouTube", quando_usar: "Achar palavras-chave e ideias de vídeo com volume e pouca concorrência; benchmark de canais do nicho.", serve_para: ["dashboard"], prioridade: "alta" },
  { id: "elevenlabs", nome: "ElevenLabs", url: "https://elevenlabs.io", categoria: "Operação · Produção", quando_usar: "Narração em inglês para vídeos faceless, VSL e anúncios.", serve_para: ["audio", "criativo_video"], prioridade: "alta" },
  { id: "capcut", nome: "CapCut", url: "https://www.capcut.com", categoria: "Operação · Produção", quando_usar: "Edição rápida de vídeos longos e Shorts/Reels, legendas automáticas.", serve_para: ["criativo_video"], prioridade: "media" },
  { id: "higgsfield", nome: "Higgsfield", url: "https://higgsfield.ai", categoria: "Operação · Produção", quando_usar: "Gerar cenas e b-roll em vídeo com IA para anúncios e vídeos.", serve_para: ["criativo_video", "criativo_imagem"], prioridade: "media" },
  { id: "search-console", nome: "Google Search Console", url: "https://search.google.com/search-console", categoria: "Operação · SEO", quando_usar: "Indexação, sitemap, cliques e posição por busca.", serve_para: ["dashboard"], prioridade: "alta" },
  { id: "ga4", nome: "Google Analytics 4", url: "https://analytics.google.com", categoria: "Operação · Medição", quando_usar: "Tráfego e conversão do site fora do tracker do Império.", serve_para: ["dashboard"], prioridade: "baixa" },
  { id: "ahrefs-webmaster", nome: "Ahrefs Webmaster Tools", url: "https://ahrefs.com/webmaster-tools", categoria: "Operação · SEO", quando_usar: "Auditoria técnica gratuita e backlinks do próprio site.", serve_para: ["dashboard"], prioridade: "media" },
  { id: "vercel", nome: "Vercel", url: "https://vercel.com", categoria: "Operação · Sites", quando_usar: "Publicar páginas e sites do projeto no domínio próprio.", serve_para: ["pagina"], prioridade: "alta" },
  { id: "meta-ads", nome: "Meta Ads Manager", url: "https://adsmanager.facebook.com", categoria: "Operação · Tráfego", quando_usar: "Campanhas, conjuntos e anúncios; pixel e API de Conversões.", serve_para: ["dashboard"], prioridade: "alta" },
  { id: "meta-ad-library", nome: "Biblioteca de Anúncios da Meta", url: "https://www.facebook.com/ads/library", categoria: "Operação · Tráfego", quando_usar: "Ver anúncios ativos de concorrentes e há quanto tempo rodam (sinal de escala).", serve_para: ["criativo_video", "criativo_imagem"], prioridade: "alta" },
  { id: "evolution-api", nome: "Evolution API (WhatsApp)", url: "https://doc.evolution-api.com", categoria: "Operação · X1", quando_usar: "Número de WhatsApp conectado ao Império para X1 e avisos (imphq_wa_providers).", serve_para: ["automacao"], prioridade: "alta" },
  { id: "geelark", nome: "GeeLark", url: "https://www.geelark.com", categoria: "Operação · Orgânico", quando_usar: "Aparelhos na nuvem para contas sociais; publicação pelo geelark-publisher.", serve_para: ["automacao"], prioridade: "alta" },
];

export const ACCESS_BY_KEY = new Map(ACCESS.map((a) => [a.key, a]));
export const CHANNEL_BY_KEY = new Map(CHANNELS.map((c) => [c.key, c]));
export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = { falta: "Falta", em_andamento: "Em andamento", conectado: "Conectado", nao_se_aplica: "Não se aplica" };

/** Canais pedidos em texto livre ("youtube, seo, tráfego direto, x1"). Desconhecidos voltam em `invalidos`. */
export function parseChannels(input: string | ReadonlyArray<string>): { canais: ChannelKey[]; invalidos: string[] } {
  const ALIAS: Record<string, ChannelKey> = {
    youtube: "youtube", yt: "youtube", shorts: "youtube",
    seo: "seo", blog: "seo", site: "seo",
    ads: "ads_direto", ads_direto: "ads_direto", trafego: "ads_direto", trafego_direto: "ads_direto", direto: "ads_direto", dtc: "ads_direto", meta: "ads_direto",
    x1: "x1", whatsapp: "x1",
    organico: "organico_social", organico_social: "organico_social", tiktok: "organico_social", instagram: "organico_social", reels: "organico_social",
    webinar: "webinar",
  };
  const parts = (typeof input === "string" ? input.split(/[,;+]/) : [...input])
    .map((p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
  const canais: ChannelKey[] = [];
  const invalidos: string[] = [];
  for (const p of parts) {
    const k = ALIAS[p];
    if (!k) invalidos.push(p);
    else if (!canais.includes(k)) canais.push(k);
  }
  return { canais, invalidos };
}

/** Canais que o projeto já roda, pelos playbooks aplicados no mapa. */
export function channelsFromPlaybooks(playbookIds: ReadonlyArray<string>): ChannelKey[] {
  const ids = new Set(playbookIds);
  return CHANNELS.filter((c) => c.playbooks.some((p) => ids.has(p))).map((c) => c.key);
}

export interface Evidence { whatsapp: boolean; ads_sync: boolean; tracker: boolean; vendas: boolean }
export interface DeclaredAccess { access_key: string; status: string; nota?: string | null; owner_member_id?: string | null; updated_at?: string | null }

const STATUS_ORDER: Record<AccessStatus, number> = { falta: 0, em_andamento: 1, conectado: 2, nao_se_aplica: 3 };
const isStatus = (s: string): s is AccessStatus => s in STATUS_ORDER;

/**
 * Checklist de acessos dos canais: obrigatórios e opcionais, sem repetir, na ordem de dependência.
 * Status: evidência no banco manda (declarado "falta" com dado vira "conectado" e avisa); depois o declarado;
 * sem declaração, "conectado" por inferência quando algo que depende dele já funciona; senão "falta".
 */
export function accessChecklist(channels: ReadonlyArray<ChannelKey>, declared: ReadonlyArray<DeclaredAccess>, evidence: Partial<Evidence> = {}) {
  const required = new Set<string>(), optional = new Set<string>(), usedBy = new Map<string, ChannelKey[]>();
  for (const key of channels) {
    const ch = CHANNEL_BY_KEY.get(key);
    if (!ch) continue;
    for (const a of ch.acessos) { required.add(a); usedBy.set(a, [...(usedBy.get(a) ?? []), key]); }
    for (const a of ch.opcionais) { optional.add(a); usedBy.set(a, [...(usedBy.get(a) ?? []), key]); }
  }
  for (const a of required) optional.delete(a);
  // Dependências entram junto: de obrigatório viram obrigatórias; de opcional, opcionais.
  const addDeps = (k: string, mandatory: boolean) => {
    for (const d of ACCESS_BY_KEY.get(k)?.depende_de ?? []) {
      if (required.has(d) || (!mandatory && optional.has(d))) continue;
      if (mandatory) { required.add(d); optional.delete(d); } else optional.add(d);
      usedBy.set(d, [...new Set([...(usedBy.get(d) ?? []), ...(usedBy.get(k) ?? [])])]);
      addDeps(d, mandatory);
    }
  };
  for (const k of [...required]) addDeps(k, true);
  for (const k of [...optional]) addDeps(k, false);

  const declaredBy = new Map(declared.map((d) => [d.access_key, d]));
  const seenOf = (k: string) => { const ev = ACCESS_BY_KEY.get(k)?.evidencia; return ev ? !!evidence[ev] : false; };
  // O que tem dado (ou foi declarado conectado) prova que as dependências existem: tracker com eventos ⇒ site e domínio.
  const inferredFrom = new Map<string, string>();
  const infer = (k: string, origin: string) => { for (const d of ACCESS_BY_KEY.get(k)?.depende_de ?? []) if (!inferredFrom.has(d)) { inferredFrom.set(d, origin); infer(d, origin); } };
  for (const a of ACCESS) if (seenOf(a.key) || declaredBy.get(a.key)?.status === "conectado") infer(a.key, a.key);

  const statusOf = (k: string): { status: AccessStatus; aviso: string | null } => {
    const d = declaredBy.get(k);
    const seen = seenOf(k);
    if (seen && (!d || d.status === "falta" || d.status === "em_andamento")) {
      return { status: "conectado", aviso: d ? "O Império já vê dados deste acesso; marque como conectado." : null };
    }
    if (d && isStatus(d.status)) {
      const hasEvidence = !!ACCESS_BY_KEY.get(k)?.evidencia;
      return { status: d.status, aviso: !seen && d.status === "conectado" && hasEvidence ? "Marcado como conectado, mas o Império ainda não viu dados nos últimos 7 dias." : null };
    }
    const origin = inferredFrom.get(k);
    if (origin) return { status: "conectado", aviso: `Inferido: ${ACCESS_BY_KEY.get(origin)?.label ?? origin} já funciona.` };
    return { status: "falta", aviso: null };
  };

  const order = ACCESS.map((a) => a.key);
  const items = [...required, ...optional]
    .filter((k) => ACCESS_BY_KEY.has(k))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((k) => {
      const a = ACCESS_BY_KEY.get(k)!;
      const d = declaredBy.get(k);
      const { status, aviso } = statusOf(k);
      const bloqueado_por = status === "conectado" || status === "nao_se_aplica" ? [] : a.depende_de.filter((dep) => {
        const s = statusOf(dep).status;
        return s !== "conectado" && s !== "nao_se_aplica";
      });
      return {
        key: k, label: a.label, obrigatorio: required.has(k), status, como: a.como, ferramenta: a.ferramenta,
        canais: usedBy.get(k) ?? [], bloqueado_por, evidencia_vista: a.evidencia ? seenOf(k) : null, aviso,
        nota: d?.nota ?? null, dono: d?.owner_member_id ?? null,
      };
    });
  const obrig = items.filter((i) => i.obrigatorio && i.status !== "nao_se_aplica");
  const prontos = obrig.filter((i) => i.status === "conectado").length;
  return {
    canais: channels,
    itens: items,
    progresso: `${prontos}/${obrig.length}`,
    pronto_para_rodar: obrig.length > 0 && prontos === obrig.length,
    proximos: items.filter((i) => i.status === "falta" && i.obrigatorio && i.bloqueado_por.length === 0).map((i) => i.key),
  };
}
