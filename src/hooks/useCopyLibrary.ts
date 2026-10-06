import { useQuery } from "@tanstack/react-query";
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
