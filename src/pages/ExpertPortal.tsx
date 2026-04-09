import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
}

interface WeekPlan { [day: string]: ContentItem[]; }
interface MonthlyPlan { semana_1: WeekPlan; semana_2: WeekPlan; semana_3: WeekPlan; semana_4: WeekPlan; }

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
  const totalContent = WEEKS.reduce((total, wk) => {
    const wp = monthlyPlan[wk] || {};
    return total + DAYS.reduce((s, d) => s + (wp[d]?.length || 0), 0);
  }, 0);
  const allItems = WEEKS.flatMap(wk => {
    const wp = monthlyPlan[wk] || {};
    return DAYS.flatMap(d => (wp[d] || []).map((i: ContentItem) => i.platform));
  });
  const activePlatforms = new Set(allItems).size;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">🧭 {data.project_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel do Expert — planejamento mensal</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Objetivo do Movimento */}
        {data.content_objective && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Target className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">🎯 {data.content_objective}</p>
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
          <CardContent>
            <Tabs value={activeWeek} onValueChange={setActiveWeek}>
              <TabsList className="w-full grid grid-cols-4 mb-3">
                {WEEKS.map((wk, i) => {
                  const weekItems = DAYS.reduce((s, d) => s + ((monthlyPlan[wk] || {})[d]?.length || 0), 0);
                  return (
                    <TabsTrigger key={wk} value={wk} className="text-xs gap-1">
                      {WEEK_LABELS[i]}
                      {weekItems > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{weekItems}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {WEEKS.map(wk => {
                const weekData = monthlyPlan[wk] || {};
                return (
                  <TabsContent key={wk} value={wk}>
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
