import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildAiFeed, feedCounts } from "@shared/ai-feed";
import { AiDidFeed } from "@/components/aprovar/AiDidFeed";

const since = "2026-10-05T00:00:00Z";
const feed = buildAiFeed({
  since,
  aiMessages: [{ id: "m1", conversation_id: "c1", project_id: "jp_freitas", content: "Oi! O acesso chega no seu e-mail em até 5 minutos.", created_at: "2026-10-06T19:00:00Z", sent_by: "ai", direction: "outgoing" }],
  incoming: [
    { id: "i0", conversation_id: "c1", project_id: "jp_freitas", content: "bom dia", created_at: "2026-10-06T10:00:00Z", sent_by: "lead", direction: "incoming" },
    { id: "i1", conversation_id: "c1", project_id: "jp_freitas", content: "Já paguei e não recebi o acesso", created_at: "2026-10-06T18:59:00Z", sent_by: "lead", direction: "incoming" },
    { id: "i2", conversation_id: "c1", project_id: "jp_freitas", content: "depois", created_at: "2026-10-06T19:05:00Z", sent_by: "lead", direction: "incoming" },
  ],
  sales: [
    { id: "v1", project_id: "jp_freitas", nome: "Glaucilei", produto_nome: "Código dos Cortes Perfeitos", valor: 47, status: "pix_gerado", created_at: "2026-10-06T19:42:00Z", data: { hot_lead_responder_sent: "2026-10-06T19:42:11Z", recovery_sent_levels: [1], recovery_last: { at: "2026-10-06T20:00:07Z", ok: true } } },
    { id: "v2", project_id: "jp_freitas", nome: "Velho", produto_nome: "CCP", valor: 47, status: "pix_gerado", created_at: "2026-09-27T21:21:00Z", data: { recovery_last: { at: "2026-09-28T21:30:00Z", ok: true }, recovery_sent_levels: [2, 3] } },
    { id: "v3", project_id: "jp_freitas", nome: "Pagou", produto_nome: "CCP", valor: 47, status: "aprovado", created_at: "2026-10-06T10:00:00Z", data: { hot_lead_responder_sent: "2026-10-06T10:00:02Z" } },
  ],
  knowledge: [{ id: "k1", project_id: "jp_freitas", pergunta: "Tem curso presencial?", resposta: "No momento não temos", aprovada: true, triado_em: "2026-10-06T17:00:00Z", triagem: { reutilizavel: 0.87 } }],
  actions: [],
  feedback: [{ item_kind: "acervo", item_id: "k1", verdict: "ok", correcao: null }],
});

const mutate = vi.fn();
vi.mock("@/hooks/useAiFeed", () => ({
  useAiFeed: () => ({ data: feed, isLoading: false, error: null }),
  useAiFeedback: () => ({ mutate, isPending: false }),
}));

describe("A IA fez", () => {
  it("monta o feed com o contexto certo, só dentro da janela, e conta o que falta revisar", () => {
    expect(feed.map((i) => `${i.kind}:${i.id}`)).toEqual(["recuperacao_pix:v1", "resposta_wa:m1", "acervo:k1", "recuperacao_pix:v3"]);
    expect(feed.find((i) => i.id === "m1")?.contexto).toBe("Já paguei e não recebi o acesso");
    expect(feed.find((i) => i.id === "v1")).toMatchObject({ resultado: "Ainda não pagou", feito: "Respondi na hora em que o Pix foi gerado e mandei a régua de recuperação (nível 1)." });
    expect(feed.find((i) => i.id === "v3")?.resultado).toBe("Pagou depois ✓");
    expect(feedCounts(feed)).toMatchObject({ total: 4, sem_revisao: 3 });
  });

  it("revisa com 'tá certo' e exige texto para 'faria diferente' numa resposta", () => {
    render(<AiDidFeed projectName={() => "JP Freitas"} />);
    expect(screen.queryByText("Tem curso presencial?")).not.toBeInTheDocument(); // já revisado e filtro "só sem revisão"
    const card = screen.getByRole("article", { name: "Respondi um lead no WhatsApp" });
    expect(within(card).getByText("Já paguei e não recebi o acesso")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Tá certo/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ verdict: "ok", item: expect.objectContaining({ id: "m1" }) }), expect.anything());

    fireEvent.click(within(card).getByRole("button", { name: /Faria diferente/ }));
    fireEvent.change(within(card).getByLabelText("Como você faria"), { target: { value: "Pede o e-mail e reenvia o link" } });
    fireEvent.click(within(card).getByRole("button", { name: "Enviar correção" }));
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ verdict: "diferente", correcao: "Pede o e-mail e reenvia o link" }), expect.anything());
  });
});
