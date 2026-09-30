import { describe, expect, it } from "vitest";
import { parsePrice, productContext, cheaperProduct, guardDownsell, guardJPReply, verifiedMagicLink, jpAccessStatus, dedupeHistory } from "@shared/conversation-policy";

// Prices and destinations reproduced from the audited live catalogue; no lead PII.
const data = { produtos: [
  { nome: "Master Cuts", ativo: false, preco: "1997,00", links: ["https://mastercuts.lovable.app"] },
  { nome: "O CÓDIGO DOS CORTES PERFEITOS", preco: "47,00", link_checkout: "https://checkout.ticto.app/O854B666F", copy_arsenal: "Imersão Master Cuts, dois dias, 15 vagas" },
  { nome: "Finalização Express", preco: "37,00", link_checkout: "https://checkout.ticto.app/O3B3FE443" },
  { nome: "JP Hair Education", preco: "797", links: ["https://www.jphaireducation.com/promocao"] },
  { nome: "Mentoria de Negócios", preco: "4.000", links: ["https://www.jphaireducation.com/mentoria"] },
] };
describe("JP conversation safety", () => {
  it("reads the actual mentoring price as four thousand", () => expect(parsePrice("4.000")).toBe(4000));
  it.each([["1.997,00",1997],["47,00",47],["R$ 4.000,00",4000],["124.75",124.75],[400,400],["???",null],[0,null]])("parses %s", (input, expected) => expect(parsePrice(input)).toBe(expected));
  it("includes all active products without contaminated copy", () => {
    const ctx = productContext(data, "jp_freitas");
    expect(ctx).toContain("Finalização Express"); expect(ctx).toContain("4000.00");
    expect(ctx).not.toContain("15 vagas"); expect(ctx).not.toContain("mastercuts.lovable.app");
    expect(ctx).toContain("Master Cuts: INDISPONÍVEL");
  });
  it("never downsells a R$37 checkout to R$4000", () => expect(cheaperProduct(data,"jp_freitas","", "https://checkout.ticto.app/O3B3FE443?utm_source=wa")).toBeNull());
  it("requires an identified original and lower available price", () => {
    expect(cheaperProduct(data,"jp_freitas","unknown", "")).toBeNull();
    expect(cheaperProduct(data,"jp_freitas","JP Hair Education", "")?.price).toBe(37);
  });
  it("rejects an invented alternative or price after downsell generation", () => {
    expect(guardDownsell("Comece com a Mentoria por R$4.000",data,"jp_freitas",null)).not.toContain("Mentoria");
    const allowed = cheaperProduct(data,"jp_freitas","JP Hair Education", "");
    expect(guardDownsell("Finalização Express por R$37,00",data,"jp_freitas",allowed)).toContain("Finalização Express");
    expect(guardDownsell("Finalização Express por R$400,00",data,"jp_freitas",allowed)).not.toContain("400");
  });
  it("separates course purchase from salon booking", () => {
    expect(guardJPReply("Finalize em https://jpfreitas.com.br/agenda",data,"jp_freitas","education 5.0\nSim quero")).toContain("jphaireducation.com/promocao");
    expect(guardJPReply("Agende: https://jpfreitas.com.br/agenda",data,"jp_freitas","Quero agendar no salão")).toContain("/agenda");
  });
  it("blocks a closed event offer and invented social experience", () => {
    expect(guardJPReply("Master Cuts tem 15 vagas em março de 2026!",data,"jp_freitas","Quero presencial")).toContain("sem turmas");
    expect(guardJPReply("A viagem foi ótima!",data,"jp_freitas","Como foi a viagem?")).toContain("assistente da equipe");
  });
  it("accepts only successful token links for the member domain", () => {
    expect(verifiedMagicLink({ok:true,magic_link:"https://jphaireducation.com.br"})).toBeNull();
    expect(verifiedMagicLink({ok:false,magic_link:"https://jphaireducation.com.br/auth/verify?token="+"a".repeat(64)})).toBeNull();
    expect(verifiedMagicLink({ok:true,magic_link:"https://evil.test/auth/verify?token="+"a".repeat(64)})).toBeNull();
    expect(verifiedMagicLink({ok:true,magic_link:"https://jphaireducation.com.br/auth/verify?token="+"a".repeat(64)})).not.toBeNull();
  });
  it("reads the published CRM exists/entitlements contract", () => {
    expect(jpAccessStatus({ok:true,exists:true,entitlements:[{is_active:true,program_id:"course"}]})).toMatchObject({hasAccount:true,hasAccess:true});
    expect(jpAccessStatus({ok:false,exists:true,has_premium:true}).hasAccess).toBe(false);
  });
  it("deduplicates provider pairs while preserving repeated lead messages", () => {
    const msgs=[{direction:"in",content:"Sim",mid:"f".repeat(24),created_at:"2026-09-30T12:00:00Z"},{direction:"in",content:"Sim",mid:"m_".repeat(40),created_at:"2026-09-30T12:00:01Z"},{direction:"in",content:"Sim",mid:"m2".repeat(40),created_at:"2026-09-30T12:01:00Z"}];
    expect(dedupeHistory(msgs)).toHaveLength(2);
  });
});
