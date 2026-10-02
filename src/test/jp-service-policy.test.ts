import { describe, expect, it } from "vitest";
import { jpDecision, jpServiceContext, jpMayFollowUp } from "@shared/jp-service-policy";

describe("JP SDR and support replay", () => {
  it("does not turn the audited four-month immersion complaint into a hot sale", () => {
    const d = jpDecision("Estou esperando meu dia de imersão no salão sai ou não hein?!!já fazem 4 meses", { intent: "compra_quente", urgency: "high" });
    expect(d.mode).toBe("suporte");
    expect(d.support_kind).toBe("commitment");
    expect(d.commercial_score).toBe(0);
    expect(d.purchase_signal).toBe("none");
  });
  it.each(["Quanto custa o curso?", "Qual o preço da formação?", "Qual livro?", "Obrigado", "Não consigo acessar minhas aulas", "Quero agendar um horário"])("does not inflate buying intent for %s", message => {
    expect(jpDecision(message, { intent: "compra_quente", urgency: "high" }).purchase_signal).not.toBe("explicit");
  });
  it.each(["Quero comprar", "Como eu pago?", "Manda o pix", "Me manda o link de compra"])("recognizes explicit purchase: %s", message => expect(jpDecision(message).purchase_signal).toBe("explicit"));
  it("honors refusal even when an older model says hot", () => expect(jpDecision("Não quero comprar", { intent: "compra_quente" }).commercial_score).toBe(0));
  it("changes topic without erasing the pending commitment", () => {
    const state = { support_kind: "commitment", support_status: "pending", pending_commitments: { old: { evidence: "imersão combinada", status: "pending_verification" } } };
    expect(jpDecision("Qual livro?", {}, state).mode).toBe("relacionamento");
    expect(jpServiceContext("Qual livro?", state)).toContain("imersão combinada");
  });
  it("only confirms access after an explicit successful login and a sent link", () => {
    const state = { support_kind: "access", support_status: "awaiting_confirmation" };
    expect(jpDecision("Obrigado", {}, state).support_confirmed).toBe(false);
    expect(jpDecision("Ainda não consegui entrar", {}, state).support_confirmed).toBe(false);
    expect(jpDecision("Consegui entrar", {}, state).support_confirmed).toBe(true);
    expect(jpDecision("Consegui entrar", {}, { ...state, support_status: "pending" }).support_confirmed).toBe(false);
  });
  it("rejects invented profile evidence and keeps the literal declared goal", () => {
    const d = jpDecision("Quero aprender corte crespo", { extracted_profile: { seeking: "corte crespo", moment: "iniciante" }, profile_evidence: { seeking: "aprender corte crespo", moment: "sou iniciante" } });
    expect(d.facts.seeking.value).toBe("corte crespo");
    expect(d.facts.moment).toBeUndefined();
  });
  it.each(["pending", "awaiting_email", "awaiting_confirmation", "handoff"])("blocks commercial follow-up during %s support", support_status => expect(jpMayFollowUp({ support_status })).toBe(false));
  it("blocks follow-up after refusal or a social topic", () => {
    expect(jpMayFollowUp({ decision: jpDecision("Não quero comprar") })).toBe(false);
    expect(jpMayFollowUp({ decision: jpDecision("Qual livro?") })).toBe(false);
    expect(jpMayFollowUp({ decision: jpDecision("Quero comprar") })).toBe(true);
  });
});
