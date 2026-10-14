import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export function useAutoSave(projectId: string | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pendingPatch = useRef<Record<string, Json>>({});

  const save = useCallback(
    (field: string, value: Json) => {
      if (!projectId) return;
      pendingPatch.current[field] = value;
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const patch = { ...pendingPatch.current };
        pendingPatch.current = {};
        if (Object.keys(patch).length === 0) return;
        const { error } = await supabase
          .from("imphq_projects")
          .update(patch)
          .eq("id", projectId);
        if (error) toast.error("Erro ao salvar alterações do projeto");
      }, 600);
    },
    [projectId]
  );

  return save;
}

