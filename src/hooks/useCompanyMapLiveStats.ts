import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NodeStats {
  revenue30d: number;
  revenue7d: number;
  vendas7d: number;
  ticketMedio7d: number;
  leadsAbertos: number;
  leadsTotais: number;
  // Por tipo_venda (7d)
  principalRevenue7d: number;
  orderbumpRevenue7d: number;
  upsellRevenue7d: number;
  downsellRevenue7d: number;
  // Take-rates: % das vendas principais que também tiveram X
  orderbumpTakeRate: number;
  upsellTakeRate: number;
}

const empty = (): NodeStats => ({
  revenue30d: 0, revenue7d: 0, vendas7d: 0, ticketMedio7d: 0,
  leadsAbertos: 0, leadsTotais: 0,
  principalRevenue7d: 0, orderbumpRevenue7d: 0, upsellRevenue7d: 0, downsellRevenue7d: 0,
  orderbumpTakeRate: 0, upsellTakeRate: 0,
});

export function useCompanyMapLiveStats(projectIds: string[]) {
  return useQuery({
    queryKey: ["company-map-stats-v2", projectIds.sort().join(",")],
    enabled: projectIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const [vendas30, vendas7, leadsOpen, leadsAll] = await Promise.all([
        supabase.from("imphq_vendas").select("project_id, valor").in("project_id", projectIds).gte("created_at", d30),
        supabase.from("imphq_vendas").select("project_id, valor, tipo_venda, lead_id").in("project_id", projectIds).gte("created_at", d7),
        supabase.from("imphq_leads").select("project_id").in("project_id", projectIds).neq("status", "ganho"),
        supabase.from("imphq_leads").select("project_id").in("project_id", projectIds),
      ]);

      const map: Record<string, NodeStats> = {};
      projectIds.forEach(id => (map[id] = empty()));

      (vendas30.data || []).forEach((v: any) => {
        if (map[v.project_id]) map[v.project_id].revenue30d += Number(v.valor || 0);
      });

      // Track lead_ids with each tipo for take-rate
      const principalLeads: Record<string, Set<string>> = {};
      const bumpLeads: Record<string, Set<string>> = {};
      const upsellLeads: Record<string, Set<string>> = {};

      (vendas7.data || []).forEach((v: any) => {
        const s = map[v.project_id]; if (!s) return;
        const valor = Number(v.valor || 0);
        s.revenue7d += valor;
        s.vendas7d += 1;
        const tipo = (v.tipo_venda || "principal").toLowerCase();
        if (tipo.includes("upsell")) s.upsellRevenue7d += valor;
        else if (tipo.includes("downsell")) s.downsellRevenue7d += valor;
        else if (tipo.includes("bump")) s.orderbumpRevenue7d += valor;
        else s.principalRevenue7d += valor;

        const lid = v.lead_id;
        if (lid) {
          if (tipo === "principal" || (!tipo.includes("upsell") && !tipo.includes("downsell") && !tipo.includes("bump"))) {
            (principalLeads[v.project_id] ||= new Set()).add(lid);
          }
          if (tipo.includes("bump")) (bumpLeads[v.project_id] ||= new Set()).add(lid);
          if (tipo.includes("upsell")) (upsellLeads[v.project_id] ||= new Set()).add(lid);
        }
      });

      Object.keys(map).forEach(pid => {
        const s = map[pid];
        s.ticketMedio7d = s.vendas7d ? s.revenue7d / s.vendas7d : 0;
        const pSet = principalLeads[pid];
        if (pSet && pSet.size > 0) {
          const bump = bumpLeads[pid]?.size || 0;
          const up = upsellLeads[pid]?.size || 0;
          s.orderbumpTakeRate = (bump / pSet.size) * 100;
          s.upsellTakeRate = (up / pSet.size) * 100;
        }
      });

      (leadsOpen.data || []).forEach((l: any) => { if (map[l.project_id]) map[l.project_id].leadsAbertos += 1; });
      (leadsAll.data || []).forEach((l: any) => { if (map[l.project_id]) map[l.project_id].leadsTotais += 1; });

      return map;
    },
  });
}

/** Returns the KPI badge line for a given node kind. */
export function pickKpiForKind(kind: string, s: NodeStats | null | undefined):
  { primary: string; secondary: string; tone: "good" | "warn" | "bad" | "neutral" } | null {
  if (!s) return null;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const money = (n: number) => `R$ ${fmt(n)}`;
  const pct = (n: number) => `${n.toFixed(0)}%`;

  switch (kind) {
    case "oferta":
    case "pagina_vendas":
    case "vsl":
      return {
        primary: money(s.revenue30d),
        secondary: `${s.leadsAbertos} leads abertos`,
        tone: s.revenue30d > 0 ? "good" : "warn",
      };
    case "checkout":
      return {
        primary: `${s.vendas7d} vendas 7d`,
        secondary: `ticket ${money(s.ticketMedio7d)}`,
        tone: s.vendas7d > 0 ? "good" : "bad",
      };
    case "orderbump":
      return {
        primary: money(s.orderbumpRevenue7d),
        secondary: `take ${pct(s.orderbumpTakeRate)}`,
        tone: s.orderbumpTakeRate >= 20 ? "good" : s.orderbumpTakeRate >= 5 ? "warn" : "bad",
      };
    case "upsell":
      return {
        primary: money(s.upsellRevenue7d),
        secondary: `take ${pct(s.upsellTakeRate)}`,
        tone: s.upsellTakeRate >= 15 ? "good" : s.upsellTakeRate >= 5 ? "warn" : "bad",
      };
    case "downsell":
      return {
        primary: money(s.downsellRevenue7d),
        secondary: `recuperação 7d`,
        tone: s.downsellRevenue7d > 0 ? "good" : "neutral",
      };
    case "captura":
      return {
        primary: `${s.leadsTotais} leads`,
        secondary: `${s.leadsAbertos} abertos`,
        tone: s.leadsTotais > 0 ? "good" : "warn",
      };
    case "email":
      return {
        primary: `${s.leadsAbertos} nurture`,
        secondary: `${s.leadsTotais} totais`,
        tone: "neutral",
      };
    default:
      return null;
  }
}
