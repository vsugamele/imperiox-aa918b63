import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, ListTodo, DollarSign, Users, AlertTriangle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Stats {
  projects: number;
  tasks: number;
  leads: number;
  monthlyCost: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, monthlyCost: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, leadRes, costRes, recentRes, urgentRes, oppRes] = await Promise.all([
        supabase.from("imphq_projects").select("id", { count: "exact", head: true }),
        supabase.from("imphq_tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }),
        supabase.from("imphq_custos").select("valor, moeda"),
        supabase.from("imphq_projects").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("imphq_tasks").select("*").neq("status", "done").order("due_date", { ascending: true }).limit(5),
        supabase.from("imphq_mi_opportunities").select("*").eq("ativo", true).order("score", { ascending: false }).limit(4),
      ]);

      let totalCost = 0;
      if (costRes.data) {
        costRes.data.forEach((c: any) => {
          const val = parseFloat(c.valor) || 0;
          totalCost += c.moeda === "USD" ? val * 5.2 : val;
        });
      }

      setStats({
        projects: projRes.count || 0,
        tasks: taskRes.count || 0,
        leads: leadRes.count || 0,
        monthlyCost: totalCost,
      });
      setRecentProjects(recentRes.data || []);
      setUrgentTasks(urgentRes.data || []);
      setOpportunities(oppRes.data || []);
    }
    load();
  }, []);

  const statCards = [
    { label: "Projetos", value: stats.projects, icon: FolderKanban, color: "text-primary" },
    { label: "Tarefas Pendentes", value: stats.tasks, icon: ListTodo, color: "text-warning" },
    { label: "Leads", value: stats.leads, icon: Users, color: "text-success" },
    { label: "Custo Mensal", value: `R$ ${stats.monthlyCost.toFixed(2)}`, icon: DollarSign, color: "text-destructive" },
  ];

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do seu império digital</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`p-2 rounded-lg bg-secondary ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-mono font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Projetos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProjects.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto</p>}
            {recentProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projetos/${p.id}`)}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.icon || "📁"}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category || "Sem categoria"}</p>
                  </div>
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.color || "hsl(var(--primary))" }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Urgent Tasks */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Tarefas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente</p>}
            {urgentTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.project_id || "Sem projeto"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.due_date && (
                    <span className={`text-xs font-mono ${isOverdue(t.due_date) ? "text-destructive" : "text-muted-foreground"}`}>
                      {new Date(t.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                    ${t.priority === "urgent" ? "bg-destructive/20 text-destructive" :
                      t.priority === "high" ? "bg-warning/20 text-warning" :
                      "bg-muted text-muted-foreground"}`}>
                    {t.priority || "normal"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Market Intel */}
      {opportunities.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {opportunities.map((o) => (
                <div key={o.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm font-medium">{o.produto}</p>
                  <p className="text-xs text-muted-foreground">{o.nicho} → {o.sub_nicho}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-mono font-bold text-primary">{o.score}</span>
                    {o.ticket && <span className="text-xs font-mono text-success">R$ {o.ticket}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
