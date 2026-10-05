import { describe, expect, it, vi } from "vitest";
import { AUTONOMY_RULES, checkAutonomy, effectiveAutonomy } from "@shared/autonomy";
import { decideApproval, type ApprovalStore } from "@shared/approval-decide";
import { briefingAlerts } from "@shared/project-briefing";

const team = [{ id: "m1", name: "Bruno Lima", email: "b@test" }];

describe("níveis de autonomia", () => {
  it("o banco ajusta dentro do teto, nunca acima; ação desconhecida é nunca", () => {
    expect(effectiveAutonomy("acao_ia:reject")).toBe("auto");
    expect(effectiveAutonomy("acao_ia:reject", "aprovar")).toBe("aprovar");
    expect(effectiveAutonomy("semaforo_ads:approve", "auto")).toBe("aprovar");
    expect(effectiveAutonomy("pix_travado:approve", "auto")).toBe("nunca");
    expect(effectiveAutonomy("apagar_tudo")).toBe("nunca");
    expect(new Set(AUTONOMY_RULES.map((r) => r.key)).size).toBe(AUTONOMY_RULES.length);
  });

  it("'aprovar' exige alguém do time por nome, primeiro nome, e-mail ou id", () => {
    expect(checkAutonomy("conteudo:approve", null, null, team)).toMatchObject({ ok: false });
    expect(checkAutonomy("conteudo:approve", null, "Fulano", team)).toMatchObject({ ok: false });
    expect(checkAutonomy("conteudo:approve", null, "bruno", team)).toEqual({ ok: true, level: "aprovar", actor: "ia (OK de Bruno Lima)" });
    expect(checkAutonomy("conteudo:approve", null, "B@TEST", team)).toMatchObject({ ok: true });
    expect(checkAutonomy("conteudo:reject", null, null, team)).toEqual({ ok: true, level: "auto", actor: "ia" });
    expect(checkAutonomy("rascunho:approve", null, "bruno", team)).toMatchObject({ ok: false, level: "nunca" });
  });
});

function fakeStore(): ApprovalStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getSaleData: vi.fn(async () => ({ recovery_sent_levels: [1] })),
    updateSale: vi.fn(async (id, patch) => { calls.push(`sale:${id}:${JSON.stringify(patch)}`); }),
    updateAiAction: vi.fn(async (id, patch) => { calls.push(`action:${id}:${patch.status}`); }),
    executeAiAction: vi.fn(async (id) => { calls.push(`exec:${id}`); }),
    updateKnowledge: vi.fn(async (id, patch) => { calls.push(`kb:${id}:${patch.aprovada}:${patch.resposta ?? ""}`); }),
    setStepStatus: vi.fn(async (id, status) => { calls.push(`step:${id}:${status}`); }),
    updateContent: vi.fn(async (id, patch) => { calls.push(`content:${id}:${patch.status}`); }),
  };
}

describe("decisão compartilhada da fila", () => {
  it("cada origem faz a mesma coisa que a tela", async () => {
    const st = fakeStore();
    expect(await decideApproval({ source: "semaforo_ads", id: "a" }, "approve", st)).toBe("Ação executada");
    expect(await decideApproval({ source: "pix_travado", id: "v" }, "mark_paid", st)).toBe("Pix marcado como pago");
    expect(await decideApproval({ source: "pix_travado", id: "v", metadata: { recoveryLevel: 2 } }, "approve", st, { now: "2026-10-05T00:00:00Z" })).toContain("nível 2");
    expect(await decideApproval({ source: "duvida_bot", id: "k", metadata: { suggestedAnswer: "Sim" } }, "approve", st)).toBe("Resposta aprovada no acervo do bot");
    expect(st.calls).toEqual([
      "exec:a",
      'sale:v:{"status":"aprovado"}',
      'sale:v:{"data":{"recovery_sent_levels":[1,2],"last_recovery_sent_at":"2026-10-05T00:00:00Z"}}',
      "kb:k:true:Sim",
    ]);
  });

  it("recusa decisão que não vale para a origem", async () => {
    await expect(decideApproval({ source: "conteudo", id: "c" }, "mark_paid", fakeStore())).rejects.toThrow(/não vale/);
    await expect(decideApproval({ source: "rascunho", id: "d" }, "approve", fakeStore())).rejects.toThrow(/não vale/);
  });
});

describe("alertas do resumo", () => {
  it("avisa decisão parada, pagamento sumido e sync de anúncios com problema", () => {
    const now = Date.parse("2026-10-05T12:00:00Z");
    const alerts = briefingAlerts({
      board: null,
      approvals: [{ key: "acao_ia:a", source: "acao_ia", id: "a", title: "X", detail: null, projectId: "p", createdAt: "2026-10-03T12:00:00Z", link: "/", media: null, risk: null, impactBrl: null, inline: true }],
      payments: [{ plataforma: "Ticto", ultima: "2026-10-01T12:00:00Z", total_90d: 300 }, { plataforma: "H&W", ultima: "2026-09-05T12:00:00Z", total_90d: 4 }],
      ads: { estado: "erro", problemas: ["Token da Meta expirado."] },
      now,
    });
    expect(alerts.map((a) => a.texto)).toEqual([
      "1 decisão(ões) esperando há mais de 24 h na fila Aprovar",
      "Ticto: nenhum aviso de pagamento há 4 dias (média 3.3/dia). Conferir se é falta de venda ou postback.",
      "Anúncios: Token da Meta expirado.",
    ]);
  });
});

describe("frases do diário", () => {
  it("traduz o registro e o autor", async () => {
    const { journalActor, journalText } = await import("@shared/journal");
    expect(journalText({ created_at: "", action: "etapa_responsavel", actor: null, entity_name: "Checkout", details: { de: null, para: "Bruno" } })).toBe("Checkout: responsável — → Bruno");
    expect(journalText({ created_at: "", action: "venda_aprovada", actor: null, entity_name: "Kit", details: { valor: 97 } })).toBe("Venda aprovada: Kit (97)");
    expect(journalActor("ia (OK de Bruno Lima) via mcp")).toBe("IA · OK de Bruno");
    expect(journalActor("ia (mcp)")).toBe("IA");
    expect(journalActor("vsugamele@gmail.com")).toBe("vsugamele");
    expect(journalActor(null)).toBe("Automação");
  });
});
