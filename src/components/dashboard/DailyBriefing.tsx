import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, RefreshCw, Flame, Target, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Action { label: string; route: string; icon: string }
interface Briefing {
  id: string;
  briefing_date: string;
  briefing_text: string;
  actions: Action[];
  created_at: string;
}

const iconMap: Record<string, any> = { flame: Flame, target: Target, alert: AlertTriangle, trending: TrendingUp, check: CheckCircle2 };

export default function DailyBriefing({ projectFilter }: { projectFilter: string }) {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchBriefing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  if (loading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-lg font-bold text-primary">Briefing do Dia</h3>
              <p className="text-xs text-muted-foreground capitalize">{today}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchBriefing(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="ml-1 text-xs">Atualizar</span>
          </Button>
        </div>

        {briefing ? (
          <>
            <p className="text-sm leading-7 text-foreground/90 mb-4">{briefing.briefing_text}</p>
            <div className="flex flex-wrap gap-2">
              {briefing.actions?.map((a, i) => {
                const Icon = iconMap[a.icon] || Target;
                return (
                  <Button key={i} variant="outline" size="sm" onClick={() => navigate(a.route)} className="border-primary/30 hover:bg-primary/10 hover:border-primary/50">
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {a.label}
                  </Button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">Nenhum briefing gerado ainda hoje.</p>
            <Button onClick={() => fetchBriefing(true)} disabled={refreshing} size="sm">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Gerar agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
