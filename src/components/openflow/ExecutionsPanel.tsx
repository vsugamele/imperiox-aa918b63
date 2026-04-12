import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

interface ExecutionsPanelProps {
  automacoes: { id: string; nome: string }[];
  projects: { id: string; name: string }[];
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  running: { label: "Executando", className: "bg-blue-500/20 text-blue-400", icon: Loader2 },
  completed: { label: "Concluído", className: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "bg-red-500/20 text-red-400", icon: XCircle },
  waiting: { label: "Aguardando", className: "bg-amber-500/20 text-amber-400", icon: Clock },
};

export function ExecutionsPanel({ automacoes, projects }: ExecutionsPanelProps) {
  const [executions, setExecutions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("imphq_flow_executions" as any).select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setExecutions(data || []));
  }, []);

  const autoName = (id: string) => automacoes.find(a => a.id === id)?.nome || id?.slice(0, 8);
  const projName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const waitingCount = executions.filter(e => e.status === "waiting").length;

  if (executions.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma execução registrada</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{executions.length} execuções</Badge>
        {waitingCount > 0 && (
          <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> {waitingCount} aguardando
          </Badge>
        )}
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {executions.map(exec => {
          const sc = statusConfig[exec.status] || statusConfig.completed;
          const StatusIcon = sc.icon;
          const isExpanded = expandedId === exec.id;

          return (
            <Card key={exec.id} className="bg-card border-border cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : exec.id)}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] ${sc.className}`}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${exec.status === "running" ? "animate-spin" : ""}`} />
                      {sc.label}
                    </Badge>
                    <span className="text-xs font-medium">{autoName(exec.automacao_id)}</span>
                    {exec.project_id && <Badge variant="outline" className="text-[9px]">{projName(exec.project_id)}</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(exec.created_at).toLocaleString("pt-BR")}</span>
                </div>

                {exec.status === "waiting" && exec.next_run_at && (
                  <p className="text-[10px] text-amber-400">⏰ Próxima: {new Date(exec.next_run_at).toLocaleString("pt-BR")}</p>
                )}

                {exec.error_message && (
                  <p className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded">{exec.error_message}</p>
                )}

                {isExpanded && exec.step_results && Array.isArray(exec.step_results) && (
                  <div className="border-t border-border/30 pt-2 space-y-1">
                    {exec.step_results.map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-secondary/50 text-[10px]">
                        <Badge variant="outline" className="text-[8px]">#{step.step ?? i}</Badge>
                        <span className="font-medium">{step.tipo || "step"}</span>
                        <Badge className={`text-[8px] ${step.status === "sent" || step.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : step.status === "error" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"}`}>
                          {step.status}
                        </Badge>
                        {step.reason && <span className="text-muted-foreground">{step.reason}</span>}
                        {step.finished_at && <span className="text-muted-foreground ml-auto">{new Date(step.finished_at).toLocaleTimeString("pt-BR")}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
