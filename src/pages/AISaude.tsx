import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Moon, Search, Dna, AlertTriangle, Theater, BarChart3,
  Activity, TrendingUp, TrendingDown, RefreshCw,
  DollarSign, Sparkles
} from "lucide-react";
import { toast } from "sonner";

type AutonomyStatus = {
  system: string;
  icon: any;
  enabled: boolean;
  lastRun?: string | null;
  detail?: string;
  toneColor: string;
};

type ConvScoreRow = {
  id: string;
  conversation_id: string;
  score: number;
  outcome: string;
  postmortem?: string;
  what_worked?: string[];
  what_failed?: string[];
  scored_at: string;
};

type LearnedEntry = {
  created_at: string;
  kind: string;
  title: string;
  reason?: string;
  status: string;
  payload?: any;
};

export default function AISaude() {
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<any>(null);
  const [worstConvs, setWorstConvs] = useState<ConvScoreRow[]>([]);
  const [bestConvs, setBestConvs] = useState<ConvScoreRow[]>([]);
  const [learnedTimeline, setLearnedTimeline] = useState<LearnedEntry[]>([]);
  const [conversionStats, setConversionStats] = useState({ won: 0, lost: 0, warm: 0, totalScored: 0, avgScore: 0 });
  const [cacheStats, setCacheStats] = useState({ entries: 0, hits: 0, savings_estimate_brl: 0 });

  // Carrega lista de projetos
  useEffect(() => {
    supabase.from("imphq_projects").select("id, name").order("name").then(({ data }) => {
      const list = (data || []) as any[];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    });
  }, []);

  const reload = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Config IA do projeto
      const { data: cfg } = await supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", projectId)
        .eq("enabled", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setConfig(cfg);

      // Scores: top 10 piores e 10 melhores
      const { data: scores } = await supabase
        .from("imphq_wa_conversation_scores")
        .select("id, conversation_id, score, outcome, postmortem, what_worked, what_failed, scored_at")
        .eq("project_id", projectId)
        .order("scored_at", { ascending: false })
        .limit(200);

      const sorted = (scores || []) as ConvScoreRow[];
      setWorstConvs([...sorted].sort((a, b) => a.score - b.score).slice(0, 10));
      setBestConvs([...sorted].sort((a, b) => b.score - a.score).slice(0, 5));

      // Stats agregadas
      const won = sorted.filter(s => s.outcome === "won").length;
      const lost = sorted.filter(s => s.score < 30).length;
      const warm = sorted.filter(s => s.score >= 65 && s.outcome !== "won").length;
      const totalScored = sorted.length;
      const avgScore = totalScored > 0 ? Math.round(sorted.reduce((acc, s) => acc + s.score, 0) / totalScored) : 0;
      setConversionStats({ won, lost, warm, totalScored, avgScore });

      // Timeline de aprendizados (auto-audit + self-tune + escalation)
      const { data: actions } = await supabase
        .from("imphq_ai_actions")
        .select("created_at, kind, title, reason, status, payload")
        .eq("projeto_id", projectId)
        .in("kind", ["self_audit", "prompt_tune_applied", "prompt_tune_proposal", "auto_escalation", "persona_drift_alert", "persona_drift_applied"])
        .order("created_at", { ascending: false })
        .limit(15);
      setLearnedTimeline((actions || []) as LearnedEntry[]);

      // Cache stats globais
      const { data: cacheData } = await supabase
        .from("imphq_embedding_cache")
        .select("hits", { count: "exact" });
      const totalEntries = cacheData?.length || 0;
      const totalHits = (cacheData || []).reduce((acc: number, e: any) => acc + (e.hits || 0), 0);
      // Estimativa: cada hit economiza ~R$0.0008 (chamada de embedding 768d evitada)
      const savings = Number((totalHits * 0.0008).toFixed(2));
      setCacheStats({ entries: totalEntries, hits: totalHits, savings_estimate_brl: savings });
    } catch (e: any) {
      console.error("[ai-saude] erro:", e);
      toast.error("Erro ao carregar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) reload();
  }, [projectId]);

  const autonomySystems: AutonomyStatus[] = [
    {
      system: "Self-audit noturno",
      icon: Moon,
      enabled: config?.auto_audit_enabled === true,
      lastRun: config?.last_audit_at,
      detail: Array.isArray(config?.audit_findings) && config.audit_findings.length > 0
        ? `${config.audit_findings[0]?.phrases_added?.length || 0} frases, ${config.audit_findings[0]?.rules_added?.length || 0} regras (última noite)`
        : undefined,
      toneColor: "indigo",
    },
    {
      system: "Detect-gaps (2h)",
      icon: Search,
      enabled: true,
      lastRun: undefined,
      detail: "Sempre ativo — alimenta dúvidas pendentes",
      toneColor: "cyan",
    },
    {
      system: "Self-tune semanal",
      icon: Dna,
      enabled: config?.auto_tune_enabled === true,
      lastRun: config?.last_tune_at,
      detail: Array.isArray(config?.tune_history) && config.tune_history.length > 0
        ? `${config.tune_history[0]?.wins_analyzed || 0} vendas vs ${config.tune_history[0]?.losses_analyzed || 0} perdas analisadas`
        : undefined,
      toneColor: "purple",
    },
    {
      system: "Escalation semântica",
      icon: AlertTriangle,
      enabled: config?.auto_escalation_enabled === true,
      detail: "A cada 20min decide passar pra humano",
      toneColor: "rose",
    },
    {
      system: "Drift de persona",
      icon: Theater,
      enabled: config?.auto_drift_enabled === true,
      lastRun: config?.last_drift_at,
      detail: config?.drift_score != null ? `Score atual: ${config.drift_score}/100` : undefined,
      toneColor: config?.drift_score != null && Number(config.drift_score) < 60 ? "amber" : "emerald",
    },
    {
      system: "Pontuação + postmortem",
      icon: BarChart3,
      enabled: config?.auto_scoring_enabled === true,
      detail: conversionStats.totalScored > 0 ? `${conversionStats.totalScored} conversas pontuadas` : undefined,
      toneColor: "blue",
    },
  ];

  const runManual = async (fnName: string, label: string) => {
    try {
      toast.info(`Disparando ${label}…`);
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { project_id: projectId, dry_run: false },
      });
      if (error) throw error;
      toast.success(`${label} concluído`);
      console.log(`[${fnName}]`, data);
      reload();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const projectName = projects.find(p => p.id === projectId)?.name || projectId;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-400" />
            Saúde da IA
            <span className="text-sm font-normal text-muted-foreground ml-2">{projectName}</span>
          </h1>
          <p className="text-xs text-muted-foreground">Visão consolidada dos 6 sistemas autônomos, aprendizados recentes e qualidade das conversas.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-xs bg-secondary/40 border border-border/30 rounded px-3 py-1.5"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button variant="ghost" size="icon" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[10px] text-muted-foreground uppercase">Vendas</span></div>
          <p className="text-xl font-bold text-emerald-400">{conversionStats.won}</p>
          <p className="text-[10px] text-muted-foreground">conversas que converteram</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-rose-400" /><span className="text-[10px] text-muted-foreground uppercase">Perdas</span></div>
          <p className="text-xl font-bold text-rose-400">{conversionStats.lost}</p>
          <p className="text-[10px] text-muted-foreground">score &lt; 30</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-400" /><span className="text-[10px] text-muted-foreground uppercase">Mornos</span></div>
          <p className="text-xl font-bold text-amber-400">{conversionStats.warm}</p>
          <p className="text-[10px] text-muted-foreground">engajados sem conversão</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-indigo-400" /><span className="text-[10px] text-muted-foreground uppercase">Score médio</span></div>
          <p className="text-xl font-bold text-indigo-400">{conversionStats.avgScore}/100</p>
          <p className="text-[10px] text-muted-foreground">{conversionStats.totalScored} pontuadas</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[10px] text-muted-foreground uppercase">Cache</span></div>
          <p className="text-xl font-bold text-emerald-400">R$ {cacheStats.savings_estimate_brl.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{cacheStats.hits} hits, {cacheStats.entries} entradas</p>
        </CardContent></Card>
      </div>

      {/* Sistemas autônomos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-400" /> 6 Sistemas Autônomos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {autonomySystems.map((sys) => {
            const Icon = sys.icon;
            return (
              <div key={sys.system} className={`p-3 rounded-lg border ${sys.enabled ? "bg-secondary/15 border-border/30" : "bg-muted/10 border-border/10 opacity-60"}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 text-${sys.toneColor}-400`} />
                    <p className="text-xs font-semibold">{sys.system}</p>
                  </div>
                  <Badge variant={sys.enabled ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">
                    {sys.enabled ? "ON" : "OFF"}
                  </Badge>
                </div>
                {sys.detail && <p className="text-[10px] text-muted-foreground leading-tight">{sys.detail}</p>}
                {sys.lastRun && (
                  <p className="text-[9px] text-indigo-400 font-mono mt-1">
                    {new Date(sys.lastRun).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="learned" className="w-full">
        <TabsList>
          <TabsTrigger value="learned">📚 O que a IA aprendeu</TabsTrigger>
          <TabsTrigger value="worst">🔥 10 Piores conversas</TabsTrigger>
          <TabsTrigger value="best">⭐ Melhores conversas</TabsTrigger>
        </TabsList>

        <TabsContent value="learned" className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : learnedTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem aprendizados registrados ainda. Ative os sistemas autônomos no painel da IA.</p>
          ) : (
            learnedTimeline.map((entry, i) => (
              <div key={i} className="p-3 rounded-lg border border-border/20 bg-secondary/10">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold">{entry.title}</p>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{entry.kind}</Badge>
                </div>
                {entry.reason && <p className="text-[11px] text-muted-foreground">{entry.reason}</p>}
                <p className="text-[9px] text-muted-foreground font-mono mt-1">
                  {new Date(entry.created_at).toLocaleString("pt-BR")} · {entry.status}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="worst" className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : worstConvs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem scores ainda. Ative "Pontuar conversas" para começar.</p>
          ) : (
            worstConvs.map(c => (
              <div key={c.id} className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[9px] h-4">{c.score}/100</Badge>
                      <span className="text-[10px] text-muted-foreground">{c.outcome}</span>
                    </div>
                    {c.postmortem && <p className="text-xs text-foreground/90">{c.postmortem}</p>}
                    {(c.what_failed || []).length > 0 && (
                      <ul className="text-[10px] text-rose-300/90 space-y-0.5">
                        {(c.what_failed || []).slice(0, 3).map((f: string, i: number) => <li key={i}>✗ {f}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="best" className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : bestConvs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
          ) : (
            bestConvs.map(c => (
              <div key={c.id} className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] h-4">{c.score}/100</Badge>
                  <span className="text-[10px] text-muted-foreground">{c.outcome}</span>
                </div>
                {c.postmortem && <p className="text-xs text-foreground/90">{c.postmortem}</p>}
                {(c.what_worked || []).length > 0 && (
                  <ul className="text-[10px] text-emerald-300/90 space-y-0.5 mt-1">
                    {(c.what_worked || []).slice(0, 3).map((f: string, i: number) => <li key={i}>✓ {f}</li>)}
                  </ul>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Quick actions */}
      <Card className="border-indigo-500/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-400" /> Disparar manualmente</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-self-audit", "Self-audit")}>🌙 Audit</Button>
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-detect-gaps", "Detect-gaps")}>🔍 Gaps</Button>
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-self-tune", "Self-tune")}>🧬 Tune</Button>
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-decide-escalation", "Escalation")}>🚨 Escalation</Button>
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-persona-drift", "Drift")}>🎭 Drift</Button>
          <Button size="sm" variant="outline" onClick={() => runManual("wa-ai-conv-scoring", "Scoring")}>📊 Score</Button>
        </CardContent>
      </Card>
    </div>
  );
}
