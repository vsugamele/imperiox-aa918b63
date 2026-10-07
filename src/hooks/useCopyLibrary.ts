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

export interface LibraryHealthData {
  total: number; videos: number; videos_com_texto: number; imagens: number; imagens_lidas: number; com_projeto: number; com_angulo: number;
  formatos: Array<{ formato: string; n: number }>;
}

/** Saúde da biblioteca de referências (REF2.1): quanto já foi processado pelo pipeline. Atualiza a cada 2 minutos. */
export function useLibraryHealth() {
  return useQuery({
    queryKey: ["library-health"],
    refetchInterval: 120_000,
    queryFn: async (): Promise<LibraryHealthData> => {
      const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        const { count: n, error } = await build(base());
        if (error) throw error;
        return n ?? 0;
      };
      const base = () => supabase.from("imphq_referencias").select("id", { count: "exact", head: true });
      const [total, videos, videosTexto, imagens, imagensLidas, comProjeto, comAngulo, fmt] = await Promise.all([
        count((q) => q),
        count((q) => q.eq("tipo", "video")),
        count((q) => q.eq("tipo", "video").not("transcricao", "is", null).neq("transcricao", "")),
        count((q) => q.neq("tipo", "video")),
        count((q) => q.neq("tipo", "video").not("transcricao", "is", null).neq("transcricao", "")),
        count((q) => q.not("project_id", "is", null)),
        count((q) => q.in("copy_lib_status", ["firme", "revisado"])),
        supabase.from("imphq_referencias").select("formato").not("formato", "is", null).limit(2000),
      ]);
      if (fmt.error) throw fmt.error;
      const by = new Map<string, number>();
      for (const r of fmt.data ?? []) by.set(String(r.formato), (by.get(String(r.formato)) ?? 0) + 1);
      return {
        total, videos, videos_com_texto: videosTexto, imagens, imagens_lidas: imagensLidas, com_projeto: comProjeto, com_angulo: comAngulo,
        formatos: [...by.entries()].map(([formato, n]) => ({ formato, n })).sort((a, b) => b.n - a.n),
      };
    },
  });
}
