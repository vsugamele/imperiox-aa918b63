import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/today-board";
import { newSales, saleCurrency, type WatchedSale } from "@/lib/sale-watch";
import { useProjectsAndMaps } from "@/hooks/usePlaybooks";

export const NEW_SALE_EVENT = "imperio:new-sale";

/** Avisa venda aprovada nova em qualquer tela (consulta a cada minuto) e atualiza Hoje. */
export function SaleWatcher() {
  const qc = useQueryClient();
  const seen = useRef(new Set<string>());
  const seeded = useRef(false);
  const { data: targets } = useProjectsAndMaps();
  const { data } = useQuery({
    queryKey: ["sale-watch"],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async (): Promise<WatchedSale[]> => {
      const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
      const { data: rows, error } = await supabase.from("imphq_vendas")
        .select("id, project_id, valor, produto_nome, data, created_at")
        .eq("status", "aprovado").gte("created_at", since).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return rows ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    const fresh = newSales(data, seen.current, seeded.current);
    seeded.current = true;
    if (!fresh.length) return;
    for (const sale of fresh.slice(0, 3)) {
      const project = targets?.projects.find((p) => p.id === sale.project_id)?.name ?? sale.project_id ?? "Projeto";
      toast.success(`💰 Venda aprovada · ${project}`, {
        description: `${sale.produto_nome || "Produto"} · ${formatMoney(Number(sale.valor || 0), saleCurrency(sale.data))}`,
        duration: 8000,
      });
    }
    window.dispatchEvent(new CustomEvent(NEW_SALE_EVENT, { detail: { count: fresh.length } }));
    for (const key of ["today-board", "map-flow-volume", "company-map-stats-v2"]) qc.invalidateQueries({ queryKey: [key] });
  }, [data, targets, qc]);

  return null;
}
