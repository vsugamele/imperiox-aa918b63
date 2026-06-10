import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, Cell } from "recharts";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, Users, Activity, TrendingUp, ArrowRight, CornerDownRight, Clock, Split, Zap, Trash2, Download, Tag, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface OpenFlowAnalyticsProps {
  automacoes: any[];
}

interface StepStat {
  index: number;
  tipo: string;
  label: string;
  templateName: string;
  reached: number;
  completed: number;
  waiting: number;
  failed: number;
  droppedOff: number;
  progressionRate: number;
  dropOffRate: number;
  abTestEnabled: boolean;
  abStats: {
    a: { reached: number; completed: number; droppedOff: number; progressionRate: number; dropOffRate: number };
    b: { reached: number; completed: number; droppedOff: number; progressionRate: number; dropOffRate: number };
  };
  avgDuration: string;
  stalledCount: number;
  routeTriggers: Record<string, number>;
}

export function OpenFlowAnalytics({ automacoes }: OpenFlowAnalyticsProps) {
  const [selectedAutoId, setSelectedAutoId] = useState<string>("");
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Recovery dialog states
  const [recoveringStepIdx, setRecoveringStepIdx] = useState<number | null>(null);
  const [recoveringLeads, setRecoveringLeads] = useState<any[]>([]);
  const [fetchingLeads, setFetchingLeads] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const [revenueByFlow, setRevenueByFlow] = useState<{nome: string; receita: number; count: number; automacao_id: string}[]>([]);

  // Auto-select first automation if available
  useEffect(() => {
    if (automacoes.length > 0 && !selectedAutoId) {
      setSelectedAutoId(automacoes[0].id);
    }
  }, [automacoes]);

  // Load revenue attribution by flow (last 30 days)
  useEffect(() => {
    const loadRevenue = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: vendas } = await supabase
        .from('imphq_vendas')
        .select('valor, data')
        .eq('status', 'aprovado')
        .gte('created_at', thirtyDaysAgo);

      const byFlow = new Map<string, {nome: string; receita: number; count: number; automacao_id: string}>();
      (vendas || []).forEach((v: any) => {
        const attrId = v.data?.flow_attribution_id;
        const attrNome = v.data?.flow_attribution_nome || 'Direto (sem fluxo)';
        if (attrId) {
          const current = byFlow.get(attrId) || { nome: attrNome, receita: 0, count: 0, automacao_id: attrId };
          byFlow.set(attrId, { ...current, receita: current.receita + (v.valor || 0), count: current.count + 1 });
        }
      });
      setRevenueByFlow(Array.from(byFlow.values()).sort((a, b) => b.receita - a.receita));
    };
    loadRevenue();
  }, []);

  // Load executions for the selected automation
  useEffect(() => {
    if (!selectedAutoId) return;

    const fetchExecutions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("imphq_flow_executions")
          .select("id, status, step_results, created_at, lead_id")
          .eq("automacao_id", selectedAutoId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setExecutions(data || []);
      } catch (err) {
        console.error("Erro ao carregar execuções para analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [selectedAutoId]);

  const selectedAuto = automacoes.find(a => a.id === selectedAutoId);
  const acoes = selectedAuto?.acoes || [];
  const acoesCount = acoes.length;

  // Process statistics
  const stats: StepStat[] = acoes.map((acao: any, idx: number) => {
    let label = acao.tipo;
    if (acao.tipo === "ia_message") label = "IA Conversacional (Mente)";
    else if (acao.tipo === "whatsapp") label = "WhatsApp";
    else if (acao.tipo === "email") label = "Email (Resend)";
    else if (acao.tipo === "audio") label = "Áudio (IA)";
    else if (acao.tipo === "telegram") label = "Telegram";
    else if (acao.tipo === "aguardar") label = "Aguardar / Delay";
    else if (acao.tipo === "adicionar_tag") label = "Adicionar Tag";
    else if (acao.tipo === "remover_tag") label = "Remover Tag";
    else if (acao.tipo === "condicao_lead") label = "Condição por Dado";
    else if (acao.tipo === "webhook_call") label = "Webhook / API";

    return {
      index: idx,
      tipo: acao.tipo,
      label,
      templateName: acao.template || "",
      reached: 0,
      completed: 0,
      waiting: 0,
      failed: 0,
      droppedOff: 0,
      progressionRate: 0,
      dropOffRate: 0,
      abTestEnabled: acao.ab_test_enabled || false,
      abStats: {
        a: { reached: 0, completed: 0, droppedOff: 0, progressionRate: 0, dropOffRate: 0 },
        b: { reached: 0, completed: 0, droppedOff: 0, progressionRate: 0, dropOffRate: 0 }
      },
      avgDuration: "N/A",
      stalledCount: 0,
      routeTriggers: {}
    };
  });

  // Calculate counts based on executions
  const nowMs = Date.now();
  const TWO_HOURS_MS = 2 * 3600 * 1000;

  executions.forEach((exec) => {
    const stepResults = exec.step_results || [];
    if (!Array.isArray(stepResults)) return;

    // Check for stalled leads (>2h at same step)
    if (exec.status === "running" || exec.status === "waiting") {
      const lastRes = stepResults[stepResults.length - 1];
      if (lastRes && lastRes.started_at) {
        const startedTime = new Date(lastRes.started_at).getTime();
        if (nowMs - startedTime > TWO_HOURS_MS) {
          const stepIdx = typeof lastRes.step === "number" ? lastRes.step : parseInt(lastRes.step);
          if (!isNaN(stepIdx) && stepIdx >= 0 && stepIdx < stats.length) {
            stats[stepIdx].stalledCount++;
          }
        }
      }
    }

    stepResults.forEach((stepRes: any) => {
      const stepIdx = typeof stepRes.step === "number" ? stepRes.step : parseInt(stepRes.step);
      if (isNaN(stepIdx) || stepIdx < 0 || stepIdx >= acoesCount) return;

      const stat = stats[stepIdx];
      stat.reached++;

      const isCompleted = stepRes.status === "completed" || stepRes.status === "sent" || stepRes.status === "success" || stepRes.status === "guided_ai_completed";
      const isWaiting = stepRes.status === "waiting" || stepRes.status === "running" || stepRes.status === "waiting_for_lead_response" || stepRes.status === "delayed_for_condition";
      const isFailed = stepRes.status === "error" || stepRes.status === "failed";

      if (isCompleted) {
        stat.completed++;
        // Track IA routes activation rate
        if (stepRes.notes && stepRes.notes.includes("Rota acionada:")) {
          const match = stepRes.notes.match(/Rota acionada:\s*([^\s(]+)/);
          if (match) {
            const routeName = match[1];
            stat.routeTriggers[routeName] = (stat.routeTriggers[routeName] || 0) + 1;
          }
        }
      } else if (isWaiting) {
        stat.waiting++;
      } else if (isFailed) {
        stat.failed++;
      }

      // Check variant
      const variant = stepRes.ab_variant;
      if (variant === "A" || variant === "B") {
        const vKey = variant.toLowerCase() as "a" | "b";
        stat.abStats[vKey].reached++;
        
        // Progression to next step
        const reachedNext = stepResults.some((r: any) => r.step === stepIdx + 1);
        if (stepIdx < acoesCount - 1) {
          if (reachedNext) {
            stat.abStats[vKey].completed++;
          } else {
            if (isCompleted) {
              stat.abStats[vKey].droppedOff++;
            }
          }
        } else {
          // Last step: completed is success
          if (isCompleted) {
            stat.abStats[vKey].completed++;
          } else if (!isWaiting) {
            stat.abStats[vKey].droppedOff++;
          }
        }
      }
    });
  });

  // Calculate rates and duration
  stats.forEach((stat, idx) => {
    // General rates
    if (idx < acoesCount - 1) {
      const nextStat = stats[idx + 1];
      stat.droppedOff = Math.max(0, stat.completed - nextStat.reached);
      stat.progressionRate = stat.reached > 0 ? (nextStat.reached / stat.reached) * 100 : 0;
      stat.dropOffRate = stat.reached > 0 ? (stat.droppedOff / stat.reached) * 100 : 0;
    } else {
      stat.droppedOff = Math.max(0, stat.reached - stat.completed - stat.waiting);
      stat.progressionRate = stat.reached > 0 ? (stat.completed / stat.reached) * 100 : 0;
      stat.dropOffRate = stat.reached > 0 ? (stat.droppedOff / stat.reached) * 100 : 0;
    }

    // A/B Variant rates
    const a = stat.abStats.a;
    const b = stat.abStats.b;
    a.progressionRate = a.reached > 0 ? (a.completed / a.reached) * 100 : 0;
    a.dropOffRate = a.reached > 0 ? (a.droppedOff / a.reached) * 100 : 0;
    b.progressionRate = b.reached > 0 ? (b.completed / b.reached) * 100 : 0;
    b.dropOffRate = b.reached > 0 ? (b.droppedOff / b.reached) * 100 : 0;

    // Calculate average duration
    let totalMs = 0;
    let count = 0;

    executions.forEach((exec) => {
      const results = exec.step_results || [];
      if (!Array.isArray(results)) return;

      const startObj = results.find((r: any) => r.step === idx && r.started_at);
      if (!startObj) return;

      const startTs = new Date(startObj.started_at).getTime();
      let finishTs = 0;
      
      const finishObj = results.find((r: any) => r.step === idx && r.finished_at);
      if (finishObj) {
        finishTs = new Date(finishObj.finished_at).getTime();
      } else {
        const nextStepObj = results.find((r: any) => r.step === idx + 1 && r.started_at);
        if (nextStepObj) {
          finishTs = new Date(nextStepObj.started_at).getTime();
        }
      }

      if (finishTs > startTs) {
        totalMs += (finishTs - startTs);
        count++;
      }
    });

    if (count > 0) {
      const avgMs = totalMs / count;
      const avgMinutes = avgMs / 60000;
      if (avgMinutes < 60) {
        stat.avgDuration = `${Math.round(avgMinutes)} min`;
      } else {
        const avgHours = avgMinutes / 60;
        if (avgHours < 24) {
          stat.avgDuration = `${avgHours.toFixed(1)}h`;
        } else {
          stat.avgDuration = `${(avgHours / 24).toFixed(1)} dias`;
        }
      }
    }
  });

  // Global funnel KPIs
  const totalStarted = executions.length;
  const totalCompleted = acoesCount > 0 ? stats[acoesCount - 1].completed : 0;
  const globalSuccessRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;
  const globalDropOffCount = totalStarted - totalCompleted;
  const globalDropOffRate = totalStarted > 0 ? (globalDropOffCount / totalStarted) * 100 : 0;

  // Data for Recharts Bar Chart
  const chartData = stats.map((stat) => ({
    name: `Etapa ${stat.index + 1}: ${stat.label.substring(0, 15)}${stat.label.length > 15 ? "..." : ""}`,
    "Leads Ativos": stat.reached,
    "Taxa de Avanço (%)": Math.round(stat.progressionRate),
    rawLabel: stat.label,
    reached: stat.reached,
    completed: stat.completed,
    droppedOff: stat.droppedOff,
  }));

  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  // Fetch leads for batch recovery
  const handleRecoverLeads = async (idx: number) => {
    setRecoveringStepIdx(idx);
    setFetchingLeads(true);
    try {
      const droppedOffExecs = executions.filter((exec) => {
        const results = exec.step_results || [];
        if (!Array.isArray(results)) return false;
        
        if (idx < acoesCount - 1) {
          const completedThis = results.some((r: any) => r.step === idx && (r.status === "completed" || r.status === "sent" || r.status === "success" || r.status === "guided_ai_completed"));
          const reachedNext = results.some((r: any) => r.step === idx + 1);
          return completedThis && !reachedNext;
        } else {
          const reachedThis = results.some((r: any) => r.step === idx);
          const completedThis = results.some((r: any) => r.step === idx && (r.status === "completed" || r.status === "sent" || r.status === "success" || r.status === "guided_ai_completed"));
          const isWaiting = results.some((r: any) => r.step === idx && (r.status === "waiting" || r.status === "running" || r.status === "waiting_for_lead_response" || r.status === "delayed_for_condition"));
          return reachedThis && !completedThis && !isWaiting;
        }
      });

      const leadIds = Array.from(new Set(droppedOffExecs.map(e => e.lead_id).filter(Boolean)));
      if (leadIds.length === 0) {
        setRecoveringLeads([]);
        return;
      }

      const { data, error } = await supabase
        .from("imphq_leads")
        .select("id, name, phone, email, tags")
        .in("id", leadIds);

      if (error) throw error;
      setRecoveringLeads(data || []);
    } catch (err) {
      console.error("Erro ao buscar leads evadidos:", err);
      toast.error("Erro ao carregar detalhes dos leads.");
    } finally {
      setFetchingLeads(false);
    }
  };

  const handleExportCSV = () => {
    if (recoveringLeads.length === 0) return;
    const headers = "Nome,Telefone,Email,Tags\n";
    const rows = recoveringLeads.map(l => `"${l.name || ''}","${l.phone || ''}","${l.email || ''}","${(l.tags || []).join('; ')}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_evadidos_etapa_${recoveringStepIdx! + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso!");
  };

  const handleTransHumanaBulk = async () => {
    if (!selectedAuto || recoveringLeads.length === 0) return;
    setProcessingAction("human");
    try {
      const phones = recoveringLeads.map(l => l.phone).filter(Boolean);
      const cleanPhones = phones.map(p => p.replace(/\D/g, ""));
      const searchPhones = [...phones, ...cleanPhones];

      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({ status: "needs_human" })
        .eq("project_id", selectedAuto.project_id)
        .in("phone", searchPhones);

      if (error) throw error;

      await supabase.from("imphq_ai_actions").insert({
        kind: "human_handoff",
        risk_level: "low",
        confidence: 1.0,
        title: "Transição em Lote (Recuperação Analytics)",
        reason: `Reengajamento manual de leads evadidos na etapa #${recoveringStepIdx! + 1}`,
        payload: { lead_count: recoveringLeads.length },
        projeto_id: selectedAuto.project_id,
        source: "analytics-recovery",
        status: "executed",
        auto_executed: true,
        executed_at: new Date().toISOString()
      });

      toast.success(`${recoveringLeads.length} leads transferidos para suporte humano!`);
    } catch (err: any) {
      console.error("Erro na transição em massa:", err);
      toast.error(`Erro ao transferir: ${err.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleAddTagBulk = async () => {
    if (recoveringLeads.length === 0) return;
    if (!tagInput.trim()) {
      toast.error("Digite uma tag.");
      return;
    }
    setProcessingAction("tag");
    try {
      const tag = tagInput.trim();
      const updatePromises = recoveringLeads.map(async (l) => {
        const currentTags = Array.isArray(l.tags) ? l.tags : [];
        if (currentTags.includes(tag)) return;

        const newTags = [...currentTags, tag];
        return supabase
          .from("imphq_leads")
          .update({ tags: newTags })
          .eq("id", l.id);
      });

      await Promise.all(updatePromises);
      toast.success(`Tag "${tag}" adicionada a ${recoveringLeads.length} leads!`);
      setTagInput("");

      // Reload leads
      const leadIds = recoveringLeads.map(l => l.id);
      const { data } = await supabase.from("imphq_leads").select("id, name, phone, email, tags").in("id", leadIds);
      setRecoveringLeads(data || []);
    } catch (err: any) {
      console.error("Erro ao adicionar tag em lote:", err);
      toast.error(`Erro ao adicionar tag: ${err.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector and Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <h2 className="text-lg font-bold font-serif text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
            OpenFlow Analytics (Conversão & Evasão)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analise a taxa de avanço e identifique exatamente onde os leads estão esfriando.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground shrink-0">Automação:</span>
          <Select value={selectedAutoId} onValueChange={setSelectedAutoId}>
            <SelectTrigger className="w-full sm:w-[250px] h-9 text-xs bg-secondary/30 border-border/40">
              <SelectValue placeholder="Selecione um fluxo" />
            </SelectTrigger>
            <SelectContent>
              {automacoes.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.nome} ({a.acoes?.length || 0} etapas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 gap-2 text-sm text-muted-foreground bg-card/40 rounded-xl border border-border/20 min-h-[300px]">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Carregando métricas do funil...
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-xl bg-secondary/5">
          <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Nenhuma execução para esta automação ainda.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            As métricas aparecerão assim que a automação for disparada por novos leads.
          </p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Start Count */}
            <Card className="bg-gradient-to-br from-blue-500/5 via-transparent to-transparent border-border/40 hover:border-blue-500/25 transition-all shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Entradas no Funil</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{totalStarted}</p>
                  <p className="text-[9px] text-muted-foreground">Execuções totais iniciadas</p>
                </div>
                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 2: Completed Success */}
            <Card className="bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent border-border/40 hover:border-emerald-500/25 transition-all shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conclusões com Sucesso</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{totalCompleted}</p>
                  <p className="text-[9px] text-muted-foreground">Leads que concluíram todo o fluxo</p>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Global Success Rate */}
            <Card className="bg-gradient-to-br from-violet-500/5 via-transparent to-transparent border-border/40 hover:border-violet-500/25 transition-all shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conversão Geral</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{formatPercent(globalSuccessRate)}</p>
                  <p className="text-[9px] text-muted-foreground">Taxa de sucesso ponta a ponta</p>
                </div>
                <div className="p-2.5 bg-violet-500/10 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-violet-400 animate-pulse" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Global Drop-off Rate */}
            <Card className="bg-gradient-to-br from-red-500/5 via-transparent to-transparent border-border/40 hover:border-red-500/25 transition-all shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Taxa de Evasão Geral</p>
                  <p className="text-2xl font-bold text-foreground font-mono">{formatPercent(globalDropOffRate)}</p>
                  <p className="text-[9px] text-muted-foreground">Leads que pararam no meio do caminho</p>
                </div>
                <div className="p-2.5 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Attribution by Flow Card */}
          {revenueByFlow.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <h3 className="font-semibold text-sm">Receita Atribuída por Fluxo (30 dias)</h3>
                </div>
                <div className="space-y-2">
                  {revenueByFlow.map((item) => (
                    <div key={item.automacao_id} className="flex items-center justify-between p-2 rounded bg-secondary/40">
                      <div>
                        <p className="text-xs font-medium">{item.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{item.count} venda(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">R$ {item.receita.toFixed(2).replace('.', ',')}</p>
                        <div className="w-24 bg-muted rounded-full h-1 mt-1">
                          <div
                            className="bg-emerald-500 h-1 rounded-full"
                            style={{ width: `${Math.min(100, (item.receita / revenueByFlow[0].receita) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recharts Chart and Visual Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Funnel Graph */}
            <Card className="lg:col-span-7 border-border/40 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
              <CardHeader className="border-b border-border/20 bg-secondary/5 px-4 py-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" /> Distribuição de Leads Ativos por Etapa
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Quantidade absoluta de leads que interagiram com cada bloco do funil.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 min-h-[300px]">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} width={140} />
                    <ChartTooltip
                      contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px" }}
                      labelStyle={{ color: "#f8fafc", fontWeight: "bold", fontSize: "11px" }}
                      itemStyle={{ color: "#cbd5e1", fontSize: "11px" }}
                    />
                    <Bar dataKey="Leads Ativos" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.rawLabel.includes("IA")
                              ? "rgba(168, 85, 247, 0.75)" // Purple for AI
                              : entry.rawLabel.includes("WhatsApp")
                              ? "rgba(16, 185, 129, 0.75)" // Emerald for WhatsApp
                              : "rgba(59, 130, 246, 0.75)" // Blue for others
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Step breakdown list */}
            <Card className="lg:col-span-5 border-border/40 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden">
              <CardHeader className="border-b border-border/20 bg-secondary/5 px-4 py-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Análise de Evasão por Etapa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 divide-y divide-border/20 max-h-[360px] overflow-y-auto pr-1">
                {stats.map((stat, i) => {
                  const isAi = stat.tipo === "ia_message";
                  return (
                    <div key={stat.index} className="py-3.5 space-y-2.5 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">
                            #{stat.index + 1}
                          </span>
                          <span className="text-xs font-bold text-foreground truncate" title={stat.label}>
                            {stat.label}
                          </span>
                          {isAi && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[8px] font-semibold h-4 px-1 py-0 uppercase shrink-0">
                              IA Mente
                            </Badge>
                          )}
                          {stat.stalledCount > 0 && (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30 text-[8px] font-bold flex items-center gap-0.5 h-4 px-1 shrink-0 animate-pulse">
                              ⚠️ {stat.stalledCount} travados
                            </Badge>
                          )}
                          <span className="text-[9px] text-muted-foreground/80 flex items-center gap-0.5 font-mono shrink-0 ml-1 bg-secondary/20 px-1.5 py-0.5 rounded">
                            <Clock className="h-3 w-3 text-muted-foreground/45" /> {stat.avgDuration}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-emerald-400">
                            {Math.round(stat.progressionRate)}% avanço
                          </span>
                        </div>
                      </div>

                      {/* Progression Indicators */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex flex-col gap-0.5 p-1.5 bg-secondary/20 rounded border border-border/20">
                          <span className="text-muted-foreground/70 uppercase text-[8px] font-bold">Avançou</span>
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            {i < acoesCount - 1 ? stats[i + 1].reached : stat.completed} leads
                            <ArrowRight className="h-3 w-3 text-emerald-400" />
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 p-1.5 bg-red-500/5 rounded border border-red-500/10">
                          <div className="flex justify-between items-center">
                            <span className="text-red-400/80 uppercase text-[8px] font-bold">Evasão (Parou)</span>
                            {stat.droppedOff > 0 && (
                              <button
                                type="button"
                                className="text-[8px] text-primary hover:underline font-bold uppercase shrink-0 flex items-center gap-0.5"
                                onClick={() => handleRecoverLeads(stat.index)}
                              >
                                <Zap className="h-2.5 w-2.5" /> Recuperar
                              </button>
                            )}
                          </div>
                          <span className="font-semibold text-red-400 flex items-center gap-1">
                            {stat.droppedOff} leads ({Math.round(stat.dropOffRate)}%)
                          </span>
                        </div>
                      </div>

                      {/* A/B Test Variant Results */}
                      {(stat.abStats?.a?.reached > 0 || stat.abStats?.b?.reached > 0) && (
                        <div className="p-2.5 rounded-lg bg-slate-950/30 border border-primary/10 space-y-2 text-[10px] animate-fade-in">
                          <div className="flex items-center gap-1 text-primary font-semibold uppercase tracking-wider text-[8px]">
                            <Split className="h-3 w-3" /> Resultado do Teste A/B de Copy
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Variant A */}
                            <div className="space-y-0.5 bg-secondary/15 p-1.5 rounded border border-border/10">
                              <div className="flex items-center justify-between font-bold text-foreground">
                                <span>Variante A</span>
                                <span className="font-mono text-emerald-400">{Math.round(stat.abStats.a.progressionRate)}%</span>
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                Entraram: <strong>{stat.abStats.a.reached}</strong> · Avançaram: <strong>{stat.abStats.a.completed}</strong>
                              </div>
                            </div>

                            {/* Variant B */}
                            <div className="space-y-0.5 bg-secondary/15 p-1.5 rounded border border-border/10">
                              <div className="flex items-center justify-between font-bold text-foreground">
                                <span>Variante B</span>
                                <span className="font-mono text-emerald-400">{Math.round(stat.abStats.b.progressionRate)}%</span>
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                Entraram: <strong>{stat.abStats.b.reached}</strong> · Avançaram: <strong>{stat.abStats.b.completed}</strong>
                              </div>
                            </div>
                          </div>
                          {/* Champion tag */}
                          {stat.abStats.a.reached >= 3 && stat.abStats.b.reached >= 3 && (
                            <div className="text-[9px] font-medium text-slate-300 flex items-center gap-1 pt-0.5">
                              {stat.abStats.b.progressionRate > stat.abStats.a.progressionRate ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">★ Variante B performando melhor (+{(stat.abStats.b.progressionRate - stat.abStats.a.progressionRate).toFixed(1)}%)</span>
                              ) : stat.abStats.a.progressionRate > stat.abStats.b.progressionRate ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">★ Variante A performando melhor (+{(stat.abStats.a.progressionRate - stat.abStats.b.progressionRate).toFixed(1)}%)</span>
                              ) : (
                                <span className="text-slate-400">Variantes empatadas.</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Small breakdown of status */}
                      <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground/80 pl-1.5">
                        <CornerDownRight className="h-3 w-3 shrink-0" />
                        <span>Entraram: <strong>{stat.reached}</strong></span>
                        {stat.waiting > 0 && (
                          <span>· Aguardando: <strong className="text-amber-400">{stat.waiting}</strong></span>
                        )}
                        {stat.failed > 0 && (
                          <span>· Falharam: <strong className="text-destructive">{stat.failed}</strong></span>
                        )}
                      </div>

                      {/* IA Routes Trigger Rates */}
                      {isAi && stat.routeTriggers && Object.keys(stat.routeTriggers).length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-purple-950/20 border border-purple-500/10 space-y-1">
                          <span className="text-[8.5px] uppercase tracking-wider text-purple-300 font-bold block">Acionamento de Rotas IA:</span>
                          <div className="flex flex-wrap gap-1.5 text-[9px]">
                            {Object.entries(stat.routeTriggers).map(([routeName, count]: any) => (
                              <span key={routeName} className="bg-purple-900/40 text-purple-200 px-1.5 py-0.5 rounded border border-purple-700/20">
                                {routeName}: <strong>{count}</strong> acionamentos
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Waterfall Funnel Visualizer */}
          <Card className="border-border/40 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden mt-6">
            <CardHeader className="border-b border-border/20 bg-secondary/5 px-4 py-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" /> Funil Waterfall de Performance
              </CardTitle>
              <CardDescription className="text-[10px]">
                Taxa de retenção acumulada e evasão passo-a-passo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 relative">
                {stats.map((stat, i) => {
                  const firstStepReached = stats[0]?.reached || 1;
                  const overallConv = stat.reached > 0 ? (stat.reached / firstStepReached) * 100 : 0;
                  const stepConv = i > 0 && stats[i-1].reached > 0 ? (stat.reached / stats[i-1].reached) * 100 : 100;
                  
                  return (
                    <div key={stat.index} className="flex-1 flex flex-col items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-border/20 relative min-w-[120px]">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Passo #{stat.index + 1}</span>
                        <span className="text-xs font-bold text-foreground truncate max-w-[110px] block" title={stat.label}>{stat.label}</span>
                      </div>
                      
                      <div className="my-4 flex flex-col items-center justify-center relative w-full">
                        {/* Visual Tapering Pillar */}
                        <div 
                          className="h-16 bg-gradient-to-t from-primary/30 to-primary/10 border border-primary/20 rounded-md transition-all duration-300 flex items-center justify-center shadow-inner"
                          style={{ width: `${Math.max(30, overallConv)}%` }}
                        >
                          <span className="text-xs font-bold text-primary font-mono">{stat.reached}</span>
                        </div>
                      </div>

                      <div className="text-center space-y-1 w-full pt-2 border-t border-border/10">
                        <div className="text-[10px] font-semibold text-emerald-400">
                          {overallConv.toFixed(1)}% <span className="text-[8px] text-muted-foreground">do total</span>
                        </div>
                        {i > 0 && (
                          <div className="text-[9px] text-slate-400">
                            {stepConv.toFixed(1)}% <span className="text-[8px] text-muted-foreground">do ant.</span>
                          </div>
                        )}
                        {stat.stalledCount > 0 && (
                          <span className="text-[8px] bg-red-950 text-red-400 px-1 py-0.5 rounded block font-bold border border-red-500/10 mt-1 animate-pulse">
                            ⚠️ {stat.stalledCount} travados
                          </span>
                        )}
                      </div>

                      {/* Arrow separator for MD+ screens */}
                      {i < stats.length - 1 && (
                        <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 p-1 bg-slate-900 rounded-full border border-border/30 shadow-md">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lead Recovery Dialog */}
      <Dialog open={recoveringStepIdx !== null} onOpenChange={(v) => !v && setRecoveringStepIdx(null)}>
        <DialogContent className="bg-slate-900 border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-1.5 text-primary">
              <Zap className="h-5 w-5 text-primary" /> Recuperar Leads Evadidos (Etapa #{recoveringStepIdx !== null ? recoveringStepIdx + 1 : ""})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Estes leads concluíram a etapa anterior mas pararam ou esfriaram antes de prosseguir no funil.
            </DialogDescription>
          </DialogHeader>

          {fetchingLeads ? (
            <div className="flex justify-center py-10 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Buscando contatos dos leads...
            </div>
          ) : recoveringLeads.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border/40 rounded-xl bg-secondary/5">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground italic">Nenhum lead elegível para reativação nesta etapa.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Actions header */}
              <div className="p-3 rounded-xl bg-secondary/25 border border-border/40 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">{recoveringLeads.length} leads prontos para ação</p>
                  <p className="text-[9px] text-muted-foreground">Escolha uma ação em lote para reengajar esses leads.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] gap-1 hover:bg-slate-800"
                    onClick={handleExportCSV}
                  >
                    <Download className="h-3 w-3" /> Exportar CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1"
                    onClick={handleTransHumanaBulk}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "human" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    Chamar Humano
                  </Button>
                </div>
              </div>

              {/* Tag assignment */}
              <div className="flex items-end gap-2 p-3 rounded-xl bg-secondary/25 border border-border/40">
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Inserir Tag em Lote</Label>
                  <Input
                    placeholder="ex: reengajar_vsl"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="h-8 text-xs bg-slate-950/50 border-border/40 focus:ring-1 focus:ring-primary mt-1"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[10px] gap-1 shrink-0 border-primary/20 text-primary hover:bg-primary/5"
                  onClick={handleAddTagBulk}
                  disabled={processingAction !== null}
                >
                  {processingAction === "tag" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Tag className="h-3 w-3" />
                  )}
                  Atribuir Tag
                </Button>
              </div>

              {/* Leads list */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Lista de Contatos</Label>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {recoveringLeads.map((l) => (
                    <div key={l.id} className="flex justify-between items-center p-2 rounded bg-secondary/15 border border-border/20 text-xs">
                      <div className="font-medium text-foreground">
                        {l.name || "Sem Nome"} <span className="text-[10px] text-muted-foreground font-mono">({l.phone || ""})</span>
                      </div>
                      <div className="flex gap-1">
                        {(l.tags || []).slice(0, 3).map((t: string, ti: number) => (
                          <Badge key={ti} className="bg-slate-950 border border-border/30 text-[9px] px-1.5 py-0 font-normal">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
