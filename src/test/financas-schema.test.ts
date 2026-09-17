import { describe, expect, it } from "vitest";
import { adsAnalysisSchema, campaignDraftsSchema, parseCreatives, parseProducts } from "@/components/projeto/financas-schema";

describe("financial AI boundaries", () => {
  it("preserves optional report sections on save", () => {
    const report = { resumo_geral: "Report", alertas: [], otimizacoes: [], novos_publicos: [{ nome: "Readers", descricao: "Engaged readers", interesses: ["Books"] }] };
    expect(adsAnalysisSchema.parse(report)).toEqual(report);
    expect(adsAnalysisSchema.safeParse({ ...report, alertas: "wrong" }).success).toBe(false);
  });
  it("rejects malformed campaign budget before currency rendering", () => {
    expect(campaignDraftsSchema.safeParse({ resumo_estrategico: "Strategy", campaigns: [{ budget_diario: "wrong" }] }).success).toBe(false);
  });
  it("keeps valid creatives and product extra fields", () => {
    expect(parseCreatives([{ name: "Video", thumbnail_url: null }, { name: {} }, null])).toEqual([{ name: "Video", thumbnail_url: null }]);
    expect(parseProducts([{ nome: "Product", preco: 25, imposto_pct: "5" }])).toEqual([{ nome: "Product", preco: 25, imposto_pct: "5" }]);
  });
});
