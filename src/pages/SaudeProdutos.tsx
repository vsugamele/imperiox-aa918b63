import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, TrendingUp, TrendingDown, DollarSign, Target, RefreshCw, Sparkles } from "lucide-react";
import { useProductHealth, type ProductHealth } from "@/hooks/useProductHealth";
import { cn } from "@/lib/utils";

function fmtMoney(v: number) {
  if (!isFinite(v)) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function tierColor(tier: ProductHealth["tier"]) {
  return tier === "alta"
    ? "border-emerald-500/40 bg-emerald-500/5"
    : tier === "media"
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-rose-500/40 bg-rose-500/5";
}

function scoreColor(score: number) {
  return score >= 70 ? "text-emerald-300" : score >= 40 ? "text-amber-300" : "text-rose-300";
}

function ProductCard({ p }: { p: ProductHealth }) {
  const [crBoost, setCrBoost] = useState([0]);    // % de melhoria no checkout_rate
  const [cpaCut, setCpaCut] = useState([0]);      // % de redução no CPA
  const [ticketUp, setTicketUp] = useState([0]); // % de aumento no ticket

  const sim = useMemo(() => {
    const crFactor = 1 + (crBoost[0] / 100);
    const cpaFactor = 1 - (cpaCut[0] / 100);
    const tkFactor = 1 + (ticketUp[0] / 100);

    const novoTicket = p.ticket * tkFactor;
    const novoCpa = p.cpa * cpaFactor;
    // se subimos conversão e mantemos investimento, vendas crescem proporcional
    const novasVendas = p.vendas * crFactor;
    const novaReceita = novasVendas * novoTicket;
    const novoLucroEstimado = novaReceita - (novasVendas * novoCpa);
    const lucroAtual = p.receita - (p.vendas * p.cpa);
    return {
      receita: novaReceita,
      lucro: novoLucroEstimado,
      deltaReceita: novaReceita - p.receita,
      deltaLucro: novoLucroEstimado - lucroAtual,
      roas: novoCpa > 0 ? novoTicket / novoCpa : 0,
    };
  }, [p, crBoost, cpaCut, ticketUp]);

  const hasSim = crBoost[0] !== 0 || cpaCut[0] !== 0 || ticketUp[0] !== 0;

  return (
    <Card className={cn("border", tierColor(p.tier))}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{p.produto}</CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">
              {p.vendas} vendas · ticket {fmtMoney(p.ticket)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={cn("text-3xl font-bold leading-none", scoreColor(p.score))}>{p.score}</div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">Receita</div>
            <div className="text-sm font-semibold">{fmtMoney(p.receita)}</div>
          </div>
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">Spend</div>
            <div className="text-sm font-semibold">{fmtMoney(p.spend)}</div>
          </div>
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">ROAS</div>
            <div className={cn("text-sm font-semibold", p.roas >= 3 ? "text-emerald-300" : p.roas >= 1.5 ? "text-amber-300" : "text-rose-300")}>
              {p.roas.toFixed(2)}x
            </div>
          </div>
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">CPA</div>
            <div className="text-sm font-semibold">{p.cpa > 0 ? fmtMoney(p.cpa) : "—"}</div>
          </div>
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">Checkout→Venda</div>
            <div className="text-sm font-semibold">{p.checkout_rate.toFixed(1)}%</div>
          </div>
          <div className="rounded-md border border-border/40 p-2 bg-secondary/30">
            <div className="text-muted-foreground">CTR médio</div>
            <div className="text-sm font-semibold">{p.ctr_medio.toFixed(2)}%</div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Simulador What-if</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Conversão checkout +</span>
              <span className="font-mono">{crBoost[0]}%</span>
            </div>
            <Slider value={crBoost} onValueChange={setCrBoost} min={0} max={100} step={5} />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">CPA −</span>
              <span className="font-mono">{cpaCut[0]}%</span>
            </div>
            <Slider value={cpaCut} onValueChange={setCpaCut} min={0} max={60} step={5} />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Ticket médio +</span>
              <span className="font-mono">{ticketUp[0]}%</span>
            </div>
            <Slider value={ticketUp} onValueChange={setTicketUp} min={0} max={100} step={5} />
          </div>

          {hasSim && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receita projetada</span>
                <span className="font-semibold text-emerald-300">{fmtMoney(sim.receita)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Δ vs atual</span>
                <span className={cn("font-semibold", sim.deltaReceita >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {sim.deltaReceita >= 0 ? "+" : ""}{fmtMoney(sim.deltaReceita)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro projetado</span>
                <span className={cn("font-semibold", sim.lucro >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {fmtMoney(sim.lucro)} ({sim.deltaLucro >= 0 ? "+" : ""}{fmtMoney(sim.deltaLucro)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ROAS projetado</span>
                <span className="font-semibold">{sim.roas.toFixed(2)}x</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SaudeProdutos() {
  const [projectId, setProjectId] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name")
        .order("name");
      return ((data || []) as any[]).map(p => ({ id: p.id as string, nome: p.name as string }));
    },
  });

  // Auto-pick first project
  if (!projectId && projects.length > 0) {
    setProjectId(projects[0].id);
  }

  const health = useProductHealth(projectId, days);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Saúde dos Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Score por produto (ROAS, CPA, checkout, ticket) + simulador what-if para projetar melhorias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7d</SelectItem>
              <SelectItem value="14">Últimos 14d</SelectItem>
              <SelectItem value="30">Últimos 30d</SelectItem>
              <SelectItem value="90">Últimos 90d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={health.refresh} disabled={health.loading}>
            <RefreshCw className={cn("h-4 w-4", health.loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /> Receita</div>
            <div className="text-2xl font-bold mt-1">{fmtMoney(health.totals.receita)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Spend</div>
            <div className="text-2xl font-bold mt-1">{fmtMoney(health.totals.spend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> ROAS geral</div>
            <div className={cn("text-2xl font-bold mt-1", health.totals.roas >= 3 ? "text-emerald-300" : health.totals.roas >= 1.5 ? "text-amber-300" : "text-rose-300")}>
              {health.totals.roas.toFixed(2)}x
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Vendas</div>
            <div className="text-2xl font-bold mt-1">{health.totals.vendas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Score distribution */}
      {health.produtos.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Distribuição por saúde</div>
              <div className="flex gap-2 text-[11px]">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                  Alta: {health.produtos.filter(p => p.tier === "alta").length}
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                  Média: {health.produtos.filter(p => p.tier === "media").length}
                </Badge>
                <Badge variant="outline" className="border-rose-500/40 text-rose-300">
                  Baixa: {health.produtos.filter(p => p.tier === "baixa").length}
                </Badge>
              </div>
            </div>
            <Progress value={(health.produtos.filter(p => p.tier === "alta").length / health.produtos.length) * 100} />
          </CardContent>
        </Card>
      )}

      {/* Cards */}
      {health.loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando saúde dos produtos…</div>
      ) : health.produtos.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum produto com vendas aprovadas nos últimos {days} dias.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {health.produtos.map(p => <ProductCard key={p.produto} p={p} />)}
        </div>
      )}
    </div>
  );
}
