import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, RotateCcw, User, Phone } from "lucide-react";
import { toast } from "sonner";

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
  const [leads, setLeads] = useState<Record<string, { nome: string; phone: string }>>({});
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadExecs = async () => {
    const { data } = await supabase.from("imphq_flow_executions").select("*").order("created_at", { ascending: false }).limit(50);
    const execs = data || [];
    setExecutions(execs);

    // Load lead names for executions that have lead_id
    const leadIds = [...new Set(execs.map((e: any) => e.lead_id).filter(Boolean))];
    if (leadIds.length > 0) {
      const { data: leadRows } = await supabase.from("imphq_leads").select("id, nome, phone").in("id", leadIds);
      const map: Record<string, { nome: string; phone: string }> = {};
      (leadRows || []).forEach((l: any) => { map[l.id] = { nome: l.nome || "", phone: l.phone || "" }; });
      setLeads(map);
    }
  };

  useEffect(() => { loadExecs(); }, []);

  const autoName = (id: string) => automacoes.find(a => a.id === id)?.nome || id?.slice(0, 8);
  const projName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const waitingCount = executions.filter(e => e.status === "waiting").length;

  const retryExecution = async (exec: any) => {
    setRetrying(exec.id);
    try {
      // Find matching automacao_log to get trigger_data
      const { data: logData } = await supabase.from("imphq_automacao_logs" as any)
        .select("trigger_data")
        .eq("automacao_id", exec.automacao_id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      const triggerData = (logData?.[0] as any)?.trigger_data || {};
      
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: exec.trigger_tipo,
          project_id: exec.project_id,
          automacao_id: exec.automacao_id,
          lead_data: triggerData,
        },
      });
      if (error) throw error;
      toast[data?.ok ? "success" : "error"](data?.ok ? "Reenvio executado!" : (data?.error || "Erro"));
      loadExecs();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setRetrying(null);
    }
  };

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
          const lead = exec.lead_id ? leads[exec.lead_id] : null;

          return (
            <Card key={exec.id} className="bg-card border-border cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setExpandedId(isExpanded ? null : exec.id)}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[9px] ${sc.className}`}>
                      <StatusIcon className={`h-3 w-3 mr-1 ${exec.status === "running" ? "animate-spin" : ""}`} />
                      {sc.label}
                    </Badge>
                    <span className="text-xs font-medium">{autoName(exec.automacao_id)}</span>
                    {exec.project_id && <Badge variant="outline" className="text-[9px]">{projName(exec.project_id)}</Badge>}
                    {lead && (
                      <Badge variant="secondary" className="text-[9px] gap-1">
                        <User className="h-2.5 w-2.5" /> {lead.nome || "—"}
                        {lead.phone && <><Phone className="h-2.5 w-2.5 ml-1" /> {lead.phone}</> }
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(exec.status === "failed" || exec.status === "completed") && (
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        title="Reenviar execução"
                        onClick={(e) => { e.stopPropagation(); retryExecution(exec); }}
                        disabled={retrying === exec.id}
                      >
                        {retrying === exec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                    )}
                    <span className="text-[10px] text-muted-foreground">{new Date(exec.created_at).toLocaleString("pt-BR")}</span>
                  </div>
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
                      <div key={i} className="p-2 rounded bg-secondary/50 text-[10px] space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[8px]">#{step.step ?? i}</Badge>
                          <span className="font-medium">{step.tipo || "step"}</span>
                          <Badge className={`text-[8px] ${step.status === "sent" || step.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : step.status === "error" ? "bg-red-500/20 text-red-400" : step.status === "skipped" ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                            {step.status}
                          </Badge>
                          {step.finished_at && <span className="text-muted-foreground ml-auto">{new Date(step.finished_at).toLocaleTimeString("pt-BR")}</span>}
                        </div>
                        {step.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-2.5 w-2.5" /> {step.phone}
                          </div>
                        )}
                        {step.provider_id && (
                          <div className="text-muted-foreground">📱 Provider: {step.provider_id.slice(0, 12)}…</div>
                        )}
                        {step.message_preview && (
                          <div className="text-muted-foreground italic truncate">"{step.message_preview}"</div>
                        )}
                        {step.reason && <div className="text-amber-400">⚠ {step.reason}</div>}
                        {step.response && !step.response.success && step.response.error && (
                          <div className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">❌ {step.response.error}</div>
                        )}
                        {step.response?.success && step.response?.message_id && (
                          <div className="text-emerald-400">✓ ID: {step.response.message_id}</div>
                        )}
                        {step.resend_id && (
                          <div className="text-emerald-400">✉ Resend: {step.resend_id}</div>
                        )}
                        {step.condition_met !== undefined && (
                          <div className="text-muted-foreground">Condição: {step.condition_met ? "✅ verdadeira" : "❌ falsa"}{step.skipped_steps ? ` (pulou ${step.skipped_steps} etapas)` : ""}</div>
                        )}
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
