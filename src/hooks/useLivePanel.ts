import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adsSyncHealth, buildLivePanel, dayFraction, liveDelta, type AdRow, type AdsSyncHealthRow, type LivePanel, type SaleRow } from "@shared/live-panel";
import { paramsFrom } from "@shared/scale-ladder";

/** Início do dia de Brasília (UTC-3) em ISO e a data AAAA-MM-DD. */
function brtToday() {
  const day = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  return { day, start: `${day}T03:00:00.000Z` };
}

async function loadLivePanel(projectId: string): Promise<LivePanel> {
  const { day, start } = brtToday();
  const month = new Date(Date.now() - 30 * 86400000).toISOString();
  const count = (event: string) => supabase.from("imphq_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("event_name", event).gte("created_at", start);
  const [pv, ic, salesRes, adsRes, webhookRes, paramsRes, healthRes] = await Promise.all([
    count("PageView"),
    count("InitiateCheckout"),
    supabase.from("imphq_vendas").select("status, valor, data").eq("project_id", projectId).gte("created_at", start).limit(5000),
    supabase.from("imphq_ads_spend").select("valor, landing_page_views, checkouts_iniciados, init_checkout, compras, valor_conversao, moeda").eq("project_id", projectId).eq("data_ref", day).limit(5000),
    supabase.from("imphq_vendas").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", month),
    supabase.from("imphq_scale_rounds").select("params").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("imphq_v_ads_sync_health").select("*").eq("project_id", projectId).maybeSingle(),
  ]);
  for (const res of [pv, ic, salesRes, adsRes, webhookRes, paramsRes]) if (res.error) throw res.error;
  const params = paramsRes.data?.[0] ? paramsFrom(paramsRes.data[0].params) : null;
  return buildLivePanel({
    trackerEvents: { PageView: pv.count ?? 0, InitiateCheckout: ic.count ?? 0 },
    sales: (salesRes.data ?? []) as SaleRow[],
    ads: (adsRes.data ?? []) as AdRow[],
    webhookConnected: (webhookRes.count ?? 0) > 0,
    params: params && params.payout > 0 && params.cpaAlvo > 0 ? params : null,
    dayFraction: dayFraction(),
    // Falha ao ler a saúde do sync não derruba o painel.
    syncHealth: healthRes.error ? null : adsSyncHealth(healthRes.data as AdsSyncHealthRow | null),
  });
}

/** Painel ao vivo do projeto, relido a cada minuto, com a variação desde a última leitura gravada (ou da sessão). */
export function useLivePanel(projectId: string | null) {
  const query = useQuery({
    queryKey: ["live-panel", projectId],
    enabled: !!projectId,
    queryFn: () => loadLivePanel(projectId as string),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const previous = useRef<{ panel: LivePanel; at: number } | null>(null);
  const [comparison, setComparison] = useState<{ delta: ReturnType<typeof liveDelta>; at: number } | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const before = previous.current;
    // Só troca a base quando a leitura mudou: o "vs" aponta para a última leitura diferente.
    if (before && JSON.stringify(before.panel.parcial) !== JSON.stringify(query.data.parcial)) {
      setComparison({ delta: liveDelta(query.data, before.panel), at: before.at });
    }
    if (!before || JSON.stringify(before.panel.parcial) !== JSON.stringify(query.data.parcial)) {
      previous.current = { panel: query.data, at: query.dataUpdatedAt };
    }
  }, [query.data, query.dataUpdatedAt]);

  // Leituras gravadas a cada 15 min (live-snapshot): o "vs" usa a última leitura de hoje diferente da atual,
  // e sobrevive a recarregar a página. A comparação da sessão fica como reserva enquanto não há leitura gravada.
  const snapshots = useQuery({
    queryKey: ["live-snapshots", projectId],
    enabled: !!projectId,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("imphq_live_snapshots").select("taken_at, painel")
        .eq("project_id", projectId as string).eq("dia", brtToday().day).order("taken_at", { ascending: false }).limit(8);
      if (error) throw error;
      return (data ?? []) as Array<{ taken_at: string; painel: unknown }>;
    },
  });
  const stored = (() => {
    if (!query.data || !snapshots.data?.length) return null;
    const current = JSON.stringify(query.data.parcial);
    const base = snapshots.data.find((s) => JSON.stringify((s.painel as LivePanel).parcial) !== current);
    return base ? { delta: liveDelta(query.data, base.painel as LivePanel), at: Date.parse(base.taken_at) } : null;
  })();

  return { ...query, comparison: stored ?? comparison };
}
