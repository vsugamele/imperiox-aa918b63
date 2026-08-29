import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FlowStat {
  id: string;
  nome: string;
  ativo: boolean;
  execs24h: number;
  success24h: number;
  errors24h: number;
}

/**
 * Fetches name + 24h execution counts for a set of automacao ids.
 * Polls every 60s. Returns Map<id, FlowStat>.
 */
export function useFlowStats(flowIds: string[]) {
  const [stats, setStats] = useState<Map<string, FlowStat>>(new Map());

  useEffect(() => {
    if (flowIds.length === 0) {
      setStats(new Map());
      return;
    }
    let cancelled = false;
    const ids = Array.from(new Set(flowIds.filter(Boolean)));

    const run = async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const [autoRes, logRes] = await Promise.all([
        supabase.from("imphq_automacoes").select("id, nome, ativo").in("id", ids),
        supabase
          .from("imphq_automacao_logs" as any)
          .select("automacao_id, status")
          .in("automacao_id", ids)
          .gte("created_at", since)
          .limit(2000),
      ]);
      if (cancelled) return;
      const map = new Map<string, FlowStat>();
      (autoRes.data || []).forEach((a: any) => {
        map.set(a.id, { id: a.id, nome: a.nome, ativo: !!a.ativo, execs24h: 0, success24h: 0, errors24h: 0 });
      });
      (logRes.data || []).forEach((l: any) => {
        const s = map.get(l.automacao_id);
        if (!s) return;
        s.execs24h++;
        if (l.status === "success") s.success24h++;
        else if (l.status === "error") s.errors24h++;
      });
      setStats(map);
    };

    run();
    const t = setInterval(() => {
      // Evita polling quando a aba está em background (reduz carga no Postgres)
      if (typeof document !== "undefined" && document.hidden) return;
      run();
    }, 180_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [flowIds.join(",")]);

  return stats;
}
