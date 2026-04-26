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
}

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

export function buildCreativeRoas(
  ads: AdSpendDetailedRow[],
  vendas: VendaDetailedRow[],
  groupBy: CreativeGroupBy = "campanha",
): CreativeRoasRow[] {
  // agregação de spend
  const spendMap = new Map<string, CreativeRoasRow>();

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
      };
      spendMap.set(k, row);
    }
    row.spend += a.valor || 0;
    row.impressoes += a.impressoes || 0;
    row.cliques += a.cliques || 0;
    row.comprasAds += a.compras || 0;
  }

  // index das vendas por chave matching
  // matching: utm_campaign (lowercase) corresponde a campanha (lowercase)
  // pra conjunto/anuncio precisamos de utm_content; se não bater, fica só na campanha
  const matchKey = (v: VendaDetailedRow): string | null => {
    const camp = norm(v.utm_campaign);
    if (!camp) return null;
    // procurar registro de spend cuja campanha bate
    if (groupBy === "campanha") {
      for (const k of spendMap.keys()) {
        if (norm(k) === camp || norm(spendMap.get(k)!.campanha) === camp) return k;
      }
      return null;
    }
    // conjunto/anuncio: tenta bater por utm_content em conjunto OR anuncio
    const content = norm(v.utm_content);
    let fallback: string | null = null;
    for (const [k, row] of spendMap.entries()) {
      if (norm(row.campanha) !== camp) continue;
      fallback = fallback || k;
      if (!content) continue;
      if (groupBy === "conjunto" && norm(row.conjunto) === content) return k;
      if (groupBy === "anuncio" && (norm(row.anuncio) === content || norm(row.conjunto) === content)) return k;
    }
    return fallback;
  };

  // contar vendas únicas (lead_id distinto pra principal)
  const buyersByKey = new Map<string, Set<string>>();

  for (const v of vendas) {
    const k = matchKey(v);
    if (!k) continue;
    const row = spendMap.get(k)!;
    const valor = v.valor || 0;
    if (isBackend(v.tipo_venda)) {
      row.receitaBackend += valor;
      row.backendCount += 1;
    } else {
      row.receitaPrincipal += valor;
      row.ftbCount += 1;
    }
    row.receitaTotal += valor;
    if (v.lead_id) {
      if (!buyersByKey.has(k)) buyersByKey.set(k, new Set());
      buyersByKey.get(k)!.add(v.lead_id);
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
    result.push(row);
  }

  return result.sort((a, b) => b.roasReal - a.roasReal);
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
