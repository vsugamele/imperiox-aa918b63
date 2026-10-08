import { describe, expect, it } from "vitest";
import { entitlementFor, JP_PREMIUM_PLAN_ID, sweepActionTitle } from "@shared/jp-access-sweep";

const now = Date.parse("2026-10-08T12:00:00Z");
const gap = { venda_id: "v1", produto_nome: "Segredo do Corte", tipo_venda: "orderbump", data_venda: "2026-10-07T02:13:00Z", email: "a@x.test", user_id: "u1", program_id: "p-segredo", grants_all_premium: false };

describe("varredura de acessos JP", () => {
  it("bump vira acesso ao programa por 1 ano a partir da compra, marcado com a venda", () => {
    expect(entitlementFor(gap, "u1", now)).toMatchObject({ scope: "program", program_id: "p-segredo", source: "imperio-sweep", source_ref: "v1", expires_at: "2027-10-07T02:13:00.000Z" });
    expect(sweepActionTitle(gap)).toBe("Liberei Segredo do Corte (bump) para a@x.test");
  });

  it("formação vira o plano Premium por 2 anos; prazo já vencido ou sem programa não libera", () => {
    expect(entitlementFor({ ...gap, grants_all_premium: true, program_id: null }, "u1", now)).toMatchObject({ scope: "plan", plan_id: JP_PREMIUM_PLAN_ID, expires_at: "2028-10-06T02:13:00.000Z" });
    expect(entitlementFor({ ...gap, data_venda: "2025-01-01T00:00:00Z" }, "u1", now)).toBeNull();
    expect(entitlementFor({ ...gap, program_id: null }, "u1", now)).toBeNull();
  });
});
