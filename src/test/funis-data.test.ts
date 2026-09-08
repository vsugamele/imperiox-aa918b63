import { describe, expect, it } from "vitest";
import { parseFunnelData, parseProjectData, serializeFunnelStages, toJson } from "@/lib/funis-data";

describe("funnel persistence boundaries", () => {
  it("keeps pipeline assets, canvas metadata, stage order and custom fields when stages are saved", () => {
    const data = parseFunnelData({
      etapas: [{ nome: "Landing", visitantes: 4, conversoes: 1, pos_x: 50, pos_y: 80, connects_to: [1], custom: { campaign: "existing" } }, { nome: "Checkout", visitantes: 1, conversoes: 0 }],
      pipeline_assets: { creative: { url: "https://example.com/image.png" } },
      canvas: { zoom: 1.2 },
    });
    const stages = data.etapas!.map((stage, index) => index === 0 ? { ...stage, visitantes: 5 } : stage);
    expect(serializeFunnelStages(data, stages)).toEqual({ ...data, etapas: stages });
    expect(stages[0]).toMatchObject({ pos_x: 50, pos_y: 80, connects_to: [1], custom: { campaign: "existing" } });
    expect(stages.map(stage => stage.nome)).toEqual(["Landing", "Checkout"]);
  });

  it("accepts legacy serialized project data, string products and numeric offer prices", () => {
    const data = parseProjectData(JSON.stringify({ produtos: ["Original", { name: "Main", price: 99, ofertas: [{ nome: "Pack", preco_por: 149, custom: true }] }], extra: { preserved: true } }));
    expect(data.produtos).toEqual([{ nome: "Original" }, { name: "Main", price: "99", ofertas: [{ nome: "Pack", preco_por: "149", custom: true }] }]);
    expect(data.extra).toEqual({ preserved: true });
  });

  it("ignores malformed stage collections without exposing them to canvas array operations", () => {
    expect(parseFunnelData({ etapas: "invalid", other: 1 })).toEqual({ other: 1 });
    expect(parseFunnelData("not json")).toEqual({});
  });

  it("serializes optional JSON values and rejects unsupported numeric data", () => {
    expect(toJson({ missing: undefined, list: [undefined, null, false] })).toEqual({ list: [null, null, false] });
    expect(() => toJson({ count: Infinity })).toThrow("JSON");
  });
});
