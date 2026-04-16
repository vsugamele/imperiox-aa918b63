import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban, ListTodo, DollarSign, Users } from "lucide-react";
import { getPeriodRange, getPreviousPeriodRange, calcDelta } from "@/lib/periodUtils";
import { DeltaBadge } from "./DeltaBadge";

interface Stats {
  projects: number;
  tasks: number;
  leads: number;
  monthlyCost: number;
}

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  compare?: boolean;
}

export default function DashboardStats({ period, projectFilter, productFilter, compare = false }: Props) {
  const [stats, setStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, monthlyCost: 0 });
  const [prevStats, setPrevStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, monthlyCost: 0 });

  useEffect(() => {
    async function loadRange(from: string, to: string): Promise<Stats> {
      let leadsQ = supabase.from("imphq_leads").select("id", { count: "exact", head: true })
        .gte("criado_em", from).lte("criado_em", to);
      if (projectFilter !== "all") leadsQ = leadsQ.eq("project_id", projectFilter);

      let costQ = supabase.from("imphq_custos").select("valor, moeda")
        .gte("data", from.split("T")[0]).lte("data", to.split("T")[0]);
      if (projectFilter !== "all") costQ = costQ.eq("project_id", projectFilter);

      const projRes: any = await supabase.from("imphq_projects").select("id", { count: "exact", head: true });
      const taskRes: any = await supabase.from("imphq_tasks").select("id", { count: "exact", head: true }).neq("status", "done");
      const leadRes: any = await leadsQ;
      const costRes: any = await costQ;

      let totalCost = 0;
      (costRes.data || []).forEach((c: any) => {
        const val = parseFloat(c.valor) || 0;
        totalCost += c.moeda === "USD" ? val * 5.2 : val;
      });

      return {
        projects: projRes.count || 0,
        tasks: taskRes.count || 0,
        leads: leadRes.count || 0,
        monthlyCost: totalCost,
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

  const statCards = [
    { label: "Projetos", value: stats.projects, prev: prevStats.projects, icon: FolderKanban, gradient: "from-primary/15 to-primary/5", iconBg: "bg-primary/15 text-primary", textColor: "text-primary", inverse: false, formatted: String(stats.projects) },
    { label: "Tarefas Pendentes", value: stats.tasks, prev: prevStats.tasks, icon: ListTodo, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400", inverse: true, formatted: String(stats.tasks) },
    { label: "Leads", value: stats.leads, prev: prevStats.leads, icon: Users, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400", inverse: false, formatted: String(stats.leads) },
    { label: "Custo", value: stats.monthlyCost, prev: prevStats.monthlyCost, icon: DollarSign, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400", inverse: true, formatted: `R$ ${stats.monthlyCost.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((s, i) => (
        <Card key={s.label} className={`bg-gradient-to-br ${s.gradient} border-border hover:scale-[1.03] transition-all duration-200 cursor-default animate-fade-in`} style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`p-3 rounded-xl ${s.iconBg}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-mono font-bold ${s.textColor}`}>{s.formatted}</p>
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
