import { describe, expect, it } from "vitest";
import { hasLanding, levaWarnings, parseTaxonomyAnswer, PORTA_PONTO, taxonomyRequest } from "@shared/hw-taxonomy";
import { askableItems, hardFindings, reviewRequest, reviewVerdict } from "@shared/hw-review";
import { diagnose, peersOf, telemetryOf } from "@shared/hw-telemetry";
import { cboCuts, cboDecide, p2Plan } from "@shared/cbo-policy";
import { isCosmeticOnly, nextVariation, nextWave, variationBrief } from "@shared/winner-mold";
import { checkMicrolead, microleadPrompt, microleadSplit } from "@shared/microlead";

describe("taxonomia (porta, ponto, pouso, carga)", () => {
  it("só pergunta pouso com 2 frases e carga com descrição do primeiro quadro", () => {
    expect(hasLanding("I'm 54. Then my sister-in-law showed me what she drinks.")).toBe(true);
    expect(hasLanding("Watch this")).toBe(false);
    const q1 = taxonomyRequest({ texto: "Watch this" }).questions;
    expect(Object.keys(q1)).toEqual(["ponto_rota", "porta"]);
    const q2 = taxonomyRequest({ texto: "Eu tinha desistido. Me dá 73 segundos.", primeiro_quadro: "colher de pó espumando num copo" }).questions;
    expect(Object.keys(q2).sort()).toEqual(["carga", "ponto_rota", "porta", "pouso"]);
  });

  it("grava só o que veio firme e ignora escolhas fora do vocabulário", () => {
    const v = parseTaxonomyAnswer({ answers: { ponto_rota: { choice: "2", confidence: 0.81 }, porta: { choice: "voz_dela", confidence: 0.4 }, pouso: { choice: "inventado", confidence: 0.9 } } });
    expect(v.ponto_rota).toBe(2);
    expect(v.porta).toBe("voz_dela");
    expect(v.pouso).toBeNull();
    expect(v.firmes).toEqual({ ponto_rota: 2 });
    expect(PORTA_PONTO.narrativa).toBe(1);
  });

  it("acusa porta repetida, portas vazias e ponto 5 no frio", () => {
    const avisos = levaWarnings([
      { id: "a", porta: "direta", ponto_rota: 2 }, { id: "b", porta: "direta", ponto_rota: 2 }, { id: "c", porta: "narrativa", ponto_rota: 1 },
      { id: "d", porta: "descoberta", ponto_rota: 1 }, { id: "e", porta: "voz_dela", ponto_rota: 5 },
    ]);
    expect(avisos.join(" ")).toContain("\"Direta\" repetida em 2");
    expect(avisos.join(" ")).toContain("Quebra de crença");
    expect(avisos.join(" ")).toContain("ponto 5");
  });
});

describe("Revisor", () => {
  const base = { texto: "Tenho 54 anos e tinha desistido da minha barriga. Me dá 73 segundos e eu te mostro por que ela não muda.", publico: "mulheres 50+" };

  it("sem descrição do quadro e da página, não pergunta o bloco print nem o fundo do hook", () => {
    const ids = askableItems(base).map((i) => i.id);
    expect(ids).not.toContain("print_carga");
    expect(ids).not.toContain("hook_fundo");
    expect(Object.keys(reviewRequest(base).questions)).toEqual(ids);
  });

  it("regras fixas pegam atributo pessoal, prazo e número redondo", () => {
    const f = hardFindings({ texto: "Você é diabético? Perca 10 kg em 30 dias. Me dá 1 minuto." });
    expect(f.map((x) => x.id)).toEqual(expect.arrayContaining(["compliance_atributo", "compliance_claim", "pouso_detalhe"]));
  });

  it("aprova quando tudo passa e reprova por compliance mesmo com o Jev dizendo que está ok", () => {
    const ok = Object.fromEntries(askableItems(base).map((i) => [i.id, { noul: i.bloco === "compliance" ? 0.05 : 0.9 }]));
    const v = reviewVerdict(base, { answers: ok });
    expect(v.aprovado).toBe(true);
    expect(v.nota).toBe(100);
    const ruim = { ...base, texto: base.texto + " Perca 10 kg em 30 dias." };
    const v2 = reviewVerdict(ruim, { answers: ok });
    expect(v2.aprovado).toBe(false);
    expect(v2.reprovacoes.join(" ")).toContain("prazo");
  });

  it("pouso fraco vira correção permitida, não reprovação", () => {
    const ans = Object.fromEntries(askableItems(base).map((i) => [i.id, { noul: i.bloco === "compliance" ? 0.05 : i.id === "pouso_dela" ? 0.1 : 0.9 }]));
    const v = reviewVerdict(base, { answers: ans });
    expect(v.aprovado).toBe(true);
    expect(v.correcoes_permitidas[0]).toContain("\"você\"");
  });
});

describe("diagnóstico do painel", () => {
  const peerRows = (ctr: number, hold: number) => [{ valor: 30, impressoes: 2000, video_3s_views: 700, video_thruplay: Math.round(700 * hold), link_clicks: Math.round(2000 * ctr), landing_page_views: Math.round(2000 * ctr * 0.8) }];

  it("bloco de concreto: hook rate abaixo de 20%", () => {
    const t = telemetryOf([{ valor: 30, impressoes: 5000, video_3s_views: 600, video_thruplay: 200, link_clicks: 60, landing_page_views: 50 }]);
    expect(t.hook_rate).toBe(0.12);
    const d = diagnose(t, { ctr: 0.012, cpc: 0.5, hold_rate: 0.3 });
    expect(d[0].estagio).toBe("carga");
  });

  it("hook bom e hold baixo = pouso; connect baixo = página/pixel", () => {
    const peers = peersOf([telemetryOf(peerRows(0.015, 0.4)), telemetryOf(peerRows(0.02, 0.45)), telemetryOf(peerRows(0.018, 0.5))]);
    const t = telemetryOf([{ valor: 40, impressoes: 3000, video_3s_views: 1200, video_thruplay: 200, link_clicks: 60, landing_page_views: 25 }]);
    const est = diagnose(t, peers).map((d) => d.estagio);
    expect(est).toContain("pouso");
    expect(est).toContain("pagina");
  });

  it("sem volume não diagnostica", () => {
    expect(diagnose(telemetryOf([{ impressoes: 300 }]), { ctr: null, cpc: null, hold_rate: null })[0].estagio).toBe("volume");
  });
});

describe("política CBO", () => {
  const p = { payout: 59 };
  const ad = (o: Partial<{ gasto: number; ic: number; vendas: number; cliques: number; horas_no_ar: number }>) => ({ ad_id: "a", nome: "A", gasto: 0, ic: 0, vendas: 0, cliques: 50, horas_no_ar: 72, ...o });

  it("escada de cortes acompanha o payout (JP ≈ R$19 / R$27 / R$50) e sobe 30% em vídeo", () => {
    expect(cboCuts(p)).toEqual({ semIc: 18.88, poucoIc: 26.55, limite: 50.15 });
    expect(cboCuts({ ...p, formato: "video" }).semIc).toBe(24.54);
    expect(cboDecide(ad({ gasto: 20, ic: 0 }), p).regra).toBe("corte_1");
    expect(cboDecide(ad({ gasto: 27, ic: 1 }), p).regra).toBe("corte_2");
    expect(cboDecide(ad({ gasto: 45, ic: 3 }), p).acao).toBe("manter");
    expect(cboDecide(ad({ gasto: 51, ic: 3 }), p).regra).toBe("limite");
  });

  it("não valida antes de 48h nem com uma venda; 3 vendas vão para a P2, 4 viram escala", () => {
    expect(cboDecide(ad({ gasto: 40, ic: 3, vendas: 3, horas_no_ar: 30 }), p).acao).toBe("aguardar");
    expect(cboDecide(ad({ gasto: 40, ic: 2, vendas: 1 }), p).acao).toBe("manter");
    expect(cboDecide(ad({ gasto: 120, ic: 6, vendas: 3 }), p).acao).toBe("validado");
    expect(cboDecide(ad({ gasto: 150, ic: 8, vendas: 4 }), p).acao).toBe("vira_escala");
  });

  it("CPC acima do teto corta, salvo venda que paga", () => {
    expect(cboDecide(ad({ gasto: 18, ic: 1, cliques: 5 }), { ...p, cpcMax: 2 }).regra).toBe("cpc");
    expect(cboDecide(ad({ gasto: 40, ic: 2, vendas: 1, cliques: 5 }), { ...p, cpcMax: 2 }).acao).toBe("manter");
  });

  it("P2: 1-5-N, orçamento 10× o payout, bid 70–100% e degraus de ~23%", () => {
    const plan = p2Plan(4, { payout: 110 });
    expect(plan.estrutura).toBe("1-5-4");
    expect(plan.orcamento_referencia).toBe(1100);
    expect([plan.bid_min, plan.bid_max]).toEqual([77, 110]);
    expect(plan.degraus_bid).toEqual([110, 134.97, 159.94, 184.91]);
  });
});

describe("Molde Vencedor", () => {
  it("começa pelo V00, segue a fila e trava o V04 até ler V01–V03", () => {
    expect(nextVariation({ campeao_id: "c", feitas: {}, tem_v00: false })).toBe("V00");
    expect(nextVariation({ campeao_id: "c", feitas: { V01: "vendeu" }, tem_v00: true })).toBe("V02");
    expect(nextVariation({ campeao_id: "c", feitas: { V01: "vendeu", V02: "no_ar", V03: "morreu" }, tem_v00: true })).toBeNull();
    expect(nextVariation({ campeao_id: "c", feitas: { V01: "vendeu", V02: "morreu", V03: "morreu" }, tem_v00: true })).toBe("V04");
  });

  it("produz em ondas: a mesma variação para todos os campeões que podem fazê-la", () => {
    const w = nextWave([
      { campeao_id: "a", feitas: {}, tem_v00: true },
      { campeao_id: "b", feitas: {}, tem_v00: true },
      { campeao_id: "c", feitas: { V01: "vendeu" }, tem_v00: true },
    ]);
    expect(w.onda).toBe("V01");
    expect(w.itens.map((i) => i.campeao_id)).toEqual(["a", "b"]);
  });

  it("o brief trava o script e muda só uma dimensão; música/legenda não é variação", () => {
    const b = variationBrief({ script: "Tenho 54 anos...", quem_fala: "nutricionista 50 anos de jaleco", onde: "consultório", tom_visual: "luz fria", formato: "video", campeao_id: "x" }, "V03");
    expect(b.dimensao).toBe("onde");
    expect(b.manter).toMatchObject({ script: "Tenho 54 anos...", quem_fala: "nutricionista 50 anos de jaleco", tom_visual: "luz fria" });
    expect(b.prompt).toContain("COPY TRAVADA");
    expect(isCosmeticOnly(["música", "legenda"])).toBe(true);
    expect(isCosmeticOnly(["música", "outra pessoa"])).toBe(false);
  });
});

describe("Microlead", () => {
  it("brief traz as 7 etapas e o split dá 65/17,5/10 com soma 100", () => {
    expect(microleadPrompt({ produto: "SlimSoda", publico: "mulheres 45+", promessa_vsl: "x", mecanismo_vsl: "y" })).toContain("7. Transição");
    const s = microleadSplit("controle", ["r1", "r2"], "nova");
    // Reservas dividem 17,5 (8,8 cada, arredondado); o controle fica com o resto para fechar 100.
    expect(s.pesos.map((p) => [p.papel, p.peso])).toEqual([["controle", 72.4], ["reserva", 8.8], ["reserva", 8.8], ["teste", 10]]);
    expect(Math.round(s.pesos.reduce((a, p) => a + p.peso, 0))).toBe(100);
  });

  it("checa tamanho, número e a palavra vídeo na transição", () => {
    const curto = checkMicrolead("Isso é curto.\n\nAssista o vídeo.");
    expect(curto.ok).toBe(false);
    expect(curto.problemas.join(" ")).toContain("vídeo");
  });
});

describe("placar pelas réguas do método", () => {
  it("agrupa por porta e por ponto da rota com rótulos legíveis", async () => {
    const { methodScoreboard } = await import("@shared/method-scoreboard");
    const row = (porta: string | null, ponto: number | null, vendas: number) => ({ metodo: null, copy_lib_id: null, porta, ponto_rota: ponto, gasto: 30, ic: 1, vendas, receita_liquida: vendas * 59 });
    const rows = [row("voz_dela", 2, 2), row("voz_dela", 2, 1), row("bloco_invalido", 5, 0), row(null, null, 0)];
    const porPorta = methodScoreboard(rows, "porta");
    expect(porPorta[0]).toMatchObject({ chave: "voz_dela", rotulo: "Voz dela", vendas: 3 });
    expect(porPorta[porPorta.length - 1].rotulo).toBe("Sem etiqueta");
    expect(methodScoreboard(rows, "ponto_rota")[0].rotulo).toBe("2 · Sente o problema");
  });
});
