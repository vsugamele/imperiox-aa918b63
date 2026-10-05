import { describe, expect, it } from "vitest";
import { accountHealth } from "@/lib/ad-account-health";

const base = { meta_account_status: null, meta_billing_status: null, meta_unusable_reason: null, ultima_checagem: null };

describe("accountHealth", () => {
  it("sem checagem fica desconhecido", () => {
    expect(accountHealth(base).tone).toBe("unknown");
    expect(accountHealth({ ...base, ultima_checagem: "2026-10-05T00:00:00Z" }).label).toBe("Não aparece na Zernio");
  });
  it("ativa com pagamento = ok; sem pagamento = alerta", () => {
    expect(accountHealth({ ...base, meta_account_status: 1, meta_billing_status: "ok" }).tone).toBe("ok");
    expect(accountHealth({ ...base, meta_account_status: 1, meta_billing_status: "missing" }).tone).toBe("warn");
  });
  it("desativada ou com pendência = falha", () => {
    expect(accountHealth({ ...base, meta_account_status: 2, meta_unusable_reason: "disabled" })).toMatchObject({ tone: "fail", detail: "disabled" });
    expect(accountHealth({ ...base, meta_account_status: 3 }).tone).toBe("fail");
  });
});
