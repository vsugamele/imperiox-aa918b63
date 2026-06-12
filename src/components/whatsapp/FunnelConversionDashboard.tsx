import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Users, DollarSign, Zap, ArrowRight } from "lucide-react";

interface Props { projectId: string }

interface StageCount { stage: string; label: string; color: string; count: number; pct: number }
interface FlowStat { id: string; nome: string; execucoes: number; vendas: number; taxa: string }

const STAGES = [
  { id: "frio",    label: "Frio",    color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  { id: "morno",   label: "Morno",   color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "quente",  label: "Quente",  color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { id: "cliente", label: "Cliente", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

export function FunnelConversionDashboard({ projectId }: Props) {
  const [period, setPeriod] = useState("30");

  const { data, isLoading: loading } = useQuery({
    queryKey: ["funnel-conversion", projectId, period],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - Number(period) * 86_400_000).toISOString();

      const [leadsRes, vendasRes, execRes, autoRes] = await Promise.all([
        supabase.from("imphq_leads").select("status, score").eq("project_id", projectId).gte("criado_em", since),
        supabase.from("imphq_vendas").select("valor").eq("project_id", projectId).gte("created_at", since),
        supabase.from("imphq_flow_executions").select("automacao_id, status").eq("project_id", projectId).gte("created_at", since),
        supabase.from("imphq_automacoes").select("id, nome").eq("project_id", projectId).eq("ativo", true),
      ]);

      const leads = (leadsRes.data as any[]) || [];
      const vendas = (vendasRes.data as any[]) || [];
      const execs = (execRes.data as any[]) || [];
      const autos = (autoRes.data as any[]) || [];

      const totalLeads = leads.length;
      const revenue = vendas.reduce((s, v) => s + Number(v.valor || 0), 0);
      const scores = leads.filter(l => l.score != null).map(l => Number(l.score));
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const hotLeads = leads.filter(l => Number(l.score) >= 80).length;

      const stageCounts: Record<string, number> = {};
      for (const l of leads) {
        const s = l.status || "frio";
        stageCounts[s] = (stageCounts[s] || 0) + 1;
      }
      const total = totalLeads || 1;
      const stages: StageCount[] = STAGES.map(s => ({
        stage: s.id,
        label: s.label,
        color: s.color,
        count: stageCounts[s.id] || 0,
        pct: Math.round(((stageCounts[s.id] || 0) / total) * 100),
      }));

      const flowMap: Record<string, { nome: string; execucoes: number; vendas: number }> = {};
      for (const a of autos) flowMap[a.id] = { nome: a.nome || a.id, execucoes: 0, vendas: 0 };
      for (const e of execs) {
        if (e.automacao_id && flowMap[e.automacao_id]) flowMap[e.automacao_id].execucoes++;
      }
      const flows: FlowStat[] = Object.entries(flowMap)
        .filter(([, v]) => v.execucoes > 0)
        .map(([id, v]) => ({
          id,
          nome: v.nome,
          execucoes: v.execucoes,
          vendas: v.vendas,
          taxa: v.execucoes > 0 ? ((v.vendas / v.execucoes) * 100).toFixed(1) + "%" : "—",
        }))
        .sort((a, b) => b.vendas - a.vendas)
        .slice(0, 8);

      return { kpis: { totalLeads, revenue, avgScore, hotLeads }, stages, flows };
    },
  });

  const kpis = data?.kpis ?? { totalLeads: 0, revenue: 0, avgScore: 0, hotLeads: 0 };
  const stages = data?.stages ?? [];
  const flows = data?.flows ?? [];

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-primary">📊 Conversão por Funil</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Progressão de leads pelos estágios e ROI dos flows</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7d</SelectItem>
            <SelectItem value="30">Últimos 30d</SelectItem>
            <SelectItem value="90">Últimos 90d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Users, label: "Total Leads", value: kpis.totalLeads, color: "text-blue-400" },
              { icon: Zap, label: "Hot Leads (≥80)", value: kpis.hotLeads, color: "text-orange-400" },
              { icon: TrendingUp, label: "Score Médio", value: kpis.avgScore, color: "text-emerald-400" },
              { icon: DollarSign, label: "Receita", value: `R$ ${kpis.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-yellow-400" },
            ].map(kpi => (
              <Card key={kpi.label} className="p-3 bg-secondary/40">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{kpi.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              </Card>
            ))}
          </div>

          {/* Funnel stages */}
          <Card className="p-4 bg-secondary/40">
            <h3 className="text-sm font-semibold mb-3 text-foreground/80">Funil de Estágios</h3>
            <div className="flex items-center gap-1 flex-wrap">
              {stages.map((s, i) => (
                <div key={s.stage} className="flex items-center gap-1">
                  <div className="text-center min-w-[80px]">
                    <div className={`rounded-lg border px-3 py-2 ${s.color}`}>
                      <p className="text-lg font-bold">{s.count}</p>
                      <p className="text-[10px] font-medium">{s.label}</p>
                      <p className="text-[9px] opacity-70">{s.pct}%</p>
                    </div>
                    {/* Conversion bar */}
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                  {i < stages.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
            {stages[0] && stages[3] && stages[0].count > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Taxa frio→cliente: <span className="text-emerald-400 font-medium">{((stages[3].count / stages[0].count) * 100).toFixed(1)}%</span>
              </p>
            )}
          </Card>

          {/* Flow performance */}
          <Card className="p-4 bg-secondary/40">
            <h3 className="text-sm font-semibold mb-3 text-foreground/80">Performance dos Flows</h3>
            {flows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma execução de flow no período.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-[10px] uppercase text-muted-foreground tracking-wider pb-1 border-b border-border/40">
                  <span className="col-span-2">Flow</span>
                  <span className="text-center">Execuções</span>
                  <span className="text-center">Vendas / Taxa</span>
                </div>
                {flows.map(f => (
                  <div key={f.id} className="grid grid-cols-4 gap-2 items-center py-1.5 border-b border-border/20 last:border-0 hover:bg-muted/20 rounded px-1 transition-colors">
                    <span className="col-span-2 text-xs text-foreground truncate" title={f.nome}>{f.nome}</span>
                    <span className="text-center text-xs text-muted-foreground">{f.execucoes}</span>
                    <div className="text-center">
                      <span className={`text-xs font-medium ${f.vendas > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{f.vendas}</span>
                      <Badge variant="outline" className="ml-1 text-[9px] px-1">{f.taxa}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
