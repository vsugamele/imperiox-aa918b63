import { describe, expect, it } from "vitest";
import { parseOperatorCommand, planOperatorRound, resolveOperatorCommand, type OperatorLive, type OperatorProject } from "@shared/operator";

// O formatador de moeda usa espaço inquebrável depois do "R$".
const sp = (t: string) => t.replace(/\u00a0/g, " ");
const opts = { since: "2026-10-07T12:00:00Z", label: "14:00", appUrl: "https://imperiox.vercel.app" };
const live = (over: Partial<OperatorLive["parcial"]> = {}, alertas: string[] = []): OperatorLive => ({
  moeda: "BRL",
  parcial: {
    gasto: { valor: 100 }, faturamento: { valor: 200 }, vendas: { valor: 4 }, roas: { valor: 2 },
    cpa: { valor: 25, zona: "escala", zona_label: "ESCALA", alvo: 45 }, ...over,
  },
  alertas,
});

const jp: OperatorProject = {
  id: "jp_freitas", name: "JP Freitas",
  live: live({ cpa: { valor: 80, zona: "prejuizo", zona_label: "PREJUÍZO", alvo: 45 } }, ["Pixel da Meta (4) e checkout (1) discordam em mais de 20%: conferir pixel/CAPI e UTMs."]),
  briefing: {
    alertas: [
      { nivel: "critico", texto: "2 etapa(s) com prazo vencido: A, B" },
      { nivel: "atencao", texto: "Ticto: nenhum aviso de pagamento há 4 dias (média 1.2/dia). Conferir se é falta de venda ou postback." },
    ],
    aprovacoes: {
      total: 5,
      primeiras: [
        { key: "acao_ia:a1", origem: "Ações da IA", titulo: "Pausar conjunto caro", esperando_ha: "2 d", precisa_ok_de_alguem: ["approve"], decisao_pelo_mcp: ["approve", "reject"], link: "/imperius" },
        { key: "duvida_bot:d1", origem: "Dúvidas do bot", titulo: "Qual o prazo de acesso?", esperando_ha: "5 h", precisa_ok_de_alguem: ["approve"], decisao_pelo_mcp: ["approve", "reject"], link: "/aprovar" },
        { key: "etapa:e1", origem: "Etapas", titulo: "Revisar VSL", esperando_ha: "1 d", precisa_ok_de_alguem: [], decisao_pelo_mcp: ["reject"], link: "/funis" },
      ],
    },
    etapas: { lista_atrasadas: [
      { etapa: "Gravar anúncio", responsavel: "Bruno Lima", prazo: "2026-10-05", link: "/x" },
      { etapa: "Revisar VSL", responsavel: "Bruno Lima", prazo: "2026-10-06", link: "/y" },
      { etapa: "Parâmetros da esteira", responsavel: null, prazo: "2026-10-04", link: "/z" },
    ] },
    diario: [
      { quando: "2026-10-07T13:00:00Z", acao: "wa_reply", quem: "ia (bot WhatsApp)", o_que: "Ana" },
      { quando: "2026-10-07T13:10:00Z", acao: "acesso", quem: "bot Direct", o_que: "Carla" },
      { quando: "2026-10-07T13:20:00Z", acao: "etapa", quem: "vinicius@x.com", o_que: "Etapa" },
      { quando: "2026-10-07T09:00:00Z", acao: "wa_reply", quem: "ia", o_que: "antes da rodada" },
    ],
  },
};
const calmo: OperatorProject = { id: "slimsoda", name: "SlimSoda", live: live(), briefing: { alertas: [], aprovacoes: { total: 0, primeiras: [] }, etapas: { lista_atrasadas: [] }, diario: [] } };

describe("operador diário: rodada", () => {
  it("prioriza dinheiro, numera só decisões que precisam de OK e cobra atraso por dono", () => {
    const r = planOperatorRound([jp, calmo], opts);
    expect(r.itens.filter((i) => i.tipo === "dinheiro").map((i) => sp(i.texto))).toEqual([
      "CPA R$ 80,00 (PREJUÍZO) com 4 vendas hoje, alvo R$ 45,00 — rever verba e anúncios",
      "Pixel da Meta (4) e checkout (1) discordam em mais de 20%: conferir pixel/CAPI e UTMs.",
      "Ticto: nenhum aviso de pagamento há 4 dias (média 1.2/dia). Conferir se é falta de venda ou postback.",
    ]);
    expect(r.itens.filter((i) => i.tipo === "decisao").map((i) => [i.n, i.key])).toEqual([[1, "acao_ia:a1"], [2, "duvida_bot:d1"]]);
    expect(r.texto).toContain("*Bruno Lima* — Gravar anúncio, Revisar VSL · *sem dono* — Parâmetros da esteira");
    expect(r.texto).toContain("🟠 Precisa de OK (2 de 5):");
    expect(r.texto).toContain("*1.* Ações da IA: Pausar conjunto caro — espera 2 d");
    // Projeto sem nada a dizer fica de fora.
    expect(r.texto).not.toContain("SlimSoda");
    // Só o que a IA/bot fez depois do início da janela.
    expect(r.feitos_pela_ia).toBe(2);
    expect(r.texto).toContain("A IA fez 2 coisas sozinha");
    expect(r.texto.indexOf("🔴")).toBeLessThan(r.texto.indexOf("🟠"));
    expect(r.texto.indexOf("🟠")).toBeLessThan(r.texto.indexOf("🟡"));
  });

  it("CPA fora do alvo com poucas vendas não alarma; gasto sem venda acima do alvo sim", () => {
    const poucas = planOperatorRound([{ ...calmo, live: live({ vendas: { valor: 2 }, cpa: { valor: 80, zona: "prejuizo", zona_label: "PREJUÍZO", alvo: 45 } }) }], opts);
    expect(poucas.texto).toBe("");
    const semVenda = planOperatorRound([{ ...calmo, live: live({ gasto: { valor: 60 }, vendas: { valor: 0 }, cpa: { valor: null, zona: "sem_venda", zona_label: "SEM VENDA", alvo: 45 } }) }], opts);
    expect(semVenda.itens.map((i) => sp(i.texto))).toEqual(["Gasto R$ 60,00 hoje e nenhuma venda (já passou do CPA alvo R$ 45,00)"]);
  });

  it("sem nada a dizer, texto vazio; a assinatura só muda quando o conteúdo muda", () => {
    expect(planOperatorRound([calmo], opts).texto).toBe("");
    const a = planOperatorRound([jp], opts).assinatura;
    expect(planOperatorRound([jp], { ...opts, label: "19:30" }).assinatura).toBe(a);
    const menos = { ...jp, briefing: { ...jp.briefing!, etapas: { lista_atrasadas: [] } } };
    expect(planOperatorRound([menos], opts).assinatura).not.toBe(a);
  });
});

describe("operador: respostas no grupo", () => {
  it("entende ok/sim/não/pago com um ou vários números", () => {
    expect(parseOperatorCommand("ok 1")).toEqual({ decisao: "approve", numeros: [1] });
    expect(parseOperatorCommand("Sim 2")).toEqual({ decisao: "approve", numeros: [2] });
    expect(parseOperatorCommand("ok 1, 3 e 5.")).toEqual({ decisao: "approve", numeros: [1, 3, 5] });
    expect(parseOperatorCommand("não 2")).toEqual({ decisao: "reject", numeros: [2] });
    expect(parseOperatorCommand("nao 2 2")).toEqual({ decisao: "reject", numeros: [2] });
    expect(parseOperatorCommand("pago 4")).toEqual({ decisao: "mark_paid", numeros: [4] });
  });

  it("ignora conversa normal do grupo", () => {
    for (const t of ["ok", "ok pessoal", "vamos ver o 2 amanhã", "1", "", null, "ok 1 e o resto depois"]) expect(parseOperatorCommand(t)).toBeNull();
  });

  it("liga os números à última rodada e aponta os que não existem", () => {
    const r = planOperatorRound([jp], opts);
    const res = resolveOperatorCommand({ decisao: "approve", numeros: [2, 9] }, r.itens);
    expect(res.decisoes).toEqual([{ n: 2, key: "duvida_bot:d1", texto: "Dúvidas do bot: Qual o prazo de acesso? — espera 5 h", decisao: "approve" }]);
    expect(res.desconhecidos).toEqual([9]);
  });
});
