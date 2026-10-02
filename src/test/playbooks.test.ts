import { describe, expect, it } from "vitest";
import { readStageContract } from "@shared/project-map";
import { elementType } from "@shared/map-elements";
import { isMetricKey, metricKey, METRIC_KEYS } from "@shared/metric-keys";
import { PLAYBOOK_LIBRARY } from "@shared/playbook-library";
import { contractText, fillVars, planPlaybook, sameStep, type Playbook } from "@shared/playbooks";
import { writePlaybookPlan } from "@shared/playbook-apply";

const step = (ordem: number, secao: string, label: string, kind = "doc", depende_de: number[] = []) => ({
  ordem, secao, label, kind, executor_type: "AI_SKILL", skill: null, metrica: null, checklist: ["Item de {produto}"], depende_de,
  contrato: { o: "Fazer {produto}.", e: "Entrada.", s: "Saída.", p: "Pronto.", m: "Métrica.", d: "Nada.", f: "Semanal.", x: "Avisar." },
});
const mini: Pick<Playbook, "nome" | "steps"> = {
  nome: "Teste",
  steps: [step(1, "Preparação", "Avatar e dores"), step(2, "Preparação", "Ângulos", "doc", [1]), step(3, "Conversão", "Checkout de {produto}", "checkout", [2])],
};

describe("playbooks: planejamento no mapa", () => {
  it("desenha uma seção por linha, abaixo do conteúdo que já existe", () => {
    const plan = planPlaybook(mini, { nodes: [{ id: "a", label: "Outra coisa", kind: "meta_ads", position: { x: 0, y: 100 }, height: 200 }], frames: [{ y: 0, height: 580 }] }, { produto: "SlimTide" });
    expect(plan.frames.map((f) => f.text)).toEqual(["TESTE — Preparação", "TESTE — Conversão"]);
    expect(plan.frames[0].y).toBe(580 + 160);
    expect(plan.frames[1].y).toBe(plan.frames[0].y + 640);
    expect(plan.nodes.map((n) => n.position)).toEqual([{ x: 40, y: 740 + 90 }, { x: 340, y: 740 + 90 }, { x: 40, y: 1380 + 90 }]);
    expect(plan.nodes[2].label).toBe("Checkout de SlimTide");
    expect(plan.nodes[0].checklist).toEqual([{ text: "Item de SlimTide", done: false }]);
    expect(plan.edges).toEqual([{ from: 1, to: 2 }, { from: 2, to: 3 }]);
    expect(plan.created).toBe(3);
  });

  it("reaproveita etapa equivalente já no mapa em vez de duplicar", () => {
    const plan = planPlaybook(mini, { nodes: [{ id: "chk", label: "Checkout SlimTide (H&W)", kind: "checkout", position: { x: 0, y: 0 } }], frames: [] }, { produto: "SlimTide" });
    expect(plan.nodes.find((n) => n.stepOrdem === 3)?.existingId).toBe("chk");
    expect(plan.reused).toBe(1);
    expect(plan.created).toBe(2);
  });

  it("tipo específico único no mapa e no playbook é a mesma etapa, mesmo com outro nome; tipo genérico não", () => {
    const pb: Pick<Playbook, "nome" | "steps"> = { nome: "T", steps: [step(1, "A", "Campanha de teste (Meta)", "meta_ads"), step(2, "A", "Roteiro", "doc")] };
    const plan = planPlaybook(pb, { nodes: [
      { id: "bm", label: "Meta Ads — subir na BM", kind: "meta_ads" },
      { id: "d", label: "Mecanismo único", kind: "doc" },
    ], frames: [] });
    expect(plan.nodes.map((n) => n.existingId)).toEqual(["bm", null]);
    // Dois do mesmo tipo no mapa: ambíguo, cria nova.
    const ambiguous = planPlaybook(pb, { nodes: [{ id: "x", label: "Conta 1", kind: "meta_ads" }, { id: "y", label: "Conta 2", kind: "meta_ads" }], frames: [] });
    expect(ambiguous.nodes[0].existingId).toBeNull();
  });

  it("mapa vazio começa no topo", () => {
    expect(planPlaybook(mini, { nodes: [], frames: [] }).frames[0].y).toBe(0);
  });

  it("sameStep exige o mesmo tipo e nome parecido", () => {
    expect(sameStep({ label: "Página de oferta", kind: "pagina_vendas" }, { label: "Oferta — página principal", kind: "pagina_vendas" })).toBe(true);
    expect(sameStep({ label: "Página de oferta", kind: "pagina_vendas" }, { label: "Página de oferta", kind: "checkout" })).toBe(false);
    expect(sameStep({ label: "Recuperação de carrinho", kind: "recuperacao" }, { label: "Upsell do kit", kind: "recuperacao" })).toBe(false);
  });

  it("variável sem valor fica legível", () => {
    expect(fillVars("Canal em {plataforma} de {produto}", { produto: "SlimTide" })).toBe("Canal em a plataforma de SlimTide");
  });

  it("o contrato gerado é lido campo a campo pelo leitor de contrato do mapa", () => {
    const { fields } = readStageContract({ id: "n", label: "x", description: contractText(mini.steps[2].contrato, { produto: "SlimTide" }) });
    const value = (key: string) => fields.find((f) => f.key === key)?.value?.replace(/\.$/, "");
    expect(value("objective")).toBe("Fazer SlimTide");
    expect(value("ready")).toBe("Pronto");
    expect(value("failure")).toBe("Avisar");
  });
});

describe("biblioteca de playbooks", () => {
  it("tem as 4 famílias e ids únicos", () => {
    expect(new Set(PLAYBOOK_LIBRARY.map((p) => p.familia))).toEqual(new Set(["x1_ads", "webinar_lancamento", "organico", "seo"]));
    expect(new Set(PLAYBOOK_LIBRARY.map((p) => p.id)).size).toBe(PLAYBOOK_LIBRARY.length);
  });

  it.each(PLAYBOOK_LIBRARY.map((p) => [p.id, p] as const))("%s é consistente", (_id, p) => {
    const ordens = p.steps.map((s) => s.ordem);
    expect(new Set(ordens).size).toBe(ordens.length);
    expect(isMetricKey(p.north_star)).toBe(true);
    for (const k of p.kpis) expect(isMetricKey(k.key), k.key).toBe(true);
    for (const s of p.steps) {
      expect(elementType(s.kind), `${s.label}: ${s.kind}`).toBeDefined();
      if (s.metrica) expect(isMetricKey(s.metrica.key), s.metrica.key).toBe(true);
      for (const d of s.depende_de) expect(ordens, `${s.label} depende de ${d}`).toContain(d);
      // Os 8 campos do contrato preenchidos: é o que a IA lê para executar a etapa.
      expect(Object.values(s.contrato).every((v) => v.trim().length > 0), s.label).toBe(true);
    }
  });
});

describe("catálogo de métricas", () => {
  it("chaves únicas e busca por chave", () => {
    expect(new Set(METRIC_KEYS.map((m) => m.key)).size).toBe(METRIC_KEYS.length);
    expect(metricKey("roas")?.unidade).toBe("numero");
    expect(metricKey("nao-existe")).toBeNull();
    expect(metricKey(null)).toBeNull();
  });
});

describe("gravação do plano no mapa", () => {
  it("não cria moldura vazia nem seta repetida, e a etapa nova nasce pendente com a marca do playbook", async () => {
    const pb = { ...mini, steps: [step(1, "Preparação", "Avatar e dores"), step(2, "Conversão", "Checkout de {produto}", "checkout", [1]), step(3, "Conversão", "Upsell", "upsell", [2])] };
    const plan = planPlaybook(pb, { nodes: [{ id: "av", label: "Avatar e dores do público", kind: "doc" }, { id: "chk", label: "Checkout H&W", kind: "checkout" }], frames: [] }, { produto: "SlimTide" });
    const frames: string[] = [], edges: string[] = [], nodes: Array<{ notes: string; checklist: unknown[] }> = [];
    let app: { node_ids: string[] } | null = null;
    let seq = 0;
    const result = await writePlaybookPlan(plan, {
      playbook: { id: "teste", familia: "x1_ads" }, mapId: "m1", projectId: "slimsoda", params: {}, appliedBy: "teste",
      existingEdges: new Set(["av>chk"]), newId: () => `id${++seq}`,
    }, {
      insertFrame: async (r) => { frames.push(r.text); },
      insertNode: async (r) => { nodes.push(r); return "novo"; },
      insertEdge: async (r) => { edges.push(`${r.source_id}>${r.target_id}`); },
      insertApplication: async (r) => { app = r; },
    });
    expect(frames).toEqual(["TESTE — Conversão"]);
    expect(edges).toEqual(["chk>novo"]);
    expect(nodes[0].notes).toContain("[agent_status:pending]");
    expect(nodes[0].notes).toContain("[agent_playbook:teste#3]");
    expect(nodes[0].checklist).toEqual([{ id: "id1", text: "Item de SlimTide", done: false }]);
    expect(app?.node_ids).toEqual(["av", "chk", "novo"]);
    expect(result).toMatchObject({ created: 1, reused: 2, edges: 1, frames: 1 });
  });
});
