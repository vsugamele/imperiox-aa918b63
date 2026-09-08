import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StepStat {
  reached: number;
  completed: number;
  waiting: number;
  failed: number;
}

export interface LiveExecution {
  id: string;
  automacao_id: string;
  project_id: string | null;
  lead_id: string | null;
  status: string;
  current_step: number | null;
  next_run_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  step_results?: Json | null;
}

interface Options {
  automacaoId?: string;
  totalSteps: number;
  enabled?: boolean;
}

function classifyStepStatus(status: string | undefined) {
  if (!status) return null;
  if (["completed", "sent", "success", "guided_ai_completed"].includes(status)) return "completed" as const;
  if (["waiting", "running", "waiting_for_lead_response", "delayed_for_condition"].includes(status)) return "waiting" as const;
  if (["error", "failed"].includes(status)) return "failed" as const;
  return null;
}

export function useFlowNodeStats({ automacaoId, totalSteps, enabled = true }: Options) {
  const [stats, setStats] = useState<Record<number, StepStat>>({});
  const [executions, setExecutions] = useState<LiveExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const compute = useCallback((rows: LiveExecution[]) => {
    const acc: Record<number, StepStat> = {};
    for (let i = 0; i < totalSteps; i++) acc[i] = { reached: 0, completed: 0, waiting: 0, failed: 0 };
    for (const exec of rows) {
      const steps = Array.isArray(exec.step_results) ? exec.step_results : [];
      for (const value of steps) {
        const sr = jsonFields(value);
        if (sr.tipo === "cinna_turn" || sr.tipo === "cinna_runtime") continue;
        const idx = typeof sr?.step === "number" ? sr.step : parseInt(jsonText(sr.step));
        if (isNaN(idx) || idx < 0 || idx >= totalSteps) continue;
        acc[idx] = acc[idx] || { reached: 0, completed: 0, waiting: 0, failed: 0 };
        acc[idx].reached++;
        const cls = classifyStepStatus(jsonText(sr.status));
        if (cls) acc[idx][cls]++;
      }
    }
    setStats(acc);
  }, [totalSteps]);

  const fetchAll = useCallback(async () => {
    if (!automacaoId || !enabled) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("imphq_flow_executions")
        .select("id, automacao_id, project_id, lead_id, status, current_step, next_run_at, error_message, created_at, updated_at, step_results")
        .eq("automacao_id", automacaoId)
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = data || [];
      setExecutions(rows);
      compute(rows);
    } finally {
      setLoading(false);
    }
  }, [automacaoId, enabled, compute]);

  useEffect(() => {
    if (!automacaoId || !enabled) {
      setStats({});
      setExecutions([]);
      return;
    }
    fetchAll();
    const ch = supabase
      .channel(`flow-execs-${automacaoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "imphq_flow_executions", filter: `automacao_id=eq.${automacaoId}` },
        () => {
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(fetchAll, 400);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automacaoId, totalSteps, enabled]);

  const summary = useMemo(() => {
    const s = { running: 0, waiting: 0, failed: 0, completed: 0, total: executions.length };
    for (const e of executions) {
      if (e.status === "running") s.running++;
      else if (e.status === "waiting") s.waiting++;
      else if (e.status === "failed") s.failed++;
      else if (e.status === "completed" || e.status === "success") s.completed++;
    }
    return s;
  }, [executions]);

  return { stats, executions, summary, loading, refetch: fetchAll };
}
