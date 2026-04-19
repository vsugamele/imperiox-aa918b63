import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar, CheckCircle2, Clock, Download, FileText, Loader2, Target,
  Radio, Upload, Video, Mic, Camera, Flame, TrendingUp, Eye, Megaphone,
  ChevronRight, Play, Sparkles, ListChecks, MessageSquare, Type
} from "lucide-react";
import { format, startOfMonth, getDay, isToday, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ExpertChat } from "@/components/expert/ExpertChat";
import { ExpertTeleprompter } from "@/components/expert/ExpertTeleprompter";
import { ExpertRecorder } from "@/components/expert/ExpertRecorder";

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

const TYPE_ICONS: Record<string, typeof Camera> = {
  Story: Eye,
  Reels: Play,
  Post: Camera,
  Live: Radio,
  Vídeo: Video,
  Carousel: ListChecks,
};

const COLUMN_LABELS: Record<string, string> = {
  backlog: "Backlog", todo: "A Fazer", doing: "Em Andamento", review: "Revisão", done: "Concluído",
};

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
  copy?: string;
  hashtags?: string;
  cross_platforms?: string[];
  hook?: string;
  cta?: string;
  recording_tips?: string;
  roteiro?: string;
  sequencia?: number;
}

interface WeekSummary { focus?: string; event?: string; }
interface WeekPlan { [day: string]: ContentItem[]; }
interface MonthlyPlan {
  semana_1: WeekPlan; semana_2: WeekPlan; semana_3: WeekPlan; semana_4: WeekPlan;
  week_labels?: Record<string, string>;
  week_summaries?: Record<string, WeekSummary>;
}

function migrateToMonthly(plan: any): MonthlyPlan {
  const empty: WeekPlan = {};
  if (!plan) return { semana_1: empty, semana_2: empty, semana_3: empty, semana_4: empty };
  if (plan.semana_1) return plan as MonthlyPlan;
  return { semana_1: plan, semana_2: empty, semana_3: empty, semana_4: empty };
}

function getWeekDates(weekIndex: number): Date[] {
  const now = new Date();
  const som = startOfMonth(now);
  const dow = getDay(som);
  const offsetToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const firstMonday = new Date(som);
  firstMonday.setDate(firstMonday.getDate() + offsetToMonday);
  return DAYS.map((_, di) => {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + weekIndex * 7 + di);
    return d;
  });
}

export default function ExpertPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState("semana_1");
  const [selectedCard, setSelectedCard] = useState<ContentItem | null>(null);
  const [expertLogs, setExpertLogs] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [mainTab, setMainTab] = useState("hoje");
  const [teleprompterCard, setTeleprompterCard] = useState<ContentItem | null>(null);
  const [recorderState, setRecorderState] = useState<{ id: string; week: string; day: string; mode: "video" | "audio" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadCard, setPendingUploadCard] = useState<{ id: string; week: string; day: string } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const callApi = useCallback(async (body: any) => {
    const res = await fetch(`${supabaseUrl}/functions/v1/expert-portal?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, [supabaseUrl, token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${supabaseUrl}/functions/v1/expert-portal?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else { setData(d); setExpertLogs(d.expert_logs || []); }
      })
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [token, supabaseUrl]);

  // Detect current week automatically
  useEffect(() => {
    if (!data) return;
    const now = new Date();
    for (let wi = 0; wi < WEEKS.length; wi++) {
      const dates = getWeekDates(wi);
      if (dates.some(d => isSameDay(d, now))) {
        setActiveWeek(WEEKS[wi]);
        break;
      }
    }
  }, [data]);

  const isMarkedDone = (contentId: string) => expertLogs.some(l => l.content_id === contentId && l.action === "mark_done");
  const getMediaLog = (contentId: string) => expertLogs.find(l => l.content_id === contentId && (l.action === "video_upload" || l.action === "audio_upload"));

  const toggleDone = async (contentId: string, week: string, day: string) => {
    const wasDone = isMarkedDone(contentId);
    if (wasDone) {
      setExpertLogs(prev => prev.filter(l => !(l.content_id === contentId && l.action === "mark_done")));
    } else {
      setExpertLogs(prev => [...prev, { content_id: contentId, action: "mark_done", week, day, created_at: new Date().toISOString() }]);
    }
    await callApi({ action: "mark_done", content_id: contentId, week, day, done: !wasDone });
  };

  const downloadDoc = (doc: { title?: string; content?: string }) => {
    const blob = new Blob([doc.content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(doc.title || "documento").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadCard) return;
    const { id: contentId, week, day } = pendingUploadCard;
    const isAudio = file.type.startsWith("audio/");
    const action = isAudio ? "audio_upload" : "video_upload";
    setUploadingId(contentId);
    try {
      const { signed_url, path, error: urlError } = await callApi({ action: "upload_url", content_id: contentId, filename: file.name });
      if (urlError) throw new Error(urlError);
      await fetch(signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const { url } = await callApi({ action: "register_upload", content_id: contentId, week, day, file_path: path, filename: file.name, upload_type: action });
      setExpertLogs(prev => [...prev, { content_id: contentId, action, metadata: { url, filename: file.name, path }, created_at: new Date().toISOString() }]);
      toast.success(isAudio ? "Áudio enviado!" : "Vídeo enviado!");
    } catch (err: any) {
      toast.error("Erro no upload: " + (err.message || "Tente novamente"));
    } finally {
      setUploadingId(null); setPendingUploadCard(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const monthlyPlan = useMemo(() => data ? migrateToMonthly(data.content_plan) : null, [data]);

  // Today's content
  const todayContent = useMemo(() => {
    if (!monthlyPlan) return [];
    const now = new Date();
    const items: { item: ContentItem; week: string; day: string }[] = [];
    WEEKS.forEach((wk, wi) => {
      const dates = getWeekDates(wi);
      DAYS.forEach((day, di) => {
        if (isSameDay(dates[di], now)) {
          const wp = (monthlyPlan as any)[wk] || {};
          (wp[day] || []).forEach((item: ContentItem) => {
            items.push({ item, week: wk, day });
          });
        }
      });
    });
    return items;
  }, [monthlyPlan]);

  // Tomorrow's content
  const tomorrowContent = useMemo(() => {
    if (!monthlyPlan) return [];
    const tomorrow = addDays(new Date(), 1);
    const items: { item: ContentItem; week: string; day: string }[] = [];
    WEEKS.forEach((wk, wi) => {
      const dates = getWeekDates(wi);
      DAYS.forEach((day, di) => {
        if (isSameDay(dates[di], tomorrow)) {
          const wp = (monthlyPlan as any)[wk] || {};
          (wp[day] || []).forEach((item: ContentItem) => {
            items.push({ item, week: wk, day });
          });
        }
      });
    });
    return items;
  }, [monthlyPlan]);

  // Week progress
  const weekProgress = useMemo(() => {
    if (!monthlyPlan) return { total: 0, done: 0 };
    const wp = (monthlyPlan as any)[activeWeek] || {};
    let total = 0, done = 0;
    DAYS.forEach(d => {
      (wp[d] || []).forEach((item: ContentItem) => {
        total++;
        if (isMarkedDone(item.id)) done++;
      });
    });
    return { total, done };
  }, [monthlyPlan, activeWeek, expertLogs]);

  // Stories sequences for today
  const todayStories = useMemo(() => {
    return todayContent
      .filter(c => c.item.type === "Story")
      .sort((a, b) => (a.item.sequencia || 0) - (b.item.sequencia || 0));
  }, [todayContent]);

  const todayOther = useMemo(() => {
    return todayContent.filter(c => c.item.type !== "Story");
  }, [todayContent]);

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

  const weekLabels: Record<string, string> = monthlyPlan?.week_labels || {};
  const weekSummaries: Record<string, WeekSummary> = monthlyPlan?.week_summaries || {};
  const contentObjectives: string[] = Array.isArray(data.content_objectives)
    ? data.content_objectives.filter(Boolean)
    : data.content_objective ? [data.content_objective] : [];
  const movementContext = data.movement_context || "";
  const opsStatus = data.operational_status;

  const renderContentCard = (item: ContentItem, week: string, day: string, expanded = false) => {
    const done = isMarkedDone(item.id);
    const mediaLog = getMediaLog(item.id);
    const isUploading = uploadingId === item.id;
    const Icon = TYPE_ICONS[item.type] || Camera;

    return (
      <div
        key={item.id}
        className={`rounded-xl border transition-all ${done ? "bg-green-500/5 border-green-500/30" : "bg-card border-border hover:border-primary/40"}`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${TYPE_COLORS[item.type] || "bg-secondary"}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{PLATFORM_ICONS[item.platform] || "📌"}</span>
                  <span className="text-sm font-semibold">{item.platform}</span>
                  <Badge variant="outline" className="text-[9px] h-4">{item.type}</Badge>
                </div>
                {item.sequencia && (
                  <span className="text-[9px] text-muted-foreground">Story {item.sequencia} da sequência</span>
                )}
              </div>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
              <Checkbox checked={done} onCheckedChange={() => toggleDone(item.id, week, day)} className="h-4 w-4" />
              <span className="text-[10px] text-muted-foreground">{done ? "Feito ✅" : "Marcar"}</span>
            </label>
          </div>

          {/* Description / Theme */}
          {item.description && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">🎯 Tema</p>
              <p className="text-sm text-foreground">{item.description}</p>
            </div>
          )}

          {/* Hook */}
          {item.hook && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] font-semibold uppercase text-amber-500 mb-0.5">🪝 Abrir com</p>
              <p className="text-sm font-medium text-foreground">{item.hook}</p>
            </div>
          )}

          {/* Expanded view: copy, roteiro, recording tips */}
          {expanded && (
            <>
              {item.roteiro && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">🎬 Roteiro</p>
                  <div className="whitespace-pre-wrap text-sm bg-secondary/40 rounded-lg p-3 border border-border leading-relaxed">
                    {item.roteiro}
                  </div>
                </div>
              )}
              {item.copy && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">📝 Copy / Legenda</p>
                  <div className="whitespace-pre-wrap text-sm bg-secondary/40 rounded-lg p-3 border border-border leading-relaxed">
                    {item.copy}
                  </div>
                </div>
              )}
              {item.recording_tips && (
                <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-[10px] font-semibold uppercase text-primary mb-1">🎬 Dicas de Gravação</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{item.recording_tips}</p>
                </div>
              )}
              {item.cta && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">📢 CTA</p>
                  <p className="text-sm font-medium text-primary">{item.cta}</p>
                </div>
              )}
              {item.hashtags && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5"># Hashtags</p>
                  <p className="text-xs text-primary">{item.hashtags}</p>
                </div>
              )}
            </>
          )}

          {/* Cross-platforms */}
          {item.cross_platforms && item.cross_platforms.length > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[9px] text-muted-foreground">Repostar:</span>
              {item.cross_platforms.map(cp => (
                <Badge key={cp} variant="secondary" className="text-[8px] h-4">{cp}</Badge>
              ))}
            </div>
          )}

          {/* Actions: Upload + View Details */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
            {mediaLog ? (
              <Badge variant="secondary" className="text-[9px] h-5 gap-1">
                {mediaLog.action === "audio_upload" ? <Mic className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                {mediaLog.action === "audio_upload" ? "Áudio enviado" : "Vídeo enviado"}
              </Badge>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="outline" size="sm"
                  className="h-6 text-[10px] gap-1"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingUploadCard({ id: item.id, week, day });
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "video/*";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
                  Vídeo
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-6 text-[10px] gap-1"
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingUploadCard({ id: item.id, week, day });
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = "audio/*";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Mic className="h-3 w-3" /> Áudio
                </Button>
              </div>
            )}
            {!expanded && (item.copy || item.recording_tips || item.roteiro) && (
              <Button
                variant="ghost" size="sm"
                className="h-6 text-[10px] gap-1 ml-auto"
                onClick={() => setSelectedCard(item)}
              >
                Ver detalhes <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {data.project_name}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            {weekProgress.total > 0 && (
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{Math.round((weekProgress.done / weekProgress.total) * 100)}%</p>
                <p className="text-[9px] text-muted-foreground">{weekProgress.done}/{weekProgress.total} feitos</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {/* Main Navigation */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="hoje" className="text-xs gap-1">
              <Flame className="h-3 w-3" /> Hoje
              {todayContent.length > 0 && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-0.5">{todayContent.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="semana" className="text-xs gap-1">
              <Calendar className="h-3 w-3" /> Semana
            </TabsTrigger>
            <TabsTrigger value="movimento" className="text-xs gap-1">
              <TrendingUp className="h-3 w-3" /> Movimento
            </TabsTrigger>
            <TabsTrigger value="avatar" className="text-xs gap-1">
              <Target className="h-3 w-3" /> Avatar
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs gap-1">
              <FileText className="h-3 w-3" /> Docs
            </TabsTrigger>
          </TabsList>

          {/* ══════════════ TAB: HOJE ══════════════ */}
          <TabsContent value="hoje" className="space-y-4">
            {todayContent.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="font-semibold text-foreground">Dia livre! 🎉</p>
                  <p className="text-sm text-muted-foreground mt-1">Nenhum conteúdo planejado para hoje.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Stories Sequence */}
                {todayStories.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-pink-400" />
                      <h2 className="text-sm font-bold text-foreground">Sequência de Stories</h2>
                      <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-[9px]">
                        {todayStories.length} stories
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {todayStories.map((c, i) => (
                        <div key={c.item.id} className="relative">
                          {i < todayStories.length - 1 && (
                            <div className="absolute left-5 top-[calc(100%)] w-0.5 h-2 bg-pink-500/30" />
                          )}
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isMarkedDone(c.item.id) ? "bg-green-500/20 text-green-400" : "bg-pink-500/20 text-pink-400"}`}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              {renderContentCard(c.item, c.week, c.day, true)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Content */}
                {todayOther.length > 0 && (
                  <div className="space-y-2">
                    {todayStories.length > 0 && (
                      <div className="flex items-center gap-2 mt-4">
                        <Camera className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-bold text-foreground">Outros Conteúdos</h2>
                      </div>
                    )}
                    <div className="space-y-2">
                      {todayOther.map(c => renderContentCard(c.item, c.week, c.day, true))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tomorrow Preview */}
            {tomorrowContent.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground">Amanhã</h2>
                  <Badge variant="secondary" className="text-[9px]">{tomorrowContent.length} conteúdos</Badge>
                </div>
                <div className="space-y-2 opacity-60">
                  {tomorrowContent.map(c => (
                    <div key={c.item.id} className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center gap-3">
                      <span className="text-xs">{PLATFORM_ICONS[c.item.platform] || "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.item.description || c.item.type}</p>
                        <p className="text-[9px] text-muted-foreground">{c.item.platform} • {c.item.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expert Notes */}
            {data.expert_notes && (
              <Card className="bg-card border-border mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">📝 Instruções da Gestão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-foreground bg-secondary/30 rounded-lg p-3 border border-border leading-relaxed">
                    {data.expert_notes}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══════════════ TAB: SEMANA ══════════════ */}
          <TabsContent value="semana" className="space-y-4">
            {/* Week progress */}
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Progresso da Semana</span>
                <span className="text-xs text-muted-foreground">{weekProgress.done}/{weekProgress.total}</span>
              </div>
              <Progress value={weekProgress.total > 0 ? (weekProgress.done / weekProgress.total) * 100 : 0} className="h-2" />
            </div>

            <Tabs value={activeWeek} onValueChange={setActiveWeek}>
              <TabsList className="w-full grid grid-cols-4 mb-3">
                {WEEKS.map((wk, i) => {
                  const weekItems = DAYS.reduce((s, d) => s + (((monthlyPlan as any)[wk] || {})[d]?.length || 0), 0);
                  return (
                    <TabsTrigger key={wk} value={wk} className="text-[10px] gap-0.5">
                      S{i + 1}
                      {weekItems > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{weekItems}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {WEEKS.map((wk, wi) => {
                const weekData = (monthlyPlan as any)[wk] || {};
                const summary = weekSummaries[wk];
                const dates = getWeekDates(wi);
                return (
                  <TabsContent key={wk} value={wk} className="space-y-3">
                    {(summary?.focus || summary?.event || weekLabels[wk]) && (
                      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-border bg-secondary/20">
                        {weekLabels[wk] && <Badge variant="outline" className="text-[9px]">📋 {weekLabels[wk]}</Badge>}
                        {summary?.focus && <Badge variant="outline" className="text-[9px]">🎯 {summary.focus}</Badge>}
                        {summary?.event && <Badge variant="outline" className="text-[9px]">📅 {summary.event}</Badge>}
                      </div>
                    )}

                    {/* Day-by-day list (mobile-friendly) */}
                    <div className="space-y-4">
                      {DAYS.map((day, di) => {
                        const items = weekData[day] || [];
                        if (items.length === 0) return null;
                        const dateObj = dates[di];
                        const isT = isToday(dateObj);
                        return (
                          <div key={day}>
                            <div className={`flex items-center gap-2 mb-2 ${isT ? "text-primary" : "text-muted-foreground"}`}>
                              <span className="text-xs font-bold uppercase">{day}</span>
                              <span className="text-[10px]">{format(dateObj, "dd/MM")}</span>
                              {isT && <Badge className="bg-primary/20 text-primary text-[8px] h-4">HOJE</Badge>}
                              <div className="flex-1 h-px bg-border" />
                            </div>
                            <div className="space-y-2 pl-2">
                              {items.map((item: ContentItem) => renderContentCard(item, wk, day, false))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </TabsContent>

          {/* ══════════════ TAB: MOVIMENTO ══════════════ */}
          <TabsContent value="movimento" className="space-y-4">
            {/* Objectives */}
            {contentObjectives.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <Megaphone className="h-4 w-4" /> Objetivos do Movimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contentObjectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground">{obj}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Movement Context */}
            {movementContext && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-amber-500 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Contexto do Movimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-foreground bg-secondary/30 rounded-lg p-4 border border-border leading-relaxed">
                    {movementContext}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Operational Status */}
            {opsStatus && (opsStatus.ads_connected || opsStatus.wa_campaigns_active > 0) && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <Radio className="h-4 w-4" /> Status Operacional
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {opsStatus.ads_connected && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">📊 Tráfego Pago</p>
                        <Badge variant={opsStatus.ads_active > 0 ? "default" : "secondary"} className="text-[9px]">
                          {opsStatus.ads_active > 0 ? `✅ ${opsStatus.ads_active} conta(s)` : "⏸ Pausado"}
                        </Badge>
                      </div>
                    )}
                    {opsStatus.wa_campaigns_active > 0 && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">💬 WhatsApp</p>
                        <Badge variant="default" className="text-[9px]">✅ {opsStatus.wa_campaigns_active} campanha(s)</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Events & Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Agenda (7d)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(data.events?.length || 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum evento</p>
                  ) : data.events.map((ev: any) => (
                    <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
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
                  <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(data.tasks?.length || 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
                  ) : data.tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                      <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">
                        {t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "🟢"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{t.title}</p>
                        {t.column_id && (
                          <Badge variant="secondary" className="text-[8px] h-3.5 mt-0.5">
                            {COLUMN_LABELS[t.column_id] || t.column_id}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Processes */}
            {data.processes?.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                    <ListChecks className="h-4 w-4" /> Processos / SOPs
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.processes.map((p: any) => {
                    const steps = p.steps || [];
                    const done = steps.filter((s: any) => s.done).length;
                    const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
                    return (
                      <div key={p.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
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
          </TabsContent>

          {/* ══════════════ TAB: AVATAR ══════════════ */}
          <TabsContent value="avatar" className="space-y-4">
            {!data.avatar ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground text-sm">Nenhum avatar configurado ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Perfil Psicológico */}
                {data.avatar.perfil_psicologico && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-primary">🧠 Perfil Psicológico</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {["retrato", "arquetipo", "ferida_central", "contradicao"].map(key => {
                          const val = data.avatar.perfil_psicologico?.[key];
                          if (!val) return null;
                          const labels: Record<string, string> = { retrato: "Retrato", arquetipo: "Arquétipo", ferida_central: "Ferida Central", contradicao: "Contradição" };
                          return (
                            <div key={key} className="p-3 rounded-lg bg-secondary/50 border border-border">
                              <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">{labels[key]}</p>
                              <p className="text-sm text-foreground">{val}</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Strategic Desires */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-primary">💎 Desejos & Inimigo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { key: "desejo_externo", label: "💎 Desejo Externo", val: data.avatar.desejo_externo },
                        { key: "desejo_interno", label: "❤️ Desejo Interno", val: data.avatar.desejo_interno },
                        { key: "inimigo", label: "👹 Inimigo Comum", val: data.avatar.inimigo },
                        { key: "resultado_sonhado", label: "🌟 Resultado Sonhado", val: data.avatar.resultado_sonhado },
                      ].filter(x => x.val).map(x => (
                        <div key={x.key} className="p-3 rounded-lg bg-secondary/50 border border-border">
                          <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">{x.label}</p>
                          <p className="text-sm text-foreground">{x.val}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Dores */}
                {data.avatar.dores?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-destructive">🔥 Dores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {data.avatar.dores.map((d: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                            {typeof d === "string" ? d : d.dor || d.nome || d.titulo || JSON.stringify(d)}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Desejos list */}
                {data.avatar.desejos?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-primary">💎 Desejos Mapeados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {data.avatar.desejos.map((d: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {typeof d === "string" ? d : d.desejo || d.nome || d.titulo || JSON.stringify(d)}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Gatilhos */}
                {data.avatar.gatilhos?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-amber-500">⚡ Gatilhos Emocionais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {data.avatar.gatilhos.map((g: any, i: number) => (
                        <div key={i} className="text-sm text-foreground p-2 rounded-lg bg-secondary/30 border border-border">
                          {typeof g === "string" ? g : (
                            <>
                              <span className="font-medium">{g.nome || g.gatilho}</span>
                              {g.situacao && <span className="text-muted-foreground ml-1">— {g.situacao}</span>}
                            </>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Camadas da Psique */}
                {data.avatar.camadas_psique && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-primary">🧬 Camadas da Psique</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(data.avatar.camadas_psique).map(([key, val]: [string, any]) => (
                          <div key={key} className="p-3 rounded-lg bg-secondary/50 border border-border">
                            <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">{key.replace(/_/g, " ").toUpperCase()}</p>
                            <p className="text-sm text-foreground">{typeof val === "string" ? val : JSON.stringify(val)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Voyerismos */}
                {data.avatar.voyerismos?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-purple-400">👁️ Voyerismos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {data.avatar.voyerismos.map((v: any, i: number) => (
                        <div key={i} className="text-sm text-foreground p-2 rounded-lg bg-secondary/30 border border-border">
                          {typeof v === "string" ? v : v.cena || v.nome || JSON.stringify(v)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Problemas */}
                {data.avatar.problemas?.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-wider text-orange-400">⚠️ Problemas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {data.avatar.problemas.map((p: any, i: number) => (
                        <div key={i} className="text-sm text-foreground p-2 rounded-lg bg-secondary/30 border border-border">
                          {typeof p === "string" ? p : p.problema || p.nome || JSON.stringify(p)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ══════════════ TAB: DOCS ══════════════ */}
          <TabsContent value="docs" className="space-y-4">
            {(data.shared_docs?.length || 0) === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum documento compartilhado.</p>
                </CardContent>
              </Card>
            ) : (
              data.shared_docs.map((doc: any) => (
                <Card key={doc.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                          <p className="text-[10px] text-muted-foreground">Roteiro / Briefing</p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedDoc(doc)}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> Ler
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Expert Notes in docs tab too */}
            {data.expert_notes && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-primary">📝 Instruções & Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm text-foreground bg-secondary/30 rounded-lg p-4 border border-border leading-relaxed">
                    {data.expert_notes}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Card Detail Modal */}
        <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
          <DialogContent className="max-w-lg bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {PLATFORM_ICONS[selectedCard?.platform || ""] || "📌"} {selectedCard?.platform} — {selectedCard?.type}
              </DialogTitle>
              <DialogDescription>Detalhes do conteúdo planejado.</DialogDescription>
            </DialogHeader>
            {selectedCard && (
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 pr-4">
                  {selectedCard.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">🎯 Tema</p>
                      <p className="text-sm">{selectedCard.description}</p>
                    </div>
                  )}
                  {selectedCard.hook && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-500 mb-1 font-semibold">🪝 Abrir com</p>
                      <p className="text-sm font-medium">{selectedCard.hook}</p>
                    </div>
                  )}
                  {selectedCard.roteiro && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">🎬 Roteiro</p>
                      <div className="whitespace-pre-wrap text-sm bg-secondary/30 rounded-lg p-3 border border-border leading-relaxed">
                        {selectedCard.roteiro}
                      </div>
                    </div>
                  )}
                  {selectedCard.copy && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">📝 Copy / Legenda</p>
                      <div className="whitespace-pre-wrap text-sm bg-secondary/30 rounded-lg p-3 border border-border leading-relaxed">
                        {selectedCard.copy}
                      </div>
                    </div>
                  )}
                  {selectedCard.recording_tips && (
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-primary mb-1 font-semibold">🎬 Dicas de Gravação</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedCard.recording_tips}</p>
                    </div>
                  )}
                  {selectedCard.cta && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">📢 CTA</p>
                      <p className="text-sm font-medium text-primary">{selectedCard.cta}</p>
                    </div>
                  )}
                  {selectedCard.hashtags && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1"># Hashtags</p>
                      <p className="text-sm text-primary">{selectedCard.hashtags}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Doc Reader Modal */}
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="max-w-3xl border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {selectedDoc?.title || "Documento"}
              </DialogTitle>
              <DialogDescription>Leia o conteúdo compartilhado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <ScrollArea className="max-h-[70vh]">
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-7 text-foreground">
                  {selectedDoc?.content || "Sem conteúdo."}
                </div>
              </ScrollArea>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => selectedDoc && downloadDoc(selectedDoc)}>
                  <Download className="mr-2 h-4 w-4" /> Baixar .md
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <footer className="border-t border-border py-4 mt-8">
        <p className="text-center text-[10px] text-muted-foreground">Powered by <span className="font-semibold">Imperio HQ</span></p>
      </footer>
    </div>
  );
}
