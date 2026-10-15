import { describe, expect, it } from "vitest";
import { buildApprovalQueue } from "@shared/approval-queue";
import { supportRows } from "@shared/approval-rows";
import { decideApproval, DECISIONS_BY_SOURCE, parseSupportId, type ApprovalStore } from "@shared/approval-decide";
import { AUTONOMY_RULES } from "@shared/autonomy";

const states = [
  { channel: "whatsapp", conversation_id: "w1", project_id: "jp_freitas", support_kind: "access", support_status: "handoff", support_opened_at: "2026-10-12T10:00:00Z", latest_message_at: null },
  { channel: "instagram", conversation_id: "i1", project_id: "jp_freitas", support_kind: "other", support_status: "pending", support_opened_at: "2026-10-11T10:00:00Z", latest_message_at: null },
  { channel: "whatsapp", conversation_id: "w2", project_id: "jp_freitas", support_kind: "access", support_status: "confirmed", support_opened_at: "2026-10-10T10:00:00Z", latest_message_at: null },
];

const support = supportRows(states,
  [{ id: "w1", contact_name: "Ana", phone: "+55 (11) 99999-8888", last_message: "não consigo entrar" }],
  [{ id: "i1", participant_username: "marcos.cortes", last_message: "oi" }]);

const queue = buildApprovalQueue({
  pix: [{ id: "px1", valor: 47, created_at: "2026-10-12T09:00:00Z" }],
  semaforo: [{ id: "sem1", title: "Pausar ad", created_at: "2026-10-12T09:00:00Z" }],
  levas: [
    { id: "l1", project_id: "jp_freitas", nome: "Leva 15/10", status: "planejado", total_planejado: 8, created_at: "2026-10-15T08:00:00Z" },
    { id: "l2", project_id: "jp_freitas", nome: "Leva 14/10", status: "aprovado", total_planejado: 6, created_at: "2026-10-14T08:00:00Z" },
    { id: "l3", project_id: "jp_freitas", nome: "Leva velha", status: "completed", created_at: "2026-10-01T08:00:00Z" },
  ],
  support,
});

function fakeStore(): ApprovalStore & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec = (name: string) => async (...args: unknown[]) => { calls.push([name, ...args]); };
  return {
    calls,
    getSaleData: async () => ({}),
    updateSale: rec("updateSale"), updateAiAction: rec("updateAiAction"), executeAiAction: rec("executeAiAction"),
    updateKnowledge: rec("updateKnowledge"), setStepStatus: rec("setStepStatus"), updateContent: rec("updateContent"),
    decideLeva: rec("decideLeva"), updateSupport: rec("updateSupport"),
  };
}

describe("Aprovar como caixa única: levas e suporte parado", () => {
  it("suporte parado vem logo depois do pix; levas depois das respostas; leva gerada não entra", () => {
    expect(queue.map((i) => i.key)).toEqual([
      "pix_travado:px1",
      "suporte:whatsapp:w1",
      "suporte:instagram:i1",
      "semaforo_ads:sem1",
      "leva:l2",
      "leva:l1",
    ]);
  });

  it("suporte: nome e link da conversa; handoff é risco alto", () => {
    const wa = queue.find((i) => i.key === "suporte:whatsapp:w1");
    expect(wa).toMatchObject({ inline: true, risk: "high", link: "/inbox?tab=whatsapp&phone=5511999998888" });
    expect(wa?.title).toBe("Suporte passado para a equipe · Ana (WhatsApp)");
    expect(wa?.detail).toContain("Acesso à área de membros");
    const ig = queue.find((i) => i.key === "suporte:instagram:i1");
    expect(ig).toMatchObject({ risk: "medium", link: "/inbox?tab=instagram" });
    expect(ig?.title).toContain("@marcos.cortes");
  });

  it("leva planejada decide na fila; aprovada só abre a Fábrica para gerar", () => {
    expect(queue.find((i) => i.key === "leva:l1")).toMatchObject({ inline: true, link: "/fabrica#passo-leva" });
    expect(queue.find((i) => i.key === "leva:l2")).toMatchObject({ inline: false });
    expect(queue.find((i) => i.key === "leva:l2")?.title).toContain("esperando gerar as artes");
  });

  it("decide leva e suporte pela regra compartilhada", async () => {
    const store = fakeStore();
    const now = "2026-10-15T12:00:00Z";
    expect(await decideApproval({ source: "leva", id: "l1" }, "approve", store, { now })).toContain("Leva aprovada");
    expect(await decideApproval({ source: "leva", id: "l1" }, "reject", store, { now })).toBe("Leva descartada");
    expect(await decideApproval({ source: "suporte", id: "whatsapp:w1" }, "approve", store, { now })).toBe("Suporte marcado como resolvido");
    expect(await decideApproval({ source: "suporte", id: "instagram:i1" }, "reject", store, { now })).toBe("Conversa tirada do suporte");
    expect(store.calls).toEqual([
      ["decideLeva", "l1", "aprovar"],
      ["decideLeva", "l1", "descartar"],
      ["updateSupport", "whatsapp", "w1", { support_status: "confirmed", support_confirmed_at: now, updated_at: now }],
      ["updateSupport", "instagram", "i1", { support_status: null, support_kind: null, updated_at: now }],
    ]);
    await expect(decideApproval({ source: "leva", id: "l1" }, "mark_paid", store)).rejects.toThrow(/não vale/);
  });

  it("id de suporte inválido não chega no banco", () => {
    expect(parseSupportId("whatsapp:abc")).toEqual({ channel: "whatsapp", conversationId: "abc" });
    expect(() => parseSupportId("email:abc")).toThrow(/inválido/);
    expect(() => parseSupportId("abc")).toThrow(/inválido/);
  });

  it("toda decisão da fila tem regra de autonomia para o MCP", () => {
    const keys = new Set(AUTONOMY_RULES.map((r) => r.key));
    for (const [source, decisions] of Object.entries(DECISIONS_BY_SOURCE)) {
      for (const d of decisions) expect(keys.has(`${source}:${d}`), `${source}:${d}`).toBe(true);
    }
  });
});
