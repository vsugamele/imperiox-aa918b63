import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  automacaoId?: string;
  projectId?: string;
}

interface StepStat {
  step: number;
  tipo: string;
  total: number;
  ok: number;
  error: number;
  skipped: number;
  rate: number;
}

export function StepHeatmap({ automacaoId, projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("imphq_flow_executions")
        .select("step_results, automacao_id, project_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (automacaoId) q = q.eq("automacao_id", automacaoId);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      setRows(data || []);
      setLoading(false);
    })();
  }, [automacaoId, projectId]);

  const stats = useMemo<StepStat[]>(() => {
    const acc = new Map<number, StepStat>();
    rows.forEach((r) => {
      const steps = Array.isArray(r.step_results) ? r.step_results : [];
      steps.forEach((s: any, idx: number) => {
        const i = typeof s.step === "number" ? s.step : idx;
        const cur = acc.get(i) || { step: i, tipo: s.tipo || "step", total: 0, ok: 0, error: 0, skipped: 0, rate: 0 };
        cur.total += 1;
        if (s.status === "sent" || s.status === "completed") cur.ok += 1;
        else if (s.status === "error") cur.error += 1;
        else if (s.status === "skipped") cur.skipped += 1;
        cur.tipo = s.tipo || cur.tipo;
        acc.set(i, cur);
      });
    });
    return Array.from(acc.values())
      .map((s) => ({ ...s, rate: s.total ? s.ok / s.total : 0 }))
      .sort((a, b) => a.step - b.step);
  }, [rows]);

  const bottleneck = useMemo(() => {
    if (stats.length < 2) return null;
    let worst: StepStat | null = null;
    for (let i = 1; i < stats.length; i++) {
      const drop = stats[i - 1].total - stats[i].total;
      const dropRate = stats[i - 1].total ? drop / stats[i - 1].total : 0;
      if (dropRate > 0.3 && (!worst || dropRate > (worst as any)._drop)) {
        worst = { ...stats[i], ...( { _drop: dropRate } as any) };
      }
    }
    return worst;
  }, [stats]);

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-3 w-3 animate-spin" /> Calculando métricas…</div>;
  }
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem execuções suficientes para gerar heatmap</p>;
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));

  return (
    <Card className="bg-secondary/40 border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Conversão por step</h4>
            <Badge variant="outline" className="text-[9px]">{rows.length} execuções</Badge>
          </div>
          {bottleneck && (
            <Badge className="text-[9px] bg-red-500/20 text-red-400 border-red-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" /> Gargalo: step #{bottleneck.step}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          {stats.map((s) => {
            const widthPct = maxTotal ? (s.total / maxTotal) * 100 : 0;
            const color =
              s.rate >= 0.7 ? "bg-emerald-500/60" :
              s.rate >= 0.4 ? "bg-amber-500/60" :
              "bg-red-500/60";
            return (
              <div key={s.step} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 text-muted-foreground">#{s.step}</span>
                <span className="w-24 truncate text-foreground/80">{s.tipo}</span>
                <div className="flex-1 bg-background/40 rounded h-5 relative overflow-hidden">
                  <div className={`h-full ${color} transition-all`} style={{ width: `${widthPct}%` }} />
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <span className="text-[10px] font-medium">{s.total} exec.</span>
                    <span className="text-[10px] font-medium">{(s.rate * 100).toFixed(0)}% ok</span>
                  </div>
                </div>
                {s.error > 0 && <span className="text-red-400 w-12 text-right">{s.error} err</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
