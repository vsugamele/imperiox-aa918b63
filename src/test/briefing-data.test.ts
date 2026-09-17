import { describe, expect, it } from "vitest";
import { mergeProductIntelligence, copyArsenalFields } from "@/components/projeto/briefing-data";
import { normalizeProductLinks } from "@/lib/produto-links";

describe("briefing product data", () => {
  it("applies mechanism, context and offers together while preserving metadata", () => {
    expect(mergeProductIntelligence({ nome: "Produto", metadata: { origem: "manual" }, ofertas: [] }, { product_intel: { mecanismo: "Método", contexto: "Contexto", ofertas_sugeridas: [{ nome: "Principal", tipo_oferta: "principal", preco_sugerido: 90 }] } })).toEqual({ nome: "Produto", metadata: { origem: "manual" }, mecanismo: "Método", contexto: "Contexto", ofertas: [{ nome: "Principal", tipo_oferta: "principal", preco_por: 90, ativo: true }] });
  });
  it("preserves existing user copy and offers", () => {
    const current = { mecanismo: "Manual", contexto: "Autoral", ofertas: [{ nome: "Atual", preco_por: 80 }] };
    expect(mergeProductIntelligence(current, { product_intel: { mecanismo: "Novo", contexto: "Novo", ofertas_sugeridas: [{ nome: "Outra" }] } })).toEqual(current);
    expect(copyArsenalFields({ promessa: "Texto", variacoes: ["A"], meta: { origem: "manual" } })).toEqual({ promessa: "Texto", variacoes: ["A"] });
  });
  it("provides URLs for both legacy and structured product links", () => {
    expect(normalizeProductLinks({ links: ["https://example.com/old", { url: "https://example.com/new", label: "Site", ativo: true }] }).map(link => link.url)).toEqual(["https://example.com/old", "https://example.com/new"]);
  });
});
