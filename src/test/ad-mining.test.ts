import { describe, expect, it } from "vitest";
import { adScore, libraryUrl, mapAd, pickAds, refNotes, detectNicho, parseRefDetails, groupReferencesByOffer } from "@shared/ad-mining";

const now = Date.parse("2026-10-07T12:00:00Z");
const item = (id: string, inicio: string, extra: Record<string, unknown> = {}) => ({
  adArchiveID: id, pageID: "966", startDateFormatted: inicio, isActive: true, collationCount: 3,
  snapshot: { pageName: "American Health", body: { text: "I almost looked past the woman..." }, title: "The 79-year-old secret", ctaText: "Learn more", linkUrl: "https://shop.x.com", displayFormat: "IMAGE", images: [{ originalImageUrl: "https://scontent.fbcdn.net/a.jpg" }], videos: [] },
  ...extra,
});

describe("mineração da Biblioteca de Anúncios", () => {
  it("monta a busca por palavra, página e URL", () => {
    expect(libraryUrl("palavra", "weight loss", "US")).toContain("q=weight%20loss&search_type=keyword_unordered");
    expect(libraryUrl("palavra", "x")).toContain("is_targeted_country=false");
    expect(libraryUrl("pagina", "https://www.facebook.com/ads/library/?view_all_page_id=123456789")).toContain("view_all_page_id=123456789");
    expect(libraryUrl("url", "https://x")).toBe("https://x");
  });

  it("lê o anúncio, calcula dias no ar e ignora itens de erro", () => {
    expect(mapAd({ error: "no_items" })).toBeNull();
    const ad = mapAd(item("1", "2026-08-08T07:00:00.000Z"), now);
    expect(ad).toMatchObject({ external_id: "1", pagina: "American Health", dias_no_ar: 60, variacoes: 3, titulo: "The 79-year-old secret", imagem_url: "https://scontent.fbcdn.net/a.jpg", video_url: null });
    const video = mapAd(item("2", "2026-10-01T07:00:00.000Z", { snapshot: { pageName: "P", body: { text: "fala" }, images: [], videos: [{ videoHdUrl: "https://v.mp4", videoPreviewImageUrl: "https://p.jpg" }] } }), now);
    expect(video).toMatchObject({ video_url: "https://v.mp4", preview_url: "https://p.jpg", dias_no_ar: 6 });
    expect(refNotes(ad!)).toContain("no ar há 60 dias (desde 2026-08-08) · 3 variação(ões)");
  });

  it("escolhe os que estão há mais tempo e em mais versões, sem repetir os que já existem", () => {
    const ads = [
      mapAd(item("velho", "2026-06-01T00:00:00Z", { collationCount: 1 }), now)!,
      mapAd(item("novo", "2026-10-05T00:00:00Z"), now)!,
      mapAd(item("escala", "2026-09-01T00:00:00Z", { collationCount: 12 }), now)!,
      mapAd(item("ja-tenho", "2026-05-01T00:00:00Z"), now)!,
    ];
    expect(adScore(ads[2])).toBeGreaterThan(adScore(ads[0]));
    expect(pickAds(ads, new Set(["ja-tenho"]), 5).map((a) => a.external_id)).toEqual(["escala", "velho"]);
  });

  it("detecta nicho com base em vocabulário e palavras-chave", () => {
    expect(detectNicho({ titulo: "The Quiet Habits That Support Healthy Blood Pressure" })).toBe("Pressão Alta / Hipertensão");
    expect(detectNicho({ titulo: "Drink this simple oat trick for weight loss", link: "https://salzhack.com/hafer-trick" })).toBe("Emagrecimento / Nutra");
    expect(detectNicho({ titulo: "Drenagem linfática caseira" })).toBe("Saúde Linfática");
    expect(detectNicho({ titulo: "Tire uma carta de tarot online" })).toBe("Espiritualidade");
  });

  it("extrai os 4 pilares (página, copy, imagem, nicho) de forma estruturada", () => {
    const ref = {
      id: "meta-123",
      titulo: "Emilia Rosana Pontes — The Quiet Habits That Support Healthy Blood Pressure",
      notas: "Página: Emilia Rosana Pontes · no ar há 14 dias (desde 2026-09-29) · 1 variação(ões)\nTítulo: The Quiet Habits That Support Healthy Blood Pressure\nCopy: 3 simple morning habits to protect your heart.\nCTA: Learn more\nDestino: https://jj.thefluffyjello.online/page1",
      image_url: "https://cdn.example.com/wellness.jpg",
      pipeline: {
        mineracao: {
          pagina: "Emilia Rosana Pontes",
          destino: "https://jj.thefluffyjello.online/page1",
          dias_no_ar: 14,
          ativo: true,
        },
      },
    };

    const details = parseRefDetails(ref);
    expect(details.paginaNome).toBe("Emilia Rosana Pontes");
    expect(details.destinoHost).toBe("jj.thefluffyjello.online");
    expect(details.diasNoAr).toBe(14);
    expect(details.headline).toBe("The Quiet Habits That Support Healthy Blood Pressure");
    expect(details.copyTexto).toBe("3 simple morning habits to protect your heart.");
    expect(details.cta).toBe("Learn more");
    expect(details.nicho).toBe("Pressão Alta / Hipertensão");
    expect(details.formato).toBe("estatico");
  });

  it("agrupa múltiplas fanpages que anunciam o mesmo criativo/oferta", () => {
    const refs = [
      {
        id: "meta-1",
        titulo: "Emilia Rosana — Quiet Habits For Blood Pressure",
        notas: "Página: Emilia Rosana · no ar há 14 dias\nTítulo: Quiet Habits For Blood Pressure\nDestino: https://jj.thefluffyjello.online/p1",
      },
      {
        id: "meta-2",
        titulo: "Roberta Soares — Quiet Habits For Blood Pressure",
        notas: "Página: Roberta Soares · no ar há 18 dias\nTítulo: Quiet Habits For Blood Pressure\nDestino: https://jj.thefluffyjello.online/p2",
      },
      {
        id: "meta-3",
        titulo: "Lua de la Garza — Quiet Habits For Blood Pressure",
        notas: "Página: Lua de la Garza · no ar há 16 dias\nTítulo: Quiet Habits For Blood Pressure\nDestino: https://jj.thefluffyjello.online/p3",
      },
      {
        id: "outro-ad",
        titulo: "Outro Produto — Emagrecimento Rápido",
        notas: "Página: Outro · no ar há 5 dias\nTítulo: Emagrecimento Rápido\nDestino: https://outro.com/lp",
      },
    ];

    const clusters = groupReferencesByOffer(refs);
    expect(clusters.length).toBe(2);

    const quietHabits = clusters.find((c) => c.details.destinoHost === "jj.thefluffyjello.online");
    expect(quietHabits).toBeDefined();
    expect(quietHabits?.isCluster).toBe(true);
    expect(quietHabits?.totalPages).toBe(3);
    expect(quietHabits?.uniquePages).toContain("Roberta Soares");
    expect(quietHabits?.uniquePages).toContain("Emilia Rosana");
    expect(quietHabits?.uniquePages).toContain("Lua de la Garza");
    expect(quietHabits?.maxDiasNoAr).toBe(18);
  });
});
