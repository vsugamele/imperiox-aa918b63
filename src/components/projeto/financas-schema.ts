import { z } from "zod";

// Contracts emitted by openflow-ai handleCampaignDrafts / handleAnalyzeAds.
const optionalText = z.string().nullish();
export const campaignDraftsSchema = z.object({
  resumo_estrategico: z.string(),
  campaigns: z.array(z.object({
    nome: z.string(), objetivo: z.enum(["conversao", "trafego", "leads", "alcance", "engajamento", "retargeting"]),
    etapa_funil: z.enum(["topo", "meio", "fundo", "retencao"]), budget_diario: z.number(),
    publico: z.object({ idade_min: z.number(), idade_max: z.number(), genero: z.enum(["todos", "masculino", "feminino"]), interesses: z.array(z.string()), exclusoes: z.array(z.string()).nullish(), lookalike: optionalText, retargeting: optionalText }),
    conjuntos: z.array(z.object({ nome: z.string(), segmentacao: z.string(), posicionamento: optionalText })).nullish(),
    copies: z.array(z.object({ headline: z.string(), texto_primario: z.string(), descricao: optionalText, cta: z.string() })),
    sugestao_criativo: z.string(), justificativa: z.string(),
  })),
});
export const adsAnalysisSchema = z.object({
  resumo_geral: z.string(),
  melhor_campanha: z.object({ nome: z.string(), motivo: z.string(), metricas: z.string() }).nullish(),
  pior_campanha: z.object({ nome: z.string(), motivo: z.string(), sugestao: z.string() }).nullish(),
  alertas: z.array(z.object({ tipo: z.enum(["frequencia_alta", "ctr_baixo", "cpc_alto", "budget_mal_distribuido", "criativo_saturado", "outro"]), mensagem: z.string(), acao_sugerida: z.string() })),
  otimizacoes: z.array(z.object({ area: z.string(), recomendacao: z.string(), impacto_esperado: z.string() })),
  novos_publicos: z.array(z.object({ nome: z.string(), descricao: z.string(), interesses: z.array(z.string()) })).nullish(),
  redistribuicao_budget: optionalText,
});
// Project JSON created by facebook-ads-sync; fields can be absent for video creatives.
const creativeSchema = z.object({ name: optionalText, ad_name: optionalText, status: optionalText, body: optionalText, title: optionalText, image_url: optionalText, thumbnail_url: optionalText });
const productSchema = z.object({ nome: z.string(), link: optionalText, imposto_pct: z.union([z.string(), z.number()]).nullish() }).passthrough();
export type CampaignDrafts = z.infer<typeof campaignDraftsSchema>;
export type AdsAnalysis = z.infer<typeof adsAnalysisSchema>;
export type FacebookCreative = z.infer<typeof creativeSchema>;
export function parseCreatives(value: unknown): FacebookCreative[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => { const parsed = creativeSchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
}
export function parseProducts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => { const parsed = productSchema.safeParse(item); return parsed.success && typeof parsed.data.nome === "string" ? [{ ...parsed.data, nome: parsed.data.nome }] : []; });
}
