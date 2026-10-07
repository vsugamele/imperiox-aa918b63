import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { VariationAxis } from "@shared/creative-variations";
import { lastSync, liveReadings, type LiveReading, type LiveVariant, type SaleRow, type SpendRow } from "@shared/test-live";

export type TestOrder = Tables<"imphq_test_orders"> & { variantes: Tables<"imphq_test_variants">[] };

/** Ordens de teste (exceto canceladas) com as variantes, mais recentes primeiro. */
export function useTestOrders() {
  return useQuery({
    queryKey: ["test-orders"],
    staleTime: 60_000,
    queryFn: async (): Promise<TestOrder[]> => {
      const [oRes, vRes] = await Promise.all([
        supabase.from("imphq_test_orders").select("*").neq("status", "cancelado").order("created_at", { ascending: false }).limit(30),
        supabase.from("imphq_test_variants").select("*").order("ordem"),
      ]);
      if (oRes.error) throw oRes.error;
      if (vRes.error) throw vRes.error;
      return (oRes.data ?? []).map((o) => ({ ...o, variantes: (vRes.data ?? []).filter((v) => v.order_id === o.id) }));
    },
  });
}

export interface TestLive { readings: LiveReading[]; sync: string | null }

/** Leitura ao vivo de cada teste: gasto por anúncio do Zernio + vendas reais pela UTM. Atualiza a cada minuto. */
export function useTestLive(orders: TestOrder[]) {
  const ids = orders.map((o) => o.id).join(",");
  return useQuery({
    queryKey: ["test-live", ids],
    enabled: orders.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, TestLive>> => {
      const adIds = orders.flatMap((o) => o.variantes.map((v) => v.meta_ad_id)).filter((x): x is string => Boolean(x));
      const campaigns = orders.map((o) => o.utm_campaign);
      const [sRes, vRes] = await Promise.all([
        adIds.length
          ? supabase.from("imphq_ads_spend").select("ad_id, spend, init_checkout, link_clicks, impressoes, purchases, effective_status, created_at, date").in("ad_id", adIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("imphq_vendas").select("utm_campaign, utm_content, status, valor, valor_liquido, tipo_venda").in("utm_campaign", campaigns),
      ]);
      if (sRes.error) throw sRes.error;
      if (vRes.error) throw vRes.error;
      return Object.fromEntries(orders.map((o) => {
        const since = String(o.ativado_em ?? o.created_at).slice(0, 10);
        const spend = ((sRes.data ?? []) as Array<SpendRow & { date: string | null }>).filter((r) => String(r.date ?? "") >= since);
        return [o.id, { readings: liveReadings(o, o.variantes as LiveVariant[], spend, (vRes.data ?? []) as SaleRow[]), sync: lastSync(spend) }];
      }));
    },
  });
}

export interface VariationBatch {
  id: string;
  nome: string;
  status: string;
  total_gerado: number | null;
  total_planejado: number | null;
  error_message: string | null;
  created_at: string;
  angulo: string;
  artes: Array<{ id: string; image_url: string; eixo: string | null; headline_arte: string | null; texto_anuncio: string | null; headline: string | null }>;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Lotes de variações da fábrica (briefing.tipo = variacoes); atualiza sozinho enquanto algum está gerando. */
export function useVariationBatches() {
  return useQuery({
    queryKey: ["variation-batches"],
    queryFn: async (): Promise<VariationBatch[]> => {
      const { data: batches, error } = await supabase.from("imphq_creative_batches")
        .select("id, nome, status, total_gerado, total_planejado, error_message, created_at, briefing")
        .eq("briefing->>tipo", "variacoes").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      const ids = (batches ?? []).map((b) => b.id);
      const { data: assets, error: aErr } = ids.length
        ? await supabase.from("imphq_creative_assets").select("id, batch_id, image_url, headline_copy, metadata, reprovado").in("batch_id", ids).order("created_at")
        : { data: [], error: null };
      if (aErr) throw aErr;
      return (batches ?? []).map((b) => ({
        id: b.id, nome: b.nome, status: b.status, total_gerado: b.total_gerado, total_planejado: b.total_planejado,
        error_message: b.error_message, created_at: b.created_at, angulo: String(obj(b.briefing).angulo ?? ""),
        artes: (assets ?? []).filter((a) => a.batch_id === b.id && !a.reprovado && String(a.image_url).startsWith("http")).map((a) => {
          const meta = obj(a.metadata);
          const copy = obj(meta.copy);
          return {
            id: a.id, image_url: a.image_url, eixo: meta.eixo ? String(meta.eixo) : null,
            headline_arte: copy.headline_arte ? String(copy.headline_arte) : null,
            texto_anuncio: copy.texto_anuncio ? String(copy.texto_anuncio) : null, headline: a.headline_copy,
          };
        }),
      }));
    },
    refetchInterval: (q) => ((q.state.data ?? []).some((b) => b.status === "pending" || b.status === "processing") ? 8000 : false),
  });
}

export interface GenerateVariationsInput {
  project_id: string;
  base_image_url: string;
  angulo: string;
  hipotese: string | null;
  oferta: string;
  publico?: string | null;
  marca_topo?: string | null;
  texto_base?: string | null;
  quantidade: number;
  eixos: VariationAxis[];
}

/** Dispara a fábrica (creative-factory, action "variations") com o login de quem clicou. */
export function useGenerateVariations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateVariationsInput) => {
      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: { action: "variations", nome: `Variações · ${input.angulo}`, formato: "4:5", ...input },
      });
      if (error) throw error;
      if (!data?.batch_id) throw new Error(data?.error || "A fábrica não devolveu o lote");
      return data as { batch_id: string; quantidade: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["variation-batches"] }),
  });
}
