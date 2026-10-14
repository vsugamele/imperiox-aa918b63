import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const GLOBAL_PROJECT_KEY = "imphq:global:project";
const GLOBAL_PROJECT_EVENT = "imphq:global-project-change";

export interface GlobalProjectOption {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
}

function readStoredGlobalProject(): string {
  if (typeof window === "undefined") return "all";
  try {
    return localStorage.getItem(GLOBAL_PROJECT_KEY) || "all";
  } catch {
    return "all";
  }
}

export function useGlobalProjectList() {
  return useQuery({
    queryKey: ["global-projects-list"],
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<GlobalProjectOption[]> => {
      const { data, error } = await supabase
        .from("imphq_projects")
        .select("id, name, icon, category")
        .or("is_archived.eq.false,is_archived.is.null")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon ?? null,
        category: p.category ?? null,
      }));
    },
  });
}

export function useGlobalProject() {
  const [projectId, setProjectIdState] = useState<string>(readStoredGlobalProject);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setProjectIdState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_PROJECT_KEY) {
        setProjectIdState(e.newValue || "all");
      }
    };
    window.addEventListener(GLOBAL_PROJECT_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(GLOBAL_PROJECT_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setProjectId = useCallback((nextId: string) => {
    const normalized = nextId || "all";
    setProjectIdState(normalized);
    try {
      localStorage.setItem(GLOBAL_PROJECT_KEY, normalized);
    } catch {
      /* ignore storage errors */
    }
    window.dispatchEvent(new CustomEvent<string>(GLOBAL_PROJECT_EVENT, { detail: normalized }));
  }, []);

  return {
    projectId,
    setProjectId,
  };
}
