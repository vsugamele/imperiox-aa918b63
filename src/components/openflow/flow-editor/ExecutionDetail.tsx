import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle, Loader2, User, Phone, Zap, PlayCircle, StopCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { LiveExecution } from "./useFlowNodeStats";
import type { Acao } from "../FlowEditor";

interface Props {
  executionId: string | null;
  acoes: Acao[];
  onClose: () => void;
  onFocusStep?: (idx: number) => void;
}

const stepIcon = (status?: string) => {
  if (!status) return <Clock className="h-3.5 w-3.5 text-slate-400" />;
  if (["completed", "sent", "success", "guided_ai_completed"].includes(status)) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (["error", "failed"].includes(status)) return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
  if (["running", "waiting", "waiting_for_lead_response", "delayed_for_condition"].includes(status)) return <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />;
  return <Clock className="h-3.5 w-3.5 text-slate-400" />;
};

export function ExecutionDetail({ executionId, acoes, onClose, onFocusStep }: Props) {
  const [exec, setExec] = useState<LiveExecution | null>(null);
  const [lead, setLead] = useState<{ nome?: string; phone?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!executionId) { setExec(null); setLead(null); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_flow_executions")
        .select("id, automacao_id, project_id, lead_id, status, current_step, next_run_at, error_message, created_at, updated_at, step_results")
        .eq("id", executionId)
        .maybeSingle();
      setExec((data as LiveExecution) || null);
      if (data?.lead_id) {
        const { data: l } = await supabase.from("imphq_leads").select("nome, phone").eq("id", data.lead_id).maybeSingle();
        setLead(l || null);
      }
      setLoading(false);
    })();
  }, [executionId]);

  const resume = async () => {
    if (!exec) return;
    setActing(true);
    try {
      const { error } = await supabase.functions.invoke("openflow-resume", { body: { execution_id: exec.id } });
      if (error) throw error;
      toast.success("Execução retomada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao retomar");
    } finally { setActing(false); }
  };

  const cancel = async () => {
    if (!exec) return;
    setActing(true);
    try {
      const { error } = await supabase
        .from("imphq_flow_executions")
        .update({ status: "cancelled", error_message: "Cancelada manualmente" })
        .eq("id", exec.id);
      if (error) throw error;
      toast.success("Execução cancelada");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao cancelar");
    } finally { setActing(false); }
  };

  const replayFrom = async (fromStep: number) => {
    if (!exec) return;
    setActing(true);
    try {
      const { error } = await supabase.functions.invoke("flow-execution-replay", {
        body: { execution_id: exec.id, from_step: fromStep },
      });
      if (error) throw error;
      toast.success(`Replay a partir do step #${fromStep}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha no replay");
    } finally { setActing(false); }
  };

  const durationMs = exec ? new Date(exec.updated_at).getTime() - new Date(exec.created_at).getTime() : 0;
  const fmtDuration = (ms: number) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.round(s / 60)}min`;
    return `${(s / 3600).toFixed(1)}h`;
  };

  return (
    <Sheet open={!!executionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] bg-slate-950/95 border-white/10 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Execução</SheetTitle>
        </SheetHeader>

        {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</div>}

        {exec && (
          <div className="space-y-4 mt-4">
            <div className="rounded-xl border border-white/10 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] font-mono">{exec.status}</Badge>
                <span className="text-[10px] text-muted-foreground">{fmtDuration(durationMs)}</span>
              </div>
              {(lead?.nome || lead?.phone) && (
                <div className="flex items-center gap-3 text-[11px] text-slate-300">
                  {lead?.nome && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {lead.nome}</span>}
                  {lead?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground font-mono">
                Passo atual: #{exec.current_step ?? 0}
                {exec.next_run_at && ` · retomar ${new Date(exec.next_run_at).toLocaleString("pt-BR")}`}
              </div>
              {exec.error_message && <p className="text-[11px] text-rose-300 leading-snug">{exec.error_message}</p>}

              <div className="flex gap-2 pt-1">
                {(exec.status === "waiting" || exec.status === "failed") && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={resume} className="h-7 text-[11px] gap-1">
                    <PlayCircle className="h-3 w-3" /> Retomar
                  </Button>
                )}
                {(exec.status === "running" || exec.status === "waiting") && (
                  <Button size="sm" variant="outline" disabled={acting} onClick={cancel} className="h-7 text-[11px] gap-1 text-rose-300 border-rose-500/30 hover:bg-rose-500/10">
                    <StopCircle className="h-3 w-3" /> Cancelar
                  </Button>
                )}
                {onFocusStep && exec.current_step !== null && (
                  <Button size="sm" variant="outline" onClick={() => { onFocusStep(exec.current_step!); onClose(); }} className="h-7 text-[11px] gap-1">
                    <Zap className="h-3 w-3" /> Ver no canvas
                  </Button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-widest">Timeline</p>
              <ol className="space-y-2">
                {(exec.step_results || []).map((sr: any, i: number) => {
                  const idx = typeof sr.step === "number" ? sr.step : i;
                  const acao = acoes[idx];
                  return (
                    <li key={i} className="rounded-lg border border-white/5 bg-background/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-slate-200">
                          {stepIcon(sr.status)}
                          <span className="font-mono text-[10px] text-muted-foreground">#{idx}</span>
                          <span className="font-medium">{acao?.tipo || sr.tipo || "step"}</span>
                        </div>
                        {sr.timestamp && <span className="text-[9px] text-muted-foreground font-mono">{new Date(sr.timestamp).toLocaleTimeString("pt-BR")}</span>}
                      </div>
                      {sr.detail && <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{typeof sr.detail === "string" ? sr.detail : JSON.stringify(sr.detail).slice(0, 200)}</p>}
                      {sr.error && <p className="text-[10px] text-rose-300 mt-1 leading-snug">{String(sr.error).slice(0, 200)}</p>}
                      <div className="flex justify-end mt-1.5">
                        <Button size="sm" variant="ghost" disabled={acting} onClick={() => replayFrom(idx)} className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-slate-100">
                          <RotateCcw className="h-3 w-3" /> Replay daqui
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {(!exec.step_results || exec.step_results.length === 0) && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">Sem passos executados ainda.</p>
                )}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
