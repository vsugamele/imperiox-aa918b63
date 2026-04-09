import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CheckCircle2, Clock, FileText, Link2, Plus, RefreshCw, Trash2, X, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AIGenerateButton } from "./AIGenerateButton";

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
}

interface WeekPlan {
  [day: string]: ContentItem[];
}

interface MonthlyPlan {
  semana_1: WeekPlan;
  semana_2: WeekPlan;
  semana_3: WeekPlan;
  semana_4: WeekPlan;
}

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

const PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "Blog", "Email", "WhatsApp"];
const CONTENT_TYPES = ["Post", "Reels", "Story", "Live", "Artigo", "Email", "Vídeo", "Carousel"];
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

function migrateToMonthly(plan: any): MonthlyPlan {
  const empty: WeekPlan = {};
  if (!plan) return { semana_1: empty, semana_2: empty, semana_3: empty, semana_4: empty };
  if (plan.semana_1) return plan as MonthlyPlan;
  // Legacy weekly plan → move to semana_1
  return { semana_1: plan, semana_2: empty, semana_3: empty, semana_4: empty };
}

export function ProjetoExpertPanel({ projectId, project, onUpdateData }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const [activeWeek, setActiveWeek] = useState<string>("semana_1");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiObjective, setAiObjective] = useState("");
  const [aiFrequency, setAiFrequency] = useState("2");
  const [aiPlatforms, setAiPlatforms] = useState<string[]>(["Instagram", "YouTube"]);

  const data = project.data || {};
  const monthlyPlan = migrateToMonthly(data.content_plan);
  const currentWeekPlan: WeekPlan = monthlyPlan[activeWeek as keyof MonthlyPlan] || {};
  const expertNotes: string = data.expert_notes || "";
  const shareToken: string = data.expert_share_token || "";
  const contentObjective: string = data.content_objective || "";

  useEffect(() => {
    const now = new Date();
    const weekEnd = addDays(now, 7);
    Promise.all([
      supabase.from("imphq_calendar_events").select("*").eq("project_id", projectId).gte("start_date", now.toISOString()).lte("start_date", weekEnd.toISOString()).order("start_date"),
      supabase.from("imphq_kanban_cards").select("id, title, priority, due_date, board, column_id").contains("tags", [projectId]).order("position"),
      supabase.from("imphq_processes" as any).select("*").eq("project_id", projectId),
    ]).then(([evRes, taskRes, procRes]) => {
      setEvents(evRes.data || []);
      setTasks(taskRes.data || []);
      setProcesses(procRes.data || []);
    });
  }, [projectId]);

  const updateMonthlyPlan = useCallback((plan: MonthlyPlan) => {
    onUpdateData({ ...data, content_plan: plan });
  }, [data, onUpdateData]);

  const addContentItem = (day: string) => {
    const plan = { ...monthlyPlan };
    const week = { ...(plan[activeWeek as keyof MonthlyPlan] || {}) };
    const items = [...(week[day] || [])];
    items.push({ id: crypto.randomUUID(), platform: "Instagram", type: "Post", description: "" });
    week[day] = items;
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  const updateContentItem = (day: string, itemId: string, patch: Partial<ContentItem>) => {
    const plan = { ...monthlyPlan };
    const week = { ...(plan[activeWeek as keyof MonthlyPlan] || {}) };
    week[day] = (week[day] || []).map(item => item.id === itemId ? { ...item, ...patch } : item);
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  const removeContentItem = (day: string, itemId: string) => {
    const plan = { ...monthlyPlan };
    const week = { ...(plan[activeWeek as keyof MonthlyPlan] || {}) };
    week[day] = (week[day] || []).filter(item => item.id !== itemId);
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  const updateObjective = (obj: string) => {
    onUpdateData({ ...data, content_objective: obj });
  };

  const updateNotes = (notes: string) => {
    onUpdateData({ ...data, expert_notes: notes });
  };

  // Share link
  const generateShareLink = async () => {
    const token = shareToken || crypto.randomUUID();
    if (!shareToken) {
      onUpdateData({ ...data, expert_share_token: token });
    }
    const url = `${window.location.origin}/expert/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado! Envie para o expert.");
  };

  const regenerateShareLink = () => {
    const token = crypto.randomUUID();
    onUpdateData({ ...data, expert_share_token: token });
    const url = `${window.location.origin}/expert/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Novo link gerado e copiado!");
  };

  const togglePlatform = (p: string) => {
    setAiPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  // AI handlers
  const handleContentPlanAI = (result: any) => {
    if (result?.content_plan) {
      onUpdateData({ ...data, content_plan: result.content_plan });
      toast.success("Plano de conteúdo mensal gerado com IA!");
    }
  };

  const handleExpertNotesAI = (result: any) => {
    if (result?.expert_notes) {
      onUpdateData({ ...data, expert_notes: result.expert_notes });
      toast.success("Instruções geradas com IA!");
    }
  };

  // Stats
  const totalContent = WEEKS.reduce((total, wk) => {
    const wp = monthlyPlan[wk] || {};
    return total + DAYS.reduce((s, d) => s + (wp[d]?.length || 0), 0);
  }, 0);
  const allItems = WEEKS.flatMap(wk => {
    const wp = monthlyPlan[wk] || {};
    return DAYS.flatMap(d => (wp[d] || []).map(i => i.platform));
  });
  const activePlatforms = new Set(allItems).size;

  return (
    <div className="space-y-6">
      {/* Share Link Bar */}
      <Card className="bg-card border-primary/30">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">Link público do Expert:</span>
          {shareToken ? (
            <code className="text-[10px] bg-secondary px-2 py-1 rounded truncate max-w-xs">
              {window.location.origin}/expert/{shareToken}
            </code>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Nenhum link gerado</span>
          )}
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={generateShareLink}>
            <Link2 className="h-3 w-3" /> {shareToken ? "Copiar Link" : "Gerar Link"}
          </Button>
          {shareToken && (
            <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={regenerateShareLink}>
              <RefreshCw className="h-3 w-3" /> Regenerar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Eventos (7d)", value: events.length },
          { label: "Tarefas", value: tasks.length },
          { label: "Processos", value: processes.length },
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
        {/* Agenda */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Agenda da Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum evento nos próximos 7 dias</p>
            ) : events.map(ev => (
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

        {/* Tarefas */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Tarefas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa vinculada ao projeto</p>
            ) : tasks.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
                <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">
                  {t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢"} {t.priority}
                </Badge>
                <p className="text-xs truncate flex-1">{t.title}</p>
                {t.due_date && <span className="text-[9px] text-muted-foreground flex-shrink-0">{format(new Date(t.due_date), "dd/MM")}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Processos */}
      {processes.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" /> Processos / SOPs
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {processes.map((p: any) => {
              const steps = p.steps || [];
              const done = steps.filter((s: any) => s.done).length;
              const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
              return (
                <div key={p.id} className="p-3 rounded bg-secondary/50 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium">{p.title || p.name}</p>
                    <Badge variant="outline" className="text-[9px] h-4">{pct}%</Badge>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[9px] text-muted-foreground mt-1">{done}/{steps.length} etapas</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Plano de Conteúdo Mensal */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📅 Plano de Conteúdo Mensal</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                setAiObjective(contentObjective);
                setAiDialogOpen(true);
              }}>
                <Sparkles className="h-3.5 w-3.5" /> 🤖 Gerar Plano com IA
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Objetivo do Movimento */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Target className="h-4 w-4 text-primary flex-shrink-0" />
            <Input
              value={contentObjective}
              onChange={e => updateObjective(e.target.value)}
              placeholder="🎯 Objetivo do Movimento — Ex: Aquecimento para lançamento, Autoridade no nicho, Captação de leads..."
              className="bg-transparent border-none text-sm focus-visible:ring-0 h-8"
            />
          </div>

          {/* Week Tabs */}
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <TabsList className="w-full grid grid-cols-4">
              {WEEKS.map((wk, i) => (
                <TabsTrigger key={wk} value={wk} className="text-xs">
                  {WEEK_LABELS[i]}
                </TabsTrigger>
              ))}
            </TabsList>

            {WEEKS.map(wk => (
              <TabsContent key={wk} value={wk}>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map(day => {
                    const weekData = monthlyPlan[wk] || {};
                    const items = weekData[day] || [];
                    return (
                      <div key={day} className="space-y-1">
                        <p className="text-[10px] font-semibold text-center uppercase text-muted-foreground">{day}</p>
                        <div className="min-h-[100px] rounded border border-border bg-secondary/30 p-1 space-y-1.5">
                          {items.map(item => (
                            <div key={item.id} className={`p-2 rounded border ${TYPE_COLORS[item.type] || "bg-secondary/50 text-foreground border-border"} group relative`}>
                              <Button variant="ghost" size="icon" className="h-4 w-4 absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => removeContentItem(day, item.id)}>
                                <X className="h-2.5 w-2.5" />
                              </Button>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs">{PLATFORM_ICONS[item.platform] || "📌"}</span>
                                <Select value={item.platform} onValueChange={v => updateContentItem(day, item.id, { platform: v })}>
                                  <SelectTrigger className="h-5 text-[10px] bg-transparent border-none p-0 w-auto min-w-0 font-semibold">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PLATFORMS.map(p => <SelectItem key={p} value={p} className="text-xs">{PLATFORM_ICONS[p]} {p}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Select value={item.type} onValueChange={v => updateContentItem(day, item.id, { type: v })}>
                                <SelectTrigger className="h-5 text-[10px] bg-transparent border-none p-0 w-auto min-w-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTENT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input
                                value={item.description}
                                onChange={e => updateContentItem(day, item.id, { description: e.target.value })}
                                placeholder="Tema..."
                                className="h-5 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 mt-0.5"
                              />
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="w-full h-6 text-[9px] text-muted-foreground" onClick={() => addContentItem(day)}>
                            <Plus className="h-2.5 w-2.5 mr-0.5" /> Adicionar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Pre-Questions Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Configurar Plano com IA
            </DialogTitle>
            <DialogDescription>Responda as perguntas para gerar um plano de conteúdo mensal personalizado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">🎯 Qual o objetivo do conteúdo este mês?</Label>
              <Input
                value={aiObjective}
                onChange={e => setAiObjective(e.target.value)}
                placeholder="Ex: Aquecimento para lançamento, Gerar autoridade, Captar leads..."
                className="bg-secondary"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">📊 Frequência de posts por dia?</Label>
              <Select value={aiFrequency} onValueChange={setAiFrequency}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 post por dia</SelectItem>
                  <SelectItem value="2">2 posts por dia</SelectItem>
                  <SelectItem value="3">3 posts por dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">📱 Plataformas prioritárias</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={aiPlatforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                    <span>{PLATFORM_ICONS[p]} {p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAiDialogOpen(false)}>Cancelar</Button>
            <AIGenerateButton
              projectId={projectId}
              action="generate_content_plan"
              label="Gerar Plano Mensal"
              onResult={(result) => {
                handleContentPlanAI(result);
                setAiDialogOpen(false);
              }}
              contextSources={["Briefing", "Avatar", "Expert", "Brand Kit"]}
              fieldsToFill={["Plano de conteúdo 4 semanas"]}
              showMenteSelector
              size="sm"
              variant="default"
              extraBody={{
                content_objective: aiObjective,
                posts_per_day: parseInt(aiFrequency),
                priority_platforms: aiPlatforms,
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notas / Instruções */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📝 Notas & Instruções para o Expert</CardTitle>
          <AIGenerateButton
            projectId={projectId}
            action="generate_expert_notes"
            label="Gerar Instruções com IA"
            onResult={handleExpertNotesAI}
            contextSources={["Briefing", "Expert", "Tarefas", "Conteúdo"]}
            fieldsToFill={["Notas do Expert"]}
            showMenteSelector
            size="sm"
            variant="outline"
          />
        </CardHeader>
        <CardContent>
          <Textarea
            value={expertNotes}
            onChange={e => updateNotes(e.target.value)}
            placeholder="Orientações gerais, objetivos da semana, lembretes importantes..."
            className="min-h-[100px] bg-secondary/50"
            rows={5}
          />
        </CardContent>
      </Card>
    </div>
  );
}
