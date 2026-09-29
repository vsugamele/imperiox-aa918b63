import { describe, expect, it } from "vitest";
import { buildProjectMap, type ProjectMapInput } from "@shared/project-map";

const noActivity: ProjectMapInput["activity"] = {
  approvedSales30dByProduct: {},
  waIncoming30d: 0,
  waOutgoing30d: 0,
  funnelEvents7d: 0,
  activeWaProviders: 0,
  aiEnabled: null,
  aiDraftMode: null,
};

function input(project: Partial<ProjectMapInput["project"]>, extra: Partial<ProjectMapInput> = {}): ProjectMapInput {
  return {
    project: { id: "p", name: "Projeto", data: {}, avatar: {}, ...project },
    competitors: [],
    mapNodes: [],
    activity: noActivity,
    ...extra,
  };
}

const section = (map: ReturnType<typeof buildProjectMap>, area: string) => map.sections.find((s) => s.area === area)!;

describe("buildProjectMap", () => {
  it("reads the new format (link_checkout, vsl object, links array) as built", () => {
    const map = buildProjectMap(input({
      data: {
        produtos: [{ nome: "Kit 6", preco: 119.94, link_checkout: "https://slim.app/checkout-6" }],
        mecanismo_unico: { nome: "Baking soda shot", explicacao: "x".repeat(150) },
        vsl: { gancho: "This is the real shot..." },
        links: [{ url: "https://slim.app", nome: "Buy page", tipo: "vercel" }],
      },
    }));
    expect(map.dataFormat).toBe("padrao_novo");
    expect(section(map, "produtos").status).toBe("construido");
    expect(section(map, "mecanismo").status).toBe("construido");
    expect(map.gaps.some((g) => g.message.includes("checkout"))).toBe(false);
    expect(section(map, "ativos").items.find((i) => i.key === "ativos:vsl")?.status).toBe("construido");
  });

  it("reads the legacy format, pauses inactive products and marks sold products as running", () => {
    const map = buildProjectMap(input({
      data: {
        produtos: [
          { nome: "Master Cuts", ativo: false, status: "inativo", links: ["https://mastercuts.app"], preco: "1997,00" },
          { nome: "Código dos Cortes Perfeitos", preco: "47,00", links: [{ url: "https://pay.ticto.app/abc", tipo: "checkout" }, "https://codigo.app"] },
        ],
      },
    }, { activity: { ...noActivity, approvedSales30dByProduct: { "Código dos Cortes Perfeitos": 12 } } }));
    const items = section(map, "produtos").items;
    expect(map.dataFormat).toBe("legado");
    expect(items.find((i) => i.label === "Master Cuts")?.status).toBe("pausado");
    expect(items.find((i) => i.label === "Código dos Cortes Perfeitos")?.status).toBe("rodando");
    expect(section(map, "produtos").status).toBe("rodando");
    expect(map.gaps.some((g) => g.item === "Master Cuts")).toBe(false);
  });

  it("reads the single-product format without inventing price or links", () => {
    const map = buildProjectMap(input({ data: { produto: "LinfaFlow", preco: "197,00", checkout_url: "https://linfa.com/checkout", vsl_url: "https://linfa.com" } }));
    const product = section(map, "produtos").items[0];
    expect(map.dataFormat).toBe("produto_unico");
    expect(product.label).toBe("LinfaFlow");
    expect(product.status).toBe("construido");
    expect(product.evidence).toContain("Preço: 197,00");
  });

  it("turns an empty project into critical gaps instead of defaults", () => {
    const map = buildProjectMap(input({ data: {}, avatar: null }));
    expect(map.dataFormat).toBe("vazio");
    expect(map.score).toBe(0);
    expect(map.sections.every((s) => s.status === "falta")).toBe(true);
    expect(map.gaps[0].severity).toBe("critica");
    expect(JSON.stringify(map)).not.toMatch(/47,00|jpfreitas|codigodoscortes/i);
  });

  it("grades avatar facets across legacy and new key names", () => {
    const partial = buildProjectMap(input({ avatar: { dores_profundas: ["dor"], resultado_sonhado: "sonho" } }));
    expect(section(partial, "avatar").status).toBe("desenhado");
    expect(partial.gaps.some((g) => g.area === "avatar" && g.item === "Inimigo comum")).toBe(true);

    const full = buildProjectMap(input({
      avatar: { problemas: ["p"], desejos_internos: ["d"], objecoes: ["o"], crenca_bloqueadora: "c", inimigo: "i", headlines: ["h"] },
      data: { publico_alvo: "mulheres 40+" },
    }));
    expect(section(full, "avatar").status).toBe("construido");
  });

  it("marks the funnel as running from tracked events even when not drawn", () => {
    const map = buildProjectMap(input({}, { activity: { ...noActivity, funnelEvents7d: 30 } }));
    expect(section(map, "funil").status).toBe("rodando");
    expect(map.gaps.find((g) => g.area === "funil")?.message).toContain("não está desenhado");
  });

  it("flags data hygiene problems seen in real projects", () => {
    const map = buildProjectMap(input({
      data: {
        produto: "Curso Fitness / Emagrecimento",
        preco: "R$ 997",
        produtos: [
          { nome: "O CÓDIGO DOS CORTES PERFEITOS", preco: "47,00", links: ["codigo.app/inscricao"] },
          { nome: "Código dos Cortes Perfeitos", preco: "47,,00" },
          { nome: "Assinatura", links: ["jphaireducation.com"] },
        ],
      },
    }, {
      competitors: [
        { name: "O mercado está em transição", url: "", oferta_principal: "" },
        { name: "VILA DELLA PRO", url: "https://viladella.com.br", oferta_principal: "Comunidade" },
      ],
      activity: { ...noActivity, approvedSales30dByProduct: { "Código dos Cortes Perfeitos": 8 } },
    }));
    const messages = map.gaps.map((g) => g.message).join("\n");
    expect(messages).toContain("duplicidade");
    expect(messages).toContain("Curso Fitness / Emagrecimento");
    expect(messages).toContain("O mercado está em transição");
    expect(messages).toContain("vende, mas o link de checkout não está cadastrado");
    expect(section(map, "produtos").items.find((i) => i.label === "Assinatura")?.evidence).toContain("Página: https://jphaireducation.com");
  });

  it("treats message traffic as a live channel even when chips are marked inactive, and flags low reply rates", () => {
    const map = buildProjectMap(input({}, { activity: { ...noActivity, activeWaProviders: 0, aiEnabled: true, aiDraftMode: false, waIncoming30d: 1500, waOutgoing30d: 90 } }));
    expect(section(map, "atendimento").status).toBe("rodando");
    const atendimento = map.gaps.filter((g) => g.area === "atendimento").map((g) => g.message).join("\n");
    expect(atendimento).toContain("nenhum chip do projeto aparece como ativo");
    expect(atendimento).toContain("Só 90 resposta(s)");
  });

  it("requires an active chip and enabled AI for built support, and flags draft mode", () => {
    const map = buildProjectMap(input({}, { activity: { ...noActivity, activeWaProviders: 1, aiEnabled: true, aiDraftMode: true, waIncoming30d: 40, waOutgoing30d: 30 } }));
    expect(section(map, "atendimento").status).toBe("rodando");
    expect(map.gaps.some((g) => g.area === "atendimento" && g.message.includes("rascunho"))).toBe(true);
  });
});
