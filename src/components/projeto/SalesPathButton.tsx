import { useState } from "react";
import { Crown, Loader2, Sparkles, AlertTriangle, CheckCircle2, TrendingUp, Target, Calendar, ShieldAlert, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const generate = async () => {
    setLoading(true);
    setPlan(null);
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("sales-path-engine", {
        body: { projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPlan(data);
      toast.success("Plano de Ataque pronto.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar plano");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const healthLabel = (s: number) => (s >= 75 ? "Saudável" : s >= 50 ? "Atenção" : s >= 25 ? "Crítico" : "Emergência");
  const healthColor = (s: number) => (s >= 75 ? "text-emerald-400" : s >= 50 ? "text-yellow-400" : "text-red-400");

  return (
    <>
      <Button
        onClick={generate}
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
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <SheetTitle className="font-display text-2xl">Plano de Ataque de Vendas</SheetTitle>
            </div>
            <SheetDescription className="text-muted-foreground">
              {projectName ? `Projeto: ${projectName}` : "Diagnóstico estratégico do projeto"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Imperius está coletando dados do funil, ads, leads e cruzando com o avatar...
                </p>
              </div>
            )}

            {plan && !loading && (
              <div className="space-y-4">
                {/* Health Score */}
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

                  {/* Ações 72h */}
                  <TabsContent value="acoes_72h" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> O que fazer nas próximas 72h</h3>
                    {plan.acoes_72h.map((a, i) => (
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

                  {/* Diagnóstico */}
                  <TabsContent value="diagnostico" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Onde está sangrando</h3>
                    {plan.diagnostico.map((d, i) => (
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

                  {/* Oportunidades */}
                  <TabsContent value="oportunidades" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Alavancas mapeadas</h3>
                    {plan.oportunidades.map((o, i) => (
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

                  {/* Caminho de Vendas */}
                  <TabsContent value="caminho" className="mt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-primary" /> Caminho de Vendas Recomendado</h3>
                    {(["trafego", "captura", "nutricao", "oferta", "upsell"] as const).map((k) => (
                      <Card key={k} className="bg-secondary/40 border-border/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs uppercase text-primary tracking-wider font-semibold">{k}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-foreground leading-7">{plan.sales_path[k]}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* 30 dias */}
                  <TabsContent value="30d" className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Sequência estratégica 30 dias</h3>
                    {[1, 2, 3, 4].map((semana) => {
                      const acoes = plan.acoes_30d.filter((a) => a.semana === semana);
                      if (acoes.length === 0) return null;
                      return (
                        <Card key={semana} className="bg-secondary/40 border-border/40">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs uppercase text-primary tracking-wider font-semibold">Semana {semana}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {acoes.map((a, i) => (
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

                {/* Riscos */}
                {plan.riscos?.length > 0 && (
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

                {/* Footer */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-muted-foreground">Modelo: {plan.model_used || "—"}</p>
                  <Button onClick={generate} variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Sparkles className="h-3 w-3" /> Gerar de novo
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
