/**
 * WeeklyReportWidget — Exibe o último relatório semanal gerado
 * Lê o evento `weekly_report_generated` mais recente de imphq_events
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, MessageSquare, HelpCircle, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface WeeklyReportWidgetProps {
  projectFilter?: string;
}

interface ReportData {
  week_label: string;
  conversions: number;
  revenue: number;
  new_leads: number;
  active_conversations: number;
  unanswered_questions: number;
  top_flows: Array<{ nome: string; conversions: number; revenue: number }>;
  report_text?: string;
}

export function WeeklyReportWidget({ projectFilter }: WeeklyReportWidgetProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportDate, setReportDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("imphq_events")
        .select("event_data, created_at, project_id")
        .eq("event_name", "weekly_report_generated")
        .order("created_at", { ascending: false })
        .limit(1);

      if (projectFilter) q = q.eq("project_id", projectFilter);

      const { data, error } = await q;
      if (error) throw error;

      if (data?.[0]) {
        setReport(data[0].event_data as unknown as ReportData);
        setReportDate(data[0].created_at);
      } else {
        setReport(null);
      }
    } catch (e: any) {
      console.error("WeeklyReportWidget:", e.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadReport(); }, [projectFilter]);

  const handleTriggerNow = async () => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("wa-weekly-report", { body: {} });
      if (error) throw error;
      toast.success("Relatório gerado! Atualizando...");
      setTimeout(loadReport, 2000);
    } catch (e: any) {
      toast.error("Erro ao gerar relatório: " + e.message);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/40 bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Relatório Semanal</CardTitle>
          {reportDate && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {formatDistanceToNow(new Date(reportDate), { addSuffix: true, locale: ptBR })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-muted-foreground"
            onClick={handleTriggerNow}
            disabled={triggering}
            title="Gerar relatório agora"
          >
            {triggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>

      {!report ? (
        <CardContent className="pb-5">
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">Nenhum relatório gerado ainda.</p>
            <p className="text-[10px] text-muted-foreground/60">
              O relatório é enviado toda segunda-feira às 08h.<br />
              Configure seu número no WhatsApp &gt; Configurações da IA.
            </p>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-2" onClick={handleTriggerNow} disabled={triggering}>
              {triggering ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Gerar agora
            </Button>
          </div>
        </CardContent>
      ) : (
        <CardContent className="pb-4 space-y-3">
          {/* Semana */}
          {report.week_label && (
            <p className="text-[10px] text-muted-foreground">📅 {report.week_label}</p>
          )}

          {/* Métricas principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Conversões
              </div>
              <p className="text-xl font-bold text-emerald-400">{report.conversions}</p>
              {report.revenue > 0 && (
                <p className="text-[10px] text-emerald-300/70">
                  R$ {Number(report.revenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3 text-blue-400" /> Novos Leads
              </div>
              <p className="text-xl font-bold text-blue-400">{report.new_leads}</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MessageSquare className="h-3 w-3 text-amber-400" /> Conversas Ativas
              </div>
              <p className="text-xl font-bold text-amber-400">{report.active_conversations}</p>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <HelpCircle className="h-3 w-3 text-red-400" /> Sem Resposta
              </div>
              <p className="text-xl font-bold text-red-400">{report.unanswered_questions}</p>
              <p className="text-[10px] text-muted-foreground/60">perguntas</p>
            </div>
          </div>

          {/* Top fluxos */}
          {report.top_flows?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">🔄 Fluxos com melhor desempenho</p>
              {report.top_flows.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                  <span className="text-xs text-foreground truncate max-w-[60%]">{f.nome || "Fluxo"}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{f.conversions} conv.</span>
                    {f.revenue > 0 && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        R$ {Number(f.revenue).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Texto completo (expandível) */}
          {expanded && report.report_text && (
            <div className="border border-border/30 rounded-xl bg-secondary/20 p-3 animate-fade-in">
              <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wider">Mensagem enviada via WhatsApp</p>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {report.report_text}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
