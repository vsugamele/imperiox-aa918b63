import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, CheckCircle2, Clock, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

interface ContentItem {
  id: string;
  platform: string;
  type: string;
  description: string;
}

export default function ExpertPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const contentPlan = data.content_plan || {};
  const totalContent = DAYS.reduce((s, d) => s + (contentPlan[d]?.length || 0), 0);
  const activePlatforms = new Set(DAYS.flatMap(d => (contentPlan[d] || []).map((i: ContentItem) => i.platform))).size;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">🧭 {data.project_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel do Expert — visão semanal</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Eventos (7d)", value: data.events?.length || 0 },
            { label: "Tarefas", value: data.tasks?.length || 0 },
            { label: "Posts/Semana", value: totalContent },
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

          {/* Tarefas */}
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
                  <p className="text-xs truncate flex-1">{t.title}</p>
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

        {/* Plano de Conteúdo */}
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
                    {(contentPlan[day] || []).map((item: ContentItem) => (
                      <div key={item.id} className="p-1.5 rounded bg-background border border-border text-[9px] space-y-0.5">
                        <p className="font-semibold text-primary">{item.platform}</p>
                        <p className="text-muted-foreground">{item.type}</p>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    ))}
                    {!(contentPlan[day]?.length) && (
                      <p className="text-[8px] text-muted-foreground text-center pt-4">—</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-8">
        <p className="text-center text-[10px] text-muted-foreground">Powered by <span className="font-semibold">Imperio HQ</span></p>
      </footer>
    </div>
  );
}
