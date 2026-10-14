// Mineração da Biblioteca de Anúncios (REF2.2): monta a busca, lê o anúncio do Apify e decide o que vale guardar.
// Prioridade = tempo no ar + variações (anúncio que roda há semanas e em várias versões é sinal de que vende).
// TS puro; a função ref-mining baixa a mídia e grava.

export type SourceTipo = "palavra" | "pagina" | "url";

export function libraryUrl(tipo: SourceTipo | string, valor: string, pais = "BR"): string {
  if (tipo === "url") return valor;
  const base = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&is_targeted_country=false&media_type=all&sort_data[direction]=desc&sort_data[mode]=total_impressions";
  if (tipo === "pagina") {
    const id = valor.match(/(\d{6,})/)?.[1];
    return id ? `${base}&country=ALL&search_type=page&view_all_page_id=${id}` : valor;
  }
  return `${base}&country=${encodeURIComponent(pais || "BR")}&q=${encodeURIComponent(valor)}&search_type=keyword_unordered`;
}

export interface MinedAd {
  external_id: string;
  pagina: string;
  pagina_id: string | null;
  inicio: string | null;
  dias_no_ar: number;
  ativo: boolean;
  variacoes: number;
  copy: string;
  titulo: string | null;
  cta: string | null;
  link: string | null;
  formato_meta: string | null;
  imagem_url: string | null;
  video_url: string | null;
  preview_url: string | null;
  biblioteca_url: string;
  nicho_sugerido?: string;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Lê um item do apify/facebook-ads-scraper. Null quando não é um anúncio (ex.: erro "no_items"). */
export function mapAd(item: unknown, now = Date.now()): MinedAd | null {
  const it = obj(item);
  const id = str(it.adArchiveID) ?? str(it.adArchiveId);
  if (!id) return null;
  const s = obj(it.snapshot);
  const cards = arr(s.cards);
  const images = [...arr(s.images), ...cards];
  const videos = [...arr(s.videos), ...cards.filter((c) => c.videoHdUrl || c.videoSdUrl)];
  const inicio = str(it.startDateFormatted) ?? (typeof it.startDate === "number" ? new Date(Number(it.startDate) * 1000).toISOString() : null);
  const body = str(obj(s.body).text) ?? str(cards[0]?.body) ?? str(it.adCreativeBody) ?? str(it.body) ?? str(s.caption) ?? "";
  const titulo = str(s.title) ?? str(cards[0]?.title) ?? str(it.adCreativeLinkTitle) ?? str(it.title);
  const link = str(s.linkUrl) ?? str(cards[0]?.linkUrl) ?? str(it.linkUrl);
  const pagina = str(s.pageName) ?? str(it.pageName) ?? "Página";

  return {
    external_id: id,
    pagina,
    pagina_id: str(it.pageID) ?? str(it.pageId),
    inicio,
    dias_no_ar: inicio ? Math.max(0, Math.floor((now - Date.parse(inicio)) / 86_400_000)) : 0,
    ativo: it.isActive !== false,
    variacoes: Math.max(1, Number(it.collationCount ?? 1)),
    copy: body,
    titulo,
    cta: str(s.ctaText),
    link,
    formato_meta: str(s.displayFormat),
    imagem_url: str(images[0]?.originalImageUrl) ?? str(images[0]?.resizedImageUrl),
    video_url: str(videos[0]?.videoHdUrl) ?? str(videos[0]?.videoSdUrl),
    preview_url: str(videos[0]?.videoPreviewImageUrl),
    biblioteca_url: `https://www.facebook.com/ads/library/?id=${id}`,
    nicho_sugerido: detectNicho({ titulo, copy: body, link, pagina }),
  };
}

/** Quanto mais tempo no ar e mais variações, mais provável que venda. */
export function adScore(ad: Pick<MinedAd, "dias_no_ar" | "variacoes" | "ativo">): number {
  return (ad.ativo ? 1 : 0.5) * (Math.min(ad.dias_no_ar, 180) + 10 * Math.min(ad.variacoes, 20));
}

/** Os melhores anúncios novos da busca: no ar há pelo menos `minDias`, com mídia, sem repetir os que já estão na biblioteca. */
export function pickAds(ads: ReadonlyArray<MinedAd>, existing: ReadonlySet<string>, limit: number, minDias = 7): MinedAd[] {
  const seen = new Set<string>();
  return ads
    .filter((a) => a.dias_no_ar >= minDias && (a.imagem_url || a.video_url) && !existing.has(a.external_id))
    .filter((a) => (seen.has(a.external_id) ? false : (seen.add(a.external_id), true)))
    .sort((a, b) => adScore(b) - adScore(a))
    .slice(0, limit);
}

export function refNotes(ad: MinedAd): string {
  const desde = ad.inicio ? ad.inicio.slice(0, 10) : "?";
  return [
    `Página: ${ad.pagina} · no ar há ${ad.dias_no_ar} dias (desde ${desde}) · ${ad.variacoes} variação(ões)${ad.ativo ? "" : " · encerrado"}`,
    ad.titulo ? `Título: ${ad.titulo}` : null,
    ad.copy ? `Copy: ${ad.copy.length > 600 ? `${ad.copy.slice(0, 599)}…` : ad.copy}` : null,
    ad.cta ? `CTA: ${ad.cta}` : null,
    ad.link ? `Destino: ${ad.link}` : null,
  ].filter(Boolean).join("\n");
}

/** Detecção de nicho e subnicho baseada em vocabulário e sinais comerciais */
export function detectNicho(data: { titulo?: string | null; copy?: string | null; link?: string | null; pagina?: string | null; tags?: string[] | null }): string {
  const text = `${data.titulo || ""} ${data.copy || ""} ${data.link || ""} ${data.pagina || ""} ${(data.tags || []).join(" ")}`.toLowerCase();

  if (/blood pressure|press[ãa]o|hipertens|cardio|cora[çc][ãa]o|arterial/.test(text)) return "Pressão Alta / Hipertensão";
  if (/slimsoda|weight loss|perda de peso|emagrec|diet|gordura|hafer-trick|salzhack|fat burn|metabolismo|belly|barriga|secar|detox/.test(text)) return "Emagrecimento / Nutra";
  if (/linfa|drenagem|incha[çc]o|lymph/.test(text)) return "Saúde Linfática";
  if (/mem[óo]ria|memory|brain|foco|cogni|alzh|dem[êe]ncia/.test(text)) return "Memória / Cognição";
  if (/diabet|glicemia|sugar|blood sugar|insulina/.test(text)) return "Diabetes / Glicemia";
  if (/joint|artrite|artrose|coluna|articula|dor no joelho|dor nas costas|back pain/.test(text)) return "Dores / Articulações";
  if (/pr[óo]stata|prostate|pot[êe]ncia|ere[çc]|testosteron/.test(text)) return "Saúde Masculina";
  if (/skin|pele|cabelo|hair|rugas|anti-aging|col[áa]geno|melasma|acne/.test(text)) return "Pele / Estética";
  if (/tarot|cartomante|signo|espiritual|ora[çc][ãa]o|anjo|arcanjo|astrolog/.test(text)) return "Espiritualidade";
  if (/invest|renda|dinheiro|finance|cripto|score|cr[ée]dito/.test(text)) return "Finanças";
  if (/amor|relacionamento|casamento|reconquista|marido|esposa/.test(text)) return "Relacionamento";
  if (/health|sa[úu]de|wellness|natural|habit|remedy|rem[ée]dio|ch[áa]|suco|f[óo]rmula/.test(text)) return "Saúde e Bem-estar";
  return "Geral";
}

export interface RefDetails {
  // 1. PÁGINA
  paginaNome: string;
  paginaId?: string | null;
  destinoUrl?: string | null;
  destinoHost?: string | null;
  diasNoAr: number;
  dataInicio?: string | null;
  ativo: boolean;
  statusAtivo: boolean;
  variacoes: number;
  bibliotecaUrl?: string | null;

  // 2. COPY
  headline: string;
  copyTexto: string;
  cta?: string | null;
  gancho?: string | null;

  // 3. IMAGEM / CRIATIVO
  formato: "video" | "estatico" | "carrossel" | "outro";
  mediaUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  textoVisual?: string | null;
  descricaoVisual?: string | null;
  hasFrames: boolean;
  duracao?: number | null;

  // 4. NICHO
  nicho: string;
  tags: string[];
}

function cleanHeadlineText(raw?: string | null, pageName?: string | null): string {
  if (!raw) return "Referência de Anúncio";
  let h = raw.trim();
  if (pageName && h.startsWith(`${pageName} — `)) {
    h = h.slice(pageName.length + 3).trim();
  } else if (h.includes(" — ")) {
    const parts = h.split(" — ");
    if (parts.length > 1 && parts[0].length < 35) {
      h = parts.slice(1).join(" — ").trim();
    }
  }
  return h || raw.trim();
}

function extractHost(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0] || null;
  }
}

/** Extrai de forma unificada e estruturada os 4 pilares a partir de qualquer registro */
export function parseRefDetails(ref: any): RefDetails {
  const pMine = ref.pipeline?.mineracao || {};
  const notas = ref.notas || "";

  // Página
  const paginaNome = pMine.pagina ||
    notas.match(/Página:\s*([^·\n\r]+)/)?.[1]?.trim() ||
    ref.project_name ||
    (ref.source === "library" ? "Biblioteca" : "—");
  const paginaId = pMine.pagina_id || null;

  const destinoUrl = pMine.destino ||
    notas.match(/Destino:\s*([^\n\r]+)/)?.[1]?.trim() ||
    (ref.tipo === "landing_page" ? ref.url : null) ||
    null;
  const destinoHost = extractHost(destinoUrl);

  const diasNoAr = Number(pMine.dias_no_ar ?? (notas.match(/no ar há (\d+) dias/)?.[1] ?? 0));
  const dataInicio = pMine.inicio || notas.match(/\(desde ([^)]+)\)/)?.[1] || null;
  const ativo = pMine.ativo !== false && !notas.includes("encerrado");
  const variacoes = Number(pMine.variacoes ?? (notas.match(/(\d+) variação/)?.[1] ?? 1));
  const bibliotecaUrl = pMine.biblioteca_url || (ref.fonte === "meta-ads-library" && ref.url ? ref.url : null);

  // Copy
  const parsedHeadline = notas.match(/Título:\s*([^\n\r]+)/)?.[1]?.trim();
  const headline = parsedHeadline || cleanHeadlineText(ref.titulo, paginaNome);

  const parsedCopy = notas.match(/Copy:\s*([\s\S]*?)(?=\nCTA:|\nDestino:|$)/)?.[1]?.trim();
  const copyTexto = parsedCopy || ref.transcricao || (ref.source === "ads" ? notas : "") || "";

  const cta = pMine.cta || notas.match(/CTA:\s*([^\n\r]+)/)?.[1]?.trim() || ref.analise?.copy?.cta || ref.analise?.editorial?.ctaObserved || null;
  const gancho = ref.leitura?.gancho || ref.analise?.copy?.gancho || (copyTexto ? copyTexto.slice(0, 100) : null);

  // Imagem
  const isVideo = ref.is_video || ref.tipo === "video" || !!ref.duracao || (ref.quadros && Array.isArray(ref.quadros) && ref.quadros.length > 0);
  const formato: RefDetails["formato"] = isVideo ? "video" : (ref.formato === "carrossel" ? "carrossel" : "estatico");
  const imageUrl = ref.image_url || (!isVideo ? ref.url : null);
  const videoUrl = isVideo ? ref.url : null;
  const mediaUrl = imageUrl || videoUrl;
  const textoVisual = ref.leitura?.texto_na_imagem || ref.leitura?.texto_na_tela || null;
  const descricaoVisual = ref.leitura?.descricao_visual || null;
  const hasFrames = !!(ref.quadros && Array.isArray(ref.quadros) && ref.quadros.length > 0);

  // Nicho
  const nicho = ref.analise?.editorial?.primaryNiche ||
    ref.leitura?.nicho ||
    (Array.isArray(ref.tags) ? ref.tags.find((t: string) => t && !["Meta Ads", "criativo", "video"].includes(t)) : null) ||
    detectNicho({ titulo: headline, copy: copyTexto, link: destinoUrl, pagina: paginaNome, tags: ref.tags });

  const tags = Array.from(new Set([
    nicho,
    formato === "video" ? "Vídeo" : "Estático",
    diasNoAr >= 14 ? "Escalado" : null,
    ...(ref.tags || []),
  ].filter(Boolean) as string[]));

  return {
    paginaNome,
    paginaId,
    destinoUrl,
    destinoHost,
    diasNoAr,
    dataInicio,
    ativo,
    statusAtivo: ativo,
    variacoes,
    bibliotecaUrl,
    headline,
    copyTexto,
    cta,
    gancho,
    formato,
    mediaUrl,
    imageUrl,
    videoUrl,
    textoVisual,
    descricaoVisual,
    hasFrames,
    duracao: ref.duracao ? Number(ref.duracao) : null,
    nicho,
    tags,
  };
}

export interface GroupedRefCluster {
  id: string;
  clusterKey: string;
  mainRef: any;
  details: RefDetails;
  variations: any[];
  allRefs: any[];
  totalPages: number;
  count: number;
  uniquePages: string[];
  maxDiasNoAr: number;
  isCluster: boolean;
}

/** Agrupa referências da mesma oferta/criativo veiculadas em várias páginas */
export function groupReferencesByOffer(refs: any[]): GroupedRefCluster[] {
  const clusters = new Map<string, any[]>();

  for (const r of refs) {
    const d = parseRefDetails(r);
    // Chave de agrupamento: Host da LP + Headline limpa (ou ID único para refs manuais/semelhantes)
    let key = r.id;
    if (d.destinoHost && d.headline && d.headline.length >= 8) {
      const normH = d.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
      key = `cluster:${d.destinoHost}:${normH}`;
    } else if (d.destinoHost) {
      key = `host:${d.destinoHost}`;
    }

    const list = clusters.get(key) || [];
    list.push(r);
    clusters.set(key, list);
  }

  const result: GroupedRefCluster[] = [];

  clusters.forEach((items, key) => {
    // Ordena pelo maior dias_no_ar e dados mais completos
    items.sort((a, b) => {
      const da = parseRefDetails(a);
      const db = parseRefDetails(b);
      return (db.diasNoAr - da.diasNoAr) || ((b.score || 0) - (a.score || 0));
    });

    const mainRef = items[0];
    const details = parseRefDetails(mainRef);
    const uniquePages = Array.from(new Set(items.map((i) => parseRefDetails(i).paginaNome).filter(Boolean)));
    const maxDiasNoAr = Math.max(...items.map((i) => parseRefDetails(i).diasNoAr));

    result.push({
      id: mainRef.id,
      clusterKey: key,
      mainRef,
      details: {
        ...details,
        diasNoAr: maxDiasNoAr,
        variacoes: items.length,
      },
      variations: items,
      allRefs: items,
      totalPages: uniquePages.length,
      count: uniquePages.length,
      uniquePages,
      maxDiasNoAr,
      isCluster: items.length > 1,
    });
  });

  return result;
}

