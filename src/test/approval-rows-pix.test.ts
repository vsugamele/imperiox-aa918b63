import { describe, expect, it } from "vitest";
import { autoRecoveryActive, pixRowsFromSales } from "@shared/approval-rows";

const sale = (id: string, data: Record<string, unknown>) => ({ id, project_id: "jp_freitas", lead_id: null, valor: 47, produto_nome: "Código dos Cortes Perfeitos", data, nome: "Glaucilei", created_at: "2026-10-06T19:42:09Z" });

describe("Pix travado na fila", () => {
  it("some da fila quando a régua automática já está cuidando; volta se o último envio falhou", () => {
    expect(autoRecoveryActive({ hot_lead_responder_ok: true, recovery_sent_levels: [1], recovery_last: { ok: true } })).toBe(true);
    expect(autoRecoveryActive({ recovery_sent_levels: [], recovery_last: { ok: false, error: "no_provider" }, hot_lead_responder_ok: true })).toBe(false);
    expect(autoRecoveryActive({})).toBe(false);
    const rows = pixRowsFromSales([
      sale("a", { hot_lead_responder_ok: true, recovery_sent_levels: [1] }),
      sale("b", { recovery_last: { ok: false, error: "no_provider" } }),
      sale("c", {}),
    ] as never, {}, Date.parse("2026-10-06T21:00:00Z"));
    expect(rows.map((r) => r.id)).toEqual(["b", "c"]);
  });
});
