import { useEffect, useState, useCallback, useMemo } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, CheckCircle2, Clock, FileText, Link2, Plus, RefreshCw, Trash2, X, Sparkles, Target, Radio, MessageSquare, Video, Download } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AIGenerateButton } from "./AIGenerateButton";

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
  copy?: string;
  hashtags?: string;
  cross_platforms?: string[];
}

interface WeekPlan {
  [day: string]: ContentItem[];
}

interface WeekSummary {
  focus?: string;
  event?: string;
}

interface MonthlyPlan {
  semana_1: WeekPlan;
  semana_2: WeekPlan;
  semana_3: WeekPlan;
  semana_4: WeekPlan;
  week_labels?: Record<string, string>;
  week_summaries?: Record<string, WeekSummary>;
}

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

const ALL_PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "Blog", "Email", "WhatsApp"];
const CONTENT_TYPES = ["Post", "Reels", "Story", "Live", "Artigo", "Email", "Vídeo", "Carousel", "Video Longo"];
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

const LINK_TO_PLATFORM: Record<string, string> = {
  instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok",
  linkedin: "LinkedIn", blog: "Blog", whatsapp: "WhatsApp",
};

/** Calculate real dates (dd/MM) for each day of a given week index */
function getWeekDates(weekIndex: number): string[] {
  const now = new Date();
  const som = startOfMonth(now);
  const dow = getDay(som); // 0=Sun
  const offsetToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const firstMonday = new Date(som);
  firstMonday.setDate(firstMonday.getDate() + offsetToMonday);

  return DAYS.map((_, di) => {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + weekIndex * 7 + di);
    return format(d, "dd/MM");
  });
}

function migrateToMonthly(plan: any): MonthlyPlan {
  const empty: WeekPlan = {};
  if (!plan) return { semana_1: empty, semana_2: empty, semana_3: empty, semana_4: empty };
  if (plan.semana_1) return plan as MonthlyPlan;
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
  const [aiProductName, setAiProductName] = useState("");
  const [aiPlatforms, setAiPlatforms] = useState<string[]>(["Instagram", "YouTube"]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [expertLogs, setExpertLogs] = useState<any[]>([]);

  // Operational status
  const [opsStatus, setOpsStatus] = useState<any>(null);

  // Card detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ContentItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [editCopy, setEditCopy] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editType, setEditType] = useState("");

  const data = project.data || {};
  const monthlyPlan = migrateToMonthly(data.content_plan);
  const currentWeekPlan: WeekPlan = (monthlyPlan as any)[activeWeek] || {};
  const expertNotes: string = data.expert_notes || "";
  const shareToken: string = data.expert_share_token || "";
  const movementContext: string = data.movement_context || "";
  const contentObjectives: string[] = Array.isArray(data.content_objectives)
    ? data.content_objectives
    : data.content_objective ? [data.content_objective] : [""];
  const weekLabels: Record<string, string> = monthlyPlan.week_labels || {};
  const weekSummaries: Record<string, WeekSummary> = monthlyPlan.week_summaries || {};

  const PLATFORMS = useMemo(() => {
    const links = data.links || {};
    const active = Object.entries(links)
      .filter(([_, v]) => v && String(v).trim() !== "")
      .map(([k]) => LINK_TO_PLATFORM[k.toLowerCase()])
      .filter(Boolean) as string[];
    if (!active.includes("Email")) active.push("Email");
    return active.length > 1 ? active : ALL_PLATFORMS;
  }, [data.links]);

  const products = useMemo(() => {
    const prods = data.produtos || [];
    return Array.isArray(prods) ? prods.map((p: any) => p.nome || p.name || "").filter(Boolean) : [];
  }, [data.produtos]);

  useEffect(() => {
    const now = new Date();
    const weekEnd = addDays(now, 7);
    Promise.all([
      supabase.from("imphq_calendar_events").select("*").eq("project_id", projectId).gte("start_date", now.toISOString()).lte("start_date", weekEnd.toISOString()).order("start_date"),
      supabase.from("imphq_kanban_cards").select("id, title, priority, due_date, board, column_id").contains("tags", [projectId]).order("position"),
      supabase.from("imphq_processes" as any).select("*").eq("project_id", projectId),
      supabase.from("imphq_expert_logs" as any).select("*").eq("project_id", projectId),
    ]).then(([evRes, taskRes, procRes, logsRes]) => {
      setEvents(evRes.data || []);
      setTasks(taskRes.data || []);
      setProcesses(procRes.data || []);
      setExpertLogs(logsRes.data || []);
    });

    // Fetch operational status
    Promise.all([
      supabase.from("imphq_ad_accounts" as any).select("id, platform, account_name, is_active").eq("project_id", projectId),
      supabase.from("imphq_wa_campaigns" as any).select("id, name, status").eq("project_id", projectId).eq("status", "active"),
    ]).then(([adsRes, waRes]) => {
      const ads = adsRes.data || [];
      const activeAds = ads.filter((a: any) => a.is_active);
      setOpsStatus({
        ads_connected: ads.length > 0,
        ads_active: activeAds.length,
        ads_accounts: ads.map((a: any) => ({ platform: a.platform, name: a.account_name, active: a.is_active })),
        wa_campaigns_active: (waRes.data || []).length,
        wa_campaigns: (waRes.data || []).map((c: any) => ({ name: c.name })),
      });
    });
  }, [projectId]);

  const isLogDone = (contentId: string) => expertLogs.some(l => l.content_id === contentId && l.action === "mark_done");
  const getLogVideo = (contentId: string) => expertLogs.find(l => l.content_id === contentId && l.action === "video_upload");

  const updateMonthlyPlan = useCallback((plan: MonthlyPlan) => {
    onUpdateData({ ...data, content_plan: plan });
  }, [data, onUpdateData]);

  const getWeekPlan = (wk: string): WeekPlan => (monthlyPlan as any)[wk] || {};

  const addContentItem = (day: string) => {
    const plan = { ...monthlyPlan };
    const week = { ...getWeekPlan(activeWeek) };
    const items = [...(week[day] || [])];
    items.push({ id: crypto.randomUUID(), platform: "Instagram", type: "Post", description: "" });
    week[day] = items;
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  const updateContentItem = (day: string, itemId: string, patch: Partial<ContentItem>) => {
    const plan = { ...monthlyPlan };
    const week = { ...getWeekPlan(activeWeek) };
    week[day] = (week[day] || []).map(item => item.id === itemId ? { ...item, ...patch } : item);
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  const removeContentItem = (day: string, itemId: string) => {
    const plan = { ...monthlyPlan };
    const week = { ...getWeekPlan(activeWeek) };
    week[day] = (week[day] || []).filter(item => item.id !== itemId);
    (plan as any)[activeWeek] = week;
    updateMonthlyPlan(plan);
  };

  /** Clear all content from a specific week */
  const clearWeek = (wk: string) => {
    const plan = { ...monthlyPlan };
    (plan as any)[wk] = {};
    updateMonthlyPlan(plan);
    toast.success("Semana limpa com sucesso!");
  };

  const updateObjectives = (objectives: string[]) => {
    onUpdateData({ ...data, content_objectives: objectives, content_objective: objectives[0] || "" });
  };

  const addObjective = () => {
    updateObjectives([...contentObjectives, ""]);
  };

  const removeObjective = (index: number) => {
    updateObjectives(contentObjectives.filter((_, i) => i !== index));
  };

  const setObjectiveAt = (index: number, value: string) => {
    const updated = [...contentObjectives];
    updated[index] = value;
    updateObjectives(updated);
  };

  const updateWeekLabel = (wk: string, label: string) => {
    const plan = { ...monthlyPlan, week_labels: { ...weekLabels, [wk]: label } };
    updateMonthlyPlan(plan);
  };

  const updateNotes = (notes: string) => {
    onUpdateData({ ...data, expert_notes: notes });
  };

  const updateMovementContext = (ctx: string) => {
    onUpdateData({ ...data, movement_context: ctx });
  };

  const openCardDetail = (item: ContentItem, day: string) => {
    setSelectedCard(item);
    setSelectedDay(day);
    setEditCopy(item.copy || "");
    setEditHashtags(item.hashtags || "");
    setEditDescription(item.description);
    setEditPlatform(item.platform);
    setEditType(item.type);
    setDetailModalOpen(true);
  };

  const saveCardDetail = () => {
    if (!selectedCard) return;
    updateContentItem(selectedDay, selectedCard.id, {
      platform: editPlatform,
      type: editType,
      description: editDescription,
      copy: editCopy,
      hashtags: editHashtags,
    });
    setDetailModalOpen(false);
    toast.success("Card atualizado!");
  };

  const deleteCardFromModal = () => {
    if (!selectedCard) return;
    removeContentItem(selectedDay, selectedCard.id);
    setDetailModalOpen(false);
    toast.success("Card excluído.");
  };

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

  const handleContentPlanAI = (result: any) => {
    if (result?.content_plan) {
      const aiPlan = migrateToMonthly(result.content_plan);
      const currentPlan = { ...monthlyPlan };
      let filled = 0;
      let preserved = 0;

      if (aiPlan.week_labels) {
        currentPlan.week_labels = { ...currentPlan.week_labels, ...aiPlan.week_labels };
      }
      if (aiPlan.week_summaries) {
        currentPlan.week_summaries = { ...currentPlan.week_summaries, ...aiPlan.week_summaries };
      }

      for (const wk of WEEKS) {
        const aiWeek = aiPlan[wk] || {};
        const currentWeek = currentPlan[wk] || {};
        const mergedWeek = { ...currentWeek };

        for (const day of DAYS) {
          const existing = currentWeek[day] || [];
          const aiItems = aiWeek[day] || [];
          if (existing.length === 0 && aiItems.length > 0) {
            mergedWeek[day] = aiItems;
            filled++;
          } else if (existing.length > 0) {
            preserved++;
          }
        }
        (currentPlan as any)[wk] = mergedWeek;
      }

      onUpdateData({ ...data, content_plan: currentPlan });
      toast.success(`Plano gerado! ${filled} dias preenchidos, ${preserved} dias preservados.`);
    }
  };

  const handleExpertNotesAI = (result: any) => {
    if (result?.expert_notes) {
      onUpdateData({ ...data, expert_notes: result.expert_notes });
      toast.success("Instruções geradas com IA!");
    }
  };

  const handleCopyAI = (result: any) => {
    if (result?.copy) {
      setEditCopy(result.copy);
    }
    if (result?.hashtags) {
      setEditHashtags(result.hashtags);
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

  const emptyDaysCount = WEEKS.reduce((total, wk) => {
    const wp = monthlyPlan[wk] || {};
    return total + DAYS.reduce((s, d) => (wp[d]?.length || 0) === 0 ? s + 1 : s, 0);
  }, 0);

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

      {/* Status Operacional */}
      {opsStatus && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
              <Radio className="h-4 w-4" /> Status Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Ads */}
              <div className="p-3 rounded bg-secondary/50 border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">📊 Tráfego Pago</p>
                {opsStatus.ads_connected ? (
                  <>
                    <Badge variant={opsStatus.ads_active > 0 ? "default" : "secondary"} className="text-[9px]">
                      {opsStatus.ads_active > 0 ? `✅ ${opsStatus.ads_active} conta(s) ativa(s)` : "⏸ Contas pausadas"}
                    </Badge>
                    <div className="mt-1 space-y-0.5">
                      {opsStatus.ads_accounts.map((a: any, i: number) => (
                        <p key={i} className="text-[9px] text-muted-foreground">
                          {a.platform} — {a.name} {a.active ? "🟢" : "🔴"}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[9px] text-muted-foreground">Nenhuma conta de ads vinculada</p>
                )}
              </div>
              {/* WA Campaigns */}
              <div className="p-3 rounded bg-secondary/50 border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">💬 Campanhas WhatsApp</p>
                {opsStatus.wa_campaigns_active > 0 ? (
                  <>
                    <Badge variant="default" className="text-[9px]">✅ {opsStatus.wa_campaigns_active} ativa(s)</Badge>
                    <div className="mt-1 space-y-0.5">
                      {opsStatus.wa_campaigns.map((c: any, i: number) => (
                        <p key={i} className="text-[9px] text-muted-foreground">• {c.name}</p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[9px] text-muted-foreground">Nenhuma campanha ativa</p>
                )}
              </div>
              {/* Movement context */}
              <div className="p-3 rounded bg-secondary/50 border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">📋 Contexto do Movimento</p>
                <Textarea
                  value={movementContext}
                  onChange={e => updateMovementContext(e.target.value)}
                  placeholder="Ex: Tráfego ligado desde dia 5, Lançamento dia 20..."
                  className="bg-transparent border-none text-xs focus-visible:ring-0 min-h-[60px] p-0 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              {emptyDaysCount > 0 && totalContent > 0 && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={() => {
                  setAiObjective(contentObjectives.filter(Boolean).join("; "));
                  setAiDialogOpen(true);
                }}>
                  <Sparkles className="h-3 w-3" /> Preencher {emptyDaysCount} dias vazios
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                setAiObjective(contentObjectives.filter(Boolean).join("; "));
                setAiDialogOpen(true);
              }}>
                <Sparkles className="h-3.5 w-3.5" /> 🤖 Gerar Plano com IA
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mini Calendar */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="shrink-0">
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
                modifiers={{
                  hasContent: (() => {
                    const dates: Date[] = [];
                    const today = new Date();
                    const som2 = startOfMonth(today);
                    WEEKS.forEach((wk, wi) => {
                      const wp = monthlyPlan[wk] || {};
                      DAYS.forEach((day, di) => {
                        if ((wp[day]?.length || 0) > 0) {
                          const dayOffset = wi * 7 + di;
                          const d = new Date(som2);
                          d.setDate(d.getDate() + dayOffset);
                          dates.push(d);
                        }
                      });
                    });
                    return dates;
                  })(),
                }}
                modifiersStyles={{
                  hasContent: { fontWeight: "bold", textDecoration: "underline", color: "hsl(var(--primary))" },
                }}
              />
            </div>
            <div className="flex-1 w-full space-y-2">
              {/* Objetivos do Movimento — multi-bullets */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-xs font-semibold text-primary">Objetivos do Movimento</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={addObjective}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {contentObjectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">•</span>
                    <Input
                      value={obj}
                      onChange={e => setObjectiveAt(i, e.target.value)}
                      placeholder="Ex: Aquecimento para lançamento, Captação de leads..."
                      className="bg-transparent border-none text-sm focus-visible:ring-0 h-7 flex-1"
                    />
                    {contentObjectives.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeObjective(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Week Tabs */}
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <TabsList className="w-full grid grid-cols-4">
              {WEEKS.map((wk, i) => {
                const weekItems = DAYS.reduce((s, d) => s + ((monthlyPlan[wk] || {})[d]?.length || 0), 0);
                const label = weekLabels[wk] ? `${WEEK_LABELS[i]} — ${weekLabels[wk]}` : WEEK_LABELS[i];
                return (
                  <TabsTrigger key={wk} value={wk} className="text-xs gap-1">
                    {label}
                    {weekItems > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{weekItems}</Badge>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {WEEKS.map((wk, wi) => {
              const dates = getWeekDates(wi);
              const weekItemCount = DAYS.reduce((s, d) => s + (((monthlyPlan as any)[wk] || {})[d]?.length || 0), 0);
              return (
                <TabsContent key={wk} value={wk} className="space-y-3">
                  {/* Week label + summary bar + clear button */}
                  <div className="flex flex-wrap items-center gap-3 p-2 rounded border border-border bg-secondary/20">
                    <Input
                      value={weekLabels[wk] || ""}
                      onChange={e => updateWeekLabel(wk, e.target.value)}
                      placeholder={`Fase da ${WEEK_LABELS[wi]} — Ex: Atração, Autoridade, Objeções, Lançamento`}
                      className="bg-transparent border-none text-xs focus-visible:ring-0 h-7 flex-1 min-w-[200px]"
                    />
                    {weekSummaries[wk]?.focus && (
                      <Badge variant="outline" className="text-[9px]">🎯 {weekSummaries[wk].focus}</Badge>
                    )}
                    {weekSummaries[wk]?.event && (
                      <Badge variant="outline" className="text-[9px]">📅 {weekSummaries[wk].event}</Badge>
                    )}
                    {weekItemCount > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" /> Limpar Semana
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Limpar {WEEK_LABELS[wi]}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso vai remover todos os {weekItemCount} cards de conteúdo desta semana. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => clearWeek(wk)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Limpar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day, di) => {
                      const weekData = monthlyPlan[wk] || {};
                      const items = weekData[day] || [];
                      return (
                        <div key={day} className="space-y-1">
                          <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{day}</p>
                            <p className="text-[9px] text-muted-foreground/70">{dates[di]}</p>
                          </div>
                          <div className="min-h-[100px] rounded border border-border bg-secondary/30 p-1 space-y-1.5">
                            {items.map(item => {
                              const done = isLogDone(item.id);
                              const videoLog = getLogVideo(item.id);
                              const videoMeta = videoLog?.metadata as any;
                              return (
                                <div
                                  key={item.id}
                                  className={`p-2 rounded border ${TYPE_COLORS[item.type] || "bg-secondary/50 text-foreground border-border"} ${done ? "ring-1 ring-green-500/40" : ""} group relative cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all`}
                                  onClick={() => openCardDetail(item, day)}
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
                                  {/* Expert status badges */}
                                  {(done || videoLog) && (
                                    <div className="mt-1 pt-1 border-t border-current/10 flex flex-wrap gap-1">
                                      {done && <Badge variant="secondary" className="text-[7px] h-3.5 gap-0.5"><CheckCircle2 className="h-2 w-2" /> Feito</Badge>}
                                      {videoLog && videoMeta?.url && (
                                        <a
                                          href={videoMeta.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="inline-flex"
                                        >
                                          <Badge variant="secondary" className="text-[7px] h-3.5 gap-0.5 cursor-pointer hover:bg-primary/20">
                                            <Video className="h-2 w-2" /> {videoMeta.filename ? "📹 " + videoMeta.filename : "Vídeo"}
                                          </Badge>
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <Button variant="ghost" size="sm" className="w-full h-6 text-[9px] text-muted-foreground" onClick={() => addContentItem(day)}>
                              <Plus className="h-2.5 w-2.5 mr-0.5" /> Adicionar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Card Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {PLATFORM_ICONS[editPlatform] || "📌"} Detalhes do Conteúdo
            </DialogTitle>
            <DialogDescription>Edite os detalhes, adicione copy e hashtags.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Plataforma</Label>
                <Select value={editPlatform} onValueChange={setEditPlatform}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_PLATFORMS.map(p => <SelectItem key={p} value={p}>{PLATFORM_ICONS[p]} {p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">🎯 Tema / Descrição</Label>
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Sobre o que é esse conteúdo?"
                className="bg-secondary min-h-[60px]"
                rows={2}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">📝 Copy / Texto do Post</Label>
                <AIGenerateButton
                  projectId={projectId}
                  action="generate_copy"
                  label="✨ Gerar Copy"
                  onResult={handleCopyAI}
                  contextSources={["Avatar", "Brand Kit"]}
                  fieldsToFill={["Copy do post"]}
                  showMenteSelector
                  size="sm"
                  variant="ghost"
                  extraBody={{
                    platform: editPlatform,
                    content_type: editType,
                    description: editDescription,
                    content_objective: contentObjectives.filter(Boolean).join("; "),
                  }}
                />
              </div>
              <Textarea
                value={editCopy}
                onChange={e => setEditCopy(e.target.value)}
                placeholder="Cole ou gere a copy com IA..."
                className="bg-secondary min-h-[100px] text-sm"
                rows={4}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block"># Hashtags</Label>
              <Input
                value={editHashtags}
                onChange={e => setEditHashtags(e.target.value)}
                placeholder="#marketing #digital #vendas"
                className="bg-secondary"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="destructive" size="sm" className="gap-1" onClick={deleteCardFromModal}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDetailModalOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveCardDetail}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Pre-Questions Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Configurar Plano com IA
            </DialogTitle>
            <DialogDescription>Responda as perguntas para gerar um plano de conteúdo mensal personalizado. Dias com conteúdo existente serão preservados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {totalContent > 0 && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                ⚠️ Você já tem {totalContent} posts. A IA vai preencher apenas os {emptyDaysCount} dias vazios.
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">🎯 Qual o objetivo do conteúdo este mês?</Label>
              <Input
                value={aiObjective}
                onChange={e => setAiObjective(e.target.value)}
                placeholder="Ex: Aquecimento para lançamento, Gerar autoridade, Captar leads..."
                className="bg-secondary"
              />
            </div>
            {products.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">📦 Produto em foco</Label>
                <Select value={aiProductName} onValueChange={setAiProductName}>
                  <SelectTrigger className="bg-secondary"><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os produtos</SelectItem>
                    {products.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">📊 Frequência de posts por dia?</Label>
              <Select value={aiFrequency} onValueChange={setAiFrequency}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
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
                product_name: aiProductName,
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
