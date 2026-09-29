// Mapa da Empresa — regra única de leitura de um projeto.
// TS puro e sem dependências: usado pelo frontend (@shared/project-map) e pelas edge functions.
// Nunca inventa valores: o que não está no banco vira lacuna, nunca um default.

export type MapStatus = "falta" | "desenhado" | "construido" | "rodando";
export type ItemStatus = MapStatus | "pausado";
export type GapSeverity = "critica" | "importante" | "sugestao";
export type MapArea = "produtos" | "avatar" | "mecanismo" | "concorrentes" | "funil" | "ativos" | "atendimento";
export type DataFormat = "padrao_novo" | "legado" | "produto_unico" | "vazio";

export interface MapItem {
  key: string;
  label: string;
  status: ItemStatus;
  evidence: string[];
}

export interface MapSection {
  area: MapArea;
  label: string;
  status: MapStatus;
  items: MapItem[];
}

export interface MapGap {
  area: MapArea;
  item?: string;
  severity: GapSeverity;
  message: string;
  action: string;
  skill?: string;
}

export interface ProjectMap {
  projectId: string;
  projectName: string;
  dataFormat: DataFormat;
  score: number;
  sections: MapSection[];
  gaps: MapGap[];
}

export interface ProjectMapInput {
  project: { id: string; name: string; data: unknown; avatar: unknown };
  competitors: ReadonlyArray<Record<string, unknown>>;
  mapNodes: ReadonlyArray<{ label?: string | null; url?: string | null }>;
  activity: {
    /** Vendas aprovadas nos últimos 30 dias, por `produto_nome`. */
    approvedSales30dByProduct: Record<string, number>;
    waIncoming30d: number;
    waOutgoing30d: number;
    funnelEvents7d: number;
    activeWaProviders: number;
    /** null quando o projeto não tem configuração de IA. */
    aiEnabled: boolean | null;
    aiDraftMode: boolean | null;
  };
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  falta: "Falta",
  desenhado: "Desenhado",
  construido: "Construído",
  rodando: "Rodando",
  pausado: "Pausado",
};

const STATUS_RANK: Record<MapStatus, number> = { falta: 0, desenhado: 1, construido: 2, rodando: 3 };
const STATUS_WEIGHT: Record<MapStatus, number> = { falta: 0, desenhado: 0.4, construido: 0.8, rodando: 1 };
const AREA_WEIGHT: Record<MapArea, number> = {
  produtos: 25, avatar: 15, mecanismo: 10, concorrentes: 10, funil: 15, ativos: 15, atendimento: 10,
};
const SEVERITY_RANK: Record<GapSeverity, number> = { critica: 0, importante: 1, sugestao: 2 };

// ── helpers ─────────────────────────────────────────────────────────────

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Conteúdo real: texto não vazio, lista com itens ou objeto com algum valor preenchido. */
function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(filled);
  if (value && typeof value === "object") return Object.values(value).some(filled);
  return false;
}

function textSize(value: unknown): number {
  if (typeof value === "string") return value.trim().length;
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + textSize(v), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((n: number, v) => n + textSize(v), 0);
  return 0;
}

function lowest(statuses: MapStatus[]): MapStatus {
  return statuses.reduce<MapStatus>((low, s) => (STATUS_RANK[s] < STATUS_RANK[low] ? s : low), "rodando");
}

function highest(statuses: MapStatus[]): MapStatus {
  return statuses.reduce<MapStatus>((high, s) => (STATUS_RANK[s] > STATUS_RANK[high] ? s : high), "falta");
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

interface LinkRef { url: string; kind: "checkout" | "pagina" | "outro"; label: string }

const CHECKOUT_HINT = /checkout|pay\.|\/pay\b|ticto|hotmart|kiwify|perfectpay|eduzz|monetizze|braip|whop|stripe|cart/i;

function classifyUrl(url: string, tipo: string, label: string): LinkRef["kind"] {
  const t = tipo.toLowerCase();
  if (t === "checkout") return "checkout";
  if (["vsl", "lp", "captura", "vercel", "pagina", "site"].includes(t)) return CHECKOUT_HINT.test(url) ? "checkout" : "pagina";
  if (CHECKOUT_HINT.test(url) || /checkout/i.test(label)) return "checkout";
  return "outro";
}

/** URL absoluta; aceita domínio sem protocolo ("site.com/x"). Vazio quando não é link. */
function asUrl(value: unknown): string {
  const raw = text(value);
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(raw)) return `https://${raw}`;
  return "";
}

/** Aceita string[], {url,tipo,label|nome}[] ou objeto {site, "0": {url,label}}. */
function collectLinks(value: unknown): LinkRef[] {
  const entries: unknown[] = Array.isArray(value) ? value : Object.values(record(value));
  const links: LinkRef[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      const url = asUrl(entry);
      if (url) links.push({ url, kind: classifyUrl(url, "", ""), label: "" });
      continue;
    }
    const obj = record(entry);
    const url = asUrl(obj.url);
    if (!url || obj.ativo === false) continue;
    const label = text(obj.label) || text(obj.nome);
    links.push({ url, kind: classifyUrl(url, text(obj.tipo), label), label });
  }
  return links;
}

// ── detecção de formato ─────────────────────────────────────────────────

function detectFormat(data: Record<string, unknown>): DataFormat {
  const hasList = Array.isArray(data.produtos) && data.produtos.length > 0;
  if (hasList && (filled(data.mecanismo_unico) || filled(data.vsl))) return "padrao_novo";
  if (hasList) return "legado";
  if (filled(data.produto)) return "produto_unico";
  return "vazio";
}

// ── produtos ────────────────────────────────────────────────────────────

interface NormalizedProduct {
  name: string;
  price: string;
  paused: boolean;
  checkout: LinkRef[];
  pages: LinkRef[];
  mecanismo: unknown;
  copy: unknown;
}

function normalizeProducts(data: Record<string, unknown>): NormalizedProduct[] {
  if (Array.isArray(data.produtos)) {
    return data.produtos.map((raw, index) => {
      const p = record(raw);
      const links = collectLinks(p.links);
      for (const key of ["link_checkout", "checkout_url"]) {
        const url = asUrl(p[key]);
        if (url) links.push({ url, kind: "checkout", label: key });
      }
      const single = asUrl(p.link);
      if (single) links.push({ url: single, kind: classifyUrl(single, "", ""), label: "link" });
      const status = normalizeName(text(p.status));
      return {
        name: text(p.nome) || text(p.name) || (typeof raw === "string" ? raw.trim() : "") || `Produto ${index + 1}`,
        price: text(p.preco) || text(p.valor) || text(p.ticket) || text(p.preco_por) || text(p.price),
        paused: p.ativo === false || ["inativo", "pausado", "arquivado"].includes(status),
        checkout: links.filter((l) => l.kind === "checkout"),
        pages: links.filter((l) => l.kind !== "checkout"),
        mecanismo: p.mecanismo,
        copy: p.copy_arsenal,
      };
    });
  }
  if (filled(data.produto)) {
    const checkout = asUrl(data.checkout_url);
    const page = asUrl(data.vsl_url);
    return [{
      name: text(data.produto) || text(record(data.produto).nome),
      price: text(data.preco),
      paused: false,
      checkout: checkout ? [{ url: checkout, kind: "checkout", label: "checkout_url" }] : [],
      pages: page ? [{ url: page, kind: "pagina", label: "vsl_url" }] : [],
      mecanismo: undefined,
      copy: undefined,
    }];
  }
  return [];
}

function salesFor(name: string, sales: Record<string, number>): number {
  const target = normalizeName(name);
  if (!target) return 0;
  return Object.entries(sales).reduce((sum, [produto, count]) => {
    const candidate = normalizeName(produto);
    return candidate && (candidate === target || candidate.includes(target) || target.includes(candidate)) ? sum + count : sum;
  }, 0);
}

function productsSection(products: NormalizedProduct[], data: Record<string, unknown>, input: ProjectMapInput, gaps: MapGap[]): MapSection {
  const items: MapItem[] = products.map((p) => {
    const evidence: string[] = [];
    if (p.price) evidence.push(`Preço: ${p.price}`);
    p.checkout.forEach((l) => evidence.push(`Checkout: ${l.url}`));
    p.pages.forEach((l) => evidence.push(`Página: ${l.url}`));
    const sold = salesFor(p.name, input.activity.approvedSales30dByProduct);
    if (sold > 0) evidence.push(`${sold} venda(s) aprovada(s) em 30 dias`);

    let status: ItemStatus;
    if (p.paused) status = "pausado";
    else if (sold > 0) status = "rodando";
    else if (p.checkout.length > 0) status = "construido";
    else status = "desenhado";

    if (!p.paused) {
      // Se já vende, o checkout existe em algum lugar: falta só cadastrar para a IA poder enviar o link.
      if (p.checkout.length === 0) gaps.push({ area: "produtos", item: p.name, severity: sold > 0 ? "importante" : "critica", message: sold > 0 ? `"${p.name}" vende, mas o link de checkout não está cadastrado (a IA não consegue enviá-lo).` : `"${p.name}" não tem link de checkout cadastrado.`, action: "Cadastrar o link de checkout do produto." });
      if (!p.price) gaps.push({ area: "produtos", item: p.name, severity: "importante", message: `"${p.name}" está sem preço.`, action: "Cadastrar o preço do produto." });
      if (p.pages.length === 0) gaps.push({ area: "produtos", item: p.name, severity: "importante", message: `"${p.name}" não tem página de vendas/VSL vinculada.`, action: "Vincular a página de vendas ou VSL ao produto." });
    }
    return { key: `produto:${p.name}`, label: p.name, status, evidence };
  });

  const names = products.map((p) => normalizeName(p.name).replace(/^(o|a|os|as)\s+/, ""));
  const duplicates = products.filter((p, i) => names.findIndex((n) => n === names[i]) !== i).map((p) => p.name);
  if (duplicates.length) {
    gaps.push({ area: "produtos", severity: "sugestao", message: `Produto(s) cadastrado(s) em duplicidade: ${duplicates.join(", ")}.`, action: "Unificar os cadastros duplicados para a IA não usar preço ou link errado." });
  }
  if (Array.isArray(data.produtos) && data.produtos.length > 0 && filled(data.produto)) {
    gaps.push({ area: "produtos", severity: "sugestao", message: `Campo antigo de produto único ("${text(data.produto)}"${text(data.preco) ? `, ${text(data.preco)}` : ""}) convive com a lista de produtos.`, action: "Conferir se o campo antigo ainda vale; se não, remover para não confundir a IA." });
  }

  const active = items.filter((i) => i.status !== "pausado").map((i) => i.status as MapStatus);
  if (products.length === 0) {
    gaps.push({ area: "produtos", severity: "critica", message: "Nenhum produto cadastrado no projeto.", action: "Cadastrar produtos com preço, checkout e página de vendas." });
  } else if (active.length === 0) {
    gaps.push({ area: "produtos", severity: "importante", message: "Todos os produtos estão pausados.", action: "Confirmar se o projeto está parado ou reativar uma oferta." });
  }
  return { area: "produtos", label: "Produtos & Ofertas", status: active.length ? highest(active) : "falta", items };
}

// ── avatar ──────────────────────────────────────────────────────────────

const AVATAR_FACETS: Array<{ key: string; label: string; avatarKeys: string[]; dataKeys?: string[]; skill: string }> = [
  { key: "dores", label: "Dores", avatarKeys: ["dores_profundas", "dores_superficiais", "problemas", "categorias_problemas", "the_hell"], dataKeys: ["dores"], skill: "dossie-problemas-v2" },
  { key: "desejos", label: "Desejos", avatarKeys: ["desejos_internos", "desejos_externos", "desejo_interno", "desejo_externo", "resultado_sonhado", "the_high"], dataKeys: ["desejos"], skill: "escavador-desejos" },
  { key: "objecoes", label: "Objeções e medos", avatarKeys: ["objecoes", "medos"], skill: "avatar-architect-v8" },
  { key: "crencas", label: "Crenças", avatarKeys: ["crenca_bloqueadora", "crenca_necessaria", "epifania_central"], skill: "avatar-architect-v8" },
  { key: "inimigo", label: "Inimigo comum", avatarKeys: ["inimigo"], skill: "avatar-architect-v8" },
  { key: "linguagem", label: "Linguagem do avatar", avatarKeys: ["palavras_dor", "palavras_desejo", "palavras_solucao", "frases_gatilho_dor", "frases_gatilho_desejo", "headlines", "ganchos"], skill: "avatar-architect-v8" },
  { key: "perfil", label: "Perfil e segmentos", avatarKeys: ["perfil_psicologico", "camadas_psique", "sub_avatares", "nome", "idade_faixa"], dataKeys: ["publico_alvo"], skill: "avatar-architect-v8" },
];

function avatarSection(avatar: Record<string, unknown>, data: Record<string, unknown>, gaps: MapGap[]): MapSection {
  const items: MapItem[] = AVATAR_FACETS.map((facet) => {
    const sources = [
      ...facet.avatarKeys.filter((k) => filled(avatar[k])).map((k) => `avatar.${k}`),
      ...(facet.dataKeys ?? []).filter((k) => filled(data[k])).map((k) => `data.${k}`),
    ];
    return { key: `avatar:${facet.key}`, label: facet.label, status: sources.length ? "construido" : "falta", evidence: sources };
  });
  const done = items.filter((i) => i.status === "construido").length;
  const status: MapStatus = done === 0 ? "falta" : done >= 6 ? "construido" : "desenhado";

  if (done === 0) {
    gaps.push({ area: "avatar", severity: "critica", message: "Avatar não mapeado.", action: "Gerar o dossiê de avatar do projeto.", skill: "avatar-architect-v8" });
  } else {
    AVATAR_FACETS.forEach((facet, i) => {
      if (items[i].status === "falta") gaps.push({ area: "avatar", item: facet.label, severity: "importante", message: `Avatar sem "${facet.label}".`, action: `Completar "${facet.label}" do avatar.`, skill: facet.skill });
    });
  }
  return { area: "avatar", label: "Avatar", status, items };
}

// ── mecanismo ───────────────────────────────────────────────────────────

function mecanismoSection(avatar: Record<string, unknown>, data: Record<string, unknown>, products: NormalizedProduct[], gaps: MapGap[]): MapSection {
  const sources: Array<[string, unknown]> = [
    ["data.mecanismo_unico", data.mecanismo_unico],
    ["avatar.mecanismo", avatar.mecanismo],
    ...products.filter((p) => filled(p.mecanismo)).map((p): [string, unknown] => [`produto "${p.name}"`, p.mecanismo]),
  ];
  const found = sources.filter(([, v]) => filled(v));
  const size = found.reduce((n, [, v]) => n + textSize(v), 0);
  const status: MapStatus = found.length === 0 ? "falta" : size >= 120 ? "construido" : "desenhado";
  if (status === "falta") gaps.push({ area: "mecanismo", severity: "critica", message: "Mecanismo único não definido.", action: "Definir o mecanismo único da oferta.", skill: "mecanismo-unico-v2" });
  else if (status === "desenhado") gaps.push({ area: "mecanismo", severity: "importante", message: "Mecanismo único está raso (pouco detalhado).", action: "Aprofundar o mecanismo único.", skill: "mecanismo-unico-v2" });
  return {
    area: "mecanismo",
    label: "Mecanismo único",
    status,
    items: [{ key: "mecanismo", label: "Mecanismo", status, evidence: found.map(([k]) => k) }],
  };
}

// ── concorrentes ────────────────────────────────────────────────────────

function concorrentesSection(competitors: ProjectMapInput["competitors"], gaps: MapGap[]): MapSection {
  const items: MapItem[] = competitors.map((c) => {
    const name = text(c.name) || "Concorrente";
    const evidence = ["url", "oferta_principal", "preco", "mecanismo_unico", "headline", "paginas_funil"].filter((k) => filled(c[k]));
    const complete = filled(c.oferta_principal) && (filled(c.mecanismo_unico) || filled(c.headline)) && filled(c.url);
    return { key: `concorrente:${name}`, label: name, status: complete ? "construido" : "desenhado", evidence };
  });
  const complete = items.filter((i) => i.status === "construido").length;
  const status: MapStatus = items.length === 0 ? "falta" : items.length >= 3 && complete >= 2 ? "construido" : "desenhado";
  const empty = competitors.filter((c) => !filled(c.url) && !filled(c.oferta_principal) && !filled(c.mecanismo_unico)).map((c) => text(c.name));
  if (empty.length) {
    gaps.push({ area: "concorrentes", severity: "sugestao", message: `${empty.length} registro(s) sem site, oferta nem mecanismo — podem ser anotações importadas como concorrente: ${empty.slice(0, 5).join("; ")}${empty.length > 5 ? "…" : ""}.`, action: "Revisar e remover o que não for concorrente de verdade." });
  }
  if (status === "falta") gaps.push({ area: "concorrentes", severity: "importante", message: "Nenhum concorrente mapeado.", action: "Mapear os principais concorrentes e suas ofertas.", skill: "funnel-hacking-supremo-v2" });
  else if (status === "desenhado") gaps.push({ area: "concorrentes", severity: "sugestao", message: `${items.length} concorrente(s), ${complete} com oferta e mecanismo detalhados.`, action: "Detalhar oferta, mecanismo e funil dos concorrentes.", skill: "funnel-hacking-supremo-v2" });
  return { area: "concorrentes", label: "Concorrentes", status, items };
}

// ── funil ───────────────────────────────────────────────────────────────

function funilSection(input: ProjectMapInput, gaps: MapGap[]): MapSection {
  const nodes = input.mapNodes;
  const withUrl = nodes.filter((n) => /^https?:\/\//i.test(text(n.url))).length;
  const events = input.activity.funnelEvents7d;
  const evidence: string[] = [];
  if (nodes.length) evidence.push(`${nodes.length} etapa(s) no mapa, ${withUrl} com link`);
  if (events) evidence.push(`${events} evento(s) de funil em 7 dias`);

  let status: MapStatus;
  if (events > 0) status = "rodando";
  else if (nodes.length === 0) status = "falta";
  else if (withUrl * 2 >= nodes.length) status = "construido";
  else status = "desenhado";

  if (nodes.length === 0) {
    gaps.push({ area: "funil", severity: events > 0 ? "importante" : "critica", message: events > 0 ? "O funil recebe tráfego, mas não está desenhado no mapa." : "Funil não desenhado.", action: "Desenhar as etapas do funil no mapa do projeto." });
  } else if (withUrl * 2 < nodes.length) {
    gaps.push({ area: "funil", severity: "importante", message: `Só ${withUrl} de ${nodes.length} etapas do funil têm link.`, action: "Vincular os links reais a cada etapa do funil." });
  }
  if (events === 0 && nodes.length > 0) gaps.push({ area: "funil", severity: "sugestao", message: "Nenhum evento de funil registrado nos últimos 7 dias.", action: "Conferir se o rastreamento do funil está instalado." });
  return { area: "funil", label: "Funil", status, items: [{ key: "funil", label: "Funil", status, evidence }] };
}

// ── ativos ──────────────────────────────────────────────────────────────

function ativosSection(avatar: Record<string, unknown>, data: Record<string, unknown>, products: NormalizedProduct[], gaps: MapGap[]): MapSection {
  const projectLinks = collectLinks(data.links);
  const liveSalesPage = [...products.flatMap((p) => p.pages), ...projectLinks.filter((l) => l.kind === "pagina")];
  const vslScripts = ([["data.vsl", data.vsl], ["avatar.vsl_timeline", avatar.vsl_timeline], ["avatar.pagina_vendas", avatar.pagina_vendas]] as Array<[string, unknown]>).filter(([, v]) => filled(v));
  const vslStatus: MapStatus = liveSalesPage.length ? "construido" : vslScripts.length ? "desenhado" : "falta";

  const copySources = ([["avatar.headlines", avatar.headlines], ["avatar.pagina_vendas", avatar.pagina_vendas], ["data.angulos_persuasivos", data.angulos_persuasivos], ["avatar.bullets", avatar.bullets]] as Array<[string, unknown]>).filter(([, v]) => filled(v));
  const productCopy = products.filter((p) => filled(p.copy)).map((p) => `copy_arsenal "${p.name}"`);
  const copyStatus: MapStatus = copySources.length || productCopy.length ? "construido" : "falta";

  const creatives = Array.isArray(data.facebook_creatives) ? data.facebook_creatives.map(record) : [];
  const activeAds = creatives.filter((c) => ["ACTIVE", "ACTIVE_CAMPAIGN"].includes(text(c.status))).length;
  const creativeScripts = ([["data.roteiros_ads_e_reels", data.roteiros_ads_e_reels], ["avatar.anuncios", avatar.anuncios], ["avatar.ganchos", avatar.ganchos]] as Array<[string, unknown]>).filter(([, v]) => filled(v));
  const creativeStatus: MapStatus = activeAds > 0 ? "rodando" : creatives.length > 0 ? "construido" : creativeScripts.length ? "desenhado" : "falta";

  if (vslStatus === "falta") gaps.push({ area: "ativos", item: "VSL / página de vendas", severity: "critica", message: "Sem VSL ou página de vendas.", action: "Escrever o roteiro da VSL e publicar a página.", skill: "vsl-filemon" });
  else if (vslStatus === "desenhado") gaps.push({ area: "ativos", item: "VSL / página de vendas", severity: "importante", message: "A VSL tem roteiro, mas nenhuma página publicada está cadastrada.", action: "Publicar a página e cadastrar o link." });
  if (copyStatus === "falta") gaps.push({ area: "ativos", item: "Copy", severity: "importante", message: "Sem headlines ou copy de vendas registradas.", action: "Gerar headlines e a copy da página.", skill: "headline-forge" });
  if (creativeStatus === "falta") gaps.push({ area: "ativos", item: "Criativos", severity: "importante", message: "Sem criativos ou roteiros de anúncio.", action: "Gerar ângulos e roteiros de criativos.", skill: "angulos-criativos" });
  else if (creativeStatus === "desenhado") gaps.push({ area: "ativos", item: "Criativos", severity: "sugestao", message: "Há roteiros de anúncio, mas nenhum criativo sincronizado do Meta.", action: "Produzir e subir os criativos." });
  else if (creativeStatus === "construido") gaps.push({ area: "ativos", item: "Criativos", severity: "sugestao", message: "Criativos cadastrados, mas nenhum anúncio ativo no Meta.", action: "Conferir se o tráfego está pausado de propósito." });

  const items: MapItem[] = [
    { key: "ativos:vsl", label: "VSL / página de vendas", status: vslStatus, evidence: [...liveSalesPage.map((l) => l.url), ...vslScripts.map(([k]) => k)] },
    { key: "ativos:copy", label: "Copy", status: copyStatus, evidence: [...copySources.map(([k]) => k), ...productCopy] },
    { key: "ativos:criativos", label: "Criativos", status: creativeStatus, evidence: [creatives.length ? `${creatives.length} criativo(s) do Meta, ${activeAds} ativo(s)` : "", ...creativeScripts.map(([k]) => k)].filter(Boolean) },
  ];
  return { area: "ativos", label: "Ativos (VSL, copy, criativos)", status: lowest(items.map((i) => i.status as MapStatus)), items };
}

// ── atendimento ─────────────────────────────────────────────────────────

function atendimentoSection(data: Record<string, unknown>, input: ProjectMapInput, gaps: MapGap[]): MapSection {
  const { activeWaProviders, aiEnabled, aiDraftMode, waIncoming30d, waOutgoing30d } = input.activity;
  const hasTree = filled(data.arvore_atendimento_whatsapp);
  const traffic = waIncoming30d + waOutgoing30d;
  const evidence: string[] = [];
  if (activeWaProviders) evidence.push(`${activeWaProviders} chip(s) de WhatsApp ativo(s)`);
  if (aiEnabled !== null) evidence.push(aiEnabled ? (aiDraftMode ? "IA ligada em modo rascunho" : "IA ligada respondendo") : "IA configurada, mas desligada");
  if (hasTree) evidence.push("Árvore de atendimento documentada");
  if (traffic) evidence.push(`${waIncoming30d} mensagem(ns) recebida(s) e ${waOutgoing30d} enviada(s) em 30 dias`);

  // Mensagens trafegando provam que existe um canal, mesmo com o chip marcado como inativo.
  const built = (activeWaProviders > 0 || traffic > 0) && aiEnabled === true;
  let status: MapStatus;
  if (built && traffic > 0) status = "rodando";
  else if (built) status = "construido";
  else if (activeWaProviders > 0 || aiEnabled !== null || hasTree || traffic > 0) status = "desenhado";
  else status = "falta";

  if (activeWaProviders === 0 && traffic > 0) {
    gaps.push({ area: "atendimento", severity: "critica", message: "Há mensagens chegando, mas nenhum chip do projeto aparece como ativo (status de conexão desatualizado ou chip caindo).", action: "Conferir a conexão dos chips de WhatsApp do projeto." });
  } else if (activeWaProviders === 0) {
    gaps.push({ area: "atendimento", severity: status === "falta" ? "importante" : "critica", message: "Nenhum chip de WhatsApp ativo no projeto.", action: "Conectar um número de WhatsApp ao projeto." });
  }
  if (waIncoming30d >= 20 && waOutgoing30d < waIncoming30d * 0.3) {
    const rate = Math.round((waOutgoing30d / waIncoming30d) * 100);
    gaps.push({ area: "atendimento", severity: "importante", message: `Só ${waOutgoing30d} resposta(s) registrada(s) para ${waIncoming30d} mensagem(ns) recebida(s) em 30 dias (${rate}%).`, action: "Verificar se a IA está respondendo e se as respostas são registradas." });
  }
  if (aiEnabled === null) gaps.push({ area: "atendimento", severity: "importante", message: "IA de atendimento não configurada.", action: "Configurar a IA de atendimento do projeto." });
  else if (!aiEnabled) gaps.push({ area: "atendimento", severity: "importante", message: "IA de atendimento desligada.", action: "Ligar a IA de atendimento." });
  else if (aiDraftMode) gaps.push({ area: "atendimento", severity: "sugestao", message: "IA em modo rascunho: as respostas esperam aprovação humana.", action: "Revisar se já dá para liberar a IA." });
  return { area: "atendimento", label: "Atendimento (WhatsApp + IA)", status, items: [{ key: "atendimento", label: "Atendimento", status, evidence }] };
}

// ── entrada ─────────────────────────────────────────────────────────────

export function buildProjectMap(input: ProjectMapInput): ProjectMap {
  const data = record(input.project.data);
  const avatar = record(input.project.avatar);
  const products = normalizeProducts(data);
  const gaps: MapGap[] = [];

  const sections = [
    productsSection(products, data, input, gaps),
    avatarSection(avatar, data, gaps),
    mecanismoSection(avatar, data, products, gaps),
    concorrentesSection(input.competitors, gaps),
    funilSection(input, gaps),
    ativosSection(avatar, data, products, gaps),
    atendimentoSection(data, input, gaps),
  ];

  const totalWeight = sections.reduce((n, s) => n + AREA_WEIGHT[s.area], 0);
  const score = Math.round(sections.reduce((n, s) => n + AREA_WEIGHT[s.area] * STATUS_WEIGHT[s.status], 0) / totalWeight * 100);
  gaps.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return {
    projectId: input.project.id,
    projectName: input.project.name,
    dataFormat: detectFormat(data),
    score,
    sections,
    gaps,
  };
}
