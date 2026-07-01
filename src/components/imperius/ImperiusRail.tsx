import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ChevronRight, Loader2, Check, X, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type AIAction = {
  id: string;
  kind: string;
  risk_level: "low" | "medium" | "high";
  status: string;
  confidence: number;
  title: string;
  reason: string | null;
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
  r === "high" ? "bg-red-500/15 text-red-400 border-red-500/30"
  : r === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

// Sugestões contextuais por rota — leves, sem chamada de IA
const ROUTE_HINTS: Record<string, { title: string; cta?: string; to?: string }> = {
  dashboard: { title: "Reveja CPL e ROAS do dia.", cta: "Ver Funil", to: "/funil-conversao" },
  leads: { title: "Leads quentes em /inbox?", cta: "Abrir Inbox", to: "/inbox" },
  inbox: { title: "Crie campanha pra leads frios.", cta: "Campanhas", to: "/campanhas" },
  campanhas: { title: "Veja templates campeões.", cta: "Ver Funil", to: "/funil-conversao" },
  openflow: { title: "Pattern detection pode virar flow.", cta: "Imperius", to: "/imperius" },
  financas: { title: "Atribuição proporcional ativa.", cta: "ROAS Real", to: "/gerenciador" },
  gerenciador: { title: "CTR < 1%? Pause low.", cta: "Ver criativos", to: "/criativos" },
  imperius: { title: "Você já tá na fonte da decisão.", cta: "Dashboard", to: "/dashboard" },
};

const RAIL_LS_KEY = "imphq.imperius.rail.open";
const RAIL_VISIBLE_KEY = "imphq.imperius.rail.visible";

export function ImperiusRail() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_LS_KEY) === "1"; } catch { return false; }
  });
  const [visible, setVisible] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_VISIBLE_KEY) !== "0"; } catch { return true; }
  });
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const routeKey = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const hint = ROUTE_HINTS[routeKey];

  const pending = useMemo(() => actions.filter((a) => a.status === "proposed"), [actions]);
  const totalImpact = useMemo(
    () => pending.reduce((s, a) => s + Number(a.impact_brl || 0), 0),
    [pending]
  );
  const hasHigh = pending.some((a) => a.risk_level === "high" || Number(a.impact_brl || 0) > 1000);

  useEffect(() => { try { localStorage.setItem(RAIL_LS_KEY, open ? "1" : "0"); } catch {} }, [open]);
  useEffect(() => { try { localStorage.setItem(RAIL_VISIBLE_KEY, visible ? "1" : "0"); } catch {} }, [visible]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("imphq_ai_actions")
      .select("id, kind, risk_level, status, confidence, title, reason, auto_executed, executed_at, error, projeto_id, created_at, impact_brl, priority_score")
      .or(`status.eq.proposed,executed_at.gte.${since}`)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setActions((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("imperius_rail_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_ai_actions" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "imphq_ai_actions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handle = async (a: AIAction, mode: "execute" | "reject" | "revert") => {
    setBusyId(a.id);
    try {
      if (mode === "reject") {
        await supabase.from("imphq_ai_actions").update({ status: "rejected" }).eq("id", a.id);
        toast.success("Rejeitada");
      } else {
        const { data, error } = await supabase.functions.invoke("imperius-executor", {
          body: { action_id: a.id, mode },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Falhou");
        toast.success(mode === "revert" ? "Revertida" : "Executada");
      }
      await load();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-secondary/80 border-l border-y border-border rounded-l-md px-1.5 py-3 text-muted-foreground/60 hover:text-primary"
        title="Mostrar Imperius"
      >
        <Bot className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 transition-all",
        open ? "w-[340px]" : "w-[44px]"
      )}
    >
      {/* Collapsed pill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "h-auto py-3 rounded-l-xl rounded-r-md border bg-background/90 backdrop-blur-xl shadow-lg flex flex-col items-center gap-2 px-2 group",
            hasHigh ? "border-amber-500/40" : "border-border"
          )}
          title="Abrir Imperius"
        >
          <div className="relative">
            <Bot className={cn("h-5 w-5", hasHigh ? "text-amber-400 animate-pulse" : "text-primary/80 group-hover:text-primary")} />
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
          {totalImpact > 0 && (
            <span className="text-[9px] font-mono text-amber-400/90 [writing-mode:vertical-rl] rotate-180">
              {fmtBRL(totalImpact)}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/70 bg-secondary/40">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="h-4 w-4 text-primary shrink-0" />
              <span className="font-serif italic text-base truncate">Imperius</span>
              {pending.length > 0 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary/30 text-primary">
                  {pending.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVisible(false)}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground px-1"
                title="Esconder"
              >
                ocultar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground/70 hover:text-foreground p-1 rounded hover:bg-muted/30"
                title="Recolher"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Contextual hint */}
          {hint && (
            <div className="px-3 py-2 border-b border-border/40 bg-gold/5 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-gold shrink-0" />
              <span className="text-[11px] text-muted-foreground flex-1 truncate">{hint.title}</span>
              {hint.cta && hint.to && (
                <button
                  onClick={() => navigate(hint.to!)}
                  className="text-[10px] uppercase tracking-wider text-gold hover:text-gold-light font-medium"
                >
                  {hint.cta}
                </button>
              )}
            </div>
          )}

          {/* Actions list */}
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="p-2 space-y-2">
              {loading && actions.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : pending.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">
                  Nenhuma ação pendente. Scout segue rodando.
                </p>
              ) : (
                pending.slice(0, 8).map((a) => (
                  <div key={a.id} className="border border-border/70 rounded-md p-2 bg-secondary/30">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground leading-snug flex-1">{a.title}</p>
                      <Badge variant="outline" className={cn("text-[9px] h-4 px-1 shrink-0 uppercase", riskColor(a.risk_level))}>
                        {a.risk_level}
                      </Badge>
                    </div>
                    {a.reason && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{a.reason}</p>}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                        <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}</span>
                        {Number(a.impact_brl || 0) > 0 && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-amber-400/80">{fmtBRL(Number(a.impact_brl))}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                          disabled={busyId === a.id}
                          onClick={() => handle(a, "reject")}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2"
                          disabled={busyId === a.id}
                          onClick={() => handle(a, "execute")}
                        >
                          {busyId === a.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><Check className="h-3 w-3" /><span className="ml-1 text-[10px]">OK</span></>}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="px-3 py-1.5 border-t border-border/40 bg-secondary/20 flex items-center justify-between">
            <button
              onClick={() => navigate("/imperius")}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              Feed completo →
            </button>
            {totalImpact > 0 && (
              <span className="text-[10px] font-mono text-amber-400/90">{fmtBRL(totalImpact)} em jogo</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
