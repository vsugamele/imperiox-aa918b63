import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, ListTodo, AlertTriangle, TrendingUp, CalendarIcon, Wallet, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  isAdmin: boolean;
}

export default function DashboardCards({ period, projectFilter, isAdmin }: Props) {
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [projectFinance, setProjectFinance] = useState<any[]>([]);
  const [recentCards, setRecentCards] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

      const [recentRes, oppRes, eventsRes, urgentCardsRes, columnsRes, membersRes, projListRes, cardsDataRes, finResumo] = await Promise.all([
        supabase.from("imphq_projects").select("id, name, icon, category, color").order("created_at", { ascending: false }).limit(5),
        supabase.from("imphq_mi_opportunities").select("id, produto, nicho, sub_nicho, score, ticket").eq("ativo", true).order("score", { ascending: false }).limit(4),
        supabase.from("imphq_calendar_events").select("id, title, event_date, event_type, project_id, imphq_projects(name, icon, color)").gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(5),
        supabase.from("imphq_kanban_cards").select("id, title, priority, due_date, column_id, project_id, member_id").or(`priority.in.(urgent,high),due_date.lt.${today}`).limit(20),
        supabase.from("imphq_kanban_columns").select("id, title, board"),
        supabase.from("imphq_team_members").select("id, name, avatar_url"),
        supabase.from("imphq_projects").select("id, name, icon"),
        supabase.from("imphq_kanban_cards").select("id, title, priority, board, column_id, project_id, updated_at").order("updated_at", { ascending: false }).limit(10),
        supabase.from("vw_financas_resumo").select("project_id, project_name, project_icon, custo_total, receita_total, lucro_liquido, roas, cpl").gt("receita_total", 0).order("lucro_liquido", { ascending: false }).limit(5),
      ]);

      setRecentProjects(recentRes.data || []);
      setOpportunities(oppRes.data || []);
      setUpcomingEvents(eventsRes.data || []);

      // Enriched urgent cards
      const colMap = new Map((columnsRes.data || []).map((c: any) => [c.id, c]));
      const memberMap = new Map((membersRes.data || []).map((m: any) => [m.id, m]));
      const projMap2 = new Map((projListRes.data || []).map((p: any) => [p.id, p]));

      const enrichedCards = (urgentCardsRes.data || []).map((c: any) => {
        const col = colMap.get(c.column_id);
        const colTitle = (col?.title || "").toLowerCase();
        const isBlocked = colTitle.includes("travado") || colTitle.includes("bloqueado") || colTitle.includes("blocked");
        const isOverdueCard = c.due_date && c.due_date < today;
        const _status = isBlocked ? "travado" : isOverdueCard ? "atrasado" : "urgente";
        const proj = projMap2.get(c.project_id);
        return { ...c, _status, _member: memberMap.get(c.member_id) || null, _projectName: proj ? `${proj.icon || "📁"} ${proj.name}` : null };
      }).filter((c: any) => {
        const col = colMap.get(c.column_id);
        const colTitle = (col?.title || "").toLowerCase();
        return !colTitle.includes("conclu") && !colTitle.includes("done") && !colTitle.includes("feito");
      }).sort((a: any, b: any) => {
        const order: Record<string, number> = { travado: 0, atrasado: 1, urgente: 2 };
        return (order[a._status] ?? 3) - (order[b._status] ?? 3);
      }).slice(0, 8);
      setUrgentTasks(enrichedCards);

      // Recent kanban cards
      const cardsData = cardsDataRes.data;
      if (cardsData) {
        const colIds = [...new Set(cardsData.map((c: any) => c.column_id))];
        const { data: colsData } = await supabase.from("imphq_kanban_columns").select("id, title").in("id", colIds);
        const colMap2 = new Map((colsData || []).map((c: any) => [c.id, c.title]));
        setRecentCards(cardsData.map((c: any) => ({ ...c, column_title: colMap2.get(c.column_id) || "?" })));
      }

      // Project finance
      setProjectFinance((finResumo.data || []).map((f: any) => ({
        id: f.project_id, name: f.project_name || f.project_id, icon: f.project_icon || "📁",
        cost: Number(f.custo_total) || 0, revenue: Number(f.receita_total) || 0,
        profit: Number(f.lucro_liquido) || 0, roas: Number(f.roas) || 0, cpl: Number(f.cpl) || 0,
      })));
    }
    load();
  }, [period, projectFilter]);

  const isOverdue = (date: string | null) => date ? new Date(date) < new Date() : false;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /> Projetos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProjects.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto</p>}
            {recentProjects.map((p) => (
              <div key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:scale-[1.01] cursor-pointer transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.icon || "📁"}</span>
                  <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category || "Sem categoria"}</p></div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: p.color || "hsl(var(--primary))" }} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Atenção Necessária */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Atenção Necessária</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentTasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum card pendente</p>}
            {urgentTasks.map((t) => {
              const statusBadge = t._status === "travado"
                ? { label: "Travado", cls: "bg-purple-500/20 text-purple-400" }
                : t._status === "atrasado"
                ? { label: "Atrasado", cls: "bg-orange-500/20 text-orange-400" }
                : { label: t.priority === "urgent" ? "Urgente" : "Alta", cls: t.priority === "urgent" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400" };
              return (
                <div key={t.id} onClick={() => navigate("/kanban")} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-all hover:scale-[1.01]">
                  {t._member ? (
                    <div className="shrink-0 h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                      {t._member.avatar_url ? <img src={t._member.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[9px] font-bold text-primary">{t._member.name?.slice(0, 2).toUpperCase()}</span>}
                    </div>
                  ) : (
                    <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center"><Users className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t._projectName || "Sem projeto"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.due_date && <span className={`text-[10px] font-mono ${isOverdue(t.due_date) ? "text-red-400" : "text-muted-foreground"}`}>{new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${statusBadge.cls}`}>{statusBadge.label}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {upcomingEvents.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-primary" /> Próximos Eventos</CardTitle>
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
                      <div><p className="text-sm font-medium">{ev.title}</p><p className="text-xs text-muted-foreground">{project ? `${project.icon || "📁"} ${project.name}` : "Sem projeto"}</p></div>
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
              <CardTitle className="font-display text-lg flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> Top Oportunidades</CardTitle>
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
              <CardTitle className="font-display text-lg flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Saúde Financeira dos Projetos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectFinance.map((pf: any) => {
                const isPositive = pf.profit >= 0;
                const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                return (
                  <div key={pf.id} onClick={() => navigate(`/projetos/${pf.id}`)} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{pf.icon}</span>
                      <div><p className="text-sm font-medium">{pf.name}</p><p className="text-[10px] text-muted-foreground">Custo: {fmt(pf.cost)} · Receita: {fmt(pf.revenue)}</p></div>
                    </div>
                    <span className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{isPositive ? "+" : ""}{fmt(pf.profit)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Kanban Cards */}
      {recentCards.length > 0 && (
        <Card className="bg-card border-border animate-fade-in" style={{ animationDelay: "500ms", animationFillMode: "both" }}>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg flex items-center gap-2"><ListTodo className="h-4 w-4 text-amber-400" /> Últimos Cards Movimentados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCards.map((c: any) => (
              <div key={c.id} onClick={() => navigate("/kanban")} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${c.priority === "urgent" ? "bg-destructive" : c.priority === "high" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{c.title}</p><p className="text-[10px] text-muted-foreground">{c.board} · {c.column_title}</p></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px]">{c.column_title}</Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(c.updated_at), { locale: ptBR, addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
