import { supabase } from "@/integrations/supabase/client";

export interface LeadRow {
  id: string;
  project_id: string | null;
  criado_em: string | null;
  email: string | null;
  phone: string | null;
  nome: string | null;
  data: any;
}

export interface VendaRow {
  id: string;
  lead_id: string | null;
  project_id: string | null;
  valor: number | null;
  data_venda: string | null;
  utm_source: string | null;
  email?: string | null;
}

export interface AdsSpendRow {
  project_id: string | null;
  data_ref: string | null;
  valor: number | null;
  plataforma: string | null;
  campanha: string | null;
}

export interface CohortCell {
  cohortMonth: string; // YYYY-MM
  monthOffset: number; // 0 = aquisição, 1 = mês seguinte...
  leadsTotal: number;
  buyers: number;
  rate: number; // %
  revenue: number;
}

export interface CohortMatrixData {
  cohortMonths: string[]; // ordenados ascendente
  maxOffset: number;
  cells: Record<string, CohortCell>; // key `${cohortMonth}|${offset}`
  totals: Record<string, number>; // leads por cohort
}

export interface ChannelLtv {
  channel: string;
  leads: number;
  buyers: number;
  revenue: number;
  ltv: number; // revenue / leads únicos
  arpu: number; // revenue / buyers
  cac: number;
  ltvCacRatio: number;
  paybackDays: number | null;
}

const monthKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthsBetween = (a: string, b: string): number => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

export const extractUtmSource = (lead: LeadRow): string => {
  const d = lead.data || {};
  const src =
    d.utm_source ||
    d.utmSource ||
    d.source ||
    d.origem ||
    (d.utm && d.utm.source) ||
    "direto";
  return String(src || "direto").toLowerCase().trim() || "direto";
};

export async function fetchCohortDataset(projectId?: string) {
  const leadsQ = supabase
    .from("imphq_leads")
    .select("id, project_id, criado_em, email, phone, nome, data")
    .order("criado_em", { ascending: true })
    .limit(5000);
  const vendasQ = supabase
    .from("imphq_vendas")
    .select("id, lead_id, project_id, valor, valor_liquido, data_venda, utm_source, data")
    .eq("status", "aprovado")
    .order("data_venda", { ascending: true })
    .limit(5000);
  const adsQ = supabase
    .from("imphq_ads_spend")
    .select("project_id, data_ref, valor, plataforma, campanha")
    .order("data_ref", { ascending: false })
    .limit(5000);

  const filterByProject = <T extends { project_id?: string | null }>(rows: T[]) =>
    projectId ? rows.filter((r) => r.project_id === projectId) : rows;

  const [leadsRes, vendasRes, adsRes] = await Promise.all([leadsQ, vendasQ, adsQ]);

  const leads = filterByProject((leadsRes.data || []) as LeadRow[]);
  const vendas = filterByProject((vendasRes.data || []) as any[]).map((v) => ({
    ...v,
    valor: Number(v.valor || 0),
    valor_liquido: v.valor_liquido != null ? Number(v.valor_liquido) : null,
  })) as VendaRow[];
  const ads = filterByProject((adsRes.data || []) as any[]).map((a) => ({
    ...a,
    valor: Number(a.valor || 0),
  })) as AdsSpendRow[];

  return { leads, vendas, ads };
}

export function buildCohortMatrix(
  leads: LeadRow[],
  vendas: VendaRow[],
): CohortMatrixData {
  // mapa lead_id -> cohortMonth
  const leadCohort = new Map<string, string>();
  const cohortLeads = new Map<string, Set<string>>();

  for (const l of leads) {
    const m = monthKey(l.criado_em);
    if (!m) continue;
    leadCohort.set(l.id, m);
    if (!cohortLeads.has(m)) cohortLeads.set(m, new Set());
    cohortLeads.get(m)!.add(l.id);
  }

  // construir células
  const cells: Record<string, CohortCell> = {};
  const buyersByKey = new Map<string, Set<string>>();
  const revenueByKey = new Map<string, number>();

  for (const v of vendas) {
    if (!v.lead_id) continue;
    const cohort = leadCohort.get(v.lead_id);
    const sellMonth = monthKey(v.data_venda);
    if (!cohort || !sellMonth) continue;
    const offset = monthsBetween(cohort, sellMonth);
    if (offset < 0) continue;
    const key = `${cohort}|${offset}`;
    if (!buyersByKey.has(key)) buyersByKey.set(key, new Set());
    buyersByKey.get(key)!.add(v.lead_id);
    revenueByKey.set(key, (revenueByKey.get(key) || 0) + (v.valor || 0));
  }

  const cohortMonths = Array.from(cohortLeads.keys()).sort();
  let maxOffset = 0;

  const totals: Record<string, number> = {};
  for (const m of cohortMonths) totals[m] = cohortLeads.get(m)!.size;

  for (const m of cohortMonths) {
    const total = totals[m];
    // até hoje
    const now = new Date();
    const nowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const offsetMax = monthsBetween(m, nowKey);
    for (let off = 0; off <= offsetMax; off++) {
      const key = `${m}|${off}`;
      const buyers = buyersByKey.get(key)?.size || 0;
      const revenue = revenueByKey.get(key) || 0;
      cells[key] = {
        cohortMonth: m,
        monthOffset: off,
        leadsTotal: total,
        buyers,
        rate: total > 0 ? (buyers / total) * 100 : 0,
        revenue,
      };
      if (off > maxOffset) maxOffset = off;
    }
  }

  return { cohortMonths, maxOffset, cells, totals };
}

export function buildChannelLtv(
  leads: LeadRow[],
  vendas: VendaRow[],
  ads: AdsSpendRow[],
): ChannelLtv[] {
  // canal por lead
  const leadChannel = new Map<string, string>();
  const leadCreated = new Map<string, Date>();
  const channelLeads = new Map<string, Set<string>>();
  const channelEmails = new Map<string, Set<string>>();

  for (const l of leads) {
    const ch = extractUtmSource(l);
    leadChannel.set(l.id, ch);
    if (l.criado_em) leadCreated.set(l.id, new Date(l.criado_em));
    if (!channelLeads.has(ch)) channelLeads.set(ch, new Set());
    channelLeads.get(ch)!.add(l.id);
    if (l.email) {
      if (!channelEmails.has(ch)) channelEmails.set(ch, new Set());
      channelEmails.get(ch)!.add(l.email.toLowerCase());
    }
  }

  // receita e dias até primeira compra por canal
  const channelRevenue = new Map<string, number>();
  const channelBuyers = new Map<string, Set<string>>();
  const channelDays: Map<string, number[]> = new Map();

  for (const v of vendas) {
    let ch: string | null = null;
    if (v.lead_id && leadChannel.has(v.lead_id)) ch = leadChannel.get(v.lead_id)!;
    else if (v.utm_source) ch = String(v.utm_source).toLowerCase();
    if (!ch) ch = "direto";
    channelRevenue.set(ch, (channelRevenue.get(ch) || 0) + (v.valor || 0));
    if (v.lead_id) {
      if (!channelBuyers.has(ch)) channelBuyers.set(ch, new Set());
      channelBuyers.get(ch)!.add(v.lead_id);
      const created = leadCreated.get(v.lead_id);
      if (created && v.data_venda) {
        const days = (new Date(v.data_venda).getTime() - created.getTime()) / 86400000;
        if (days >= 0) {
          if (!channelDays.has(ch)) channelDays.set(ch, []);
          channelDays.get(ch)!.push(days);
        }
      }
    }
  }

  // CAC: total ads spend dividido proporcional por leads do canal pago
  const totalAds = ads.reduce((s, a) => s + (a.valor || 0), 0);
  const totalLeads = leads.length || 1;

  const channels = new Set<string>([
    ...channelLeads.keys(),
    ...channelRevenue.keys(),
  ]);

  const result: ChannelLtv[] = [];
  for (const ch of channels) {
    const leadsCount = channelLeads.get(ch)?.size || 0;
    const buyers = channelBuyers.get(ch)?.size || 0;
    const revenue = channelRevenue.get(ch) || 0;
    const ltv = leadsCount > 0 ? revenue / leadsCount : 0;
    const arpu = buyers > 0 ? revenue / buyers : 0;
    const cacShare = totalLeads > 0 ? (leadsCount / totalLeads) * totalAds : 0;
    const cac = buyers > 0 ? cacShare / buyers : 0;
    const ratio = cac > 0 ? ltv / cac : 0;
    const days = channelDays.get(ch) || [];
    const avgDays = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : null;
    let payback: number | null = null;
    if (avgDays != null && arpu > 0 && cac > 0) {
      // dias médios * (CAC / ARPU) — quanto ele leva pra cobrir CAC
      payback = Math.round(avgDays * (cac / arpu));
    }
    result.push({
      channel: ch,
      leads: leadsCount,
      buyers,
      revenue,
      ltv,
      arpu,
      cac,
      ltvCacRatio: ratio,
      paybackDays: payback,
    });
  }

  return result.sort((a, b) => b.ltvCacRatio - a.ltvCacRatio);
}

export function leadsForCohortCell(
  leads: LeadRow[],
  vendas: VendaRow[],
  cohortMonth: string,
  monthOffset: number,
): { lead: LeadRow; revenue: number; vendas: VendaRow[] }[] {
  const inCohort = leads.filter((l) => monthKey(l.criado_em) === cohortMonth);
  const out: { lead: LeadRow; revenue: number; vendas: VendaRow[] }[] = [];
  for (const lead of inCohort) {
    const vs = vendas.filter((v) => {
      if (v.lead_id !== lead.id) return false;
      const sm = monthKey(v.data_venda);
      if (!sm) return false;
      return monthsBetween(cohortMonth, sm) === monthOffset;
    });
    if (vs.length === 0 && monthOffset > 0) continue;
    const rev = vs.reduce((s, v) => s + (v.valor || 0), 0);
    out.push({ lead, revenue: rev, vendas: vs });
  }
  return out.sort((a, b) => b.revenue - a.revenue);
}

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
