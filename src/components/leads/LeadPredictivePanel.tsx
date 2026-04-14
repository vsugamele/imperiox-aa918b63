import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, AlertTriangle, Target, Zap, RefreshCw, DollarSign, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Prediction {
  id: string;
  lead_id: string;
  conversion_probability: number;
  churn_risk: string;
  predicted_value: number;
  recommended_actions: string[];
  ai_summary: string;
  scoring_factors: any;
  next_best_action: string;
  expires_at: string;
}

interface Props {
  leadIds: string[];
  projectFilter: string;
}

const RISK_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  low: { label: "Baixo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: <TrendingUp className="h-3 w-3" /> },
  medium: { label: "Médio", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <AlertTriangle className="h-3 w-3" /> },
  high: { label: "Alto", color: "bg-destructive/20 text-destructive border-destructive/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function LeadPredictivePanel({ leadIds, projectFilter }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadPredictions = async () => {
    setLoading(true);
    let query = supabase.from("imphq_lead_predictions").select("*").order("conversion_probability", { ascending: false });
    if (projectFilter !== "all" && projectFilter !== "none") {
      query = query.eq("project_id", projectFilter);
    }
    const { data } = await query.limit(50);
    setPredictions((data || []) as unknown as Prediction[]);
    setLoading(false);
  };

  useEffect(() => { loadPredictions(); }, [projectFilter]);

  const runAnalysis = async () => {
    if (leadIds.length === 0) { toast.error("Nenhum lead para analisar"); return; }
    setAnalyzing(true);
    const idsToAnalyze = leadIds.slice(0, 20);
    toast.info(`Analisando ${idsToAnalyze.length} leads com IA...`);

    try {
      const { data, error } = await supabase.functions.invoke("lead-predict", {
        body: { lead_ids: idsToAnalyze },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`${data.count} predições geradas!`);
        loadPredictions();
      } else {
        toast.error(data?.error || "Erro na análise");
      }
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit - tente novamente em alguns segundos");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes - adicione fundos em Settings > Workspace");
      else toast.error("Erro: " + (err?.message || "desconhecido"));
    }
    setAnalyzing(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // Summary stats
  const avgConversion = predictions.length > 0 ? Math.round(predictions.reduce((s, p) => s + p.conversion_probability, 0) / predictions.length) : 0;
  const totalPredictedValue = predictions.reduce((s, p) => s + (p.predicted_value || 0), 0);
  const highRisk = predictions.filter(p => p.churn_risk === "high").length;
  const hotLeads = predictions.filter(p => p.conversion_probability >= 70).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-lg">CRM Preditivo</h3>
          <Badge variant="outline" className="text-[10px]">{predictions.length} predições</Badge>
        </div>
        <Button size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1.5">
          {analyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          {analyzing ? "Analisando..." : "Analisar com IA"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Conversão Média</p>
            <p className="text-2xl font-bold text-primary">{avgConversion}%</p>
            <Progress value={avgConversion} className="h-1 mt-1" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Receita Prevista</p>
            <p className="text-2xl font-bold text-emerald-400">R$ {totalPredictedValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Leads Quentes</p>
            <p className="text-2xl font-bold text-amber-400">{hotLeads}</p>
            <p className="text-[9px] text-muted-foreground">≥ 70% conversão</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Risco Alto</p>
            <p className="text-2xl font-bold text-destructive">{highRisk}</p>
            <p className="text-[9px] text-muted-foreground">churn iminente</p>
          </CardContent>
        </Card>
      </div>

      {/* Predictions List */}
      {predictions.length === 0 && !loading && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma predição ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Analisar com IA" para gerar predições dos seus leads.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {predictions.map((pred) => {
          const risk = RISK_CONFIG[pred.churn_risk] || RISK_CONFIG.medium;
          const isExpanded = expanded.has(pred.id);
          const probColor = pred.conversion_probability >= 70 ? "text-emerald-400" : pred.conversion_probability >= 40 ? "text-amber-400" : "text-destructive";

          return (
            <Card key={pred.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => toggleExpand(pred.id)}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </div>

                  {/* Conversion gauge */}
                  <div className="w-12 text-center">
                    <span className={cn("text-lg font-bold", probColor)}>{pred.conversion_probability}</span>
                    <span className="text-[9px] text-muted-foreground block">%</span>
                  </div>

                  {/* Lead info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{pred.ai_summary}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn("text-[9px] gap-0.5", risk.color)}>
                        {risk.icon} {risk.label}
                      </Badge>
                      {pred.predicted_value > 0 && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                          <DollarSign className="h-2.5 w-2.5" />R$ {pred.predicted_value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </span>
                      )}
                      {pred.next_best_action && (
                        <span className="text-[10px] text-primary flex items-center gap-0.5 truncate">
                          <Target className="h-2.5 w-2.5 shrink-0" /> {pred.next_best_action}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">📋 Ações Recomendadas</p>
                      <ul className="space-y-1">
                        {(pred.recommended_actions || []).map((action, i) => (
                          <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {pred.scoring_factors && Object.keys(pred.scoring_factors).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">🔍 Fatores de Scoring</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(pred.scoring_factors).map(([key, val]) => (
                            <Badge key={key} variant="outline" className={cn("text-[9px]", val ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
                              {key.replace(/_/g, " ")}: {String(val)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
