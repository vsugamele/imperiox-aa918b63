import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodRange } from "@/lib/periodUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, Brain, Target, AlertTriangle, Sparkles, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
}

interface DailyData {
  dia: string;
  receita: number;
  vendas: number;
  leads: number;
}

interface Forecast {
  projected30d: number;
  trend: "up" | "down" | "stable";
  trendPct: number;
  confidence: number;
}

interface Anomaly {
  type: "spike" | "drop";
  metric: string;
  value: number;
  expected: number;
  date: string;
  severity: "warning" | "critical";
}

interface FunnelHealth {
  score: number;
  grade: string;
  details: { label: string; value: number; benchmark: number; status: "good" | "warning" | "critical" }[];
}

interface AIRecommendation {
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  cta?: { label: string; to: string };
}

// Simple linear regression
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 };
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0;
  data.forEach((y, x) => {
    ssXY += (x - xMean) * (y - yMean);
    ssXX += (x - xMean) ** 2;
  });
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = yMean - slope * xMean;
  data.forEach((y, x) => {
    const predicted = slope * x + intercept;
    ssRes += (y - predicted) ** 2;
    ssTot += (y - yMean) ** 2;
  });
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function detectAnomalies(dailyData: DailyData[]): Anomaly[] {
  if (dailyData.length < 7) return [];
  const anomalies: Anomaly[] = [];
  const recentDays = dailyData.slice(-14);

  // Calculate moving average and std dev for revenue
  for (let i = 7; i < recentDays.length; i++) {
    const window = recentDays.slice(i - 7, i);
    const avg = window.reduce((s, d) => s + d.receita, 0) / 7;
    const stdDev = Math.sqrt(window.reduce((s, d) => s + (d.receita - avg) ** 2, 0) / 7);
    const current = recentDays[i];
    const threshold = Math.max(stdDev * 2, avg * 0.5);

    if (current.receita > avg + threshold && avg > 0) {
      anomalies.push({
        type: "spike", metric: "Receita", value: current.receita,
        expected: avg, date: current.dia,
        severity: current.receita > avg * 3 ? "critical" : "warning"
      });
    } else if (current.receita < avg - threshold && avg > 50) {
      anomalies.push({
        type: "drop", metric: "Receita", value: current.receita,
        expected: avg, date: current.dia,
        severity: current.receita < avg * 0.3 ? "critical" : "warning"
      });
    }
  }
  return anomalies.slice(-5);
}

function calculateFunnelHealth(data: { leads: number; checkouts: number; vendas: number; adsSpend: number }): FunnelHealth {
  const leadToCheckout = data.leads > 0 ? (data.checkouts / data.leads) * 100 : 0;
  const checkoutToSale = data.checkouts > 0 ? (data.vendas / data.checkouts) * 100 : 0;
  const overallConversion = data.leads > 0 ? (data.vendas / data.leads) * 100 : 0;

  const details = [
    { label: "Lead → Checkout", value: leadToCheckout, benchmark: 15, status: leadToCheckout >= 15 ? "good" as const : leadToCheckout >= 8 ? "warning" as const : "critical" as const },
    { label: "Checkout → Venda", value: checkoutToSale, benchmark: 30, status: checkoutToSale >= 30 ? "good" as const : checkoutToSale >= 15 ? "warning" as const : "critical" as const },
    { label: "Conversão Geral", value: overallConversion, benchmark: 5, status: overallConversion >= 5 ? "good" as const : overallConversion >= 2 ? "warning" as const : "critical" as const },
  ];

  const scores = details.map(d => d.status === "good" ? 100 : d.status === "warning" ? 60 : 20);
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";

  return { score, grade, details };
}

function generateRecommendations(
  forecast: Forecast, anomalies: Anomaly[], health: FunnelHealth,
  data: { avgCPL: number; roas: number; totalLeads: number; totalVendas: number }
): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  if (forecast.trend === "down" && forecast.trendPct < -15) {
    recs.push({
      icon: "📉", title: "Receita em queda", priority: "high",
      description: `Tendência de queda de ${Math.abs(forecast.trendPct).toFixed(0)}%. Revise seus criativos e landing pages — a fadiga de anúncio pode estar afetando a performance.`,
      cta: { label: "Auditar criativos", to: "/criativos" },
    });
  }
  if (data.roas > 0 && data.roas < 1.5) {
    recs.push({
      icon: "🚨", title: "ROAS baixo", priority: "high",
      description: `ROAS atual de ${data.roas.toFixed(1)}x. Considere pausar campanhas com ROAS < 1x e concentrar budget nas que performam melhor.`,
      cta: { label: "Abrir Gerenciador", to: "/gerenciador" },
    });
  }
  if (data.avgCPL > 40) {
    recs.push({
      icon: "💰", title: "CPL elevado", priority: "medium",
      description: `CPL médio de R$ ${data.avgCPL.toFixed(2)}. Teste novos públicos, copys mais diretas ou formatos de vídeo curto para reduzir o custo.`,
      cta: { label: "Otimizar campanhas", to: "/gerenciador" },
    });
  }
  if (health.details.find(d => d.label === "Checkout → Venda" && d.status === "critical")) {
    recs.push({
      icon: "🛒", title: "Abandono de checkout alto", priority: "high",
      description: "Menos de 15% dos checkouts convertem. Revise: preço, formas de pagamento, sequência de recuperação e urgência na página.",
      cta: { label: "Recuperar agora", to: "/recuperacao" },
    });
  }
  if (health.details.find(d => d.label === "Lead → Checkout" && d.status === "critical")) {
    recs.push({
      icon: "🎯", title: "Leads não avançam no funil", priority: "medium",
      description: "Poucos leads chegam ao checkout. Melhore a sequência de nutrição (emails + WhatsApp) e a proposta de valor na página de vendas.",
      cta: { label: "Ajustar nutrição", to: "/nutricao" },
    });
  }
  if (forecast.trend === "up" && forecast.trendPct > 20) {
    recs.push({
      icon: "🚀", title: "Momento de escala", priority: "medium",
      description: `Crescimento de ${forecast.trendPct.toFixed(0)}%! Aproveite para aumentar budget gradualmente (20-30% por semana) e duplicar criativos vencedores.`,
      cta: { label: "Escalar budget", to: "/gerenciador" },
    });
  }
  if (anomalies.some(a => a.type === "spike")) {
    recs.push({
      icon: "⚡", title: "Pico detectado", priority: "low",
      description: "Houve um pico anormal de receita. Investigue se foi uma campanha específica que funcionou — duplique e escale essa abordagem.",
      cta: { label: "Ver campanhas", to: "/gerenciador" },
    });
  }
  if (data.totalLeads > 100 && data.totalVendas < 3) {
    recs.push({
      icon: "🔍", title: "Qualidade de lead baixa", priority: "high",
      description: "Muitos leads mas poucas vendas. O público pode estar desqualificado. Revise segmentação e adicione perguntas de qualificação no formulário.",
      cta: { label: "Revisar leads", to: "/leads" },
    });
  }

  return recs.slice(0, 5);
}

export default function PredictiveDashboard({ period, projectFilter, productFilter }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [funnelHealth, setFunnelHealth] = useState<FunnelHealth | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use period for filtering vendas/leads, but always use 90d window for regression
      const { from: periodFrom } = getPeriodRange(period);
      const d90 = new Date(Date.now() - 90 * 86400000).toISOString();
      const fromDate = d90; // regression always needs 90d

      let vendasQ = supabase.from("imphq_vendas").select("valor, status, created_at, produto_nome, project_id").gte("created_at", fromDate);
      if (projectFilter && projectFilter !== "all") vendasQ = vendasQ.eq("project_id", projectFilter);
      if (productFilter && productFilter !== "all") vendasQ = vendasQ.eq("produto_nome", productFilter);

      let leadsQ = supabase.from("imphq_leads").select("id, status, created_at, data, project_id").gte("created_at", fromDate);
      if (projectFilter && projectFilter !== "all") leadsQ = leadsQ.eq("project_id", projectFilter);

      let adsQ = supabase.from("imphq_ads_spend").select("valor, leads, data_ref, project_id").gte("data_ref", fromDate.slice(0, 10));
      if (projectFilter && projectFilter !== "all") adsQ = adsQ.eq("project_id", projectFilter);

      const [vendasRes, leadsRes, adsRes] = await Promise.all([vendasQ, leadsQ, adsQ]);

      // Build daily data
      const dayMap: Record<string, DailyData> = {};
      const nowMs = Date.now();
      for (let i = 0; i < 90; i++) {
        const d = new Date(nowMs - i * 86400000);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        dayMap[key] = { dia: key, receita: 0, vendas: 0, leads: 0 };
      }

      (vendasRes.data || []).forEach((v: any) => {
        const key = v.created_at?.slice(0, 10);
        if (key && dayMap[key]) {
          dayMap[key].vendas++;
          if (v.status === "aprovado") dayMap[key].receita += parseFloat(v.valor) || 0;
        }
      });

      (leadsRes.data || []).forEach((l: any) => {
        const key = l.created_at?.slice(0, 10);
        if (key && dayMap[key]) dayMap[key].leads++;
      });

      const dailyData = Object.values(dayMap).sort((a, b) => a.dia.localeCompare(b.dia));
      const revenueArr = dailyData.map(d => d.receita);

      // Forecast
      const last30 = revenueArr.slice(-30);
      const { slope, intercept, r2 } = linearRegression(last30);
      const current30Total = last30.reduce((a, b) => a + b, 0);
      const projected = Array.from({ length: 30 }, (_, i) => Math.max(0, slope * (30 + i) + intercept)).reduce((a, b) => a + b, 0);
      const trendPct = current30Total > 0 ? ((projected - current30Total) / current30Total) * 100 : 0;

      const fc: Forecast = {
        projected30d: projected,
        trend: trendPct > 5 ? "up" : trendPct < -5 ? "down" : "stable",
        trendPct,
        confidence: Math.max(0, Math.min(100, Math.round(Math.abs(r2) * 100)))
      };
      setForecast(fc);

      // Anomalies
      const anom = detectAnomalies(dailyData);
      setAnomalies(anom);

      // Funnel health
      const totalLeads = (leadsRes.data || []).length;
      const checkouts = (leadsRes.data || []).filter((l: any) => {
        const evt = (l.data as any)?.ultimo_evento;
        return evt && ["checkout", "inicio_checkout", "initiate_checkout", "purchase_out_of_shopping_cart",
          "pix_gerado", "pix_created", "boleto_gerado", "purchase_billet_printed",
          "cartao_recusado", "refused", "pagamento_recusado", "aguardando_pagamento", "pendente"].includes(evt);
      }).length;
      const totalVendas = (vendasRes.data || []).filter((v: any) => v.status === "aprovado").length;
      const totalAdsSpend = (adsRes.data || []).reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
      const totalAdsLeads = (adsRes.data || []).reduce((s: number, a: any) => s + (a.leads || 0), 0);

      const health = calculateFunnelHealth({ leads: totalLeads, checkouts, vendas: totalVendas, adsSpend: totalAdsSpend });
      setFunnelHealth(health);

      // Recommendations
      const avgCPL = totalAdsLeads > 0 ? totalAdsSpend / totalAdsLeads : 0;
      const roas = totalAdsSpend > 0 ? (vendasRes.data || []).filter((v: any) => v.status === "aprovado").reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0) / totalAdsSpend : 0;
      const recs = generateRecommendations(fc, anom, health, { avgCPL, roas, totalLeads, totalVendas });
      setRecommendations(recs);
    } catch (e) {
      console.error("PredictiveDashboard error:", e);
    } finally {
      setLoading(false);
    }
  }, [period, projectFilter, productFilter]);

  useEffect(() => { load(); }, [load]);

  const generateAIInsight = async () => {
    setAiLoading(true);
    try {
      const context = {
        forecast,
        anomalies: anomalies.length,
        funnelScore: funnelHealth?.score,
        recommendations: recommendations.map(r => r.title),
      };
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "generate",
          prompt: `Analise estes dados de performance do negócio e dê um resumo executivo em 3-4 frases com ação imediata mais importante:\n${JSON.stringify(context)}`,
          systemPrompt: "Você é um consultor de marketing digital especialista em funis de venda e tráfego pago. Seja direto, use dados e sugira ações concretas."
        }
      });
      if (error) throw error;
      setAiInsight(data?.result || data?.text || "Não foi possível gerar insight.");
    } catch (e: any) {
      toast.error("Erro ao gerar insight IA");
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  const trendColor = forecast?.trend === "up" ? "text-emerald-400" : forecast?.trend === "down" ? "text-red-400" : "text-amber-400";
  const TrendIcon = forecast?.trend === "up" ? TrendingUp : forecast?.trend === "down" ? TrendingDown : Activity;
  const healthColor = (funnelHealth?.score || 0) >= 80 ? "text-emerald-400" : (funnelHealth?.score || 0) >= 50 ? "text-amber-400" : "text-red-400";
  const healthBg = (funnelHealth?.score || 0) >= 80 ? "bg-emerald-500/15" : (funnelHealth?.score || 0) >= 50 ? "bg-amber-500/15" : "bg-red-500/15";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Inteligência Preditiva</h2>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">BETA</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="text-xs gap-1">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Menos" : "Detalhes"}
        </Button>
      </div>

      {/* Top cards — clicáveis: abrem detalhes (toggle expanded) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Forecast */}
        <Card
          className="border-border bg-card/60 cursor-pointer hover:scale-[1.02] hover:border-primary/40 transition-all"
          onClick={() => setExpanded(true)}
          title="Clique para ver detalhes da projeção"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Projeção 30 dias</span>
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              R$ {(forecast?.projected30d || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium ${trendColor}`}>
                {(forecast?.trendPct || 0) > 0 ? "+" : ""}{(forecast?.trendPct || 0).toFixed(1)}%
              </span>
              <span className="text-[10px] text-muted-foreground">confiança {forecast?.confidence}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Health */}
        <Card
          className="border-border bg-card/60 cursor-pointer hover:scale-[1.02] hover:border-primary/40 transition-all"
          onClick={() => setExpanded(true)}
          title="Clique para ver as 3 métricas do funil"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Saúde do Funil</span>
              <Target className={`h-4 w-4 ${healthColor}`} />
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl ${healthBg} flex items-center justify-center`}>
                <span className={`text-2xl font-bold ${healthColor}`}>{funnelHealth?.grade}</span>
              </div>
              <div>
                <p className={`text-xl font-mono font-bold ${healthColor}`}>{funnelHealth?.score}/100</p>
                <p className="text-[10px] text-muted-foreground">baseado em 3 métricas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anomalies */}
        <Card
          className="border-border bg-card/60 cursor-pointer hover:scale-[1.02] hover:border-primary/40 transition-all"
          onClick={() => setExpanded(true)}
          title={anomalies.length > 0 ? "Ver lista de anomalias" : "Sem anomalias"}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Anomalias Detectadas</span>
              <AlertTriangle className={`h-4 w-4 ${anomalies.length > 0 ? "text-amber-400" : "text-emerald-400"}`} />
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">{anomalies.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {anomalies.length === 0 ? "Nenhum desvio significativo" : `${anomalies.filter(a => a.severity === "critical").length} críticas`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          {/* Funnel Health Details */}
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Detalhes do Funil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelHealth?.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{d.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.status === "good" ? "bg-emerald-500" : d.status === "warning" ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, (d.value / d.benchmark) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono ${
                      d.status === "good" ? "text-emerald-400" : d.status === "warning" ? "text-amber-400" : "text-red-400"
                    }`}>
                      {d.value.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">(meta {d.benchmark}%)</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Anomalies list */}
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Anomalias Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <p className="text-xs text-muted-foreground">✅ Nenhuma anomalia detectada nos últimos 14 dias</p>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                      a.severity === "critical" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
                    }`}>
                      <span className="text-sm">{a.type === "spike" ? "📈" : "📉"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {a.type === "spike" ? "Pico" : "Queda"} em {a.metric}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.date} — R$ {a.value.toFixed(0)} (esperado ~R$ {a.expected.toFixed(0)})
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${
                        a.severity === "critical" ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"
                      }`}>
                        {a.severity === "critical" ? "CRÍTICO" : "ATENÇÃO"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Recomendações Inteligentes
              </CardTitle>
              <Button size="sm" variant="outline" onClick={generateAIInsight} disabled={aiLoading} className="text-xs gap-1 h-7">
                <Brain className="h-3 w-3" />
                {aiLoading ? "Analisando..." : "Análise IA"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiInsight && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{aiInsight}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((r, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-lg border ${
                  r.priority === "high" ? "bg-red-500/5 border-red-500/15" :
                  r.priority === "medium" ? "bg-amber-500/5 border-amber-500/15" :
                  "bg-secondary/30 border-border"
                }`}>
                  <span className="text-lg shrink-0">{r.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">{r.title}</p>
                      <Badge variant="outline" className={`text-[8px] h-4 ${
                        r.priority === "high" ? "border-red-500/30 text-red-400" :
                        r.priority === "medium" ? "border-amber-500/30 text-amber-400" :
                        "border-border text-muted-foreground"
                      }`}>
                        {r.priority === "high" ? "URGENTE" : r.priority === "medium" ? "IMPORTANTE" : "SUGESTÃO"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                    {r.cta && (
                      <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-[11px] gap-1">
                        <Link to={r.cta.to}>
                          {r.cta.label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
