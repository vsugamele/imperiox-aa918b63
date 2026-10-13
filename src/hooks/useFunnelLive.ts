import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFunnelLive,
  type AdsRow,
  type FunnelArchetypeId,
  type FunnelLive,
  type PageRow,
  type SaleRow,
} from "@shared/funnel-live";

export interface FunnelLiveParams {
  projectId: string | null;
  produto: string | null;
  days: number;
  archetype?: FunnelArchetypeId;
}

export interface FunnelLiveData extends FunnelLive {
  produtos: string[];
  paginas: PageRow[];
  adsDoProjetoInteiro: boolean;
}

/** Números reais do funil de um projeto (e produto) no período + comparativo Δ com a janela anterior. */
export function useFunnelLive({ projectId, produto, days, archetype }: FunnelLiveParams) {
  return useQuery({
    queryKey: ["funnel-live", projectId, produto, days, archetype ?? "low_ticket_vsl"],
    enabled: !!projectId,
    refetchInterval: 120_000,
    queryFn: async (): Promise<FunnelLiveData> => {
      const now = Date.now();
      const sinceCurrent = new Date(now - days * 86_400_000).toISOString();
      const sincePrev = new Date(now - days * 2 * 86_400_000).toISOString();
      const dateCutoffCurrent = sinceCurrent.slice(0, 10);

      const [adsRes, salesRes, pagesRes] = await Promise.all([
        supabase
          .from("imphq_ads_spend")
          .select("spend, impressoes, link_clicks, cliques, init_checkout, purchases, date")
          .eq("project_id", projectId as string)
          .gte("date", sincePrev.slice(0, 10))
          .limit(5000),
        supabase
          .from("imphq_vendas")
          .select("status, valor, valor_liquido, tipo_venda, produto_nome, data, external_transaction_id, created_at")
          .eq("project_id", projectId as string)
          .gte("created_at", sincePrev)
          .limit(5000),
        supabase.rpc("imphq_page_metrics", { p_project_id: projectId as string, p_since: sinceCurrent }),
      ]);
      if (adsRes.error) throw adsRes.error;
      if (salesRes.error) throw salesRes.error;

      const rawAds = (adsRes.data ?? []) as AdsRow[];
      const currentAds = rawAds.filter((a) => !a.date || a.date >= dateCutoffCurrent);
      const prevAds = rawAds.filter((a) => Boolean(a.date && a.date < dateCutoffCurrent));

      const allSales = (salesRes.data ?? []) as SaleRow[];
      const currentAllSales = allSales.filter((s) => !s.created_at || s.created_at >= sinceCurrent);
      const prevAllSales = allSales.filter((s) => Boolean(s.created_at && s.created_at < sinceCurrent));

      const produtos = [
        ...new Set(
          currentAllSales
            .filter((s) => (s.tipo_venda ?? "principal") === "principal")
            .map((s) => s.produto_nome)
            .filter((p): p is string => !!p)
        ),
      ].sort();

      const filterByProduct = (rows: SaleRow[]) => {
        if (!produto) return rows;
        const txs = new Set(
          rows
            .filter((s) => s.produto_nome === produto)
            .map((s) => s.external_transaction_id)
            .filter(Boolean)
        );
        return rows.filter(
          (s) =>
            s.produto_nome === produto ||
            ((s.tipo_venda ?? "principal") !== "principal" && txs.has(s.external_transaction_id))
        );
      };

      const sales = filterByProduct(currentAllSales);
      const prevSales = filterByProduct(prevAllSales);

      const rawPages =
        !pagesRes.error && pagesRes.data && typeof pagesRes.data === "object"
          ? (pagesRes.data as { pages?: PageRow[] }).pages ?? []
          : [];
      const paginas = rawPages
        .filter((p) => Number(p.values?.sessoes_pagina ?? 0) > 0)
        .sort((a, b) => Number(b.values.sessoes_pagina) - Number(a.values.sessoes_pagina));

      return {
        ...buildFunnelLive({
          ads: currentAds,
          pages: paginas,
          sales,
          archetype,
          prevAds,
          prevSales,
        }),
        produtos,
        paginas,
        adsDoProjetoInteiro: !!produto,
      };
    },
  });
}
