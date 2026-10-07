// Teste A/B/C de página (FUN1.2): um link único divide o tráfego entre as páginas pelo peso escolhido, a pessoa volta
// sempre para a mesma variante, e o relatório compara visitas, cliques no botão e checkouts por variante.
// TS puro: escolha da variante, URL de destino e leitura do teste.

export interface SplitVariant { key: string; url: string; peso: number }

export function normalizeVariants(raw: unknown): SplitVariant[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((v, i) => {
      const r = v && typeof v === "object" ? v as Record<string, unknown> : {};
      return { key: String(r.key ?? String.fromCharCode(65 + i)), url: String(r.url ?? "").trim(), peso: Math.max(0, Number(r.peso ?? 1)) };
    })
    .filter((v) => /^https?:\/\//i.test(v.url));
}

/** Escolhe pelo peso. `rand` em [0,1). Se todos os pesos forem 0, divide igual. */
export function pickVariant(variants: ReadonlyArray<SplitVariant>, rand: number): SplitVariant {
  const total = variants.reduce((s, v) => s + v.peso, 0);
  if (total <= 0) return variants[Math.min(variants.length - 1, Math.floor(rand * variants.length))];
  let acc = 0;
  for (const v of variants) {
    acc += v.peso / total;
    if (rand < acc) return v;
  }
  return variants[variants.length - 1];
}

/** URL final: a página da variante + os parâmetros do anúncio (UTMs, fbclid) + a marca do teste. */
export function targetUrl(variantUrl: string, incoming: URLSearchParams, slug: string, key: string): string {
  const u = new URL(variantUrl);
  for (const [k, v] of incoming) if (!u.searchParams.has(k) && k !== "s") u.searchParams.set(k, v);
  u.searchParams.set("imp_split", slug);
  u.searchParams.set("imp_var", key);
  return u.toString();
}

export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "teste";
}

/** Mesma chave de URL que o rastreador usa (sem protocolo, www, query, barra final, .html, /index). */
export function pageKey(url: string): string {
  return url.toLowerCase().trim().split("#")[0].split("?")[0].replace(/^[a-z]+:\/\/(www\.)?/, "").replace(/\/+$/, "").replace(/\.html$/, "").replace(/\/index$/, "");
}

export interface PageMetricValues { sessoes_pagina?: number | null; cliques_cta?: number | null; cliques_checkout?: number | null }

export interface VariantReport {
  key: string;
  url: string;
  peso: number;
  enviados: number;
  visitas: number | null;
  cliques: number | null;
  checkouts: number | null;
  /** Checkouts (ou cliques no botão, se não houver checkout medido) por visita, em %. */
  conversao: number | null;
}

export const MIN_VISITAS = 100;

export function splitReport(variants: ReadonlyArray<SplitVariant>, hits: Readonly<Record<string, number>>, pages: Readonly<Record<string, PageMetricValues>>) {
  const linhas: VariantReport[] = variants.map((v) => {
    const m = pages[pageKey(v.url)];
    const visitas = m ? Number(m.sessoes_pagina ?? 0) : null;
    const cliques = m ? Number(m.cliques_cta ?? 0) : null;
    const checkouts = m ? Number(m.cliques_checkout ?? 0) : null;
    const base = checkouts && checkouts > 0 ? checkouts : cliques;
    return {
      key: v.key, url: v.url, peso: v.peso, enviados: hits[v.key] ?? 0, visitas, cliques, checkouts,
      conversao: visitas && base !== null ? Math.round((base / visitas) * 1000) / 10 : null,
    };
  });
  const medidas = linhas.filter((l) => l.conversao !== null && (l.visitas ?? 0) >= MIN_VISITAS);
  const ordenadas = [...medidas].sort((a, b) => (b.conversao ?? 0) - (a.conversao ?? 0));
  let vencedor: string | null = null;
  let leitura = `Coletando: cada página precisa de ${MIN_VISITAS} visitas medidas.`;
  if (medidas.length === linhas.length && ordenadas.length >= 2) {
    const [a, b] = ordenadas;
    if ((a.conversao ?? 0) >= (b.conversao ?? 0) * 1.2 && (a.conversao ?? 0) > 0) {
      vencedor = a.key;
      leitura = `Página ${a.key} converte ${a.conversao}% contra ${b.conversao}% da ${b.key}: vencedora.`;
    } else {
      leitura = "Empate técnico: a diferença ainda é menor que 20%.";
    }
  }
  const semRastreador = linhas.filter((l) => l.visitas === null).map((l) => l.key);
  return { linhas, vencedor, leitura, semRastreador, totalEnviados: linhas.reduce((s, l) => s + l.enviados, 0) };
}
