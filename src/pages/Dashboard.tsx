import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, ListTodo, DollarSign, Users, AlertTriangle, TrendingUp, CalendarIcon, Wallet, Lock, Zap, ShoppingCart, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import GrowthDashboard from "@/components/dashboard/GrowthDashboard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

interface Stats {
  projects: number;
  tasks: number;
  leads: number;
  monthlyCost: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ projects: 0, tasks: 0, leads: 0, monthlyCost: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [projectFinance, setProjectFinance] = useState<any[]>([]);
  const [totalReceita, setTotalReceita] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leadsTrend, setLeadsTrend] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [receitaVsCusto, setReceitaVsCusto] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [autoExecCount, setAutoExecCount] = useState(0);
  const [recentCards, setRecentCards] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [projRes, taskRes, leadRes, costRes, recentRes, urgentRes, oppRes, eventsRes] = await Promise.all([
        supabase.from("imphq_projects").select("id", { count: "exact", head: true }),
        supabase.from("imphq_tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }),
        supabase.from("imphq_custos").select("valor, moeda"),
        supabase.from("imphq_projects").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("imphq_tasks").select("*").neq("status", "done").or("priority.in.(urgent,high),due_date.lt." + new Date().toISOString()).order("due_date", { ascending: true }).limit(5),
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

      // Leads trend last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: leadsRaw } = await supabase
        .from("imphq_leads")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());
      
      const leadsByDay: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        leadsByDay[d.toISOString().split("T")[0]] = 0;
      }
      (leadsRaw || []).forEach((l: any) => {
        const day = l.created_at?.split("T")[0];
        if (day && leadsByDay[day] !== undefined) leadsByDay[day]++;
      });
      setLeadsTrend(Object.entries(leadsByDay).map(([date, count]) => ({
        date: date.slice(5), count
      })));

      // Funnel: Lead → Pix → Compra
      const { count: totalLeads } = await supabase.from("imphq_leads").select("id", { count: "exact", head: true });
      const { count: pixLeads } = await supabase.from("imphq_leads").select("id", { count: "exact", head: true }).not("data->ultimo_evento", "is", null);
      const { count: buyers } = await supabase.from("imphq_leads").select("id", { count: "exact", head: true }).eq("status", "cliente");
      setFunnelData([
        { stage: "Leads", value: totalLeads || 0, fill: "hsl(var(--primary))" },
        { stage: "Pix", value: pixLeads || 0, fill: "hsl(45, 93%, 47%)" },
        { stage: "Compra", value: buyers || 0, fill: "hsl(142, 71%, 45%)" },
      ]);

      // Revenue vs Cost by month (last 6 months)
      const [costsRes, revsRes, vendasRes, adsRes] = await Promise.all([
        supabase.from("imphq_project_costs").select("valor, moeda, created_at"),
        supabase.from("imphq_project_revenue").select("valor, created_at"),
        supabase.from("imphq_vendas").select("valor, status, created_at").eq("status", "aprovado"),
        supabase.from("imphq_ads_spend").select("valor, data"),
      ]);

      const monthMap: Record<string, { receita: number; custo: number; ads: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { receita: 0, custo: 0, ads: 0 };
      }
      
      (revsRes.data || []).forEach((r: any) => {
        const m = r.created_at?.slice(0, 7);
        if (m && monthMap[m]) monthMap[m].receita += parseFloat(r.valor) || 0;
      });
      (vendasRes.data || []).forEach((v: any) => {
        const m = v.created_at?.slice(0, 7);
        if (m && monthMap[m]) monthMap[m].receita += parseFloat(v.valor) || 0;
      });
      (costsRes.data || []).forEach((c: any) => {
        const m = c.created_at?.slice(0, 7);
        const val = parseFloat(c.valor) || 0;
        if (m && monthMap[m]) monthMap[m].custo += c.moeda === "USD" ? val * 5.2 : val;
      });
      (adsRes.data || []).forEach((a: any) => {
        const m = a.data?.slice(0, 7);
        if (m && monthMap[m]) monthMap[m].ads += parseFloat(a.valor) || 0;
      });

      setReceitaVsCusto(Object.entries(monthMap).map(([month, v]) => ({
        month: month.slice(5), receita: v.receita, custo: v.custo + v.ads
      })));

      // Alerts
      const alertList: string[] = [];
      const today = new Date().toISOString().split("T")[0];
      const { count: pixToday } = await supabase.from("imphq_leads").select("id", { count: "exact", head: true })
        .not("data->ultimo_evento", "is", null)
        .neq("status", "cliente")
        .gte("updated_at", today);
      if ((pixToday || 0) > 0) alertList.push(`${pixToday} lead(s) geraram pix hoje e não compraram`);
      
      const overdueTasks = (urgentRes.data || []).filter((t: any) => t.due_date && new Date(t.due_date) < new Date());
      if (overdueTasks.length > 0) alertList.push(`${overdueTasks.length} tarefa(s) atrasada(s)`);
      setAlerts(alertList);

      // Automations executed count
      const { count: autoCount } = await supabase.from("imphq_activity_log").select("id", { count: "exact", head: true }).eq("action", "automacao_executada");
      setAutoExecCount(autoCount || 0);

      // Project finance
      const [projCostRes, projRevRes, projListRes] = await Promise.all([
        supabase.from("imphq_project_costs").select("project_id, valor, moeda"),
        supabase.from("imphq_project_revenue").select("project_id, valor"),
        supabase.from("imphq_projects").select("id, name, icon, color"),
      ]);
      
      const projMap = new Map((projListRes.data || []).map((p: any) => [p.id, p]));
      const costByProj = new Map<string, number>();
      const revByProj = new Map<string, number>();
      
      (projCostRes.data || []).forEach((c: any) => {
        const val = parseFloat(c.valor) || 0;
        const brl = c.moeda === "USD" ? val * 5.2 : val;
        costByProj.set(c.project_id, (costByProj.get(c.project_id) || 0) + brl);
      });
      (projRevRes.data || []).forEach((r: any) => {
        const val = parseFloat(r.valor) || 0;
        revByProj.set(r.project_id, (revByProj.get(r.project_id) || 0) + val);
      });
      
      const allProjIds = new Set([...costByProj.keys(), ...revByProj.keys()]);
      const financeData = Array.from(allProjIds).map(pid => {
        const cost = costByProj.get(pid) || 0;
        const rev = revByProj.get(pid) || 0;
        const proj = projMap.get(pid);
        return { id: pid, name: proj?.name || pid, icon: proj?.icon || "📁", cost, revenue: rev, profit: rev - cost };
      }).sort((a, b) => b.profit - a.profit).slice(0, 5);
      
      setProjectFinance(financeData);

      // Total receita
      const recV = (vendasRes.data || []).reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
      const recR = (revsRes.data || []).reduce((s: number, r: any) => s + (parseFloat(r.valor) || 0), 0);
      setTotalReceita(recV + recR);
    }
    load();

    if (user) {
      supabase.from("imphq_team_members").select("role").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        const r = (data?.role || "").toLowerCase();
        setIsAdmin(r === "admin" || r === "owner");
      });
    }
  }, [user]);

  const statCards = [
    { label: "Projetos", value: stats.projects, icon: FolderKanban, gradient: "from-primary/15 to-primary/5", iconBg: "bg-primary/15 text-primary", textColor: "text-primary" },
    { label: "Tarefas Pendentes", value: stats.tasks, icon: ListTodo, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400" },
    { label: "Leads", value: stats.leads, icon: Users, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400" },
    { label: "Custo Mensal", value: `R$ ${stats.monthlyCost.toFixed(2)}`, icon: DollarSign, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400" },
  ];

  const isOverdue = (date: string | null) => date ? new Date(date) < new Date() : false;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do seu império digital</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300">{a}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Receita + Automações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-primary/5 border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Total</p>
              <p className={`text-2xl font-mono font-bold text-emerald-400 ${!isAdmin ? "blur-md select-none" : ""}`}>
                R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            {!isAdmin && <div className="ml-auto flex items-center gap-1 text-muted-foreground"><Lock className="h-4 w-4" /><span className="text-[10px]">Admin only</span></div>}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500/10 to-primary/5 border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-400"><Zap className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Automações Executadas</p>
              <p className="text-2xl font-mono font-bold text-cyan-400">{autoExecCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Trend */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Leads (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={leadsTrend}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#leadGrad)" strokeWidth={2} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Receita vs Custo */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Receita vs Custo (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={receitaVsCusto}>
                <defs>
                  <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Area type="monotone" dataKey="receita" stroke="#10b981" fill="url(#recGrad)" strokeWidth={2} name="Receita" />
                <Area type="monotone" dataKey="custo" stroke="#ef4444" fill="url(#custGrad)" strokeWidth={2} name="Custo" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      {funnelData.some(f => f.value > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6 justify-center py-4">
              {funnelData.map((f, i) => {
                const maxVal = Math.max(...funnelData.map(d => d.value), 1);
                const height = Math.max(30, (f.value / maxVal) * 120);
                const prevVal = i > 0 ? funnelData[i - 1].value : null;
                const conv = prevVal && prevVal > 0 ? ((f.value / prevVal) * 100).toFixed(1) : null;
                return (
                  <div key={f.stage} className="flex flex-col items-center gap-2">
                    <span className="text-xl font-mono font-bold" style={{ color: f.fill }}>{f.value}</span>
                    <div className="w-20 rounded-t-lg transition-all" style={{ height, backgroundColor: f.fill, opacity: 0.7 }} />
                    <span className="text-xs font-medium">{f.stage}</span>
                    {conv && <Badge variant="outline" className="text-[9px]">{conv}%</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" /> Projetos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProjects.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto</p>}
            {recentProjects.map((p) => (
              <div key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:scale-[1.01] cursor-pointer transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.icon || "📁"}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category || "Sem categoria"}</p>
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: p.color || "hsl(var(--primary))" }} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Urgent Tasks */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Tarefas Urgentes
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
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${t.priority === "urgent" ? "bg-red-500/20 text-red-400" : t.priority === "high" ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                    {t.priority || "normal"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {upcomingEvents.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> Próximos Eventos
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
                        <p className="text-xs text-muted-foreground">{project ? `${project.icon || "📁"} ${project.name}` : "Sem projeto"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-primary">{eventDate.toLocaleDateString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(eventDate, { locale: ptBR, addSuffix: true })}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {opportunities.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Top Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {opportunities.map((o) => (
                  <div key={o.id} className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/15">
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

        {projectFinance.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Saúde Financeira dos Projetos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectFinance.map((pf: any) => {
                const isPositive = pf.profit >= 0;
                const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                return (
                  <div key={pf.id} onClick={() => navigate(`/projetos/${pf.id}`)} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{pf.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{pf.name}</p>
                        <p className="text-[10px] text-muted-foreground">Custo: {fmt(pf.cost)} · Receita: {fmt(pf.revenue)}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{fmt(pf.profit)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <ActivityFeed />
      <GrowthDashboard />
    </div>
  );
}
