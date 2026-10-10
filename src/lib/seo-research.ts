import { object } from "@/lib/marketing-consolidation";
export const SEO_PREFIX = "SEO:v1\n";
export interface SeoResearch {
  keyword: string; source: string; sourceUrl: string; collectedAt: string;
  score: number | null; volume: null; decision: string; result: string; raw: Record<string, unknown>;
}
export function parseSeo(content: string): SeoResearch | null {
  if (!content.startsWith(SEO_PREFIX)) return null;
  try {
    const r = JSON.parse(content.slice(SEO_PREFIX.length));
    return typeof r.keyword === "string" && typeof r.source === "string" && typeof r.sourceUrl === "string" && typeof r.collectedAt === "string" && typeof r.decision === "string" && typeof r.result === "string" ? r : null;
  } catch { return null; }
}
export function seoNoteText(content: string): string {
  const r = parseSeo(content);
  return r ? [`Pesquisa SEO: ${r.keyword}`, `Origem: ${r.source} · ${r.sourceUrl}`, `Coleta: ${r.collectedAt}`, `Score heurístico: ${r.score ?? "sem dado"} · volume: sem dado`, `Decisão: ${r.decision}`, `Resultado: ${r.result}`].join("\n") : content;
}
export function radarResearch(input: unknown): SeoResearch[] {
  const report = object(input);
  if (report.project !== "Healthy Legs Daily" || typeof report.generated_at !== "string" || !Number.isFinite(Date.parse(report.generated_at)) || !Array.isArray(report.opportunities) || report.opportunities.length > 500) throw new Error("Relatório Healthy inválido: projeto, data e oportunidades são obrigatórios.");
  return report.opportunities.map((value: unknown) => {
    const r = object(value);
    if (typeof r.keyword !== "string" || !r.keyword.trim() || r.keyword.length > 500 || typeof r.source !== "string" || !["google-suggest", "apify-serp", "apify-related"].includes(r.source)) throw new Error("Oportunidade sem keyword/origem válida.");
    return { keyword: r.keyword.trim(), source: r.source, sourceUrl: "https://github.com/vsugamele/healthy-legs-daily/blob/main/scripts/keyword-opportunities.json", collectedAt: report.generated_at as string, score: typeof r.score === "number" ? r.score : null, volume: null, decision: "Aguardando revisão editorial", result: "Sem resultado medido", raw: r };
  });
}
/** Stable PK uses existing project_notes.id constraint. ignoreDuplicates preserves editorial decisions. */
export async function seoNoteId(projectId: string, r: SeoResearch) {
  const identity = JSON.stringify(["seo:v1", projectId, r.sourceUrl, r.collectedAt, r.source, r.keyword.normalize("NFKC").toLowerCase()]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)));
  hash[6] = (hash[6] & 15) | 128; hash[8] = (hash[8] & 63) | 128;
  const hex = [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
