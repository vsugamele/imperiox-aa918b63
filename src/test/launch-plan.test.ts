import { describe, expect, it } from "vitest";
import { PLAYBOOK_LIBRARY } from "@shared/playbook-library";
import { parseChannels } from "@shared/launch-kit";
import { launchPreview, planLaunch, projectSlug, writeLaunch, type LaunchWriter } from "@shared/launch-plan";

const canais = parseChannels("YouTube, SEO, tráfego direto, X1").canais;

function fakeWriter() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  let n = 0;
  const w: LaunchWriter = {
    insertProject: async (row) => { calls.push(["project", { ...row }]); },
    insertMap: async (row) => { calls.push(["map", { ...row }]); },
    insertFrame: async (row) => { calls.push(["frame", { ...row }]); },
    insertNode: async (row) => { calls.push(["node", { ...row }]); return `node-${++n}`; },
    insertEdge: async (row) => { calls.push(["edge", { ...row }]); },
    insertApplication: async (row) => { calls.push(["application", { ...row }]); },
    upsertAccess: async (row) => { calls.push(["access", { ...row }]); },
  };
  return { w, calls };
}

describe("lançador: plano", () => {
  it("gera id, mapa e mercado padrão", () => {
    expect(projectSlug("Lei da Atração — EUA!")).toBe("lei_da_atracao_eua");
    const plan = planLaunch({ nome: "Lei da Atração", canais }, PLAYBOOK_LIBRARY);
    expect(plan).toMatchObject({ projectId: "lei_da_atracao", mercado: "EUA (EN)", faltando: [] });
    expect(plan.mapName).toBe("Lei da Atração — Operação (YouTube · SEO e conteúdo · Tráfego direto · X1)");
    expect(plan.steps.map((s) => s.playbook.id)).toEqual(["youtube-canal", "seo-conteudo", "ads-direto-dtc", "esteira-escala-dtc", "x1-conversa"]);
  });

  it("etapa comum entre canais é reaproveitada, não duplicada", () => {
    const plan = planLaunch({ nome: "Lei da Atração", canais }, PLAYBOOK_LIBRARY);
    const avatarSteps = plan.steps.flatMap(({ plan: p }) => p.nodes.filter((n) => n.label.startsWith("Avatar e dores")));
    expect(avatarSteps.filter((n) => !n.existingId)).toHaveLength(1);
    expect(avatarSteps.length).toBeGreaterThan(1);
    expect(launchPreview(plan).playbooks[2].reaproveitadas).toBeGreaterThan(0);
  });

  it("kit de acessos sai dos canais e vira checklist da etapa humana", () => {
    const plan = planLaunch({ nome: "Crypto Signals", canais: ["youtube"] }, PLAYBOOK_LIBRARY);
    expect(plan.kitNode.label).toBe("Kit de acessos — Crypto Signals");
    expect(plan.kitNode.checklist.map((c) => c.split(" — ")[0])).toEqual(["Conta Google do projeto", "Canal do YouTube verificado"]);
    expect(launchPreview(plan).kit_de_acessos.proximos).toEqual(["Conta Google do projeto"]);
  });

  it("recusa id repetido, nome vazio e pedido sem canal", () => {
    expect(() => planLaunch({ nome: "SlimSoda", canais: ["x1"] }, PLAYBOOK_LIBRARY, ["slimsoda"])).toThrow(/Já existe/);
    expect(() => planLaunch({ nome: " ", canais: ["x1"] }, PLAYBOOK_LIBRARY)).toThrow(/nome/);
    expect(() => planLaunch({ nome: "X", canais: [] }, PLAYBOOK_LIBRARY)).toThrow(/canal/);
  });
});

describe("lançador: gravação", () => {
  it("grava projeto, mapa, kit, playbooks e acessos, ligando o reaproveitado ao id real e sem seta repetida", async () => {
    const plan = planLaunch({ nome: "Lei da Atração", canais }, PLAYBOOK_LIBRARY);
    const { w, calls } = fakeWriter();
    let id = 0;
    const result = await writeLaunch(plan, { appliedBy: "teste", newId: () => `uuid-${++id}`, today: "2026-10-03" }, w);

    expect(calls[0][0]).toBe("project");
    expect(calls[0][1]).toMatchObject({ id: "lei_da_atracao", data: { canais, mercado: "EUA (EN)" } });
    expect(calls[1]).toEqual(["map", { id: result.mapId, name: plan.mapName }]);
    expect(calls[2][1]).toMatchObject({ label: "Kit de acessos — Lei da Atração", executor_type: "HUMAN_OPERATOR", linked_project_id: "lei_da_atracao" });

    const nodeIds = new Set(calls.filter(([t]) => t === "node").map((_, i) => `node-${i + 1}`));
    const apps = calls.filter(([t]) => t === "application").map(([, r]) => r as { playbook_id: string; node_ids: string[] });
    expect(apps.map((a) => a.playbook_id)).toEqual(plan.steps.map((s) => s.playbook.id));
    for (const a of apps) for (const nid of a.node_ids) expect(nodeIds.has(nid), `${a.playbook_id}: ${nid}`).toBe(true);
    // O avatar criado no YouTube é o mesmo id usado pelo anúncio direto.
    expect(apps[0].node_ids.some((nid) => apps[2].node_ids.includes(nid))).toBe(true);

    const edges = calls.filter(([t]) => t === "edge").map(([, r]) => `${r.source_id}>${r.target_id}`);
    expect(new Set(edges).size).toBe(edges.length);
    const access = calls.filter(([t]) => t === "access").map(([, r]) => r.access_key);
    expect(access).toEqual(plan.kit.itens.filter((i) => i.obrigatorio).map((i) => i.key));
    expect(calls.filter(([t]) => t === "node").every(([, r]) => r.linked_project_id === "lei_da_atracao")).toBe(true);
  });
});
