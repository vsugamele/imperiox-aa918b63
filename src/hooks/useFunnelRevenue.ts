import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductRevenue {
  produto: string;
  receita: number;
  vendas: number;
  ticket: number;
}

export interface FunnelRevenueData {
  total: number;
  vendas: number;
  ticket: number;
  porProduto: Record<string, ProductRevenue>; // key normalizada lowercase
  loading: boolean;
}

function normalize(s: string | null | undefined) {
  return (s || "").trim().toLowerCase();
}

export function useFunnelRevenue(projectId: string, days: number = 30): FunnelRevenueData {
  const [data, setData] = useState<FunnelRevenueData>({
    total: 0, vendas: 0, ticket: 0, porProduto: {}, loading: true,
  });

  useEffect(() => {
    if (!projectId) {
      setData({ total: 0, vendas: 0, ticket: 0, porProduto: {}, loading: false });
      return;
    }
    let cancel = false;
    (async () => {
      setData(d => ({ ...d, loading: true }));
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("imphq_vendas")
        .select("valor, valor_liquido, status, produto_nome")
        .eq("project_id", projectId)
        .gte("data_venda", since)
        .limit(5000);

      if (cancel) return;

      let total = 0, count = 0;
      const porProduto: Record<string, ProductRevenue> = {};
      for (const v of (rows || []) as any[]) {
        const st = (v.status || "").toLowerCase();
        if (!st.includes("aprov") && !st.includes("paid")) continue;
        const valor = Number(v.valor_liquido ?? v.valor) || 0;
        total += valor;
        count++;
        const key = normalize(v.produto_nome);
        if (!key) continue;
        const cur = porProduto[key] || { produto: v.produto_nome, receita: 0, vendas: 0, ticket: 0 };
        cur.receita += valor;
        cur.vendas++;
        cur.ticket = cur.vendas > 0 ? cur.receita / cur.vendas : 0;
        porProduto[key] = cur;
      }

      setData({
        total,
        vendas: count,
        ticket: count > 0 ? total / count : 0,
        porProduto,
        loading: false,
      });
    })();

    return () => { cancel = true; };
  }, [projectId, days]);

  return data;
}

export function getProductRevenue(rev: FunnelRevenueData, produtoNome?: string | null): ProductRevenue | null {
  if (!produtoNome) return null;
  return rev.porProduto[produtoNome.trim().toLowerCase()] || null;
}
