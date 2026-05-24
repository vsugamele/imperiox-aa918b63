import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Flame, Target, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Action { label: string; route: string; icon: string }
interface Briefing { briefing_text: string; actions: Action[] }

const iconMap: Record<string, any> = { flame: Flame, target: Target, alert: AlertTriangle, trending: TrendingUp, check: CheckCircle2 };

interface Props {
  projectFilter: string;
  projectLabel?: string;
  productLabel?: string;
}

/**
 * Hero editorial — substitui PageHeader + DailyBriefing.
 * Tipografia serifada protagonista, metadata em DM Sans uppercase tracking-wide.
 */
export function DashboardHero({ projectFilter, projectLabel, productLabel }: Props) {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const projectId = projectFilter !== "all" ? projectFilter : null;

  const fetchBriefing = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (force) params.set("force", "true");
      if (projectId) params.set("project_id", projectId);
      const { data, error } = await supabase.functions.invoke(`daily-briefing?${params.toString()}`, {
        method: "GET" as any,
      });
      if (error) throw error;
      setBriefing(data?.briefing || null);
    } catch (e: any) {
      console.error("briefing error", e);
      toast({ title: "Erro ao gerar briefing", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBriefing(false); /* eslint-disable-next-line */ }, [projectFilter]);

  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="relative">
      <div className="flex items-center justify-between flex-wrap gap-3 text-[10px]">
        <div className="flex items-center gap-3 text-muted-foreground/80 uppercase tracking-[0.22em]">
          <span className="text-gold">Imperio HQ</span>
          <span>·</span>
          <span>Overview</span>
          {projectLabel && projectLabel !== "all" && (
            <>
              <span>·</span>
              <span className="text-foreground/80">{projectLabel}</span>
            </>
          )}
          {productLabel && productLabel !== "all" && (
            <>
              <span>·</span>
              <span className="text-foreground/80">{productLabel}</span>
            </>
          )}
        </div>
        <div className="font-mono text-muted-foreground/70 capitalize">{dateLabel} · {timeLabel}</div>
      </div>

      <div className="editorial-divider mt-3 mb-5" />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-9">
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : briefing?.briefing_text ? (
            <p className="font-serif italic text-2xl md:text-3xl leading-tight text-foreground">
              <span className="text-gold mr-2">“</span>
              {briefing.briefing_text}
              <span className="text-gold ml-1">”</span>
            </p>
          ) : (
            <p className="font-serif italic text-2xl text-muted-foreground">
              Sem briefing hoje. <button onClick={() => fetchBriefing(true)} className="underline decoration-gold/60 hover:text-gold">Gerar agora</button>.
            </p>
          )}
        </div>
        <div className="md:col-span-3 flex items-center justify-end gap-2 flex-wrap">
          {briefing?.actions?.slice(0, 2).map((a, i) => {
            const Icon = iconMap[a.icon] || Target;
            return (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => navigate(a.route)}
                className="border-gold/30 hover:bg-gold/10 hover:border-gold/60 text-xs"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {a.label}
              </Button>
            );
          })}
          <Button variant="ghost" size="icon" onClick={() => fetchBriefing(true)} disabled={refreshing} aria-label="Atualizar briefing" className="h-8 w-8">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </header>
  );
}

export default DashboardHero;
