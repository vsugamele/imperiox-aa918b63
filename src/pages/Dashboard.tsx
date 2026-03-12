import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, ListTodo, DollarSign, Users, AlertTriangle, TrendingUp, CalendarIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, leadRes, costRes, recentRes, urgentRes, oppRes, eventsRes] = await Promise.all([
        supabase.from("imphq_projects").select("id", { count: "exact", head: true }),
        supabase.from("imphq_tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }),
        supabase.from("imphq_custos").select("valor, moeda"),
        supabase.from("imphq_projects").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("imphq_tasks").select("*").neq("status", "done").order("due_date", { ascending: true }).limit(5),
        supabase.from("imphq_mi_opportunities").select("*").eq("ativo", true).order("score", { ascending: false }).limit(4),
        supabase.from("imphq_calendar_events").select("*, imphq_projects(name, icon, color)").gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(5),
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
      setUpcomingEvents(eventsRes.data || []);
    }
    load();
  }, []);

  const statCards = [
    { label: "Projetos", value: stats.projects, icon: FolderKanban, gradient: "from-primary/15 to-primary/5", iconBg: "bg-primary/15 text-primary", textColor: "text-primary" },
    { label: "Tarefas Pendentes", value: stats.tasks, icon: ListTodo, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400" },
    { label: "Leads", value: stats.leads, icon: Users, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400" },
    { label: "Custo Mensal", value: `R$ ${stats.monthlyCost.toFixed(2)}`, icon: DollarSign, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400" },
  ];

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do seu império digital</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={s.label} className={`bg-gradient-to-br ${s.gradient} border-border hover:scale-[1.03] transition-all duration-200 cursor-default animate-fade-in`} style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`p-3 rounded-xl ${s.iconBg}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-mono font-bold ${s.textColor}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "350ms", animationFillMode: "both" }}>
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
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:scale-[1.01] cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.icon || "📁"}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category || "Sem categoria"}</p>
                  </div>
                </div>
                <span
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: p.color || "hsl(var(--primary))" }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Urgent Tasks */}
        <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "420ms", animationFillMode: "both" }}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Tarefas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente</p>}
            {urgentTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.project_id || "Sem projeto"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.due_date && (
                    <span className={`text-xs font-mono ${isOverdue(t.due_date) ? "text-red-400" : "text-muted-foreground"}`}>
                      {new Date(t.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                    ${t.priority === "urgent" ? "bg-red-500/20 text-red-400" :
                      t.priority === "high" ? "bg-amber-500/20 text-amber-400" :
                      "bg-muted text-muted-foreground"}`}>
                    {t.priority || "normal"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "480ms", animationFillMode: "both" }}>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Próximos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.map((ev: any) => {
                const eventDate = new Date(ev.event_date);
                const typeIcons: Record<string, string> = { launch: "🚀", live: "🎥", deadline: "⏰", meeting: "🤝", content: "📝", general: "📌" };
                const project = ev.imphq_projects;
                return (
                  <div key={ev.id} onClick={() => project && navigate(`/projetos/${ev.project_id}`)} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{typeIcons[ev.event_type] || "📌"}</span>
                      <div>
                        <p className="text-sm font-medium">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {project ? `${project.icon || "📁"} ${project.name}` : "Sem projeto"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-primary">{eventDate.toLocaleDateString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(eventDate, { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Market Intel */}
        {opportunities.length > 0 && (
          <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Top Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {opportunities.map((o, i) => (
                  <div key={o.id} className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/15 hover:scale-[1.02] transition-transform duration-200 animate-fade-in" style={{ animationDelay: `${550 + i * 60}ms`, animationFillMode: "both" }}>
                    <p className="text-sm font-medium">{o.produto}</p>
                    <p className="text-xs text-muted-foreground">{o.nicho} → {o.sub_nicho}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-mono font-bold text-emerald-400">{o.score}</span>
                      {o.ticket && <span className="text-xs font-mono text-primary">R$ {o.ticket}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
