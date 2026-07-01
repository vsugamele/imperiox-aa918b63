import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, TrendingUp } from "lucide-react";

interface Props {
  automacaoId?: string;
  stepIndex: number;
  jumpSteps: number;
  onPromoteWinner: (winnerPct: number) => void;
}

interface Stats {
  totalA: number;
  totalB: number;
  okA: number;
  okB: number;
}

export function ABVariantStats({ automacaoId, stepIndex, jumpSteps, onPromoteWinner }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalA: 0, totalB: 0, okA: 0, okB: 0 });

  useEffect(() => {
    if (!automacaoId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_flow_executions")
        .select("step_results")
        .eq("automacao_id", automacaoId)
        .limit(500);
      const s: Stats = { totalA: 0, totalB: 0, okA: 0, okB: 0 };
      (data || []).forEach((r: any) => {
        const steps = Array.isArray(r.step_results) ? r.step_results : [];
        const ab = steps.find((x: any) => (x.step ?? -1) === stepIndex && x.tipo === "ab_split");
        if (!ab) return;
        const isA = ab.chosen_path === "A";
        if (isA) s.totalA++; else s.totalB++;
        // Downstream success: count any step AFTER stepIndex with status sent/completed
        const idx = steps.indexOf(ab);
        const downstream = steps.slice(idx + 1);
        const hasOk = downstream.some((x: any) => x.status === "sent" || x.status === "completed");
        if (hasOk) { if (isA) s.okA++; else s.okB++; }
      });
      setStats(s);
      setLoading(false);
    })();
  }, [automacaoId, stepIndex]);

  if (loading) {
    return <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Carregando stats…</div>;
  }

  const total = stats.totalA + stats.totalB;
  if (total < 5) {
    return <p className="text-[10px] text-muted-foreground/70 py-2">Sem dados suficientes ainda ({total} execuções). Mínimo: 5.</p>;
  }

  const rateA = stats.totalA ? stats.okA / stats.totalA : 0;
  const rateB = stats.totalB ? stats.okB / stats.totalB : 0;
  const winner: "A" | "B" | "tie" = rateA > rateB ? "A" : rateB > rateA ? "B" : "tie";

  return (
    <div className="space-y-2 p-2 rounded bg-secondary/40 border border-border/40">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium">Resultado do teste ({total} execuções)</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className={`p-2 rounded ${winner === "A" ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-background/40"}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">Rota A</span>
            {winner === "A" && <Trophy className="h-3 w-3 text-emerald-400" />}
          </div>
          <div className="text-muted-foreground">{stats.totalA} exec · {stats.okA} ok</div>
          <div className="font-bold text-foreground">{(rateA * 100).toFixed(1)}%</div>
        </div>
        <div className={`p-2 rounded ${winner === "B" ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-background/40"}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">Rota B</span>
            {winner === "B" && <Trophy className="h-3 w-3 text-emerald-400" />}
          </div>
          <div className="text-muted-foreground">{stats.totalB} exec · {stats.okB} ok</div>
          <div className="font-bold text-foreground">{(rateB * 100).toFixed(1)}%</div>
        </div>
      </div>
      {winner !== "tie" && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full text-[10px] gap-1"
          onClick={() => onPromoteWinner(winner === "A" ? 100 : 0)}
        >
          <Trophy className="h-3 w-3" /> Promover Rota {winner} (100% tráfego)
        </Button>
      )}
    </div>
  );
}
