import { describe, expect, it } from "vitest";
import { formatWaiting, pickWaiting, quietHours, type WaitingConv } from "@shared/wa-waiting";

const now = new Date("2026-10-09T15:00:00Z"); // 12h em Brasília
const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
const conv = (over: Partial<WaitingConv>): WaitingConv => ({
  id: "c1", project_id: "jp_freitas", phone: "5511999991234", nome: "Ana", last_message: "Oi, consigo pagar no cartão?",
  last_incoming_at: ago(90), last_message_direction: "incoming", ia_ativa: false, ai_paused: false, ...over,
});

describe("lead esperando resposta no WhatsApp", () => {
  it("lista quem falou por último entre 1 h e 48 h, sem grupos, adiados ou já avisados", () => {
    const items = pickWaiting([
      conv({}),
      conv({ id: "recente", last_incoming_at: ago(30) }),
      conv({ id: "velho", last_incoming_at: ago(60 * 49) }),
      conv({ id: "respondido", last_message_direction: "outgoing" }),
      conv({ id: "grupo", phone: "120363409438175766@g.us" }),
      conv({ id: "adiado", snoozed_until: ago(-60) }),
      conv({ id: "avisado", last_incoming_at: ago(120) }),
      conv({ id: "ia", ia_ativa: true, ai_paused_until: ago(-30), assigned_to: "u1", last_incoming_at: ago(180) }),
    ], new Set([`avisado|${ago(120)}`]), { jp_freitas: "JP Freitas" }, now);
    expect(items.map((i) => i.c)).toEqual(["ia", "c1"]);
    expect(items[1]).toMatchObject({ projeto: "JP Freitas", nome: "Ana", fone: "…1234", horas: 1.5, motivo: "IA desligada, sem responsável" });
    expect(items[0].motivo).toBe("IA pausada, com responsável");
  });

  it("monta uma mensagem só, com no máximo 10 leads", () => {
    const many = Array.from({ length: 12 }, (_, i) => conv({ id: `c${i}`, nome: `Lead ${i}` }));
    const text = formatWaiting(pickWaiting(many, new Set(), {}, now));
    expect(text).toContain("12 leads esperando");
    expect(text).toContain("…e mais 2.");
    expect(text.match(/^• /gm)).toHaveLength(10);
  });

  it("fica em silêncio das 22h às 8h de Brasília", () => {
    expect(quietHours(new Date("2026-10-09T01:30:00Z"))).toBe(true); // 22h30
    expect(quietHours(new Date("2026-10-09T10:59:00Z"))).toBe(true); // 7h59
    expect(quietHours(new Date("2026-10-09T11:00:00Z"))).toBe(false); // 8h
  });
});
