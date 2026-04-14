import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, CheckCircle2, Clock, Download, FileText, Loader2, Target, Radio, Upload, Video } from "lucide-react";
import { format, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  hook?: string;
  cta?: string;
  recording_tips?: string;
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

export default function ExpertPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState("semana_1");
  const [selectedCard, setSelectedCard] = useState<ContentItem | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [expertLogs, setExpertLogs] = useState<any[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
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
        else {
          setData(d);
          setExpertLogs(d.expert_logs || []);
        }
      })
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [token, supabaseUrl]);

  const isMarkedDone = (contentId: string) => expertLogs.some(l => l.content_id === contentId && l.action === "mark_done");
  const getVideoLog = (contentId: string) => expertLogs.find(l => l.content_id === contentId && l.action === "video_upload");

  const toggleDone = async (contentId: string, week: string, day: string) => {
    const wasDone = isMarkedDone(contentId);
    // Optimistic update
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
    a.href = url;
    a.download = `${(doc.title || "documento").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadCard) return;
    const { id: contentId, week, day } = pendingUploadCard;
    setUploadingId(contentId);
    try {
      const { signed_url, path, error: urlError } = await callApi({ action: "upload_url", content_id: contentId, filename: file.name });
      if (urlError) throw new Error(urlError);

      await fetch(signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });

      const { url } = await callApi({ action: "register_upload", content_id: contentId, week, day, file_path: path, filename: file.name });
      setExpertLogs(prev => [...prev, { content_id: contentId, action: "video_upload", metadata: { url, filename: file.name, path }, created_at: new Date().toISOString() }]);
      toast.success("Vídeo enviado com sucesso!");
    } catch (err: any) {
      toast.error("Erro no upload: " + (err.message || "Tente novamente"));
    } finally {
      setUploadingId(null);
      setPendingUploadCard(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

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
   const opsStatus = data.operational_status;
   const movementContext = data.movement_context || "";

  // Calendar content dates
  const contentDates = (() => {
    const dates: Date[] = [];
    const today = new Date();
    const som2 = startOfMonth(today);
    WEEKS.forEach((wk, wi) => {
      const wp = (monthlyPlan as any)[wk] || {};
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
        {/* Hidden video input */}
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
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

        {/* Contexto do Movimento */}
        {movementContext && (
          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <p className="text-[10px] font-semibold text-amber-500 uppercase mb-1">📋 Contexto do Movimento</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{movementContext}</p>
          </div>
        )}

        {/* Avatar do Público-Alvo */}
        {data.avatar && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                👤 Avatar do Público-Alvo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Perfil Psicológico */}
              {data.avatar.perfil_psicologico && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">🧠 Perfil Psicológico</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.avatar.perfil_psicologico.retrato && (
                      <div className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">Retrato</p>
                        <p className="text-xs text-foreground">{data.avatar.perfil_psicologico.retrato}</p>
                      </div>
                    )}
                    {data.avatar.perfil_psicologico.arquetipo && (
                      <div className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">Arquétipo</p>
                        <p className="text-xs text-foreground">{data.avatar.perfil_psicologico.arquetipo}</p>
                      </div>
                    )}
                    {data.avatar.perfil_psicologico.ferida_central && (
                      <div className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">Ferida Central</p>
                        <p className="text-xs text-foreground">{data.avatar.perfil_psicologico.ferida_central}</p>
                      </div>
                    )}
                    {data.avatar.perfil_psicologico.contradicao && (
                      <div className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">Contradição Interna</p>
                        <p className="text-xs text-foreground">{data.avatar.perfil_psicologico.contradicao}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Desejos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.avatar.desejo_externo && (
                  <div className="p-2 rounded bg-secondary/50 border border-border">
                    <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">💎 Desejo Externo</p>
                    <p className="text-xs text-foreground">{data.avatar.desejo_externo}</p>
                  </div>
                )}
                {data.avatar.desejo_interno && (
                  <div className="p-2 rounded bg-secondary/50 border border-border">
                    <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">❤️ Desejo Interno</p>
                    <p className="text-xs text-foreground">{data.avatar.desejo_interno}</p>
                  </div>
                )}
                {data.avatar.inimigo && (
                  <div className="p-2 rounded bg-secondary/50 border border-border">
                    <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">👹 Inimigo Comum</p>
                    <p className="text-xs text-foreground">{data.avatar.inimigo}</p>
                  </div>
                )}
                {data.avatar.resultado_sonhado && (
                  <div className="p-2 rounded bg-secondary/50 border border-border">
                    <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">🌟 Resultado Sonhado</p>
                    <p className="text-xs text-foreground">{data.avatar.resultado_sonhado}</p>
                  </div>
                )}
              </div>

              {/* Dores */}
              {data.avatar.dores?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">🔥 Dores</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.avatar.dores.map((d: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] border-destructive/30 text-destructive">
                        {typeof d === "string" ? d : d.dor || d.nome || d.titulo || JSON.stringify(d)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Desejos list */}
              {data.avatar.desejos?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">💎 Desejos Mapeados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.avatar.desejos.map((d: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] border-primary/30 text-primary">
                        {typeof d === "string" ? d : d.desejo || d.nome || d.titulo || JSON.stringify(d)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Gatilhos */}
              {data.avatar.gatilhos?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">⚡ Gatilhos Emocionais</p>
                  <div className="space-y-1">
                    {data.avatar.gatilhos.map((g: any, i: number) => (
                      <div key={i} className="text-xs text-foreground p-1.5 rounded bg-secondary/30">
                        {typeof g === "string" ? g : (
                          <>
                            <span className="font-medium">{g.nome || g.gatilho}</span>
                            {g.situacao && <span className="text-muted-foreground ml-1">— {g.situacao}</span>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camadas da Psique */}
              {data.avatar.camadas_psique && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">🧬 Camadas da Psique</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(data.avatar.camadas_psique).map(([key, val]: [string, any]) => (
                      <div key={key} className="p-2 rounded bg-secondary/50 border border-border">
                        <p className="text-[9px] text-muted-foreground font-semibold mb-0.5">{key.replace(/_/g, " ").toUpperCase()}</p>
                        <p className="text-xs text-foreground">{typeof val === "string" ? val : JSON.stringify(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {opsStatus && (opsStatus.ads_connected || opsStatus.wa_campaigns_active > 0) && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                <Radio className="h-4 w-4" /> Status Operacional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {opsStatus.ads_connected && (
                  <div className="p-3 rounded bg-secondary/50 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">📊 Tráfego Pago</p>
                    <Badge variant={opsStatus.ads_active > 0 ? "default" : "secondary"} className="text-[9px]">
                      {opsStatus.ads_active > 0 ? `✅ ${opsStatus.ads_active} conta(s) ativa(s)` : "⏸ Contas pausadas"}
                    </Badge>
                    <div className="mt-1 space-y-0.5">
                      {opsStatus.ads_accounts?.map((a: any, i: number) => (
                        <p key={i} className="text-[9px] text-muted-foreground">
                          {a.platform} — {a.name} {a.active ? "🟢" : "🔴"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {opsStatus.wa_campaigns_active > 0 && (
                  <div className="p-3 rounded bg-secondary/50 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">💬 Campanhas WhatsApp</p>
                    <Badge variant="default" className="text-[9px]">✅ {opsStatus.wa_campaigns_active} ativa(s)</Badge>
                    <div className="mt-1 space-y-0.5">
                      {opsStatus.wa_campaigns?.map((c: any, i: number) => (
                        <p key={i} className="text-[9px] text-muted-foreground">• {c.name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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

              {WEEKS.map((wk, wi) => {
                const weekData = (monthlyPlan as any)[wk] || {};
                const summary = weekSummaries[wk];
                const dates = getWeekDates(wi);
                return (
                  <TabsContent key={wk} value={wk} className="space-y-3">
                    {(summary?.focus || summary?.event) && (
                      <div className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-secondary/20">
                        {summary.focus && <Badge variant="outline" className="text-[9px]">🎯 {summary.focus}</Badge>}
                        {summary.event && <Badge variant="outline" className="text-[9px]">📅 {summary.event}</Badge>}
                      </div>
                    )}
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS.map((day, di) => (
                        <div key={day} className="space-y-1">
                          <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{day}</p>
                            <p className="text-[9px] text-muted-foreground/70">{dates[di]}</p>
                          </div>
                          <div className="min-h-[100px] rounded border border-border bg-secondary/30 p-1 space-y-1.5">
                            {(weekData[day] || []).map((item: ContentItem) => {
                              const done = isMarkedDone(item.id);
                              const videoLog = getVideoLog(item.id);
                              const isUploading = uploadingId === item.id;
                              return (
                                <div key={item.id} className={`p-2 rounded border ${TYPE_COLORS[item.type] || "bg-secondary/50 text-foreground border-border"} ${done ? "opacity-70 ring-1 ring-green-500/40" : ""} cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all`}>
                                  <div onClick={() => setSelectedCard(item)}>
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
                                  {/* Checklist + Upload actions */}
                                  <div className="mt-1.5 pt-1.5 border-t border-current/10 space-y-1">
                                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                                      <Checkbox checked={done} onCheckedChange={() => toggleDone(item.id, wk, day)} className="h-3 w-3" />
                                      <span className="text-[9px]">{done ? "✅ Feito" : "Marcar como feito"}</span>
                                    </label>
                                    {videoLog ? (
                                      <Badge variant="secondary" className="text-[8px] h-4 gap-0.5">
                                        <Video className="h-2.5 w-2.5" /> Vídeo enviado
                                      </Badge>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 text-[9px] gap-1 p-0 px-1 text-muted-foreground"
                                        disabled={isUploading}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingUploadCard({ id: item.id, week: wk, day });
                                          videoInputRef.current?.click();
                                        }}
                                      >
                                        {isUploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
                                        {isUploading ? "Enviando..." : "Enviar Vídeo"}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
          <DialogContent className="max-w-lg bg-[#1a1816] border-[#c9922a]/30 text-foreground">
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
                {selectedCard.hook && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🪝 Hook (abertura)</p>
                    <p className="text-sm font-medium">{selectedCard.hook}</p>
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
                {selectedCard.cta && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">📢 CTA</p>
                    <p className="text-sm font-medium text-primary">{selectedCard.cta}</p>
                  </div>
                )}
                {selectedCard.recording_tips && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🎬 Como Gravar</p>
                    <div className="whitespace-pre-wrap text-sm bg-secondary/30 rounded p-3 border border-border">
                      {selectedCard.recording_tips}
                    </div>
                  </div>
                )}
                {selectedCard.hashtags && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1"># Hashtags</p>
                    <p className="text-sm text-primary">{selectedCard.hashtags}</p>
                  </div>
                )}
                {!selectedCard.copy && !selectedCard.description && !selectedCard.hook && (
                  <p className="text-sm text-muted-foreground">Nenhum detalhe adicionado ainda.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Documentos Compartilhados */}
        {data.shared_docs?.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans uppercase tracking-wider text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" /> 📄 Documentos & Roteiros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.shared_docs.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">Abra para ler no portal ou baixe em Markdown.</p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedDoc(doc)}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Abrir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadDoc(doc)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="max-w-3xl border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                {selectedDoc?.title || "Documento"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Leia o conteúdo compartilhado sem sair do Portal do Expert.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-7 text-foreground">
                {selectedDoc?.content || "Sem conteúdo."}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => selectedDoc && downloadDoc(selectedDoc)}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar .md
                </Button>
              </div>
            </div>
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
