import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildFunnelLive, type AdsRow, type FunnelLive, type PageRow, type SaleRow } from "@shared/funnel-live";

export interface FunnelLiveParams { projectId: string | null; produto: string | null; days: number }

export interface FunnelLiveData extends FunnelLive { produtos: string[]; paginas: PageRow[]; adsDoProjetoInteiro: boolean }

/** Números reais do funil de um projeto (e produto) no período. Atualiza a cada 2 minutos. */
export function useFunnelLive({ projectId, produto, days }: FunnelLiveParams) {
  return useQuery({
    queryKey: ["funnel-live", projectId, produto, days],
    enabled: !!projectId,
    refetchInterval: 120_000,
    queryFn: async (): Promise<FunnelLiveData> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [adsRes, salesRes, pagesRes] = await Promise.all([
        supabase.from("imphq_ads_spend").select("spend, impressoes, link_clicks, cliques, init_checkout, purchases").eq("project_id", projectId as string).gte("date", since.slice(0, 10)).limit(5000),
        supabase.from("imphq_vendas").select("status, valor, valor_liquido, tipo_venda, produto_nome, data").eq("project_id", projectId as string).gte("created_at", since).limit(5000),
        supabase.rpc("imphq_page_metrics", { p_project_id: projectId as string, p_since: since }),
      ]);
      if (adsRes.error) throw adsRes.error;
      if (salesRes.error) throw salesRes.error;
      const allSales = (salesRes.data ?? []) as SaleRow[];
      const produtos = [...new Set(allSales.map((s) => s.produto_nome).filter((p): p is string => !!p))].sort();
      const sales = produto ? allSales.filter((s) => s.produto_nome === produto) : allSales;
      // A métrica de página é opcional: se a função falhar, a etapa aparece como "sem dado".
      const rawPages = !pagesRes.error && pagesRes.data && typeof pagesRes.data === "object" ? (pagesRes.data as { pages?: PageRow[] }).pages ?? [] : [];
      const paginas = rawPages.filter((p) => Number(p.values?.sessoes_pagina ?? 0) > 0).sort((a, b) => Number(b.values.sessoes_pagina) - Number(a.values.sessoes_pagina));
      return { ...buildFunnelLive({ ads: (adsRes.data ?? []) as AdsRow[], pages: paginas, sales }), produtos, paginas, adsDoProjetoInteiro: !!produto };
    },
  });
}
