import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle2, Clock, FileText, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
}

interface WeekPlan {
  [day: string]: ContentItem[];
}

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

const PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "Blog", "Email", "WhatsApp"];
const CONTENT_TYPES = ["Post", "Reels", "Story", "Live", "Artigo", "Email", "Vídeo", "Carousel"];
const DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function ProjetoExpertPanel({ projectId, project, onUpdateData }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);
  const data = project.data || {};

  const contentPlan: WeekPlan = data.content_plan || {};
  const expertNotes: string = data.expert_notes || "";

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

  const updateContentPlan = useCallback((plan: WeekPlan) => {
    onUpdateData({ ...data, content_plan: plan });
  }, [data, onUpdateData]);

  const addContentItem = (day: string) => {
    const plan = { ...contentPlan };
    const items = plan[day] || [];
    items.push({ id: crypto.randomUUID(), platform: "Instagram", type: "Post", description: "" });
    plan[day] = items;
    updateContentPlan(plan);
  };

  const updateContentItem = (day: string, itemId: string, patch: Partial<ContentItem>) => {
    const plan = { ...contentPlan };
    plan[day] = (plan[day] || []).map(item => item.id === itemId ? { ...item, ...patch } : item);
    updateContentPlan(plan);
  };

  const removeContentItem = (day: string, itemId: string) => {
    const plan = { ...contentPlan };
    plan[day] = (plan[day] || []).filter(item => item.id !== itemId);
    updateContentPlan(plan);
  };

  const updateNotes = (notes: string) => {
    onUpdateData({ ...data, expert_notes: notes });
  };

  // Stats
  const totalContent = DAYS.reduce((s, d) => s + (contentPlan[d]?.length || 0), 0);
  const activePlatforms = new Set(DAYS.flatMap(d => (contentPlan[d] || []).map(i => i.platform))).size;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{events.length}</p>
            <p className="text-[10px] text-muted-foreground">Eventos (7 dias)</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{tasks.length}</p>
            <p className="text-[10px] text-muted-foreground">Tarefas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{processes.length}</p>
            <p className="text-[10px] text-muted-foreground">Processos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalContent}</p>
            <p className="text-[10px] text-muted-foreground">Posts/Semana</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{activePlatforms}</p>
            <p className="text-[10px] text-muted-foreground">Plataformas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agenda da Semana */}
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

        {/* Tarefas Pendentes */}
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

      {/* Processos Ativos */}
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

      {/* Plano de Conteúdo Semanal */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📅 Plano de Conteúdo Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map(day => (
              <div key={day} className="space-y-1">
                <p className="text-[10px] font-semibold text-center uppercase text-muted-foreground">{day}</p>
                <div className="min-h-[80px] rounded border border-border bg-secondary/30 p-1 space-y-1">
                  {(contentPlan[day] || []).map(item => (
                    <div key={item.id} className="p-1.5 rounded bg-background border border-border text-[9px] space-y-0.5 group relative">
                      <Button variant="ghost" size="icon" className="h-3 w-3 absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100" onClick={() => removeContentItem(day, item.id)}>
                        <X className="h-2 w-2" />
                      </Button>
                      <Select value={item.platform} onValueChange={v => updateContentItem(day, item.id, { platform: v })}>
                        <SelectTrigger className="h-4 text-[8px] bg-transparent border-none p-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={item.type} onValueChange={v => updateContentItem(day, item.id, { type: v })}>
                        <SelectTrigger className="h-4 text-[8px] bg-transparent border-none p-0">
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
                        className="h-4 text-[8px] bg-transparent border-none p-0 focus-visible:ring-0"
                      />
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full h-5 text-[8px]" onClick={() => addContentItem(day)}>
                    <Plus className="h-2 w-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notas / Instruções */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary">📝 Notas & Instruções para o Expert</CardTitle>
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
