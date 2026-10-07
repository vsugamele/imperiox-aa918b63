import { describe, expect, it } from "vitest";
import { normalizeVariants, pageKey, pickVariant, slugify, splitReport, targetUrl } from "@shared/page-split";

const variants = normalizeVariants([
  { key: "A", url: "https://codigodoscortes.com/v1", peso: 1 },
  { key: "B", url: "https://codigodoscortes.com/v2?x=1", peso: 1 },
  { url: "nao-e-url" },
  { url: "https://codigodoscortes.com/v3", peso: 2 },
]);

describe("teste A/B/C de página", () => {
  it("normaliza, escolhe pelo peso e monta o destino com os parâmetros do anúncio", () => {
    expect(variants.map((v) => v.key)).toEqual(["A", "B", "D"]);
    expect(pickVariant(variants, 0.1).key).toBe("A");
    expect(pickVariant(variants, 0.3).key).toBe("B");
    expect(pickVariant(variants, 0.99).key).toBe("D");
    const url = targetUrl(variants[1].url, new URLSearchParams("utm_source=fb&utm_content=01-medo&x=9&s=slug"), "ccp-pagina", "B");
    expect(url).toBe("https://codigodoscortes.com/v2?x=1&utm_source=fb&utm_content=01-medo&imp_split=ccp-pagina&imp_var=B");
    expect(slugify("CCP · Página de Vendas!")).toBe("ccp-pagina-de-vendas");
    expect(pageKey("https://www.Site.com/vsl/index.html?utm=1")).toBe("site.com/vsl");
  });

  it("só declara vencedora com 100 visitas em cada página e 20% de vantagem", () => {
    const ab = variants.slice(0, 2);
    const pouco = splitReport(ab, { A: 50, B: 48 }, { "codigodoscortes.com/v1": { sessoes_pagina: 40, cliques_checkout: 4 }, "codigodoscortes.com/v2": { sessoes_pagina: 38, cliques_checkout: 2 } });
    expect(pouco.vencedor).toBeNull();
    expect(pouco.leitura).toContain("Coletando");
    const ok = splitReport(ab, { A: 160, B: 150 }, { "codigodoscortes.com/v1": { sessoes_pagina: 150, cliques_checkout: 15 }, "codigodoscortes.com/v2": { sessoes_pagina: 140, cliques_checkout: 7 } });
    expect(ok).toMatchObject({ vencedor: "A", totalEnviados: 310 });
    expect(ok.linhas[0]).toMatchObject({ conversao: 10, enviados: 160 });
    const semRastro = splitReport(ab, { A: 10 }, {});
    expect(semRastro.semRastreador).toEqual(["A", "B"]);
  });
});
