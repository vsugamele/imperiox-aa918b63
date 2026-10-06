import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { computeVerdict, verdictColor } from "@/lib/adsVerdict";
import { QuickFilters, type QuickFilterKey } from "@/components/gerenciador/QuickFilters";
import { buildRows, normalizeTag, cleanSlug } from "@/components/gerenciador/CampanhasTable";

describe("Cockpit de Decisão - Ads Verdict & Semáforo do Gestor", () => {
  it("classifica criativo SANGRANDO (MATAR) quando gasto > 1.5x do CPA-alvo e 0 vendas", () => {
    const res = computeVerdict({
      valor: 160,
      compras: 0,
      receita: 0,
      frequencia: 1.5,
      cliques: 60,
      cpaTarget: 100, // 1.5x = 150
    });
    expect(res.verdict).toBe("MATAR");
    expect(res.reason).toContain("Sangrando");
    expect(res.reason).toContain("1.5× CPA-alvo");
  });

  it("classifica criativo CAMPEÃO (ESCALAR) quando CPA abaixo da meta e ROAS > 2.0x com 2+ vendas", () => {
    const res = computeVerdict({
      valor: 120,
      compras: 3,
      receita: 360, // ROAS = 3.0x, CPA = 40
      frequencia: 1.8,
      cliques: 80,
      cpaTarget: 50,
    });
    expect(res.verdict).toBe("ESCALAR");
    expect(res.reason).toContain("Campeão");
    expect(res.reason).toContain("Escalar");
  });

  it("classifica criativo EM VALIDAÇÃO (AGUARDAR) quando tem menos de 50 cliques e gasto inicial", () => {
    const res = computeVerdict({
      valor: 35,
      compras: 0,
      receita: 0,
      frequencia: 1.1,
      cliques: 22,
      cpaTarget: 60,
    });
    expect(res.verdict).toBe("AGUARDAR");
    expect(res.reason).toContain("Em validação");
    expect(res.reason).toContain("22 cliques");
  });

  it("retorna cores adequadas no verdictColor para o semáforo visual", () => {
    expect(verdictColor("ESCALAR")).toContain("emerald");
    expect(verdictColor("MATAR")).toContain("red");
    expect(verdictColor("AGUARDAR")).toContain("yellow");
    expect(verdictColor("MANTER")).toContain("blue");
    expect(verdictColor("OTIMIZAR")).toContain("amber");
  });
});

describe("Matching de Vendas nos Criativos (UTM e Agregação)", () => {
  it("normaliza tags e slugs com caracteres especiais, acentos e codificação URI", () => {
    expect(normalizeTag("[C1] - VSL Principal / Aberto")).toBe("c1 vsl principal aberto");
    expect(cleanSlug("AD01_VSL_Vovó%20Gisele")).toBe("ad01vslvovogisele");
  });

  it("faz o matching correto de vendas nos anúncios (criativos) via utm_term e utm_content", () => {
    const ads = [
      {
        campaign_id: "camp_1",
        campanha: "Campanha Principal",
        adset_id: "adset_1",
        conjunto_anuncios: "Conjunto Aberto",
        ad_id: "ad_01",
        anuncio: "AD01 VSL Vovó",
        valor: 100,
        impressoes: 5000,
        cliques: 80,
      },
      {
        campaign_id: "camp_1",
        campanha: "Campanha Principal",
        adset_id: "adset_1",
        conjunto_anuncios: "Conjunto Aberto",
        ad_id: "ad_02",
        anuncio: "AD02 Depoimento Dra",
        valor: 80,
        impressoes: 4000,
        cliques: 40,
      },
    ];

    const vendas = [
      // Venda atribuída ao anúncio 1 via ID no utm_term
      {
        id: "venda_1",
        valor: 197,
        utm_campaign: "camp_1",
        utm_content: "adset_1",
        utm_term: "ad_01",
      },
      // Venda atribuída ao anúncio 1 via slug no utm_term
      {
        id: "venda_2",
        valor: 197,
        utm_campaign: "camp_1",
        utm_content: "adset_1",
        utm_term: "ad01-vsl-vovo",
      },
    ];

    const result = buildRows(ads, vendas, "bruto");

    // Verifica que o anúncio ad_01 recebeu as 2 vendas e R$ 394 de receita
    const adsUnderAdset = result.adsByAdset.get("adset_1") || [];
    const ad01 = adsUnderAdset.find(a => a.id === "ad_01");
    expect(ad01).toBeDefined();
    expect(ad01?.compras).toBe(2);
    expect(ad01?.receita).toBe(394);

    // O anúncio ad_02 não teve vendas
    const ad02 = adsUnderAdset.find(a => a.id === "ad_02");
    expect(ad02).toBeDefined();
    expect(ad02?.compras).toBe(0);
    expect(ad02?.receita).toBe(0);

    // O conjunto de anúncios pai (adset_1) deve conter no mínimo as vendas dos criativos filhos
    const adsetsUnderCamp = result.adsetsByCampaign.get("camp_1") || [];
    const adset = adsetsUnderCamp.find(as => as.id === "adset_1");
    expect(adset).toBeDefined();
    expect(adset?.compras).toBe(2);
    expect(adset?.receita).toBe(394);

    // A campanha pai também deve conter as vendas
    const campaign = result.campaigns.find(c => c.id === "camp_1");
    expect(campaign).toBeDefined();
    expect(campaign?.compras).toBe(2);
    expect(campaign?.receita).toBe(394);
  });
});

describe("QuickFilters Component", () => {
  it("renderiza chips de Semáforo do Gestor e dispara seleção", () => {
    const counts = {
      SANGRANDO: 2,
      CAMPEOES: 4,
      VALIDANDO: 7,
      PAUSADO: 1,
      SATURADO: 0,
    };
    const onChange = vi.fn();

    render(<QuickFilters active={null} counts={counts} onChange={onChange} />);

    expect(screen.getByText("Sangrando")).toBeInTheDocument();
    expect(screen.getByText("Campeões")).toBeInTheDocument();
    expect(screen.getByText("Em Validação")).toBeInTheDocument();

    const sangrandoBtn = screen.getByText("Sangrando").closest("button");
    expect(sangrandoBtn).toBeDefined();
    fireEvent.click(sangrandoBtn!);
    expect(onChange).toHaveBeenCalledWith("SANGRANDO");
  });
});
