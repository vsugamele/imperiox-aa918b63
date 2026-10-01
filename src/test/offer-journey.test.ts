import { describe, expect, it } from "vitest";
import { buildOfferJourneys, buildProjectMap, readStageContract, type ProjectMapInput } from "@shared/project-map";

const activity: ProjectMapInput["activity"] = { approvedSales30dByProduct: {}, waIncoming30d: 0, waOutgoing30d: 0, funnelEvents7d: 0, activeWaProviders: 0, aiEnabled: null, aiDraftMode: null };
const step = (reading: ReturnType<typeof buildOfferJourneys>, offer: number, key: string) => reading.offers[offer].steps.find(value => value.key === key)!;

describe("per-offer journey, same source for UI and MCP", () => {
  it("rejects credential-bearing page and image URLs in shared projections", () => {
    const unsafe = ["https://user:private@example.test/", "https://offer.test/?access_token=private", "https://offer.test/#email=private", "https://offer.test/#/welcome?token=private", "https://?bad"];
    const data = { produtos: [{ nome: "Oferta", links: [...unsafe, "https://offer.test/a#bonuses"] }] };
    const reading = buildOfferJourneys(data, [{ url: "https://offer.test/a#bonuses", image_url: "https://assets.test/print?token=private" }, { kind: "obrigado", url: unsafe[0] }]);
    expect(step(reading, 0, "sales").assets.map(asset => asset.url)).toEqual(["https://offer.test/a#bonuses"]);
    expect(step(reading, 0, "sales").assets[0].imageUrl).toBeUndefined();
    expect(reading.projectAssets[0].url).toBeNull();
    const map = buildProjectMap({ project: { id: "p", name: "P", data, avatar: {} }, competitors: [], mapNodes: [], activity });
    expect(JSON.stringify(map)).not.toContain("private");
  });

  it("keeps explicit thanks out of checkout scoring and preserves legacy pause", () => {
    const data = { produtos: [{ nome: "Oferta", links: [{ url: "https://pay.ticto.test/thanks", tipo: "obrigado" }] }] };
    const map = buildProjectMap({ project: { id: "p", name: "P", data, avatar: {} }, competitors: [], mapNodes: [], activity });
    expect(map.sections.find(section => section.area === "produtos")?.items[0].status).toBe("desenhado");
    expect(step(map.offerJourneys!, 0, "checkout").registration).toBe("not_located");
    expect(step(map.offerJourneys!, 0, "thanks").registration).toBe("registered");
    expect(buildOfferJourneys({ produto: { nome: "Legado", ativo: false } }).offers[0].paused).toBe(true);
    expect(buildOfferJourneys({ produto: { nome: "Legado", status: "Pausado" } }).offers[0].paused).toBe(true);
  });
  it("derives actionable reviews from this offer only without claiming missing assets or commercial blocks", () => {
    const data = { produtos: [
      { nome: "Piloto", links: ["https://offer.test/a"], link_checkout: "https://checkout.test/a" },
      { nome: "Pausada", ativo: false, links: [] },
    ] };
    const before = structuredClone(data);
    const reading = buildOfferJourneys(data, [{ label: "Obrigado global", kind: "obrigado", url: "https://offer.test/thanks" }]);
    const tasks = reading.offers[0].reviewTasks!;
    expect(tasks).toHaveLength(9);
    expect(tasks.every(task => task.origin === "proposed" && !!task.nextAction && !!task.reason && task.sources.includes(reading.offers[0].source))).toBe(true);
    expect(tasks.find(task => task.stageKey === "sales")).toMatchObject({ category: "verification", linkedAssets: 1 });
    expect(tasks.find(task => task.stageKey === "thanks")).toMatchObject({ category: "locate_link", applicability: "to_confirm", linkedAssets: 0 });
    expect(tasks.find(task => task.stageKey === "thanks")?.nextAction).toMatch(/Confirmar se.*obrigado/);
    expect(tasks.find(task => task.stageKey === "thanks")?.reason).toContain("não comprova inexistência");
    expect(tasks.find(task => task.stageKey === "payment")).toMatchObject({ category: "verification", linkedAssets: 0 });
    expect(tasks.find(task => task.stageKey === "ascension")?.applicability).toBe("to_confirm");
    expect(tasks.some(task => task.sources.includes("https://offer.test/thanks"))).toBe(false);
    expect(reading.offers[1].paused).toBe(true);
    expect(reading.offers[1].reviewTasks?.find(task => task.stageKey === "sales")?.category).toBe("locate_link");
    expect(data).toEqual(before);
  });
  it("expands every stage as proposed guidance without assigning agents or importing product text into contract markers", () => {
    const reading = buildOfferJourneys({ produtos: [
      { nome: "Curso [agent_skill:never-bind]", preco: "47,00", links: [] },
      { nome: "Serviço", ativo: false },
      { nome: "Assinatura" },
    ] });
    for (const offer of reading.offers) {
      expect(offer.steps.map(item => item.key)).toEqual(["sales", "checkout", "payment", "thanks", "email", "members", "delivery", "group", "ascension"]);
      expect(new Set(offer.steps.map(item => item.key)).size).toBe(9);
      for (const item of offer.steps) {
        expect(item.guidance?.status).toBe("proposed");
        const contract = readStageContract({ id: item.key, label: item.label, ...item.guidance });
        expect(contract.operationalEvidence).toBe("unverified");
        expect(contract.fields.filter(field => ["executor", "skill"].includes(field.key)).every(field => field.value === null)).toBe(true);
        expect(contract.fields.filter(field => !["executor", "skill"].includes(field.key)).every(field => !!field.value)).toBe(true);
        expect(JSON.stringify(item.guidance)).not.toContain("never-bind");
        expect(item.configuration).not.toBe("configured");
        expect(item.execution).toBe("not_checked");
      }
    }
    expect(reading.offers[1].paused).toBe(true);
    expect(reading.offers[2].price).toBeNull();
    expect(step(reading, 1, "members").guidance?.notes).toContain("outra forma de entrega");
    expect(step(reading, 2, "group").guidance?.notes).toContain("usar ou não grupo");
  });
  it("keeps distinct offers, raw prices, pause and four page variants without granting shared access", () => {
    const data = { produtos: [
      { nome: "Oferta", preco: "47,00", links: ["https://offer.test", "https://offer.test/a", "https://offer.test/b", "https://offer.test/legacy"], link_checkout: "https://checkout.test/a" },
      { nome: "Oferta Assinatura", ativo: false, links: [] },
    ] };
    const nodes = [{ label: "Área do projeto", kind: "area_membros", url: "https://members.test" }];
    const before = structuredClone({ data, nodes });
    const reading = buildOfferJourneys(data, nodes);
    expect(reading.offers).toHaveLength(2);
    expect(reading.offers[0].price).toBe("47,00");
    expect(reading.offers[1]).toMatchObject({ paused: true, price: null });
    expect(step(reading, 0, "sales").assets).toHaveLength(4);
    expect(step(reading, 1, "sales").assets).toHaveLength(0);
    expect(step(reading, 0, "members").registration).toBe("not_located");
    expect(reading.projectAssets).toHaveLength(1);
    expect(reading.offers.every(offer => offer.steps.every(item => item.execution === "not_checked"))).toBe(true);
    expect(buildProjectMap({ project: { id: "p", name: "P", data, avatar: {} }, competitors: [], mapNodes: nodes, activity }).offerJourneys).toEqual(reading);
    expect({ data, nodes }).toEqual(before);
  });
  it("does not infer a thank-you page by URL/name or email configuration from purchases", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Plano", links: [{ url: "https://page.test/obrigado", label: "Obrigado" }] }] }, [{ kind: "obrigado", url: "https://page.test/project-thanks" }]);
    expect(step(reading, 0, "thanks")).toMatchObject({ registration: "not_located", assets: [] });
    expect(step(reading, 0, "email")).toMatchObject({ registration: "not_located", configuration: "not_checked", execution: "not_checked" });
  });
  it("reads explicit roles, exact image URL and object link provenance without unsafe images", () => {
    const reading = buildOfferJourneys({ produtos: [{ nome: "Mesmo nome", links: { obrigado: { url: "https://checkout.test/thanks", tipo: "obrigado" }, curso: { url: "https://members.test/a", tipo: "area_membros" }, compra: { url: "https://checkout.test", tipo: "checkout" } } }, { nome: "Mesmo nome", links: ["https://members.test/a?variant=b"] }] }, [
      { url: "https://checkout.test/thanks", image_url: "https://assets.test/thanks.jpg" },
      { url: "https://members.test/a", image_url: "javascript:alert(1)" },
    ]);
    expect(reading.offers[0].key).not.toBe(reading.offers[1].key);
    expect(step(reading, 0, "thanks").assets[0]).toMatchObject({ source: 'data.produtos[0].links["obrigado"]', imageUrl: "https://assets.test/thanks.jpg" });
    expect(step(reading, 0, "checkout").assets).toHaveLength(1);
    expect(step(reading, 0, "members").assets[0].imageUrl).toBeUndefined();
    expect(step(reading, 1, "sales").assets[0].imageUrl).toBeUndefined();
  });
  it("accepts empty/legacy data without manufacturing a price or exporting unrelated secrets", () => {
    expect(buildOfferJourneys(null).offers).toEqual([]);
    const reading = buildOfferJourneys({ produto: "Legado", preco: 0, vsl_url: "legacy.test", checkout_url: "javascript:alert(1)", secret: "never-output" });
    expect(reading.offers[0].price).toBe("0");
    expect(step(reading, 0, "sales").assets[0].source).toBe("data.vsl_url");
    expect(step(reading, 0, "checkout").assets).toEqual([]);
    expect(JSON.stringify(reading)).not.toContain("never-output");
  });
});
