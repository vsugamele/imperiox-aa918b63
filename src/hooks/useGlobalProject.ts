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

function normalizeStoredProject(raw: string | null | undefined): string | null {
  if (!raw || raw === "all" || raw === "__all__") return null;
  return raw;
}

function readStoredGlobalProject(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeStoredProject(localStorage.getItem(GLOBAL_PROJECT_KEY));
  } catch {
    return null;
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
  const [projectId, setProjectIdState] = useState<string | null>(readStoredGlobalProject);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setProjectIdState(normalizeStoredProject(detail));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_PROJECT_KEY) {
        setProjectIdState(normalizeStoredProject(e.newValue));
      }
    };
    window.addEventListener(GLOBAL_PROJECT_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(GLOBAL_PROJECT_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setProjectId = useCallback((nextId: string | null) => {
    const normalized = normalizeStoredProject(nextId);
    setProjectIdState(normalized);
    const stored = normalized ?? "all";
    try {
      localStorage.setItem(GLOBAL_PROJECT_KEY, stored);
    } catch {
      /* ignore storage errors */
    }
    window.dispatchEvent(new CustomEvent<string | null>(GLOBAL_PROJECT_EVENT, { detail: normalized }));
  }, []);

  return {
    projectId,
    setProjectId,
  };
}
