import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Coins, Zap, Activity, Filter, Search, ArrowUpRight, Cpu, Layers, DollarSign } from "lucide-react";

type Row = {
  id: string;
  project_id: string | null;
  function_name: string;
  provider: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  tag: string | null;
  created_at: string;
};

const BRL_RATE = 5.60;

const usd = (n: number) => `$${n.toFixed(4)}`;
const usdShort = (n: number) => `$${n.toFixed(2)}`;
const brl = (n: number) => `R$ ${(n * BRL_RATE).toFixed(2)}`;
const int = (n: number) => n.toLocaleString("pt-BR");

// Fallback inteligente para estimar custos históricos quando a API devolve null
function effectiveCost(r: Row): number {
  if (r.cost_usd !== null && r.cost_usd !== undefined) return Number(r.cost_usd);
  if (r.provider === "elevenlabs") return Math.round((Number(r.total_tokens || 300) * 0.0003) * 10000) / 10000;
  if (r.provider === "kie") return 0.025;
  if (r.provider === "zernio") return 0.001;
  if (r.model?.includes("gemini-2.5-flash")) return Math.round((Number(r.total_tokens || 1000) * 0.0000002) * 100000) / 100000;
  if (r.model?.includes("gpt-4o-mini")) return Math.round((Number(r.total_tokens || 1000) * 0.0000003) * 100000) / 100000;
  return 0;
}

function getProviderBadge(provider: string) {
  const p = provider.toLowerCase();
  if (p === "openrouter") return { label: "OpenRouter", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (p === "kie") return { label: "Kie.ai", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (p === "elevenlabs") return { label: "ElevenLabs", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  if (p === "zernio") return { label: "Zernio", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  if (p === "lovable") return { label: "Lovable", className: "bg-pink-500/15 text-pink-400 border-pink-500/30" };
  if (p === "openai") return { label: "OpenAI", className: "bg-teal-500/15 text-teal-400 border-teal-500/30" };
  if (p === "anthropic") return { label: "Anthropic", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" };
  if (p === "google") return { label: "Google AI", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
  return { label: provider, className: "bg-secondary/60 text-muted-foreground border-border" };
}

function group(rows: Row[], key: (r: Row) => string) {
  const map = new Map<string, { label: string; cost: number; tokens: number; calls: number }>();
  for (const r of rows) {
    const k = key(r) || "—";
    const cur = map.get(k) || { label: k, cost: 0, tokens: 0, calls: 0 };
    cur.cost += effectiveCost(r);
    cur.tokens += Number(r.total_tokens || 0);
    cur.calls += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls);
}

export default function CustosIA() {
  const [period, setPeriod] = useState<"1d" | "7d" | "30d" | "all">("30d");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const { data: rawRows = [], isLoading, isError } = useQuery({
    queryKey: ["ai-usage", period],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from("imphq_ai_usage").select("*").order("created_at", { ascending: false }).limit(5000);
      if (period !== "all") {
        const days = period === "1d" ? 1 : period === "7d" ? 7 : 30;
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "names"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name");
      return data || [];
    },
  });

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name || (id === "—" || !id ? "Geral / Sem projeto" : id);

  // Filtragem
  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      if (selectedProject !== "all") {
        if (selectedProject === "none" && r.project_id) return false;
        if (selectedProject !== "none" && r.project_id !== selectedProject) return false;
      }
      if (selectedProvider !== "all" && r.provider.toLowerCase() !== selectedProvider.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchFn = r.function_name.toLowerCase().includes(s);
        const matchModel = (r.model || "").toLowerCase().includes(s);
        const matchProv = r.provider.toLowerCase().includes(s);
        const matchTag = (r.tag || "").toLowerCase().includes(s);
        if (!matchFn && !matchModel && !matchProv && !matchTag) return false;
      }
      return true;
    });
  }, [rawRows, selectedProject, selectedProvider, search]);

  const totalCost = filteredRows.reduce((s, r) => s + effectiveCost(r), 0);
  const totalTokens = filteredRows.reduce((s, r) => s + Number(r.total_tokens || 0), 0);
  const totalCalls = filteredRows.length;
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;

  const byProvider = useMemo(() => group(filteredRows, (r) => r.provider), [filteredRows]);
  const byFunction = useMemo(() => group(filteredRows, (r) => r.function_name), [filteredRows]);
  const byProject = useMemo(() => group(filteredRows, (r) => r.project_id || "—"), [filteredRows]);
  const byModel = useMemo(() => group(filteredRows, (r) => r.model || "Modelo não informado"), [filteredRows]);

  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach((r) => set.add(r.provider.toLowerCase()));
    return Array.from(set).sort();
  }, [rawRows]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* HEADER & FILTROS GLOBAIS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-gold/80 font-semibold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Auditoria de Operações & RAG
          </div>
          <h1
            className="text-3xl italic text-foreground tracking-tight mt-0.5"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Custos & Telemetria de IA
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitoramento de tokens, créditos de API e custos por provedor (OpenRouter, Kie.ai, Zernio, ElevenLabs, etc.).
          </p>
        </div>

        {/* SELETORES DE FILTRO */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Período */}
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            {(["1d", "7d", "30d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  period === p ? "bg-gold/20 text-gold shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "1d" ? "Hoje (24h)" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
              </button>
            ))}
          </div>

          {/* Filtro Projeto */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="h-8 text-xs w-[140px] bg-card border-border">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              <SelectItem value="none">Geral / Sem projeto</SelectItem>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Provedor */}
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="h-8 text-xs w-[130px] bg-card border-border">
              <SelectValue placeholder="Provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Provedores</SelectItem>
              {availableProviders.map((prov) => (
                <SelectItem key={prov} value={prov}>
                  {getProviderBadge(prov).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/70 border-border backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Custo Total Estimado</span>
              <Coins className="h-3.5 w-3.5 text-gold" />
            </div>
            <div
              className="text-2xl md:text-3xl italic text-foreground tabular-nums font-bold"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading ? "—" : usd(totalCost)}
            </div>
            <p className="text-[11px] text-gold/80 font-medium">
              ≈ {brl(totalCost)} <span className="text-[10px] text-muted-foreground font-normal">(câmbio R$ {BRL_RATE})</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Volume de Tokens</span>
              <Zap className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div
              className="text-2xl md:text-3xl italic text-foreground tabular-nums font-bold"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading ? "—" : int(totalTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Total de tokens processados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Chamadas / Automações</span>
              <Brain className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div
              className="text-2xl md:text-3xl italic text-foreground tabular-nums font-bold"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading ? "—" : int(totalCalls)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Requisições registradas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border backdrop-blur-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Custo Médio / Execução</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div
              className="text-2xl md:text-3xl italic text-foreground tabular-nums font-bold"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading ? "—" : usd(avgCostPerCall)}
            </div>
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Custo por tarefa unitária
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TABS DE VISUALIZAÇÃO: AGRUPAMENTOS VS EXTRATO DETALHADO */}
      <Tabs defaultValue="agrupado" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="agrupado" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Visão Consolidada
            </TabsTrigger>
            <TabsTrigger value="extrato" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Extrato em Tempo Real
            </TabsTrigger>
          </TabsList>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar função, modelo ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-card border-border"
            />
          </div>
        </div>

        {/* TAB 1: VISÃO CONSOLIDADA EM 4 PAINÉIS */}
        <TabsContent value="agrupado" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Por Provedor */}
            <PanelGroup
              title="Por Provedor"
              icon={<Cpu className="h-3.5 w-3.5 text-gold" />}
              total={totalCost}
              items={byProvider.map((i) => ({
                label: getProviderBadge(i.label).label,
                cost: i.cost,
                tokens: i.tokens,
                calls: i.calls,
                badgeClass: getProviderBadge(i.label).className,
              }))}
            />

            {/* Por Função */}
            <PanelGroup
              title="Por Função / Automação"
              icon={<Brain className="h-3.5 w-3.5 text-gold" />}
              total={totalCost}
              items={byFunction.map((i) => ({
                label: i.label,
                cost: i.cost,
                tokens: i.tokens,
                calls: i.calls,
              }))}
            />

            {/* Por Projeto */}
            <PanelGroup
              title="Por Projeto"
              icon={<Layers className="h-3.5 w-3.5 text-gold" />}
              total={totalCost}
              items={byProject.map((i) => ({
                label: projectName(i.label),
                cost: i.cost,
                tokens: i.tokens,
                calls: i.calls,
              }))}
            />

            {/* Por Modelo */}
            <PanelGroup
              title="Por Modelo de IA"
              icon={<Zap className="h-3.5 w-3.5 text-gold" />}
              total={totalCost}
              items={byModel.map((i) => ({
                label: i.label.replace("google/", "").replace("openai/", "").replace("deepseek/", ""),
                cost: i.cost,
                tokens: i.tokens,
                calls: i.calls,
              }))}
            />
          </div>
        </TabsContent>

        {/* TAB 2: EXTRATO EM TEMPO REAL */}
        <TabsContent value="extrato">
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 backdrop-blur-md">
                    <TableRow className="border-border">
                      <TableHead className="text-[11px] font-semibold text-muted-foreground w-[150px]">Data / Hora</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground">Função</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground">Provedor</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground">Modelo</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground">Projeto</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground text-right">Tokens / Unidades</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground text-right">Custo Est.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.slice(0, 150).map((r) => {
                      const cost = effectiveCost(r);
                      const badge = getProviderBadge(r.provider);
                      const date = new Date(r.created_at);
                      const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

                      return (
                        <TableRow key={r.id} className="border-border/50 text-xs hover:bg-muted/20">
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {dateStr} {timeStr}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {r.function_name}
                            {r.tag && (
                              <span className="ml-1.5 text-[9px] bg-secondary px-1 py-0.5 rounded text-muted-foreground font-normal">
                                {r.tag}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate" title={r.model || "—"}>
                            {r.model ? r.model.replace("google/", "").replace("openai/", "") : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {projectName(r.project_id || "—")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                            {r.total_tokens !== null ? int(r.total_tokens) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-gold font-medium">
                            {usd(cost)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 bg-muted/20 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Exibindo as {Math.min(150, filteredRows.length)} chamadas mais recentes de {filteredRows.length}.</span>
                <span className="text-[10px]">Taxa de conversão: $1 USD = R$ {BRL_RATE.toFixed(2)} BRL</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PanelGroup({
  title,
  icon,
  total,
  items,
}: {
  title: string;
  icon?: React.ReactNode;
  total: number;
  items: { label: string; cost: number; tokens: number; calls: number; badgeClass?: string }[];
}) {
  return (
    <Card className="bg-card/70 border-border backdrop-blur-sm flex flex-col">
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold font-semibold border-b border-border/40 pb-2">
          {icon} {title}
        </div>
        <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[360px] pr-1">
          {items.map((i) => {
            const pct = total > 0 ? (i.cost / total) * 100 : 0;
            return (
              <div key={i.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground/90 max-w-[150px]" title={i.label}>
                    {i.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {int(i.calls)}x
                    </span>
                    <span className="text-gold font-mono font-medium">
                      {usd(i.cost)}
                    </span>
                  </div>
                </div>
                {/* Barra de Proporção Visual */}
                <div className="w-full bg-secondary/50 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-gold/80 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Sem registros no filtro.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
