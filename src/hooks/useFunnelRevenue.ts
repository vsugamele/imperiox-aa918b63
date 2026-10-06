import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const amount = z.number().finite().nullable();
const count = z.number().int().nonnegative();
const productSchema = z.object({
  produto: z.string(), receita: amount, vendas: count, ticket: amount,
  currency: z.string().nullable(),
});
const revenueSchema = z.object({
  currency: z.string().nullable(), total: amount, vendas: count,
  porProduto: z.record(productSchema), unknown_net: count,
});

export type ProductRevenue = Required<z.infer<typeof productSchema>>;

export interface FunnelRevenueData {
  total: number | null;
  vendas: number;
  ticket: number | null;
  currency: string | null;
  unknown_net: number;
  porProduto: Record<string, ProductRevenue>; // key normalizada lowercase
  loading: boolean;
  error: string | null;
}

function unavailable(loading: boolean, error: string | null = null): FunnelRevenueData {
  return { total: null, vendas: 0, ticket: null, currency: null, unknown_net: 0,
    porProduto: {}, loading, error };
}

export function useFunnelRevenue(projectId: string, days = 30): FunnelRevenueData {
  const key = JSON.stringify([projectId, days]);
  const [state, setState] = useState<{ key: string; data: FunnelRevenueData }>({
    key: "", data: unavailable(true),
  });

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setState({ key, data: unavailable(false) });
      return;
    }
    setState({ key, data: unavailable(true) });
    void (async () => {
      try {
        const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
        const { data, error } = await supabase.rpc("imphq_product_revenue", {
          p_project_id: projectId, p_since: since,
        });
        if (error) throw new Error(error.message);
        const result = revenueSchema.parse(data);
        const total = result.currency === null ? null : result.total;
        const porProduto: Record<string, ProductRevenue> = Object.fromEntries(Object.entries(result.porProduto).map(([name, product]) => [
          name.trim().toLowerCase(), {
            produto: product.produto, vendas: product.vendas, currency: product.currency,
            receita: product.currency === null ? null : product.receita,
            ticket: product.currency === null ? null : product.ticket,
          },
        ]));
        if (!cancelled) setState({ key, data: {
          total, porProduto, currency: result.currency, vendas: result.vendas, unknown_net: result.unknown_net,
          ticket: total === null ? null : result.vendas > 0 ? total / result.vendas : 0,
          loading: false, error: null,
        } });
      } catch (error) {
        if (!cancelled) setState({ key, data: unavailable(false,
          error instanceof z.ZodError ? "Resposta de receita inválida"
            : error instanceof Error ? error.message : "Falha ao carregar receita",
        ) });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, days, key]);

  return state.key === key ? state.data : unavailable(Boolean(projectId));
}

export function getProductRevenue(rev: FunnelRevenueData, produtoNome?: string | null): ProductRevenue | null {
  if (!produtoNome || rev.loading || rev.error) return null;
  return rev.porProduto[produtoNome.trim().toLowerCase()] || null;
}
