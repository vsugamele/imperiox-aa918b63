import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LevaItem, LevaPlan } from "@shared/batch-strategist";

export interface SavedLeva {
  id: string;
  nome: string;
  status: string;
  total_gerado: number;
  total_planejado: number;
  error_message: string | null;
  project_id: string;
  created_at: string;
  itens: LevaItem[];
  avisos: string[];
}

export type LevaPreview = LevaPlan & { projeto: string; contexto: { referencias: number; testados: number; payout: number | null } };

/** Levas salvas pelo Estrategista (OPS1.3), mais recentes primeiro. */
export function useSavedLevas() {
  return useQuery({
    queryKey: ["levas"],
    // Enquanto alguma leva está gerando, atualiza a cada 10 s para mostrar o andamento.
    refetchInterval: (q) => ((q.state.data as SavedLeva[] | undefined)?.some((l) => l.status === "processing") ? 10_000 : false),
    queryFn: async (): Promise<SavedLeva[]> => {
      const { data, error } = await supabase.from("imphq_creative_batches")
        .select("id, nome, status, project_id, created_at, briefing, total_gerado, total_planejado, error_message")
        .eq("briefing->>tipo", "leva").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []).map((b) => {
        const br = (b.briefing ?? {}) as { itens?: LevaItem[]; avisos?: string[] };
        return { id: b.id, nome: b.nome, status: b.status, project_id: b.project_id, created_at: b.created_at, total_gerado: b.total_gerado, total_planejado: b.total_planejado, error_message: b.error_message, itens: br.itens ?? [], avisos: br.avisos ?? [] };
      });
    },
  });
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("batch-strategist", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function usePlanLeva() {
  return useMutation({ mutationFn: (input: { project_id: string; tamanho: number }) => call<LevaPreview>({ modo: "plano", ...input }) });
}

export function useLevaAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { modo: "salvar"; project_id: string; tamanho: number } | { modo: "aprovar" | "descartar"; leva_id: string }) => call<{ ok: boolean }>(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["levas"] }),
  });
}

export interface GenerateLevaInput { leva_id: string; oferta: string; publico?: string; marca_topo?: string; limite?: number }

/** OPS1.4: manda a fábrica gerar as artes de uma leva aprovada (Kie + copy pelo método). */
export function useGenerateLeva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateLevaInput) => {
      const { data, error } = await supabase.functions.invoke("creative-factory", { body: { action: "leva", ...input } });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return data as { ok: boolean; gerando: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["levas"] }),
  });
}
