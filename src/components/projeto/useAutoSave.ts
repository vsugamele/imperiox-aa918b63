import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAutoSave(projectId: string | undefined) {
  const timer = useRef<NodeJS.Timeout>();

  const save = useCallback(
    (field: string, value: any) => {
      if (!projectId) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const { error } = await supabase
          .from("imphq_projects")
          .update({ [field]: value })
          .eq("id", projectId);
        if (error) toast.error("Erro ao salvar");
      }, 800);
    },
    [projectId]
  );

  return save;
}
