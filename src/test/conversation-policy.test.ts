import { describe, expect, it } from "vitest";
import { parsePrice, productContext, cheaperProduct, guardDownsell, guardJPReply, verifiedMagicLink, jpAccessStatus, dedupeHistory, recentJPHistory, jpWelcomeMessage, jpConversationRules } from "@shared/conversation-policy";

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
    expect(guardJPReply("A viagem foi ótima!",data,"jp_freitas","Como foi a viagem?")).toBe("Obrigado pelo carinho!");
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
  it("replays the reported book question without resurrecting July's Rio or immersion", () => {
    const history = [
      { direction:"in", content:"Qual livro?", created_at:"2026-10-01T20:53:50Z" },
      { direction:"in", content:"Estou esperando meu dia de imersão no salão sai ou não hein?!!já fazem 4 meses", created_at:"2026-07-15T23:23:35Z" },
      { direction:"in", content:"Opa que dia no Rio?", created_at:"2026-07-03T02:28:18Z" },
    ];
    const recent = recentJPHistory(dedupeHistory(history),"jp_freitas");
    expect(recent.map(m=>m.content)).toEqual(["Qual livro?"]);
    const original = "Opa! Aqui é o assistente do JP Freitas. Sobre o dia no Rio, não tenho como confirmar informações de imersão, pois o Master Cuts não está disponível no momento.";
    expect(guardJPReply(original,data,"jp_freitas",recent.map(m=>m.content).join("\n"),true))
      .toBe("Me manda um print do story ou da capa pra eu confirmar qual livro é.");
  });
  it("keeps course context in the current day and does not change other projects",()=>{
    const history = [
      {direction:"in",content:"Sim quero",created_at:"2026-10-01T20:00:00Z"},
      {direction:"out",content:"JP Hair Education",created_at:"2026-10-01T19:59:00Z"},
      {direction:"in",content:"Rio",created_at:"2026-07-03T02:28:18Z"},
    ];
    expect(recentJPHistory(history,"jp_freitas")).toHaveLength(2);
    expect(recentJPHistory(history,"another_project")).toBe(history);
    expect(recentJPHistory([],"jp_freitas")).toEqual([]);
    expect(recentJPHistory([{direction:"in",content:"undated"}],"jp_freitas")).toEqual([]);
  });
  it("removes the unrequested assistant introduction while preserving the answer",()=>{
    expect(guardJPReply("Opa! 👋 Aqui é o assistente do JP Freitas. O curso custa R$ 47.",data,"jp_freitas","Qual valor?"))
      .toBe("Opa! 👋 O curso custa R$ 47.");
    expect(jpWelcomeMessage("jp_freitas","Aqui é o assistente do JP Freitas")).not.toContain("assistente");
    expect(jpWelcomeMessage("other","Olá, equipe de suporte")).toBe("Olá, equipe de suporte");
  });
  it.each(["Você é uma IA ou o JP?","É robô?","Quem está respondendo, o JP?"])("keeps an honest answer to a direct identity question: %s",question=>{
    const answer="Sou o assistente automático da equipe do JP.";
    expect(guardJPReply(answer,data,"jp_freitas",question)).toBe(answer);
  });
  it("asks for missing story context instead of inventing a book title",()=>{
    expect(guardJPReply("É o livro X.",data,"jp_freitas","Qual é o livro?",true)).toContain("print do story");
    expect(guardJPReply("O livro que você citou é X.",data,"jp_freitas","Estou lendo o livro X",false)).toContain("livro que você citou");
  });
  it("does not mistake a book recommendation request for a missing story title",()=>{
    const reply="Que tipo de leitura você procura?";
    expect(guardJPReply(reply,data,"jp_freitas","Qual livro você recomenda?",true)).toBe(reply);
  });
  it("distinguishes an existing immersion commitment from new Master Cuts enrollment",()=>{
    const rules=jpConversationRules("jp_freitas",new Date("2026-10-01T20:00:00Z"));
    expect(rules).toContain("Não assuma que toda imersão no salão é Master Cuts");
    expect(rules).toContain("Não se apresente espontaneamente");
    expect(rules).toContain("verificação do combinado");
  });
});
