import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, XCircle, Clock, CheckCircle2, Radio } from "lucide-react";
import type { LiveExecution } from "./useFlowNodeStats";
import type { Acao } from "../FlowEditor";
import { ExecutionDetail } from "./ExecutionDetail";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  executions: LiveExecution[];
  summary: { running: number; waiting: number; failed: number; completed: number; total: number };
  acoes: Acao[];
  loading: boolean;
  onFocusStep?: (idx: number) => void;
}

const statusMeta: Record<string, { label: string; className: string; icon: any }> = {
  running: { label: "Rodando", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: Loader2 },
  waiting: { label: "Aguardando", className: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: Clock },
  failed: { label: "Falha", className: "bg-rose-500/15 text-rose-300 border-rose-500/40", icon: XCircle },
  completed: { label: "Concluída", className: "bg-slate-500/15 text-slate-300 border-slate-500/40", icon: CheckCircle2 },
  success: { label: "Sucesso", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", className: "bg-slate-500/15 text-slate-400 border-slate-500/40", icon: XCircle },
};

function fmtAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function LivePanel({ open, onOpenChange, executions, summary, acoes, loading, onFocusStep }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useMemo(
    () => executions.filter(e => e.status === "running" || e.status === "waiting").slice(0, 30),
    [executions]
  );
  const failures = useMemo(
    () => executions.filter(e => e.status === "failed").slice(0, 20),
    [executions]
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[440px] bg-slate-950/95 border-white/10 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-100 flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" /> Ao Vivo
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-4 gap-2 mt-4">
            <Kpi label="Rodando" value={summary.running} className="text-emerald-400" />
            <Kpi label="Esperando" value={summary.waiting} className="text-amber-400" />
            <Kpi label="Falhas" value={summary.failed} className="text-rose-400" />
            <Kpi label="OK" value={summary.completed} className="text-slate-300" />
          </div>

          {loading && <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4"><Loader2 className="h-3 w-3 animate-spin" /> Sincronizando…</div>}

          <Section title="Ativas agora" count={active.length}>
            {active.length === 0 && <Empty>Nenhuma execução ativa.</Empty>}
            {active.map(exec => {
              const acao = exec.current_step !== null ? acoes[exec.current_step] : null;
              const meta = statusMeta[exec.status] || statusMeta.completed;
              const Icon = meta.icon;
              return (
                <button
                  key={exec.id}
                  onClick={() => setSelectedId(exec.id)}
                  className="w-full text-left rounded-lg border border-white/5 bg-background/40 hover:bg-background/70 p-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
                      <Icon className={`h-2.5 w-2.5 mr-1 ${exec.status === "running" ? "animate-spin" : ""}`} /> {meta.label}
                    </Badge>
                    <span className="text-[9px] font-mono text-muted-foreground">{fmtAgo(exec.updated_at)}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 mt-1 truncate">
                    #{exec.current_step ?? 0} · {acao?.tipo || "—"}
                  </p>
                  {exec.next_run_at && (
                    <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                      retomar {new Date(exec.next_run_at).toLocaleTimeString("pt-BR")}
                    </p>
                  )}
                </button>
              );
            })}
          </Section>

          <Section title="Últimas quedas" count={failures.length}>
            {failures.length === 0 && <Empty>Sem falhas recentes 🎉</Empty>}
            {failures.map(exec => (
              <button
                key={exec.id}
                onClick={() => setSelectedId(exec.id)}
                className="w-full text-left rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 p-2.5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-rose-300 font-medium">Falha no passo #{exec.current_step ?? 0}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{fmtAgo(exec.updated_at)}</span>
                </div>
                {exec.error_message && (
                  <p className="text-[10px] text-rose-200/80 mt-1 line-clamp-2 leading-snug">{exec.error_message}</p>
                )}
              </button>
            ))}
          </Section>
        </SheetContent>
      </Sheet>

      <ExecutionDetail
        executionId={selectedId}
        acoes={acoes}
        onClose={() => setSelectedId(null)}
        onFocusStep={onFocusStep}
      />
    </>
  );
}

function Kpi({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-secondary/30 p-2 text-center">
      <div className={`text-lg font-mono font-extrabold ${className || ""}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
          <Activity className="h-3 w-3" /> {title}
        </p>
        <span className="text-[9px] font-mono text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground text-center py-3">{children}</p>;
}
