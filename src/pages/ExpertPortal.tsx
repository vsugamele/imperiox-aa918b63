import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, CheckCircle2, Clock, FileText, Loader2, Target } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const WEEKS = ["semana_1", "semana_2", "semana_3", "semana_4"] as const;
const WEEK_LABELS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "📸", YouTube: "▶️", TikTok: "🎵", LinkedIn: "💼",
  Blog: "📝", Email: "📧", WhatsApp: "💬",
};

const TYPE_COLORS: Record<string, string> = {
  Post: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Reels: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Story: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Live: "bg-red-500/20 text-red-400 border-red-500/30",
  Artigo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Email: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Vídeo: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Carousel: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "Video Longo": "bg-cyan-600/20 text-cyan-300 border-cyan-600/30",
};

const COLUMN_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "A Fazer",
  doing: "Em Andamento",
  review: "Revisão",
  done: "Concluído",
};

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
  copy?: string;
  hashtags?: string;
  cross_platforms?: string[];
}

interface WeekSummary {
  focus?: string;
  event?: string;
}

interface WeekPlan { [day: string]: ContentItem[]; }
interface MonthlyPlan {
  semana_1: WeekPlan;
  semana_2: WeekPlan;
  semana_3: WeekPlan;
  semana_4: WeekPlan;
  week_labels?: Record<string, string>;
  week_summaries?: Record<string, WeekSummary>;
}

function migrateToMonthly(plan: any): MonthlyPlan {
  const empty: WeekPlan = {};
  if (!plan) return { semana_1: empty, semana_2: empty, semana_3: empty, semana_4: empty };
  if (plan.semana_1) return plan as MonthlyPlan;
  return { semana_1: plan, semana_2: empty, semana_3: empty, semana_4: empty };
}

export default function ExpertPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState("semana_1");
  const [selectedCard, setSelectedCard] = useState<ContentItem | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!token) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/expert-portal?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-8 text-center">
          <p className="text-xl font-bold mb-2">🔒 Acesso Negado</p>
          <p className="text-sm text-muted-foreground">{error || "Link inválido ou expirado."}</p>
        </CardContent>
      </Card>
    </div>
  );

   const monthlyPlan = migrateToMonthly(data.content_plan);
   const weekLabels: Record<string, string> = monthlyPlan.week_labels || {};
   const weekSummaries: Record<string, WeekSummary> = monthlyPlan.week_summaries || {};
   const contentObjectives: string[] = Array.isArray(data.content_objectives)
     ? data.content_objectives.filter(Boolean)
     : data.content_objective ? [data.content_objective] : [];
   const totalContent = WEEKS.reduce((total, wk) => {
     const wp = (monthlyPlan as any)[wk] || {};
     return total + DAYS.reduce((s, d) => s + (wp[d]?.length || 0), 0);
   }, 0);
   const allItems = WEEKS.flatMap(wk => {
     const wp = (monthlyPlan as any)[wk] || {};
     return DAYS.flatMap(d => (wp[d] || []).map((i: ContentItem) => i.platform));
   });
   const activePlatforms = new Set(allItems).size;

  // Calendar content dates
  const contentDates = (() => {
    const dates: Date[] = [];
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    WEEKS.forEach((wk, wi) => {
      const wp = (monthlyPlan as any)[wk] || {};
      DAYS.forEach((day, di) => {
        if ((wp[day]?.length || 0) > 0) {
          const dayOffset = wi * 7 + di;
          const d = new Date(startOfMonth);
          d.setDate(d.getDate() + dayOffset);
          dates.push(d);
        }
      });
    });
    return dates;
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">🧭 {data.project_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel do Expert — planejamento mensal</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Objetivos do Movimento */}
        {contentObjectives.length > 0 && (
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-primary">Objetivos do Movimento</span>
            </div>
            {contentObjectives.map((obj, i) => (
              <p key={i} className="text-sm text-foreground ml-6">• {obj}</p>
            ))}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Eventos (7d)", value: data.events?.length || 0 },
            { label: "Tarefas", value: data.tasks?.length || 0 },
            { label: "Posts/Mês", value: totalContent },
            { label: "Plataformas", value: activePlatforms },
          ].map(k => (
            <Card key={k.label} className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Agenda da Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.events?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento nos próximos 7 dias</p>
              ) : data.events.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(ev.start_date), "EEE, dd MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Tarefas Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.tasks?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
              ) : data.tasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
                  <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">
                    {t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.column_id && (
                        <Badge variant="secondary" className="text-[8px] h-3.5">
                          {COLUMN_LABELS[t.column_id] || t.column_id}
                        </Badge>
                      )}
                      {t.checklist_total > 0 && (
                        <span className="text-[8px] text-muted-foreground">
                          ✅ {t.checklist_done}/{t.checklist_total}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.due_date && <span className="text-[9px] text-muted-foreground">{format(new Date(t.due_date), "dd/MM")}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Processos */}
        {data.processes?.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" /> Processos / SOPs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.processes.map((p: any) => {
                const steps = p.steps || [];
                const done = steps.filter((s: any) => s.done).length;
                const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
                return (
                  <div key={p.id} className="p-3 rounded bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium">{p.title}</p>
                      <Badge variant="outline" className="text-[9px] h-4">{pct}%</Badge>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Plano de Conteúdo Mensal */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📅 Plano de Conteúdo Mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mini Calendar */}
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={calendarDate}
                onSelect={(date) => {
                  setCalendarDate(date);
                  if (date) {
                    const dayOfWeek = date.getDay();
                    const dayMap = [6, 0, 1, 2, 3, 4, 5];
                    const dayIndex = dayMap[dayOfWeek];
                    const dayKey = DAYS[dayIndex];
                    for (const wk of WEEKS) {
                      const wp = monthlyPlan[wk] || {};
                      if (wp[dayKey]?.length) {
                        setActiveWeek(wk);
                        break;
                      }
                    }
                  }
                }}
                className="rounded-md border pointer-events-auto"
                modifiers={{ hasContent: contentDates }}
                modifiersStyles={{
                  hasContent: { fontWeight: "bold", textDecoration: "underline", color: "hsl(var(--primary))" },
                }}
              />
            </div>

            <Tabs value={activeWeek} onValueChange={setActiveWeek}>
              <TabsList className="w-full grid grid-cols-4 mb-3">
                {WEEKS.map((wk, i) => {
                  const weekItems = DAYS.reduce((s, d) => s + (((monthlyPlan as any)[wk] || {})[d]?.length || 0), 0);
                  const label = weekLabels[wk] ? `${WEEK_LABELS[i]} — ${weekLabels[wk]}` : WEEK_LABELS[i];
                  return (
                    <TabsTrigger key={wk} value={wk} className="text-xs gap-1">
                      {label}
                      {weekItems > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{weekItems}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {WEEKS.map(wk => {
                const weekData = (monthlyPlan as any)[wk] || {};
                const summary = weekSummaries[wk];
                return (
                  <TabsContent key={wk} value={wk} className="space-y-3">
                    {(summary?.focus || summary?.event) && (
                      <div className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-secondary/20">
                        {summary.focus && <Badge variant="outline" className="text-[9px]">🎯 {summary.focus}</Badge>}
                        {summary.event && <Badge variant="outline" className="text-[9px]">📅 {summary.event}</Badge>}
                      </div>
                    )}
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS.map(day => (
                        <div key={day} className="space-y-1">
                          <p className="text-[10px] font-semibold text-center uppercase text-muted-foreground">{day}</p>
                          <div className="min-h-[100px] rounded border border-border bg-secondary/30 p-1 space-y-1.5">
                            {(weekData[day] || []).map((item: ContentItem) => (
                              <div
                                key={item.id}
                                className={`p-2 rounded border ${TYPE_COLORS[item.type] || "bg-secondary/50 text-foreground border-border"} cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all`}
                                onClick={() => setSelectedCard(item)}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-xs">{PLATFORM_ICONS[item.platform] || "📌"}</span>
                                  <span className="text-[10px] font-semibold">{item.platform}</span>
                                </div>
                                <p className="text-[10px] opacity-80">{item.type}</p>
                                {item.description && <p className="text-[10px] mt-0.5 truncate">{item.description}</p>}
                                {item.cross_platforms && item.cross_platforms.length > 0 && (
                                  <div className="flex gap-0.5 mt-0.5 flex-wrap">
                                    {item.cross_platforms.map(cp => <Badge key={cp} variant="outline" className="text-[7px] h-3 px-1">{cp}</Badge>)}
                                  </div>
                                )}
                                {item.copy && <Badge variant="outline" className="text-[7px] h-3 mt-1">📝 copy</Badge>}
                              </div>
                            ))}
                            {!(weekData[day]?.length) && (
                              <p className="text-[8px] text-muted-foreground text-center pt-6">—</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Card Detail Modal (read-only for portal) */}
        <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {PLATFORM_ICONS[selectedCard?.platform || ""] || "📌"} {selectedCard?.platform} — {selectedCard?.type}
              </DialogTitle>
              <DialogDescription>Detalhes do conteúdo planejado.</DialogDescription>
            </DialogHeader>
            {selectedCard && (
              <div className="space-y-4">
                {selectedCard.cross_platforms && selectedCard.cross_platforms.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Cross-platform:</span>
                    {selectedCard.cross_platforms.map(cp => <Badge key={cp} variant="secondary" className="text-[9px]">{cp}</Badge>)}
                  </div>
                )}
                {selectedCard.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🎯 Tema</p>
                    <p className="text-sm">{selectedCard.description}</p>
                  </div>
                )}
                {selectedCard.copy && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">📝 Copy</p>
                    <div className="whitespace-pre-wrap text-sm bg-secondary/30 rounded p-3 border border-border">
                      {selectedCard.copy}
                    </div>
                  </div>
                )}
                {selectedCard.hashtags && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1"># Hashtags</p>
                    <p className="text-sm text-primary">{selectedCard.hashtags}</p>
                  </div>
                )}
                {!selectedCard.copy && !selectedCard.description && (
                  <p className="text-sm text-muted-foreground">Nenhum detalhe adicionado ainda.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Notas */}
        {data.expert_notes && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📝 Instruções & Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm text-foreground bg-secondary/30 rounded p-4 border border-border">
                {data.expert_notes}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-border py-4 mt-8">
        <p className="text-center text-[10px] text-muted-foreground">Powered by <span className="font-semibold">Imperio HQ</span></p>
      </footer>
    </div>
  );
}
