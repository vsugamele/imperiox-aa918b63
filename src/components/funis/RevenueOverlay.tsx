import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Radio, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunnelRevenueData, ProductRevenue } from "@/hooks/useFunnelRevenue";

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

interface OverlayProps {
  revenue: FunnelRevenueData;
  days: number;
  onDaysChange: (d: number) => void;
  liveCount: number;
  onClose: () => void;
}

export function RevenueOverlayBar({ revenue, days, onDaysChange, liveCount, onClose }: OverlayProps) {
  return (
    <div data-ui className="absolute top-14 left-16 z-20 rounded-lg border border-emerald-500/40 bg-[#0a0608]/95 backdrop-blur shadow-2xl px-3 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-emerald-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L Live</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Receita</span>
        <span className="text-sm font-bold text-emerald-300">{revenue.loading ? "…" : fmt(revenue.total)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Vendas</span>
        <span className="text-sm font-bold text-foreground">{revenue.loading ? "…" : revenue.vendas}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Ticket</span>
        <span className="text-sm font-bold text-foreground">{revenue.loading ? "…" : fmt(revenue.ticket)}</span>
      </div>

      {liveCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40">
          <Radio className="h-3 w-3 text-rose-300 animate-pulse" />
          <span className="text-[10px] text-rose-200 font-mono">{liveCount} ev/15min</span>
        </div>
      )}

      <Select value={String(days)} onValueChange={v => onDaysChange(Number(v))}>
        <SelectTrigger className="h-7 w-[100px] text-[10px] bg-secondary/40 border-border/40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Últimos 7d</SelectItem>
          <SelectItem value="14">Últimos 14d</SelectItem>
          <SelectItem value="30">Últimos 30d</SelectItem>
          <SelectItem value="90">Últimos 90d</SelectItem>
        </SelectContent>
      </Select>

      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function NodeRevenueBadge({ data }: { data: ProductRevenue | null }) {
  if (!data || data.vendas === 0) return null;
  const tier = data.receita >= 10000 ? "high" : data.receita >= 1000 ? "mid" : "low";
  const colorClass =
    tier === "high" ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/50"
    : tier === "mid" ? "bg-sky-500/20 text-sky-200 border-sky-500/50"
    : "bg-secondary/60 text-foreground/70 border-border/40";
  return (
    <div className="mt-1.5">
      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border", colorClass)}>
        <TrendingUp className="h-2.5 w-2.5" /> {fmt(data.receita)} · {data.vendas}v
      </span>
    </div>
  );
}

interface LiveFeedProps {
  projectId: string;
  onEvent?: () => void;
}

export interface LiveActivity {
  events: number; // contagem rolling 15min
}

export function useFunnelLiveActivity(projectId: string): { count: number; recent: string[] } {
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const recentRef = useRef<{ at: number; label: string }[]>([]);

  useEffect(() => {
    if (!projectId) { setCount(0); setRecent([]); return; }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    let cancel = false;

    (async () => {
      const { count: c } = await supabase
        .from("imphq_funnel_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("created_at", since);
      if (!cancel) setCount(c || 0);
    })();

    const ch = supabase
      .channel(`funnel-live-${projectId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "imphq_funnel_events", filter: `project_id=eq.${projectId}` },
        (payload: any) => {
          const row = payload.new || {};
          const label = `${row.step || "evento"} · ${(row.utm_source || row.utm_campaign || "direto").slice(0, 18)}`;
          recentRef.current = [{ at: Date.now(), label }, ...recentRef.current].slice(0, 8);
          setRecent(recentRef.current.map(r => r.label));
          setCount(c => c + 1);
        })
      .subscribe();

    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 15 * 60 * 1000;
      recentRef.current = recentRef.current.filter(r => r.at >= cutoff);
    }, 30000);

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
      clearInterval(cleanup);
    };
  }, [projectId]);

  return { count, recent };
}

export function LiveActivityFeed({ recent, onClose }: { recent: string[]; onClose: () => void }) {
  if (recent.length === 0) return null;
  return (
    <div data-ui className="absolute bottom-3 right-3 z-20 w-[260px] rounded-lg border border-rose-500/40 bg-[#0a0608]/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-rose-300 animate-pulse" />
          <span className="text-[10px] uppercase tracking-wider text-rose-200">Atividade ao vivo</span>
        </div>
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>
      <div className="max-h-[180px] overflow-y-auto p-2 space-y-1">
        {recent.map((r, i) => (
          <div key={i} className="text-[10px] font-mono text-foreground/80 truncate">{r}</div>
        ))}
      </div>
    </div>
  );
}
