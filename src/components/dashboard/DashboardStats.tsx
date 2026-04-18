import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, ListTodo, DollarSign, Users, TrendingUp, Wallet, Target, ShoppingCart } from "lucide-react";
import { getPeriodRange, getPreviousPeriodRange, calcDelta } from "@/lib/periodUtils";
import { DeltaBadge } from "./DeltaBadge";

interface Stats {
  projects: number;
  tasks: number;
  leads: number;
  adsCost: number;
  opCost: number;
  revenue: number;
  salesCount: number;
}

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  compare?: boolean;
}

export default function DashboardStats({ period, projectFilter, productFilter, compare = false }: Props) {
  const [stats, setStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, adsCost: 0, opCost: 0, revenue: 0, salesCount: 0 });
  const [prevStats, setPrevStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, adsCost: 0, opCost: 0, revenue: 0, salesCount: 0 });

  useEffect(() => {
    async function loadRange(from: string, to: string): Promise<Stats> {
      const fromDate = from.split("T")[0];
      const toDate = to.split("T")[0];

      let leadsQ: any = supabase.from("imphq_leads").select("id", { count: "exact", head: true })
        .gte("criado_em", from).lte("criado_em", to);
      if (projectFilter !== "all") leadsQ = leadsQ.eq("project_id", projectFilter);

      let costQ: any = supabase.from("imphq_custos").select("valor, moeda")
        .gte("data", fromDate).lte("data", toDate);
      if (projectFilter !== "all") costQ = costQ.eq("project_id", projectFilter);

      let adsQ: any = supabase.from("imphq_ads_spend").select("valor, moeda")
        .gte("data_ref", fromDate).lte("data_ref", toDate);
      if (projectFilter !== "all") adsQ = adsQ.eq("project_id", projectFilter);

      let vendasQ: any = supabase.from("imphq_vendas").select("valor, produto_nome, status")
        .gte("data_venda", from).lte("data_venda", to)
        .in("status", ["aprovado", "approved", "paid", "completed"]);
      if (projectFilter !== "all") vendasQ = vendasQ.eq("project_id", projectFilter);
      if (productFilter && productFilter !== "all") vendasQ = vendasQ.eq("produto_nome", productFilter);

      const [projRes, taskRes, leadRes, costRes, adsRes, vendasRes]: any = await Promise.all([
        supabase.from("imphq_projects").select("id", { count: "exact", head: true }),
        supabase.from("imphq_tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        leadsQ, costQ, adsQ, vendasQ,
      ]);

      const sumByCurrency = (rows: any[], field = "valor") => rows.reduce((acc, r) => {
        const v = parseFloat(r[field]) || 0;
        return acc + (r.moeda === "USD" ? v * 5.2 : v);
      }, 0);

      const opCost = sumByCurrency(costRes.data || []);
      const adsCost = sumByCurrency(adsRes.data || []);
      const vendas = vendasRes.data || [];
      const revenue = vendas.reduce((a: number, v: any) => a + (parseFloat(v.valor) || 0), 0);

      return {
        projects: projRes.count || 0,
        tasks: taskRes.count || 0,
        leads: leadRes.count || 0,
        adsCost,
        opCost,
        revenue,
        salesCount: vendas.length,
      };
    }

    async function load() {
      const { from, to } = getPeriodRange(period);
      const current = await loadRange(from, to);
      setStats(current);

      if (compare) {
        const prev = getPreviousPeriodRange(period);
        const previous = await loadRange(prev.from, prev.to);
        setPrevStats(previous);
      }
    }
    load();
  }, [period, projectFilter, productFilter, compare]);

  const totalCost = stats.adsCost + stats.opCost;
  const prevTotalCost = prevStats.adsCost + prevStats.opCost;
  const profit = stats.revenue - totalCost;
  const prevProfit = prevStats.revenue - prevTotalCost;
  const roas = stats.adsCost > 0 ? stats.revenue / stats.adsCost : 0;
  const prevRoas = prevStats.adsCost > 0 ? prevStats.revenue / prevStats.adsCost : 0;

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statCards = [
    { label: "Receita", value: stats.revenue, prev: prevStats.revenue, icon: TrendingUp, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400", inverse: false, formatted: fmtBRL(stats.revenue) },
    { label: "Lucro", value: profit, prev: prevProfit, icon: Wallet, gradient: profit >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5", iconBg: profit >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400", textColor: profit >= 0 ? "text-emerald-400" : "text-red-400", inverse: false, formatted: fmtBRL(profit) },
    { label: "ROAS Real", value: roas, prev: prevRoas, icon: Target, gradient: roas >= 2 ? "from-emerald-500/15 to-emerald-500/5" : roas >= 1 ? "from-amber-500/15 to-amber-500/5" : "from-red-500/15 to-red-500/5", iconBg: roas >= 2 ? "bg-emerald-500/15 text-emerald-400" : roas >= 1 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400", textColor: roas >= 2 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : "text-red-400", inverse: false, formatted: roas > 0 ? `${roas.toFixed(2)}x` : "—" },
    { label: "Custo Total", value: totalCost, prev: prevTotalCost, icon: DollarSign, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400", inverse: true, formatted: fmtBRL(totalCost), sub: `Ads ${fmtBRL(stats.adsCost)} · Op ${fmtBRL(stats.opCost)}` },
    { label: "Vendas", value: stats.salesCount, prev: prevStats.salesCount, icon: ShoppingCart, gradient: "from-primary/15 to-primary/5", iconBg: "bg-primary/15 text-primary", textColor: "text-primary", inverse: false, formatted: String(stats.salesCount) },
    { label: "Leads", value: stats.leads, prev: prevStats.leads, icon: Users, gradient: "from-blue-500/15 to-blue-500/5", iconBg: "bg-blue-500/15 text-blue-400", textColor: "text-blue-400", inverse: false, formatted: String(stats.leads) },
    { label: "Tarefas Pend.", value: stats.tasks, prev: prevStats.tasks, icon: ListTodo, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400", inverse: true, formatted: String(stats.tasks) },
    { label: "Projetos", value: stats.projects, prev: prevStats.projects, icon: FolderKanban, gradient: "from-secondary/30 to-secondary/10", iconBg: "bg-secondary text-foreground", textColor: "text-foreground", inverse: false, formatted: String(stats.projects) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((s, i) => (
        <Card key={s.label} className={`bg-gradient-to-br ${s.gradient} border-border hover:scale-[1.03] transition-all duration-200 cursor-default animate-fade-in`} style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className={`p-2.5 rounded-xl ${s.iconBg} shrink-0`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              <p className={`text-xl font-mono font-bold ${s.textColor} truncate`}>{s.formatted}</p>
              {(s as any).sub && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{(s as any).sub}</p>}
              {compare && (
                <div className="flex items-center gap-1 mt-0.5">
                  <DeltaBadge delta={calcDelta(s.value, s.prev)} inverse={s.inverse} />
                  <span className="text-[9px] text-muted-foreground">vs anterior</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
