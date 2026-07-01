import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, Pause, Play } from "lucide-react";
import { toast } from "sonner";

export interface NodeStat {
  node_id: string;
  entered: number;
  completed: number;
  dropped: number;
  active: number;
}

interface Props {
  blueprintId: string;
  onStatsChange?: (stats: Record<string, NodeStat>) => void;
}

export function FlowLiveControl({ blueprintId, onStatsChange }: Props) {
  const [status, setStatus] = useState<"draft" | "live" | "paused">("draft");
  const [stats, setStats] = useState<Record<string, NodeStat>>({});
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const { data } = await supabase.from("imphq_flow_blueprints").select("status").eq("id", blueprintId).maybeSingle();
    if (data?.status) setStatus(data.status as any);
  };

  const loadStats = async () => {
    const { data } = await supabase
      .from("imphq_flow_node_stats")
      .select("node_id, entered, completed, dropped, active")
      .eq("blueprint_id", blueprintId);
    const map: Record<string, NodeStat> = {};
    (data || []).forEach((r: any) => { map[r.node_id] = r; });
    setStats(map);
    onStatsChange?.(map);
  };

  useEffect(() => {
    loadStatus();
    loadStats();
    const ch = supabase
      .channel(`flow-runtime-${blueprintId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "imphq_flow_node_stats", filter: `blueprint_id=eq.${blueprintId}` },
        () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintId]);

  const toggle = async (next: "live" | "paused" | "draft") => {
    setLoading(true);
    const patch: any = { status: next };
    if (next === "live") patch.activated_at = new Date().toISOString();
    const { error } = await supabase.from("imphq_flow_blueprints").update(patch).eq("id", blueprintId);
    setLoading(false);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    setStatus(next);
    toast.success(next === "live" ? "Fluxo ativado — ingerindo leads ao vivo" : next === "paused" ? "Fluxo pausado" : "Fluxo voltou a rascunho");
  };

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={
          status === "live" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 animate-pulse"
          : status === "paused" ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
          : "bg-secondary/50 text-muted-foreground border-border/60"
        }
      >
        <Radio className="h-3 w-3 mr-1" />
        {status === "live" ? "AO VIVO" : status === "paused" ? "PAUSADO" : "RASCUNHO"}
      </Badge>
      {status !== "live" && (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => toggle("live")} className="h-7 text-[11px] gap-1">
          <Play className="h-3 w-3" /> Ativar
        </Button>
      )}
      {status === "live" && (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => toggle("paused")} className="h-7 text-[11px] gap-1">
          <Pause className="h-3 w-3" /> Pausar
        </Button>
      )}
    </div>
  );
}

export function NodeStatsBadge({ stat }: { stat?: NodeStat }) {
  if (!stat || (!stat.entered && !stat.active)) return null;
  const conv = stat.entered > 0 ? Math.round((stat.completed / stat.entered) * 100) : 0;
  const dropPct = stat.entered > 0 ? Math.round((stat.dropped / stat.entered) * 100) : 0;
  return (
    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
      <span title="Entraram / Ativos agora / Conversão" className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] text-emerald-200 font-mono">
        ▶ {stat.entered} · ⚡{stat.active} · {conv}%
      </span>
      {dropPct >= 30 && (
        <span title="Taxa de abandono alta" className="rounded-md bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 text-[9px] text-rose-200 font-mono">
          ⚠ {dropPct}%
        </span>
      )}
    </div>
  );
}
