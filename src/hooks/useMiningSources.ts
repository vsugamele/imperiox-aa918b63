import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MiningSource = Tables<"imphq_mining_sources">;

/** Fontes de mineração da Biblioteca de Anúncios (REF2.2). */
export function useMiningSources() {
  return useQuery({
    queryKey: ["mining-sources"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<MiningSource[]> => {
      const { data, error } = await supabase.from("imphq_mining_sources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddMiningSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { project_id: string; tipo: "palavra" | "pagina" | "url"; valor: string; pais: string; limite: number }) => {
      const valor = input.valor.trim();
      if (!valor) throw new Error("Escreva a palavra-chave, a página ou o link");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("imphq_mining_sources").insert({ ...input, valor, created_by: auth.user?.email ?? null });
      if (error) throw new Error(error.code === "23505" ? "Essa fonte já existe neste projeto" : error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mining-sources"] }),
  });
}

export function useToggleMiningSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("imphq_mining_sources").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mining-sources"] }),
  });
}

/** Roda uma fonte agora (Apify → biblioteca). Leva até 2 minutos. */
export function useRunMiningSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke("ref-mining", { body: { modo: "source", source_id: sourceId } });
      if (error) throw error;
      const r = (data?.resultados ?? [])[0] ?? {};
      if (r.erro) throw new Error(String(r.erro));
      return r as { encontrados?: number; gravados?: number };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mining-sources"] }); qc.invalidateQueries({ queryKey: ["library-health"] }); },
  });
}
