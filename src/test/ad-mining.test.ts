import { describe, expect, it } from "vitest";
import { adScore, libraryUrl, mapAd, pickAds, refNotes } from "@shared/ad-mining";

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
});
