import { describe, expect, it } from "vitest";
import { decideSupport, hasPaidAccess, JP_FREE_PLAN_ID, lastEmail, supportMessage } from "@shared/jp-support-resolve";

const paid = [{ scope: "program", plan_id: null, program_id: "ccp", expires_at: "2099-01-01T00:00:00Z" }];
const free = [{ scope: "plan", plan_id: JP_FREE_PLAN_ID, program_id: null, expires_at: null }];

describe("resolvedor do suporte de acesso JP", () => {
  it("usa o último e-mail que a pessoa escreveu", () => {
    expect(lastEmail(["meu email é velho@x.com", "oi", "corrigindo: Nova@X.com."])).toBe("nova@x.com");
    expect(lastEmail(["oi", "não consigo entrar"])).toBe("");
  });

  it("decide entre pedir e-mail, liberar vitalício, mandar o link ou dizer que não achou compra", () => {
    expect(decideSupport({ inboundTexts: ["não consigo acessar"], email: "", hasAccount: false, ents: [], hasLifetime: false }).acao).toBe("pedir_email");
    expect(decideSupport({ inboundTexts: ["comprei o VITALÍCIO"], email: "a@x.com", hasAccount: false, ents: [], hasLifetime: false }).acao).toBe("vitalicio");
    expect(decideSupport({ inboundTexts: ["comprei o VITALÍCIO"], email: "a@x.com", hasAccount: true, ents: paid, hasLifetime: true }).acao).toBe("link");
    expect(decideSupport({ inboundTexts: ["não entra"], email: "a@x.com", hasAccount: true, ents: paid, hasLifetime: false }).acao).toBe("link");
    expect(decideSupport({ inboundTexts: ["não entra"], email: "a@x.com", hasAccount: true, ents: free, hasLifetime: false }).acao).toBe("sem_compra");
    expect(hasPaidAccess(free)).toBe(false);
  });

  it("a mensagem cita o bump liberado agora e nunca promete link sem ter um", () => {
    const msg = supportMessage({ acao: "link", email: "a@x.com" }, "https://jp/auth/verify?token=1", ["Segredo do Corte"]);
    expect(msg).toContain("Também liberei o Segredo do Corte");
    expect(msg).toContain("https://jp/auth/verify?token=1");
    expect(supportMessage({ acao: "sem_compra", email: "a@x.com" })).toContain("não encontrei compra");
  });
});
