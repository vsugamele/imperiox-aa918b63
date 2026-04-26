import { supabase } from "@/integrations/supabase/client";

export interface AdSpendDetailedRow {
  project_id: string | null;
  data_ref: string | null;
  valor: number | null;
  campanha: string | null;
  conjunto_anuncios: string | null;
  anuncio: string | null;
  cliques: number | null;
  impressoes: number | null;
  compras: number | null;
}

export interface VendaDetailedRow {
  id: string;
  lead_id: string | null;
  project_id: string | null;
  valor: number | null;
  data_venda: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_source: string | null;
  tipo_venda: string | null;
  utm_origin?: "venda" | "lead" | "none";
}

export type MatchConfidence = "exact" | "adset" | "campaign" | "unmatched";

export interface CreativeRoasRow {
  key: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  spend: number;
  impressoes: number;
  cliques: number;
  comprasAds: number; // pixel
  vendasReais: number; // do CRM
  receitaPrincipal: number;
  receitaBackend: number; // orderbump + upsell
  receitaTotal: number;
  ftbCount: number;
  backendCount: number;
  cpa: number;
  roasFront: number; // só front
  roasReal: number; // total / spend
  ltv: number; // receita / vendas únicas
  backendShare: number; // % receita vinda do backend
  // matching quality
  matchExact: number; // # vendas com match anúncio
  matchAdset: number; // # vendas com match conjunto
  matchCampaign: number; // # vendas com match só campanha
  receitaExact: number;
  receitaAdset: number;
  receitaCampaign: number;
  confidenceScore: number; // 0-100 ponderado pela receita
}

export interface UnmatchedSale {
  vendaId: string;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_source: string | null;
  valor: number;
  data_venda: string | null;
}

export interface MatchingReport {
  totalVendas: number;
  totalReceita: number;
  matched: number;
  unmatched: number;
  receitaMatched: number;
  receitaUnmatched: number;
  byConfidence: Record<MatchConfidence, { count: number; receita: number }>;
  unmatchedSamples: UnmatchedSale[];
}

export type CreativeGroupBy = "campanha" | "conjunto" | "anuncio";

export async function fetchCreativeDataset(projectId?: string) {
  const adsQ = supabase
    .from("imphq_ads_spend")
    .select("project_id, data_ref, valor, campanha, conjunto_anuncios, anuncio, cliques, impressoes, compras")
    .order("data_ref", { ascending: false })
    .limit(10000);
  const vendasQ = supabase
    .from("imphq_vendas")
    .select("id, lead_id, project_id, valor, data_venda, utm_campaign, utm_content, utm_source, tipo_venda")
    .eq("status", "aprovado")
    .order("data_venda", { ascending: false })
    .limit(10000);

  const [adsRes, vendasRes] = await Promise.all([adsQ, vendasQ]);

  const filterByProject = <T extends { project_id?: string | null }>(rows: T[]) =>
    projectId ? rows.filter((r) => r.project_id === projectId) : rows;

  const ads = filterByProject((adsRes.data || []) as any[]).map((a) => ({
    ...a,
    valor: Number(a.valor || 0),
  })) as AdSpendDetailedRow[];

  const vendas = filterByProject((vendasRes.data || []) as any[]).map((v) => ({
    ...v,
    valor: Number(v.valor || 0),
  })) as VendaDetailedRow[];

  return { ads, vendas };
}

const norm = (s: string | null | undefined) =>
  (s || "").toString().toLowerCase().trim();

const isBackend = (tipo: string | null) => {
  const t = norm(tipo);
  return t === "orderbump" || t === "upsell" || t === "downsell";
};

export interface BuildResult {
  rows: CreativeRoasRow[];
  report: MatchingReport;
}

export function buildCreativeRoas(
  ads: AdSpendDetailedRow[],
  vendas: VendaDetailedRow[],
  groupBy: CreativeGroupBy = "campanha",
): BuildResult {
  // Indexação multi-nível dos registros de spend
  // campIdx: campanha -> Set de keys agregadas
  // adsetIdx: campanha|conjunto -> Set de keys
  // adIdx: campanha|conjunto|anuncio -> key
  const spendMap = new Map<string, CreativeRoasRow>();
  const campIdx = new Map<string, Set<string>>(); // norm(campanha) -> keys
  const adsetIdx = new Map<string, Set<string>>(); // norm(camp)|norm(conj) -> keys
  const adIdx = new Map<string, string>(); // norm(camp)|norm(conj)|norm(ad) -> key

  const keyFor = (a: AdSpendDetailedRow) => {
    const camp = a.campanha || "—";
    const conj = a.conjunto_anuncios || "—";
    const ad = a.anuncio || "—";
    if (groupBy === "campanha") return camp;
    if (groupBy === "conjunto") return `${camp} › ${conj}`;
    return `${camp} › ${conj} › ${ad}`;
  };

  for (const a of ads) {
    const k = keyFor(a);
    let row = spendMap.get(k);
    if (!row) {
      row = {
        key: k,
        campanha: a.campanha || "—",
        conjunto: a.conjunto_anuncios || "—",
        anuncio: a.anuncio || "—",
        spend: 0,
        impressoes: 0,
        cliques: 0,
        comprasAds: 0,
        vendasReais: 0,
        receitaPrincipal: 0,
        receitaBackend: 0,
        receitaTotal: 0,
        ftbCount: 0,
        backendCount: 0,
        cpa: 0,
        roasFront: 0,
        roasReal: 0,
        ltv: 0,
        backendShare: 0,
        matchExact: 0,
        matchAdset: 0,
        matchCampaign: 0,
        receitaExact: 0,
        receitaAdset: 0,
        receitaCampaign: 0,
        confidenceScore: 0,
      };
      spendMap.set(k, row);
    }
    row.spend += a.valor || 0;
    row.impressoes += a.impressoes || 0;
    row.cliques += a.cliques || 0;
    row.comprasAds += a.compras || 0;

    // Indexação determinística usando a granularidade real do raw row
    const cN = norm(a.campanha);
    const conjN = norm(a.conjunto_anuncios);
    const adN = norm(a.anuncio);
    if (cN) {
      if (!campIdx.has(cN)) campIdx.set(cN, new Set());
      campIdx.get(cN)!.add(k);
    }
    if (cN && conjN) {
      const ck = `${cN}|${conjN}`;
      if (!adsetIdx.has(ck)) adsetIdx.set(ck, new Set());
      adsetIdx.get(ck)!.add(k);
    }
    if (cN && conjN && adN) {
      adIdx.set(`${cN}|${conjN}|${adN}`, k);
    }
  }

  // Matching determinístico por venda — sem fallback "primeiro registro"
  // Tenta na ordem: anúncio exato → conjunto → campanha. Se nada bater = unmatched.
  const matchSale = (v: VendaDetailedRow): { key: string; confidence: MatchConfidence } | null => {
    const cN = norm(v.utm_campaign);
    if (!cN) return null;
    const contentN = norm(v.utm_content);

    // 1. exact: utm_content casa com anúncio dentro da campanha
    if (contentN) {
      const adKeys = Array.from(adIdx.entries()).filter(([k]) => k.startsWith(`${cN}|`));
      for (const [adKey, spendKey] of adKeys) {
        const parts = adKey.split("|");
        if (parts[2] === contentN) {
          return { key: spendKey, confidence: "exact" };
        }
      }
      // 2. adset: utm_content casa com conjunto dentro da campanha
      for (const [adsetKey, keys] of adsetIdx.entries()) {
        if (!adsetKey.startsWith(`${cN}|`)) continue;
        const conjN = adsetKey.split("|")[1];
        if (conjN === contentN) {
          // pega a key mais granular se groupBy for "anuncio", senão a única
          const arr = Array.from(keys);
          // prefere a key cujo conjunto bate exatamente (deve ser todas, mas seguro)
          return { key: arr[0], confidence: "adset" };
        }
      }
    }

    // 3. campaign-only: bate só campanha. Só agrega quando há exatamente 1 key da campanha
    // OU quando groupBy === "campanha" (não há ambiguidade).
    const campKeys = campIdx.get(cN);
    if (!campKeys || campKeys.size === 0) return null;
    if (groupBy === "campanha") {
      // só existe uma key por campanha
      return { key: Array.from(campKeys)[0], confidence: "campaign" };
    }
    if (campKeys.size === 1) {
      return { key: Array.from(campKeys)[0], confidence: "campaign" };
    }
    // ambíguo: várias subdivisões e sem utm_content útil → não atribui (evita ruído)
    return null;
  };

  const buyersByKey = new Map<string, Set<string>>();
  const report: MatchingReport = {
    totalVendas: vendas.length,
    totalReceita: 0,
    matched: 0,
    unmatched: 0,
    receitaMatched: 0,
    receitaUnmatched: 0,
    byConfidence: {
      exact: { count: 0, receita: 0 },
      adset: { count: 0, receita: 0 },
      campaign: { count: 0, receita: 0 },
      unmatched: { count: 0, receita: 0 },
    },
    unmatchedSamples: [],
  };

  for (const v of vendas) {
    const valor = v.valor || 0;
    report.totalReceita += valor;
    const m = matchSale(v);
    if (!m) {
      report.unmatched += 1;
      report.receitaUnmatched += valor;
      report.byConfidence.unmatched.count += 1;
      report.byConfidence.unmatched.receita += valor;
      if (report.unmatchedSamples.length < 25) {
        report.unmatchedSamples.push({
          vendaId: v.id,
          utm_campaign: v.utm_campaign,
          utm_content: v.utm_content,
          utm_source: v.utm_source,
          valor,
          data_venda: v.data_venda,
        });
      }
      continue;
    }

    const row = spendMap.get(m.key)!;
    if (isBackend(v.tipo_venda)) {
      row.receitaBackend += valor;
      row.backendCount += 1;
    } else {
      row.receitaPrincipal += valor;
      row.ftbCount += 1;
    }
    row.receitaTotal += valor;

    if (m.confidence === "exact") {
      row.matchExact += 1;
      row.receitaExact += valor;
    } else if (m.confidence === "adset") {
      row.matchAdset += 1;
      row.receitaAdset += valor;
    } else {
      row.matchCampaign += 1;
      row.receitaCampaign += valor;
    }

    report.matched += 1;
    report.receitaMatched += valor;
    report.byConfidence[m.confidence].count += 1;
    report.byConfidence[m.confidence].receita += valor;

    if (v.lead_id) {
      if (!buyersByKey.has(m.key)) buyersByKey.set(m.key, new Set());
      buyersByKey.get(m.key)!.add(v.lead_id);
    }
  }

  const result: CreativeRoasRow[] = [];
  for (const [k, row] of spendMap.entries()) {
    const buyers = buyersByKey.get(k)?.size || 0;
    row.vendasReais = buyers;
    row.cpa = buyers > 0 ? row.spend / buyers : 0;
    row.roasFront = row.spend > 0 ? row.receitaPrincipal / row.spend : 0;
    row.roasReal = row.spend > 0 ? row.receitaTotal / row.spend : 0;
    row.ltv = buyers > 0 ? row.receitaTotal / buyers : 0;
    row.backendShare = row.receitaTotal > 0 ? (row.receitaBackend / row.receitaTotal) * 100 : 0;
    // confidence ponderado pela receita: exact=100, adset=70, campaign=40
    const totalRev = row.receitaExact + row.receitaAdset + row.receitaCampaign;
    row.confidenceScore = totalRev > 0
      ? (row.receitaExact * 100 + row.receitaAdset * 70 + row.receitaCampaign * 40) / totalRev
      : 0;
    result.push(row);
  }

  return {
    rows: result.sort((a, b) => b.roasReal - a.roasReal),
    report,
  };
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
