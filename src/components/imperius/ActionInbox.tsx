import { useEffect, useState } from "react";
import { Bot, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AIAction = {
  id: string;
  kind: string;
  risk_level: "low" | "medium" | "high";
  status: string;
  confidence: number;
  title: string;
  reason: string | null;
  payload: any;
  auto_executed: boolean;
  executed_at: string | null;
  error: string | null;
  projeto_id: string | null;
  created_at: string;
  impact_brl: number | null;
  priority_score: number | null;
};

const fmtBRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const riskColor = (r: string) =>
  r === "high" ? "bg-red-500/15 text-red-400 border-red-500/30" :
  r === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

export function ActionInbox() {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = actions.filter((a) => a.status === "proposed").length;
  const totalImpact = actions
    .filter((a) => a.status === "proposed")
    .reduce((s, a) => s + Number(a.impact_brl || 0), 0);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("imphq_ai_actions")
      .select("id, kind, risk_level, status, confidence, title, reason, payload, auto_executed, executed_at, error, projeto_id, created_at, impact_brl, priority_score")
      .or(`status.eq.proposed,executed_at.gte.${since}`)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setActions((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime: recebe novas ações da IA instantaneamente (sem polling agressivo)
    const ch = supabase
      .channel("action_inbox_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_ai_actions" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "imphq_ai_actions" }, load)
      .subscribe();
    const i = setInterval(load, 5 * 60_000); // safety fallback a cada 5min
    return () => { clearInterval(i); supabase.removeChannel(ch); };
  }, []);

  const handle = async (a: AIAction, mode: "execute" | "revert" | "reject") => {
    setBusyId(a.id);
    try {
      if (mode === "reject") {
        await supabase.from("imphq_ai_actions").update({ status: "rejected" }).eq("id", a.id);
        toast.success("Ação rejeitada");
      } else {
        const { data, error } = await supabase.functions.invoke("imperius-executor", {
          body: { action_id: a.id, mode },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Falhou");
        const redirect = data?.result?.redirect;
        if (mode === "execute" && a.kind === "createFlow" && redirect) {
          toast.success("Draft criado!", {
            action: { label: "Abrir em OpenFlow", onClick: () => { window.location.href = redirect; } },
            duration: 8000,
          });
        } else {
          toast.success(mode === "revert" ? "Ação revertida" : "Ação executada");
        }
      }
      await load();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  };


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary">
          <Bot className="h-5 w-5" />
          {pending > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {pending}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-secondary/40 backdrop-blur-xl border-border">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
            <Bot className="h-5 w-5 text-primary" /> Imperius — Fila de Ações
          </SheetTitle>
          {totalImpact > 0 && (
            <p className="text-xs text-amber-400 font-medium mt-1">🔥 {fmtBRL(totalImpact)} em jogo</p>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-3">
          {loading && actions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma ação no momento.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((a) => (
                <div key={a.id} className="border border-border rounded-lg p-3 bg-background/40 leading-7">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {a.kind === "createFlow" && (
                        <Badge variant="outline" className="text-[9px] uppercase mb-1 bg-violet-500/15 text-violet-300 border-violet-500/30">
                          Nova Automação Sugerida
                        </Badge>
                      )}
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      {a.reason && <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>}
                      {a.kind === "createFlow" && a.payload?.pattern_evidence?.estimated_recovery && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                            📈 {a.payload.pattern_evidence.estimated_recovery}
                          </Badge>
                          {a.payload.pattern_evidence.metric && (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30">
                              {a.payload.pattern_evidence.metric}
                            </Badge>
                          )}
                        </div>
                      )}
                      {a.kind === "createFlow" && Array.isArray(a.payload?.acoes) && (
                        <div className="mt-2 space-y-1 pl-2 border-l border-violet-500/30">
                          {a.payload.acoes.map((step: any, i: number) => (
                            <p key={i} className="text-[11px] text-muted-foreground">
                              <span className="text-violet-300 font-mono">{i + 1}.</span>{" "}
                              <span className="uppercase tracking-wider text-[10px]">{step.tipo}</span>
                              {step.delay_min > 0 && <span className="text-foreground/60"> · aguardar {step.delay_min}min</span>}
                              {step.template && <span className="text-foreground/70"> — "{String(step.template).slice(0, 60)}{String(step.template).length > 60 ? "…" : ""}"</span>}
                            </p>
                          ))}
                        </div>
                      )}

                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] uppercase ${riskColor(a.risk_level)}`}>
                        {a.risk_level}
                      </Badge>
                      {Number(a.impact_brl || 0) > 0 && (
                        <span className="text-[10px] font-mono text-amber-400">{fmtBRL(Number(a.impact_brl))}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}</span>
                      <span>•</span>
                      <span className="font-mono">{Math.round(a.confidence * 100)}%</span>
                      {a.auto_executed && <Badge variant="secondary" className="text-[9px]">AUTO</Badge>}
                      {a.status === "executed" && <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400">Executada</Badge>}
                      {a.status === "failed" && <Badge variant="secondary" className="text-[9px] bg-red-500/15 text-red-400">Falhou</Badge>}
                      {a.status === "reverted" && <Badge variant="secondary" className="text-[9px]">Revertida</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {a.status === "proposed" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" disabled={busyId === a.id} onClick={() => handle(a, "reject")}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" className="h-7 px-2" disabled={busyId === a.id} onClick={() => handle(a, "execute")}>
                            {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            <span className="ml-1 text-xs">{a.kind === "createFlow" ? "Criar Draft" : "Aprovar"}</span>
                          </Button>

                        </>
                      )}
                      {a.status === "executed" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" disabled={busyId === a.id} onClick={() => handle(a, "revert")}>
                          {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          <span className="ml-1 text-xs">Reverter</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {a.error && <p className="text-[11px] text-red-400 mt-2">{a.error}</p>}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
