import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Award, TrendingUp, Calendar, AlertCircle, ThumbsUp, ThumbsDown,
  ChevronRight, Brain, ListChecks, Play, Loader2, RefreshCw, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

interface AuditRecord {
  id: string;
  project_id: string;
  vendedor_name: string;
  periodo_inicio: string;
  periodo_fim: string;
  score: number;
  ponto_forte: string;
  ponto_fraco: string;
  objecao_travou: string;
  detalhes: {
    resumo_geral?: string;
    recomendacoes?: string[];
    analise_por_conversa?: Array<{
      cliente: string;
      nota: number;
      status: string;
      critica: string;
    }>;
  };
  created_at: string;
}

export default function SDRCoach() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("all");
  const [selectedAuditId, setSelectedAuditId] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);

  // 1. Carregar Projetos
  useEffect(() => {
    if (!user) return;
    setLoadingProjects(true);
    supabase
      .from("imphq_projects")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setLoadingProjects(false);
        if (error) {
          toast.error("Erro ao carregar projetos: " + error.message);
          return;
        }
        if (data && data.length > 0) {
          setProjects(data);
          setSelectedProjectId(data[0].id);
        }
      });
  }, [user]);

  // 2. Carregar Auditorias quando mudar projeto
  const loadAudits = async (projectId: string) => {
    if (!projectId) return;
    setLoadingAudits(true);
    try {
      const { data, error } = await supabase
        .from("imphq_sdr_coach_audits")
        .select("*")
        .eq("project_id", projectId)
        .order("periodo_fim", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const castedData = (data || []).map((item: any) => ({
        ...item,
        detalhes: typeof item.detalhes === "string" ? JSON.parse(item.detalhes) : item.detalhes
      })) as AuditRecord[];

      setAudits(castedData);

      // Extrair vendedores únicos
      const vends = [...new Set(castedData.map(a => a.vendedor_name))];
      setVendedores(vends);

      if (castedData.length > 0) {
        setSelectedAuditId(castedData[0].id);
      } else {
        setSelectedAuditId("");
      }
    } catch (err: any) {
      toast.error("Erro ao carregar auditorias: " + err.message);
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadAudits(selectedProjectId);
      setSelectedVendedor("all");
    }
  }, [selectedProjectId]);

  // 3. Filtrar Auditorias
  const filteredAudits = useMemo(() => {
    if (selectedVendedor === "all") return audits;
    return audits.filter(a => a.vendedor_name === selectedVendedor);
  }, [audits, selectedVendedor]);

  // Auditoria selecionada ativa
  const activeAudit = useMemo(() => {
    return filteredAudits.find(a => a.id === selectedAuditId) || filteredAudits[0] || null;
  }, [filteredAudits, selectedAuditId]);

  // Atualizar seleção se a lista filtrada mudar
  useEffect(() => {
    if (filteredAudits.length > 0) {
      const exists = filteredAudits.some(a => a.id === selectedAuditId);
      if (!exists) {
        setSelectedAuditId(filteredAudits[0].id);
      }
    } else {
      setSelectedAuditId("");
    }
  }, [filteredAudits, selectedAuditId]);

  // 4. Executar Nova Auditoria Semanal
  const triggerAudit = async () => {
    if (!selectedProjectId) return;
    setRunningAudit(true);
    const pName = projects.find(p => p.id === selectedProjectId)?.name || "Projeto";
    toast.info(`Iniciando análise de SDR para o projeto: ${pName}...`);
    try {
      const { data, error } = await supabase.functions.invoke("sdr-coach", {
        body: {
          project_id: selectedProjectId,
        }
      });

      if (error) throw error;

      if (data?.skipped === "no_human_messages") {
        toast.warning("Nenhum atendimento humano", {
          description: "Não foram encontradas mensagens de operadores humanos nos últimos 7 dias para auditar."
        });
      } else if (data?.ok) {
        toast.success(`Auditoria concluída!`, {
          description: `Gerados ${data.audits_created_count} novos relatórios de SDR.`
        });
        await loadAudits(selectedProjectId);
      }
    } catch (err: any) {
      toast.error("Falha ao rodar auditoria: " + (err.message || "Erro desconhecido"));
    } finally {
      setRunningAudit(false);
    }
  };

  // 5. KPIs Consolidados (Baseados nos audits exibidos)
  const stats = useMemo(() => {
    if (filteredAudits.length === 0) {
      return { avgScore: 0, count: 0, topObjection: "Nenhuma" };
    }
    const sum = filteredAudits.reduce((acc, curr) => acc + curr.score, 0);
    const avg = Math.round(sum / filteredAudits.length);

    // Calcular objeção mais frequente
    const objections: Record<string, number> = {};
    filteredAudits.forEach(a => {
      if (a.objecao_travou) {
        objections[a.objecao_travou] = (objections[a.objecao_travou] || 0) + 1;
      }
    });
    let topObj = "Nenhuma";
    let maxCount = 0;
    Object.entries(objections).forEach(([obj, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topObj = obj;
      }
    });

    return {
      avgScore: avg,
      count: filteredAudits.length,
      topObjection: topObj
    };
  }, [filteredAudits]);

  // Função auxiliar de cores do Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-red-400 bg-red-500/10 border-red-500/30";
  };

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 80) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    if (score >= 60) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    return "bg-red-500/15 text-red-400 border-red-500/20";
  };

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const e = new Date(end + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${s} a ${e}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            SDR Coach <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">Semanal</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria automática baseada em inteligência artificial para avaliar e treinar atendimentos de operadores de WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={triggerAudit}
            disabled={runningAudit || !selectedProjectId}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium shadow-md shadow-amber-500/15 gap-2"
          >
            {runningAudit ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditando time...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Auditar Últimos 7 dias
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter and selector bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-white/5 bg-secondary/10">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Projeto Ativo</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={loadingProjects}>
            <SelectTrigger className="bg-background/50 border-white/5">
              <SelectValue placeholder="Selecione um projeto..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Filtrar por Vendedor / SDR</Label>
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="bg-background/50 border-white/5">
              <SelectValue placeholder="Todos os operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os operadores ({vendedores.length})</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedProjectId && loadAudits(selectedProjectId)}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            disabled={loadingAudits}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingAudits ? "animate-spin" : ""}`} />
            Sincronizar Relatórios
          </Button>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-secondary/30 via-background to-secondary/15 border-white/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary shadow-inner">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nota Geral SDR</p>
              <h3 className="text-2xl font-bold font-display mt-0.5">{stats.avgScore}%</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/30 via-background to-secondary/15 border-white/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 shadow-inner">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total de Auditorias</p>
              <h3 className="text-2xl font-bold font-display mt-0.5">{stats.count} relatórios</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/30 via-background to-secondary/15 border-white/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 text-red-400 shadow-inner">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Objeção Bloqueante</p>
              <h3 className="text-xl font-bold font-display mt-1 truncate max-w-[180px]">{stats.topObjection}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Pane */}
      {loadingAudits ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-white/5 rounded-2xl bg-secondary/5">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Buscando avaliações no Supabase...</span>
        </div>
      ) : filteredAudits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/10 rounded-2xl bg-secondary/5 p-6">
          <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-bold">Nenhum Relatório Disponível</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
            Nenhuma auditoria foi registrada para este projeto e filtro. Experimente clicar no botão de auditoria para analisar os atendimentos humanos recentes.
          </p>
          <Button
            onClick={triggerAudit}
            disabled={runningAudit || !selectedProjectId}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-medium"
          >
            {runningAudit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Iniciar Primeira Auditoria
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Panel: Audits list */}
          <div className="lg:col-span-1 space-y-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Histórico de Auditorias</span>
            <ScrollArea className="h-[600px] pr-2">
              <div className="space-y-2">
                {filteredAudits.map((audit) => {
                  const isActive = activeAudit?.id === audit.id;
                  return (
                    <Card
                      key={audit.id}
                      className={`cursor-pointer hover:border-white/20 transition-all ${
                        isActive ? "border-primary/50 bg-primary/5 shadow-md" : "border-white/5 bg-card/60"
                      }`}
                      onClick={() => setSelectedAuditId(audit.id)}
                    >
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-sm block">{audit.vendedor_name}</span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatPeriod(audit.periodo_inicio, audit.periodo_fim)}
                            </span>
                          </div>
                          <Badge variant="outline" className={`font-mono font-bold text-xs ${getScoreBadgeStyle(audit.score)}`}>
                            {audit.score}%
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          Ponto fraco: {audit.ponto_fraco}
                        </div>
                        <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px]">
                          <span className="text-red-400 font-medium">Filtro: {audit.objecao_travou}</span>
                          <span className="text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                            Ver detalhes <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel: Audit detail */}
          {activeAudit && (
            <div className="lg:col-span-2 space-y-6">
              {/* Card Premium de Nota */}
              <Card className="bg-gradient-to-br from-secondary/50 via-background to-secondary/20 border-white/10 overflow-hidden relative shadow-xl">
                <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-display font-bold">{activeAudit.vendedor_name}</CardTitle>
                      <CardDescription className="text-xs">
                        Período: {formatPeriod(activeAudit.periodo_inicio, activeAudit.periodo_fim)} · Auditado em {new Date(activeAudit.created_at).toLocaleDateString("pt-BR")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Nota de Conversão</span>
                        <span className={`text-4xl font-extrabold font-display ${getScoreColor(activeAudit.score).split(" ")[0]}`}>
                          {activeAudit.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeAudit.detalhes?.resumo_geral && (
                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 leading-relaxed text-sm text-foreground/80">
                      <p className="font-medium text-xs text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-primary" /> Análise Geral do Coach
                      </p>
                      {activeAudit.detalhes.resumo_geral}
                    </div>
                  )}

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-emerald-500/5 border-emerald-500/10">
                      <CardContent className="p-3.5 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <ThumbsUp className="h-4 w-4" /> Pontos Fortes
                        </span>
                        <p className="text-xs text-foreground/85 leading-relaxed">
                          {activeAudit.ponto_forte}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-red-500/5 border-red-500/10">
                      <CardContent className="p-3.5 space-y-1.5">
                        <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                          <ThumbsDown className="h-4 w-4" /> Pontos Fracos
                        </span>
                        <p className="text-xs text-foreground/85 leading-relaxed">
                          {activeAudit.ponto_fraco}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Coaching Recomendations */}
              {activeAudit.detalhes?.recomendacoes && activeAudit.detalhes.recomendacoes.length > 0 && (
                <Card className="border-white/5 bg-card/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-amber-400" /> Recomendações Táticas de Script
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {activeAudit.detalhes.recomendacoes.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <span className="flex-1">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Individual Audited Conversations */}
              {activeAudit.detalhes?.analise_por_conversa && activeAudit.detalhes.analise_por_conversa.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Crítica por Conversa</span>
                  <div className="space-y-2">
                    {activeAudit.detalhes.analise_por_conversa.map((conv, idx) => (
                      <Card key={idx} className="border-white/5 bg-card/30">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground/90">{conv.cliente}</span>
                              <Badge variant="outline" className={`text-[9px] uppercase ${
                                conv.status === "venda_fechada" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                conv.status === "em_andamento" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                              }`}>
                                {conv.status === "venda_fechada" ? "Fechou" :
                                 conv.status === "em_andamento" ? "Pendente" : "Perdido"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                              {conv.critica}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Nota:</span>
                            <Badge variant="outline" className={`font-mono text-xs font-bold ${getScoreBadgeStyle(conv.nota)}`}>
                              {conv.nota}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
