import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowRight, Crown } from "lucide-react";

interface NextAction {
  id: string;
  title: string;
  reason: string | null;
  kind: string;
  risk_level: string;
  impact_brl: number | null;
  priority_score: number | null;
  projeto_id: string | null;
}

interface Props { projectId?: string }

/**
 * NextActionCard — A ÚNICA ação que o Imperius recomenda agora.
 * Pega de imphq_ai_actions com status='pending' ordenado por priority_score desc.
 * Foco: redução de fricção. 1 card, 1 CTA, 1 segundo de decisão.
 */
export default function NextActionCard({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<NextAction | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("imphq_ai_actions")
        .select("id, title, reason, kind, risk_level, impact_brl, priority_score, projeto_id")
        .eq("status", "pending")
        .order("priority_score", { ascending: false, nullsFirst: false })
        .order("impact_brl", { ascending: false, nullsFirst: false })
        .limit(1);
      if (projectId && projectId !== "all") q = q.eq("projeto_id", projectId);
      const { data } = await q;
      if (!mounted) return;
      setAction((data?.[0] as NextAction) || null);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    );
  }

  if (!action) return null;

  const impact = action.impact_brl
    ? `R$ ${Number(action.impact_brl).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
    : null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent hover:border-primary/60 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs uppercase tracking-wider text-primary font-semibold">Próxima Ação · Imperius</span>
              {impact && <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">{impact} em jogo</Badge>}
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">{action.title}</h3>
            {action.reason && <p className="text-xs text-muted-foreground leading-5 line-clamp-2">{action.reason}</p>}
          </div>
          <Link to="/imperius" aria-label="Abrir Imperius para ver detalhes da ação">
            <Button size="sm" className="shrink-0">
              Ver <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
