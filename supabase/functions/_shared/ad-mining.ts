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
  const body = str(obj(s.body).text) ?? str(cards[0]?.body) ?? "";
  return {
    external_id: id,
    pagina: str(s.pageName) ?? str(it.pageName) ?? "Página",
    pagina_id: str(it.pageID) ?? str(it.pageId),
    inicio,
    dias_no_ar: inicio ? Math.max(0, Math.floor((now - Date.parse(inicio)) / 86_400_000)) : 0,
    ativo: it.isActive !== false,
    variacoes: Math.max(1, Number(it.collationCount ?? 1)),
    copy: body,
    titulo: str(s.title) ?? str(cards[0]?.title),
    cta: str(s.ctaText),
    link: str(s.linkUrl) ?? str(cards[0]?.linkUrl),
    formato_meta: str(s.displayFormat),
    imagem_url: str(images[0]?.originalImageUrl) ?? str(images[0]?.resizedImageUrl),
    video_url: str(videos[0]?.videoHdUrl) ?? str(videos[0]?.videoSdUrl),
    preview_url: str(videos[0]?.videoPreviewImageUrl),
    biblioteca_url: `https://www.facebook.com/ads/library/?id=${id}`,
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
