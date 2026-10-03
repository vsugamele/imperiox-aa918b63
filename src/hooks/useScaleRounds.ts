import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { evaluateRound, roundSummary, type ScalePhase, type SpendRow } from "@shared/scale-ladder";

export interface ScaleRound {
  id: string;
  project_id: string;
  node_id: string | null;
  fase: string;
  rodada: string | null;
  params: Json;
  data: Json;
  resultado: Json | null;
  resumo: string | null;
  created_by: string | null;
  updated_at: string;
}

const COLUMNS = "id, project_id, node_id, fase, rodada, params, data, resultado, resumo, created_by, updated_at";

/** Rodadas da fase no projeto, a mais recente primeiro, e os últimos parâmetros salvos em qualquer fase. */
export function useScaleRounds(projectId: string | null, fase: ScalePhase) {
  return useQuery({
    queryKey: ["scale-rounds", projectId, fase],
    enabled: !!projectId,
    queryFn: async () => {
      const [roundsRes, paramsRes] = await Promise.all([
        supabase.from("imphq_scale_rounds").select(COLUMNS).eq("project_id", projectId as string).eq("fase", fase).order("updated_at", { ascending: false }).limit(10),
        supabase.from("imphq_scale_rounds").select("params").eq("project_id", projectId as string).order("updated_at", { ascending: false }).limit(1),
      ]);
      if (roundsRes.error) throw roundsRes.error;
      if (paramsRes.error) throw paramsRes.error;
      return { rounds: (roundsRes.data ?? []) as ScaleRound[], lastParams: paramsRes.data?.[0]?.params ?? null };
    },
  });
}

export interface SaveScaleRound { id?: string | null; projectId: string; nodeId: string; fase: ScalePhase; rodada: string; params: Record<string, number>; data: Record<string, unknown> }

/** Grava a rodada com o veredito do momento (resultado + resumo de uma linha). */
export function useSaveScaleRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveScaleRound): Promise<string> => {
      const resultado = evaluateRound(input.fase, input.params, input.data);
      const { data: auth } = await supabase.auth.getUser();
      const row = {
        project_id: input.projectId, node_id: input.nodeId, fase: input.fase, rodada: input.rodada || null,
        params: input.params as Json, data: input.data as Json, resultado: (resultado ?? null) as Json,
        resumo: roundSummary(input.fase, resultado), updated_at: new Date().toISOString(),
      };
      if (input.id) {
        const { error } = await supabase.from("imphq_scale_rounds").update(row).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase.from("imphq_scale_rounds").insert({ ...row, created_by: auth.user?.email ?? "tela" }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (_id, input) => qc.invalidateQueries({ queryKey: ["scale-rounds", input.projectId] }),
  });
}

/** Gasto, checkouts iniciados e compras do sync de anúncios no período (datas AAAA-MM-DD, inclusivas). */
export async function loadSpend(projectId: string, from: string, to: string): Promise<SpendRow[]> {
  const { data, error } = await supabase.from("imphq_ads_spend")
    .select("data_ref, conjunto_anuncios, campanha, valor, checkouts_iniciados, init_checkout, compras")
    .eq("project_id", projectId).gte("data_ref", from).lte("data_ref", to).limit(5000);
  if (error) throw error;
  return (data ?? []) as SpendRow[];
}
