import { describe, it, expect } from "vitest";
import { extractLeadComplaints, extractMarketTrends } from "@/lib/agency-radar";

describe("agency-radar engine", () => {
  it("classifies real lead messages into ranked objection/complaint clusters with actionable outputs", () => {
    const clusters = extractLeadComplaints([
      { text: "Achei o valor meio caro, tem desconto no pix?", source: "whatsapp" },
      { text: "O preço está puxado, parcela em 12x?", source: "whatsapp" },
      { text: "Comprei outro produto mês passado, já tentei de tudo e nada funciona", source: "crm" },
      { text: "Será que funciona mesmo ou é golpe?", source: "whatsapp" },
    ]);

    expect(clusters.length).toBeGreaterThanOrEqual(6);
    expect(clusters[0].id).toBe("preco_parcelamento");
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].isLiveData).toBe(true);
    expect(clusters[0].sampleQuotes[0]).toContain("caro");
    expect(clusters[0].recommendedAngle).toBeTruthy();
    expect(clusters[0].x1Script).toContain("[Nome]");
    expect(clusters[0].pageFaqBlock).toContain("❓");
  });

  it("returns canonical fallback ranking when no live lead messages exist yet", () => {
    const clusters = extractLeadComplaints([]);
    expect(clusters.length).toBeGreaterThanOrEqual(6);
    expect(clusters.every((c) => c.isLiveData === false)).toBe(true);
    expect(clusters[0].sampleQuotes.length).toBeGreaterThan(0);
  });

  it("extracts market format and hook trends from references", () => {
    const report = extractMarketTrends([
      {
        id: "ref-1",
        title: "Ad Linfa UGC 1",
        format: "UGC",
        ad_copy: "Olhe isso no espelho antes de dormir! O teste de 5 segundos que revela retenção.",
        details: JSON.stringify({ daysActive: 42, isScaled: true }),
      },
      {
        id: "ref-2",
        title: "Ad Linfa UGC 2",
        format: "UGC",
        ad_copy: "Você gasta R$ 350 em drenagem e o inchaço volta em 48h?",
        details: JSON.stringify({ daysActive: 18, isScaled: true }),
      },
      {
        id: "ref-3",
        title: "Ad Estático Comparativo",
        format: "Imagem",
        ad_copy: "Dr. revela estudo clínico sobre absorção sublingual.",
        details: JSON.stringify({ daysActive: 7, isScaled: false }),
      },
    ]);

    expect(report.isLiveData).toBe(true);
    expect(report.totalAnalyzed).toBe(3);
    expect(report.scaledTotal).toBe(2);
    expect(report.formats[0].format).toBe("UGC");
    expect(report.formats[0].scaledCount).toBe(2);
    expect(report.hooks[0].daysActive).toBe(42);
    expect(report.hooks[0].porta).toBe("descoberta");
  });
});
