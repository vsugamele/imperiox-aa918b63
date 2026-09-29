import { describe, expect, it } from "vitest";
import { MAP_ELEMENTS, elementType, phaseOf } from "@shared/map-elements";
import { analyzeGaps } from "@shared/funnel-gaps";
import { buildProjectMap } from "@shared/project-map";

// Tipos e cores que já existem em mapas salvos (imphq_company_map_nodes.kind/color).
const LEGACY: Record<string, string> = {
  vertical: "#c9922a", area: "#3b82f6", oferta: "#10b981", processo: "#8b5cf6", meta: "#ef4444", doc: "#64748b",
  vsl: "#ec4899", pagina_vendas: "#f97316", captura: "#06b6d4", checkout: "#84cc16", orderbump: "#fbbf24",
  upsell: "#22c55e", downsell: "#f43f5e", email: "#818cf8", anuncio: "#eab308", area_membros: "#a855f7",
  app: "#0ea5e9", canal: "#f59e0b", whatsapp: "#25d366", instagram: "#e1306c", facebook: "#1877f2",
  youtube: "#ff0000", tiktok: "#000000", linkedin: "#0a66c2", twitter: "#1da1f2", imagem: "#c9922a",
};

describe("map element catalog", () => {
  it("keeps every legacy kind with its original color", () => {
    for (const [key, color] of Object.entries(LEGACY)) expect(elementType(key)?.color, key).toBe(color);
  });

  it("has unique keys and a phase for each element", () => {
    const keys = MAP_ELEMENTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(phaseOf("gerou_pix")).toBe("conversao");
    expect(phaseOf("upsell")).toBe("ascensao");
    expect(phaseOf("desconhecido")).toBe("operacao");
  });
});

describe("funnel gaps (shared rule)", () => {
  it("treats catalog equivalents as present", () => {
    const ids = analyzeGaps([
      { kind: "meta_ads", label: "Ads" }, { kind: "quiz", label: "Quiz" }, { kind: "advertorial", label: "Adv" },
      { kind: "checkout", label: "Checkout" }, { kind: "whatsapp_sequencia", label: "Seq WA" },
    ]).map((g) => g.id);
    expect(ids).not.toContain("no-ads");
    expect(ids).not.toContain("no-captura");
    expect(ids).not.toContain("no-vsl");
    expect(ids).not.toContain("no-wa");
    expect(ids).toContain("no-orderbump");
  });
});

describe("project map funnel phases", () => {
  it("breaks the drawn funnel down by phase and adds structural gaps", () => {
    const map = buildProjectMap({
      project: { id: "p", name: "P", data: {}, avatar: {} },
      competitors: [],
      mapNodes: [
        { kind: "meta_ads", label: "Anúncio" },
        { kind: "vsl", label: "VSL", url: "https://vsl.app" },
        { kind: "checkout", label: "Checkout" },
      ],
      activity: { approvedSales30dByProduct: {}, waIncoming30d: 0, waOutgoing30d: 0, funnelEvents7d: 0, activeWaProviders: 0, aiEnabled: null, aiDraftMode: null },
    });
    const funil = map.sections.find((s) => s.area === "funil")!;
    const phase = (key: string) => funil.items.find((i) => i.key === `funil:${key}`);
    expect(phase("aquisicao")?.status).toBe("desenhado");
    expect(phase("conversao")?.status).toBe("construido");
    expect(phase("ascensao")?.status).toBe("falta");
    expect(map.gaps.some((g) => g.area === "funil" && g.item === "Checkout sem Upsell")).toBe(true);
  });
});
