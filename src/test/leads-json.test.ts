import { describe, expect, it } from "vitest";
import { mergeLeadQualification } from "@/pages/leads-json";

describe("lead qualification merge", () => {
  it("retains tracking and manual fields when AI adds qualification", () => {
    const lead = { visitor_id: "visitor", utms: { utm_campaign: "campaign" }, interacoes: [{ form_id: "form" }], qualificacao: { renda: "3k-8k", notas_vendedor: "call tomorrow" } };
    expect(mergeLeadQualification(lead, { qualificacao: { dor_principal: "time" } })).toEqual({ ...lead, qualificacao: { ...lead.qualificacao, dor_principal: "time" } });
  });
  it("does not spread malformed qualification arrays into stored fields", () => {
    expect(mergeLeadQualification({ qualificacao: { renda: "3k-8k" } }, { qualificacao: ["bad"] })).toEqual({ qualificacao: { renda: "3k-8k" } });
  });
});
