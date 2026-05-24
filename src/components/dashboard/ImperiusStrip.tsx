import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Zap, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Action {
  id: string;
  title: string;
  reason: string | null;
  kind: string;
  risk_level: string;
  impact_brl: number | null;
  auto_executed: boolean | null;
  status: string;
}

interface Props { projectId?: string }

/**
 * ImperiusStrip — faixa horizontal com as 3 próximas decisões da IA.
 * Substitui o NextActionCard + ActionInbox quando dentro do Dashboard.
 */
export function ImperiusStrip({ projectId }: Props) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("imphq_ai_actions")
        .select("id, title, reason, kind, risk_level, impact_brl, auto_executed, status, projeto_id, priority_score")
        .in("status", ["pending", "proposed"])
        .order("priority_score", { ascending: false, nullsFirst: false })
        .order("impact_brl", { ascending: false, nullsFirst: false })
        .limit(3);
      if (projectId && projectId !== "all") q = q.eq("projeto_id", projectId);
      const { data } = await q;
      if (!mounted) return;
      setActions((data as any) || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando Imperius…
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <Link to="/imperius" className="flex items-center justify-between py-3 px-1 group">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold/70" />
          <span className="kicker">Imperius</span>
          <span>· nenhuma decisão pendente.</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
      </Link>
    );
  }

  return (
    <div className="flex items-stretch gap-0 group">
      <div className="flex items-center gap-2 pr-4 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-gold animate-pulse" />
        <span className="kicker">Imperius</span>
      </div>
      <div className="flex-1 flex items-stretch divide-x divide-border/60 overflow-x-auto">
        {actions.map((a) => (
          <Link
            key={a.id}
            to="/imperius"
            className="flex-1 min-w-[240px] px-4 py-2 hover:bg-secondary/30 transition-colors flex items-center gap-3"
          >
            <Zap className={`h-3.5 w-3.5 shrink-0 ${a.risk_level === "high" ? "text-amber-400" : "text-gold/70"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate leading-tight">{a.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{a.kind}</span>
                {a.auto_executed && (
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-gold/15 text-gold border-0">AUTO</Badge>
                )}
                {a.impact_brl && (
                  <span className="text-[10px] text-emerald-400/80 font-mono">
                    R$ {Number(a.impact_brl).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/imperius" className="flex items-center gap-1 px-3 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-gold transition-colors shrink-0">
        Feed <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export default ImperiusStrip;
