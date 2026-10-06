import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CopyLibraryItem = Tables<"imphq_copy_library">;

/** Biblioteca de copy (ângulos, objeções, provas, mecanismos e processo). Muda raramente: cache de 1 hora. */
export function useCopyLibrary() {
  return useQuery({
    queryKey: ["copy-library"],
    staleTime: 3_600_000,
    queryFn: async (): Promise<CopyLibraryItem[]> => {
      const { data, error } = await supabase.from("imphq_copy_library").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ReferenceAngle = Pick<Tables<"imphq_referencias">, "id" | "titulo" | "url" | "image_url" | "project_id" | "copy_lib_id" | "copy_lib_status" | "copy_lib_conf" | "copy_lib_camada" | "copy_lib_alt">;

/** Referências já classificadas pelo Jev (firmes, dúvidas e revisadas). */
export function useReferenceAngles() {
  return useQuery({
    queryKey: ["reference-angles"],
    staleTime: 60_000,
    queryFn: async (): Promise<ReferenceAngle[]> => {
      const { data, error } = await supabase.from("imphq_referencias")
        .select("id, titulo, url, image_url, project_id, copy_lib_id, copy_lib_status, copy_lib_conf, copy_lib_camada, copy_lib_alt")
        .not("copy_lib_at", "is", null).order("copy_lib_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Alguém do time decide o ângulo de uma referência em dúvida (ou diz que não usa nenhum). */
export function useReviewReferenceAngle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, copy_lib_id }: { id: string; copy_lib_id: string | null }) => {
      const { error } = await supabase.from("imphq_referencias")
        .update({ copy_lib_id, copy_lib_status: copy_lib_id ? "revisado" : "sem_angulo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reference-angles"] }),
  });
}
