import { describe, expect, it } from "vitest";
import { actionGroupFor, nextActionText, waitingConversations, waitingLabel, type ConversationRow } from "@/lib/lead-next-action";

const now = Date.parse("2026-10-04T12:00:00Z");
const conv = (id: string, minAgo: number, extra: Partial<ConversationRow> = {}): ConversationRow => ({
  id, phone: "5511999", contact_name: `Contato ${id}`, project_id: "jp", last_message: "Oi, quero saber o preço", last_message_direction: "incoming",
  last_message_at: new Date(now - minAgo * 60_000).toISOString(), jid_suffix: "s.whatsapp.net", ...extra,
});

describe("lead next action", () => {
  it("groups leads by what to do: payment first, then hot, then win-back", () => {
    expect(actionGroupFor([{ key: "score_alto" }, { key: "pix_recente" }])).toBe("pagamento");
    expect(actionGroupFor([{ key: "recusado" }])).toBe("pagamento");
    expect(actionGroupFor([{ key: "engajou_agora" }])).toBe("quente");
    expect(actionGroupFor([{ key: "winback" }])).toBe("reengajar");
    expect(actionGroupFor([{ key: "winback" }, { key: "score_alto" }])).toBe("quente");
  });

  it("says the next action in plain words", () => {
    expect(nextActionText("pagamento", [{ key: "recusado" }])).toBe("Oferecer Pix ou outro cartão");
    expect(nextActionText("pagamento", [{ key: "pix_24h" }])).toBe("Ajudar a finalizar o pagamento");
    expect(nextActionText("responder", [])).toBe("Responder a mensagem");
  });

  it("lists individual conversations waiting for a reply, longest wait first, within 48 h", () => {
    const list = waitingConversations([
      conv("a", 30), conv("b", 300), conv("velha", 60 * 50),
      conv("respondida", 10, { last_message_direction: "outgoing" }), conv("grupo", 5, { jid_suffix: "g.us" }),
    ], now);
    expect(list.map((c) => c.id)).toEqual(["b", "a"]);
    expect(list[0]).toMatchObject({ nome: "Contato b", waitingMin: 300, preview: "Oi, quero saber o preço" });
  });

  it("formats the waiting time", () => {
    expect(waitingLabel(12)).toBe("esperando há 12 min");
    expect(waitingLabel(185)).toBe("esperando há 3 h");
    expect(waitingLabel(3000)).toBe("esperando há 2 dia(s)");
  });
});
