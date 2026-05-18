import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function hashAction(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return "a" + Math.abs(h).toString(36);
}

interface Props {
  projectId: string;
}

export function PlanProgressBanner({ projectId }: Props) {
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("imphq_sales_paths")
        .select("id, created_at, progress, acoes_72h, acoes_30d, health_score")
        .eq("project_id", projectId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setPlan(data);
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (!plan) return null;

  const all = [...(plan.acoes_72h || []), ...(plan.acoes_30d || [])];
  if (all.length === 0) return null;
  const prog = plan.progress || {};
  const keys = all.map((a: any) => hashAction(String(a?.acao || "")));
  const done = keys.filter((k) => prog[k] === "done").length;
  const pct = Math.round((done / keys.length) * 100);
  const age = formatDistanceToNow(new Date(plan.created_at), { addSuffix: true, locale: ptBR });

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 flex items-center gap-3">
      <Crown className="h-4 w-4 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-foreground/90">
            Plano de Ataque ativo · <span className="font-mono text-primary">{pct}%</span> executado
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {done}/{keys.length} · saúde {plan.health_score} · {age}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    </div>
  );
}
