import { useState, useEffect, useMemo } from "react";
import { Crown, Loader2, Sparkles, AlertTriangle, TrendingUp, Target, Calendar, ShieldAlert, ChevronRight, History, RefreshCw, CheckCircle2, Circle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type ActionStatus = "todo" | "doing" | "done" | "skip";
function hashAction(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return "a" + Math.abs(h).toString(36);
}
const statusOrder: ActionStatus[] = ["todo", "doing", "done", "skip"];
const statusMeta: Record<ActionStatus, { icon: any; cls: string; label: string }> = {
  todo:  { icon: Circle,        cls: "text-muted-foreground",          label: "A fazer" },
  doing: { icon: Loader2,       cls: "text-amber-400",                 label: "Em andamento" },
  done:  { icon: CheckCircle2,  cls: "text-emerald-400",               label: "Feito" },
  skip:  { icon: XCircle,       cls: "text-zinc-500 line-through",     label: "Descartado" },
};

interface SalesPathButtonProps {
  projectId: string;
  projectName?: string;
}

interface SalesPath {
  id?: string;
  resumo_executivo: string;
  health_score: number;
  diagnostico: any[];
  oportunidades: any[];
  acoes_72h: any[];
  acoes_30d: any[];
  sales_path: { trafego: string; captura: string; nutricao: string; oferta: string; upsell: string };
  riscos: string[];
  model_used?: string;
  created_at?: string;
  progress?: Record<string, ActionStatus>;
}

const severidadeColor: Record<string, string> = {
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  media: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  baixa: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
const prioridadeColor: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300 border-red-500/40",
  P1: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  P2: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

function formatBRL(n: number) {
  return n?.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) || "—";
}

export function SalesPathButton({ projectId, projectName }: SalesPathButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SalesPath | null>(null);
  const [history, setHistory] = useState<SalesPath[]>([]);
  const [view, setView] = useState<"plan" | "history">("plan");

  const loadHistory = async () => {
    const { data } = await supabase
      .from("imphq_sales_paths")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as any) || []);
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open, projectId]);

  const generate = async () => {
    setLoading(true);
    setPlan(null);
    setView("plan");
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("sales-path-engine", { body: { projectId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const pathId = data?.id;
      if (!pathId) throw new Error("Engine não retornou id do plano");

      toast.info("Imperius está analisando... (pode levar 1-3 min)", { duration: 4000 });

      // Polling do registro até status ready/failed (max 8 min)
      const start = Date.now();
      const MAX_MS = 8 * 60 * 1000;
      while (Date.now() - start < MAX_MS) {
        await new Promise((r) => setTimeout(r, 4000));
        const { data: row } = await supabase
          .from("imphq_sales_paths")
          .select("*")
          .eq("id", pathId)
          .maybeSingle();
        if (!row) continue;
        if (row.status === "ready") {
          setPlan(row as any);
          loadHistory();
          toast.success("Plano de Ataque pronto.");
          return;
        }
        if (row.status === "failed") {
          throw new Error((row as any).error_message || "Falha ao gerar plano");
        }
      }
      throw new Error("Timeout: análise demorou mais de 8 minutos");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar plano");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openExisting = (item: SalesPath) => {
    setPlan(item);
    setView("plan");
  };

  const healthLabel = (s: number) => (s >= 75 ? "Saudável" : s >= 50 ? "Atenção" : s >= 25 ? "Crítico" : "Emergência");
  const healthColor = (s: number) => (s >= 75 ? "text-emerald-400" : s >= 50 ? "text-yellow-400" : "text-red-400");

  const allActionKeys = useMemo(() => {
    if (!plan) return [] as string[];
    const list = [...(plan.acoes_72h || []), ...(plan.acoes_30d || [])];
    return list.map((a: any) => hashAction(String(a?.acao || "")));
  }, [plan]);

  const progressStats = useMemo(() => {
    const total = allActionKeys.length;
    const prog = plan?.progress || {};
    const done = allActionKeys.filter((k) => prog[k] === "done").length;
    const doing = allActionKeys.filter((k) => prog[k] === "doing").length;
    const skip = allActionKeys.filter((k) => prog[k] === "skip").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, skip, pct };
  }, [allActionKeys, plan?.progress]);

  const planAgeDays = plan?.created_at ? (Date.now() - new Date(plan.created_at).getTime()) / 86400000 : 999;
  const canRenew = !plan || progressStats.pct >= 70 || planAgeDays >= 14;

  const cycleStatus = async (key: string) => {
    if (!plan?.id) return;
    const cur = (plan.progress || {})[key] || "todo";
    const next = statusOrder[(statusOrder.indexOf(cur) + 1) % statusOrder.length];
    const newProgress = { ...(plan.progress || {}), [key]: next };
    setPlan({ ...plan, progress: newProgress });
    const { error } = await supabase.from("imphq_sales_paths").update({ progress: newProgress }).eq("id", plan.id);
    if (error) toast.error("Falha ao salvar progresso");
  };


  return (
    <>
      <Button
        onClick={() => { setOpen(true); setView(history.length > 0 || plan ? "plan" : "plan"); }}
        disabled={loading}
        className="gap-2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 border border-primary/40"
        size="sm"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
        Botão Imperador
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-secondary/40 backdrop-blur border-l border-primary/20 overflow-hidden flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <SheetTitle className="font-display text-2xl">Plano de Ataque de Vendas</SheetTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={view === "plan" ? "secondary" : "ghost"} className="gap-1.5 h-8 text-xs" onClick={() => setView("plan")}>
                  <Sparkles className="h-3 w-3" /> Plano
                </Button>
                <Button size="sm" variant={view === "history" ? "secondary" : "ghost"} className="gap-1.5 h-8 text-xs" onClick={() => setView("history")}>
                  <History className="h-3 w-3" /> Histórico ({history.length})
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={generate}
                  disabled={loading || !canRenew}
                  title={!canRenew ? `Conclua mais ações antes de regenerar (${progressStats.pct}% feito, ${Math.round(planAgeDays)}d)` : "Gerar novo plano"}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Gerar
                </Button>
              </div>
            </div>
            <SheetDescription className="text-muted-foreground">
              {projectName ? `Projeto: ${projectName}` : "Diagnóstico estratégico do projeto"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {view === "history" && (
              <div className="space-y-2">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-12">Nenhuma análise salva ainda.</p>
                )}
                {history.map((h) => (
                  <Card key={h.id} className="bg-secondary/40 border-border/40 cursor-pointer hover:border-primary/40 transition" onClick={() => openExisting(h)}>
                    <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-mono font-bold ${healthColor(h.health_score)}`}>{h.health_score}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{healthLabel(h.health_score)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {h.created_at ? formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR }) : "—"} · {h.model_used?.split("/").pop() || "—"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {view === "plan" && loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Imperius está coletando dados do funil, ads, leads e cruzando com o avatar...
                </p>
              </div>
            )}

            {view === "plan" && !loading && !plan && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <Crown className="h-12 w-12 text-primary/40" />
                <p className="text-sm text-muted-foreground max-w-xs">
                  Clique em <strong>Gerar</strong> para criar um novo Plano de Ataque, ou abra o <strong>Histórico</strong> para ver análises anteriores.
                </p>
              </div>
            )}

            {view === "plan" && plan && !loading && (
              <div className="space-y-4">
                <Card className="bg-secondary/60 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-normal">
                      <Sparkles className="h-4 w-4 text-primary" /> Saúde do Negócio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className={`text-4xl font-mono font-bold ${healthColor(plan.health_score)}`}>{plan.health_score}</span>
                      <span className="text-sm text-muted-foreground">/100 — {healthLabel(plan.health_score)}</span>
                    </div>
                    <Progress value={plan.health_score} className="h-2" />
                    <p className="text-sm text-foreground/90 leading-7 mt-4">{plan.resumo_executivo}</p>
                  </CardContent>
                </Card>

                <Tabs defaultValue="acoes_72h" className="w-full">
                  <TabsList className="bg-secondary/60 grid grid-cols-5 w-full">
                    <TabsTrigger value="acoes_72h" className="text-xs">72h</TabsTrigger>
                    <TabsTrigger value="diagnostico" className="text-xs">Diagnóstico</TabsTrigger>
                    <TabsTrigger value="oportunidades" className="text-xs">Alavancas</TabsTrigger>
                    <TabsTrigger value="caminho" className="text-xs">Caminho</TabsTrigger>
                    <TabsTrigger value="30d" className="text-xs">30 dias</TabsTrigger>
                  </TabsList>

                  <TabsContent value="acoes_72h" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> O que fazer nas próximas 72h</h3>
                    {plan.acoes_72h?.map((a: any, i: number) => (
                      <Card key={i} className="bg-secondary/40 border-border/40">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-foreground leading-6 text-sm">{a.acao}</p>
                            <Badge variant="outline" className={prioridadeColor[a.prioridade] || ""}>{a.prioridade}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-6">→ {a.resultado_esperado}</p>
                          <Badge variant="secondary" className="text-[10px] uppercase">{a.responsavel_sugerido}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="diagnostico" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Onde está sangrando</h3>
                    {plan.diagnostico?.map((d: any, i: number) => (
                      <Card key={i} className={`bg-secondary/40 border ${severidadeColor[d.severidade] || ""}`}>
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{d.area}</Badge>
                              <Badge variant="outline" className={`text-[10px] ${severidadeColor[d.severidade]}`}>{d.severidade}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-foreground leading-7">{d.problema}</p>
                          <p className="text-xs text-muted-foreground leading-6 italic">📊 {d.evidencia}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="oportunidades" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Alavancas mapeadas</h3>
                    {plan.oportunidades?.map((o: any, i: number) => (
                      <Card key={i} className="bg-secondary/40 border-border/40">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-foreground text-sm leading-6">{o.titulo}</p>
                            <Badge variant="outline" className="text-[10px]">esforço: {o.esforco}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-7">{o.alavanca}</p>
                          {o.impacto_estimado_brl > 0 && (
                            <p className="text-xs text-emerald-400 font-mono">+{formatBRL(o.impacto_estimado_brl)}/mês estimado</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="caminho" className="mt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-primary" /> Caminho de Vendas Recomendado</h3>
                    {(["trafego", "captura", "nutricao", "oferta", "upsell"] as const).map((k) => (
                      <Card key={k} className="bg-secondary/40 border-border/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs uppercase text-primary tracking-wider font-semibold">{k}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground leading-7">{plan.sales_path?.[k]}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="30d" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Sequência estratégica 30 dias</h3>
                    {[1, 2, 3, 4].map((semana) => {
                      const acoes = (plan.acoes_30d || []).filter((a: any) => a.semana === semana);
                      if (acoes.length === 0) return null;
                      return (
                        <Card key={semana} className="bg-secondary/40 border-border/40">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs uppercase text-primary tracking-wider font-semibold">Semana {semana}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {acoes.map((a: any, i: number) => (
                              <div key={i} className="border-l-2 border-primary/40 pl-3">
                                <p className="text-sm text-foreground leading-6">{a.acao}</p>
                                <p className="text-xs text-muted-foreground leading-6 mt-1">🎯 {a.objetivo}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </TabsContent>
                </Tabs>

                {plan.riscos && plan.riscos.length > 0 && (
                  <Card className="bg-red-500/5 border-red-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-400 font-semibold">
                        <ShieldAlert className="h-4 w-4" /> Riscos se nada for feito
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {plan.riscos.map((r, i) => (
                          <li key={i} className="text-sm text-foreground/90 leading-7 flex gap-2">
                            <span className="text-red-400">→</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-muted-foreground">
                    Modelo: {plan.model_used || "—"}
                    {plan.created_at && ` · ${formatDistanceToNow(new Date(plan.created_at), { addSuffix: true, locale: ptBR })}`}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
