import { useState, useMemo, useEffect, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  ExternalLink,
  Bot,
  Target,
  Activity,
  ShieldAlert,
  RefreshCw,
  Gauge,
} from "lucide-react";
import { jsonFields } from "@/lib/json-fields";
import { useNavigate } from "react-router-dom";
import { buildFunnelLive, type AdsRow, type SaleRow } from "@shared/funnel-live";
import { runFunnelDiagnostics, type FunnelDiagnosticItem } from "@shared/funnel-diagnostics";
import { scanFunnelAnomalies } from "@shared/funnel-sentinel";
import { FunnelRemediationModal } from "@/components/funis/FunnelRemediationModal";
import { normalizeProjectIcon } from "@/components/sites/SiteThumbnail";

interface Props {
  projects: Tables<"imphq_projects">[];
  onOpenGrowthCopilot: (project?: Tables<"imphq_projects">) => void;
}

type RawAdsWithProject = AdsRow & { project_id: string | null };
type RawSaleWithProject = SaleRow & { project_id: string | null };

export interface ProjectExecutiveHealth {
  project: Tables<"imphq_projects">;
  statusColor: "green" | "yellow" | "red";
  statusLabel: string;
  gargalo: string;
  proximaAcao: string;
  hasCheckout: boolean;
  hasAvatar: boolean;
  hasLinks: boolean;
  hasLiveTraffic: boolean;
  fluencyScore: number;
  scoreLabel: string;
  gasto: number;
  bruto: number;
  roas: number | null;
  cpa: number | null;
  leakBrl: number;
  anomalyCount: number;
  primaryBottleneck: FunnelDiagnosticItem | null;
}

function fmtBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
}

/**
 * Avalia a saúde executiva de um projeto combinando prontidão estrutural
 * e telemetria real de funil (Diagnóstico Cruzado + Sentinela de Vazamento).
 */
export function evaluateProjectExecutiveHealth(
  project: Tables<"imphq_projects">,
  projAds: AdsRow[],
  projSales: SaleRow[]
): ProjectExecutiveHealth {
  const pData = jsonFields(project.data);
  const avatar = jsonFields(project.avatar);

  const hasCheckout = !!(
    pData.checkout_url ||
    (Array.isArray(pData.produtos) && pData.produtos.length > 0)
  );
  const hasAvatar = !!(avatar && avatar.nome);
  const hasLinks = !!(
    pData.links &&
    (Array.isArray(pData.links)
      ? pData.links.length > 0
      : Object.keys(pData.links).length > 0)
  );

  const funnel = buildFunnelLive({
    ads: projAds,
    pages: [],
    sales: projSales,
  });

  const gasto = funnel.totais.gasto ?? 0;
  const bruto = funnel.totais.bruto ?? 0;
  const roas = funnel.totais.roas;
  const cpa = funnel.totais.cpa;
  const hasLiveTraffic = gasto > 0 || bruto > 0 || projAds.length > 0 || projSales.length > 0;

  const diagnostics = runFunnelDiagnostics(funnel);
  const sentinel = scanFunnelAnomalies(funnel, project.id);

  if (hasLiveTraffic) {
    const fluencyScore = diagnostics.score;
    const leakBrl = sentinel.totalLeakEstimateBrl;
    const primaryBottleneck = diagnostics.primaryBottleneck;
    const topAnomaly = sentinel.activeAnomalies[0] ?? null;

    let statusColor: "green" | "yellow" | "red" = "green";
    let statusLabel = "Janela de Escala";
    let gargalo = "Funil saudável (0 vazamentos críticos)";
    let proximaAcao = "Escalar orçamento em +20% (Protocolo Verde)";

    if (
      sentinel.status === "critico" ||
      fluencyScore < 55 ||
      (gasto >= 100 && bruto === 0)
    ) {
      statusColor = "red";
      statusLabel = "Gargalo Crítico";
      gargalo =
        topAnomaly?.title ||
        primaryBottleneck?.title ||
        (gasto >= 100 && bruto === 0
          ? `Gasto de ${fmtBRL(gasto)} sem vendas convertidas`
          : "Ruptura severa de conversão");
      proximaAcao =
        topAnomaly?.actionSuggestion ||
        primaryBottleneck?.recommendation ||
        "Acionar Playbook de Correção Imediata";
    } else if (
      sentinel.status === "alerta" ||
      fluencyScore < 78 ||
      (roas !== null && roas < 1.3)
    ) {
      statusColor = "yellow";
      statusLabel = "Atenção / Vazamento";
      gargalo =
        primaryBottleneck?.title ||
        topAnomaly?.title ||
        "Taxa de passagem abaixo da referência";
      proximaAcao =
        primaryBottleneck?.recommendation ||
        topAnomaly?.actionSuggestion ||
        "Otimizar etapa em atenção no Cockpit";
    }

    return {
      project,
      statusColor,
      statusLabel,
      gargalo,
      proximaAcao,
      hasCheckout,
      hasAvatar,
      hasLinks,
      hasLiveTraffic: true,
      fluencyScore,
      scoreLabel: diagnostics.scoreLabel,
      gasto,
      bruto,
      roas,
      cpa,
      leakBrl,
      anomalyCount: sentinel.activeAnomalies.length,
      primaryBottleneck,
    };
  }

  // Fallback estrutural quando o projeto ainda não possui tráfego/vendas no período selecionado
  const isNutra = project.category === "DTC Nutra";
  const isJP = project.id === "jp_freitas";

  let statusColor: "green" | "yellow" | "red" = "green";
  let statusLabel = "Pronto / Sem Tráfego";
  let gargalo = "Sem tráfego ativo no período selecionado";
  let proximaAcao = "Ativar campanha e monitorar telemetria";
  let fallbackScore = 78;

  if (!hasCheckout && !hasLinks) {
    statusColor = "red";
    statusLabel = "Parado / Sem Checkout";
    gargalo = "Falta cadastrar página de vendas ou checkout";
    proximaAcao = "Adicionar link de checkout na aba Geral";
    fallbackScore = 35;
  } else if (!hasAvatar) {
    statusColor = "yellow";
    statusLabel = "Atenção / Sem Avatar";
    gargalo = "Avatar psicológico ainda não foi estruturado";
    proximaAcao = "Completar pesquisa de avatar e dores";
    fallbackScore = 58;
  } else if (isJP) {
    statusColor = "yellow";
    statusLabel = "Preparação Low Ticket";
    gargalo = "Campanha pendente de validação de tráfego";
    proximaAcao = "Rodar Growth Copilot para Código dos Cortes";
    fallbackScore = 68;
  } else if (isNutra) {
    statusColor = "green";
    statusLabel = "Pronto para Escala";
    gargalo = "Estrutura pronta para ativação de tráfego";
    proximaAcao = "Alocar verba em PDP ou Advertorial";
    fallbackScore = 82;
  }

  return {
    project,
    statusColor,
    statusLabel,
    gargalo,
    proximaAcao,
    hasCheckout,
    hasAvatar,
    hasLinks,
    hasLiveTraffic: false,
    fluencyScore: fallbackScore,
    scoreLabel: fallbackScore >= 80 ? "Pronto" : fallbackScore >= 55 ? "Em Preparo" : "Incompleto",
    gasto: 0,
    bruto: 0,
    roas: null,
    cpa: null,
    leakBrl: 0,
    anomalyCount: 0,
    primaryBottleneck: null,
  };
}

export function SemaforoProjetos({ projects, onOpenGrowthCopilot }: Props) {
  const navigate = useNavigate();
  const [filterHealth, setFilterHealth] = useState<"all" | "green" | "yellow" | "red">("all");
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [adsData, setAdsData] = useState<RawAdsWithProject[]>([]);
  const [salesData, setSalesData] = useState<RawSaleWithProject[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [activeRemediation, setActiveRemediation] = useState<{
    diagnostic: FunnelDiagnosticItem;
    projectName: string;
    projectId: string;
  } | null>(null);

  const fetchTelemetry = useCallback(async () => {
    if (!projects.length) return;
    setLoadingTelemetry(true);
    try {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [adsRes, salesRes] = await Promise.all([
        supabase
          .from("imphq_ads_spend")
          .select("project_id, spend, impressoes, link_clicks, cliques, init_checkout, purchases")
          .gte("date", since.slice(0, 10))
          .limit(5000),
        supabase
          .from("imphq_vendas")
          .select("project_id, status, valor, valor_liquido, tipo_venda, produto_nome, data, external_transaction_id")
          .gte("created_at", since)
          .limit(5000),
      ]);
      if (!adsRes.error && adsRes.data) {
        setAdsData(adsRes.data as RawAdsWithProject[]);
      }
      if (!salesRes.error && salesRes.data) {
        setSalesData(salesRes.data as RawSaleWithProject[]);
      }
    } finally {
      setLoadingTelemetry(false);
    }
  }, [projects.length, days]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  const projectsHealth = useMemo(() => {
    return projects.map((p) => {
      const pAds = adsData.filter((a) => a.project_id === p.id);
      const pSales = salesData.filter((s) => s.project_id === p.id);
      return evaluateProjectExecutiveHealth(p, pAds, pSales);
    });
  }, [projects, adsData, salesData]);

  const filtered = useMemo(() => {
    if (filterHealth === "all") return projectsHealth;
    return projectsHealth.filter((x) => x.statusColor === filterHealth);
  }, [projectsHealth, filterHealth]);

  const summary = useMemo(() => {
    const total = projectsHealth.length;
    const green = projectsHealth.filter((x) => x.statusColor === "green").length;
    const yellow = projectsHealth.filter((x) => x.statusColor === "yellow").length;
    const red = projectsHealth.filter((x) => x.statusColor === "red").length;
    const totalBruto = projectsHealth.reduce((acc, x) => acc + x.bruto, 0);
    const totalGasto = projectsHealth.reduce((acc, x) => acc + x.gasto, 0);
    const totalLeakBrl = projectsHealth.reduce((acc, x) => acc + x.leakBrl, 0);
    const avgScore =
      total > 0
        ? Math.round(projectsHealth.reduce((acc, x) => acc + x.fluencyScore, 0) / total)
        : 0;
    const globalRoas = totalGasto > 0 ? Number((totalBruto / totalGasto).toFixed(2)) : null;

    return {
      total,
      green,
      yellow,
      red,
      totalBruto,
      totalGasto,
      totalLeakBrl,
      avgScore,
      globalRoas,
    };
  }, [projectsHealth]);

  const [showAllRows, setShowAllRows] = useState(false);
  const visibleRows = useMemo(
    () => (showAllRows || filterHealth !== "all" ? filtered : filtered.slice(0, 4)),
    [filtered, showAllRows, filterHealth]
  );

  return (
    <Card className="bg-[#0A0B0D] border-[#1B1E23] overflow-hidden shadow-xl">
      <CardHeader className="pb-3 border-b border-[#1B1E23]/60 bg-gradient-to-r from-emerald-500/5 via-amber-500/5 to-transparent">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">🚦</span>
              <CardTitle className="text-base font-semibold text-white tracking-tight">
                Semáforo Executivo Multi-Projetos
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                Telemetria Real ({days}d)
              </Badge>
              {summary.totalLeakBrl > 0 && (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-300 animate-pulse"
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  {fmtBRL(summary.totalLeakBrl)} em risco na Sentinela
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-[#8A8F98] mt-1">
              Score de fluidez ao vivo, ROAS/CPA reais, vazamentos financeiros detectados e playbooks de correção em 1 clique.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Período */}
            <div className="flex items-center gap-0.5 bg-[#121418] border border-[#1B1E23] rounded-lg p-0.5 text-xs">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                    days === d
                      ? "bg-[#1B1E23] text-[#D6FF4B] font-semibold"
                      : "text-[#8A8F98] hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                type="button"
                onClick={() => fetchTelemetry()}
                disabled={loadingTelemetry}
                title="Atualizar telemetria"
                className="px-1.5 py-1 text-[#8A8F98] hover:text-white"
              >
                <RefreshCw className={`h-3 w-3 ${loadingTelemetry ? "animate-spin text-[#D6FF4B]" : ""}`} />
              </button>
            </div>

            {/* Filtro de Cor do Semáforo */}
            <div className="flex items-center gap-1 bg-[#121418] border border-[#1B1E23] rounded-lg p-1 text-xs">
              <button
                onClick={() => setFilterHealth("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                  filterHealth === "all" ? "bg-[#1B1E23] text-white font-semibold" : "text-[#8A8F98] hover:text-white"
                }`}
              >
                Todos ({summary.total})
              </button>
              <button
                onClick={() => setFilterHealth("green")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                  filterHealth === "green" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-emerald-500 hover:text-emerald-400"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {summary.green} Ativos
              </button>
              <button
                onClick={() => setFilterHealth("yellow")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                  filterHealth === "yellow" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-amber-500 hover:text-amber-400"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" /> {summary.yellow} Atenção
              </button>
              {summary.red > 0 && (
                <button
                  onClick={() => setFilterHealth("red")}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                    filterHealth === "red" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-rose-500 hover:text-rose-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> {summary.red} Críticos
                </button>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => onOpenGrowthCopilot()}
              className="bg-[#D6FF4B] hover:bg-[#D6FF4B]/90 text-[#0A0B0D] font-mono font-semibold text-xs gap-1.5 shadow-md"
            >
              <Zap className="h-3.5 w-3.5 fill-[#0A0B0D]" /> Growth Copilot
            </Button>
          </div>
        </div>

        {/* Barra de Resumo Executivo do Portfólio */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
          <div className="rounded-lg border border-[#1B1E23] bg-[#0E1013] px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              Score Médio Portfólio
            </span>
            <span className="text-sm font-mono font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Gauge className="h-3.5 w-3.5 text-[#D6FF4B]" />
              {summary.avgScore}/100
            </span>
          </div>
          <div className="rounded-lg border border-[#1B1E23] bg-[#0E1013] px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              Faturamento ({days}d)
            </span>
            <span className="text-sm font-mono font-bold text-emerald-400 block mt-0.5">
              {fmtBRL(summary.totalBruto)}
            </span>
          </div>
          <div className="rounded-lg border border-[#1B1E23] bg-[#0E1013] px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              Investimento & ROAS
            </span>
            <span className="text-sm font-mono font-bold text-white block mt-0.5">
              {fmtBRL(summary.totalGasto)}{" "}
              <span className="text-xs text-[#D6FF4B]">
                ({summary.globalRoas !== null ? `${summary.globalRoas}x` : "—"})
              </span>
            </span>
          </div>
          <div className="rounded-lg border border-[#1B1E23] bg-[#0E1013] px-3 py-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              Vazamento Estimado ({days}d)
            </span>
            <span
              className={`text-sm font-mono font-bold block mt-0.5 ${
                summary.totalLeakBrl > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {summary.totalLeakBrl > 0 ? `~${fmtBRL(summary.totalLeakBrl)}` : "R$ 0 (Blindado)"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1B1E23] bg-[#0E1013] text-[#8A8F98] uppercase tracking-wider font-mono text-[10px]">
              <th className="py-2.5 px-4">Projeto</th>
              <th className="py-2.5 px-3">Status & Fluidez</th>
              <th className="py-2.5 px-3">Telemetria ({days}d)</th>
              <th className="py-2.5 px-3">Ativos / Risco</th>
              <th className="py-2.5 px-4">Gargalo Atual</th>
              <th className="py-2.5 px-4">Próxima Ação IA</th>
              <th className="py-2.5 px-4 text-right">Ação Rápida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B1E23]/60">
            {visibleRows.map((item) => {
              const {
                project,
                statusColor,
                statusLabel,
                gargalo,
                proximaAcao,
                hasCheckout,
                hasAvatar,
                hasLinks,
                hasLiveTraffic,
                fluencyScore,
                gasto,
                bruto,
                roas,
                leakBrl,
                primaryBottleneck,
              } = item;

              return (
                <tr
                  key={project.id}
                  className="hover:bg-[#121418]/60 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/projetos/${project.id}`)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{normalizeProjectIcon(project.icon, project.id)}</span>
                      <div>
                        <div className="font-medium text-white group-hover:text-[#D6FF4B] transition-colors flex items-center gap-1.5">
                          {project.name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#8A8F98]" />
                        </div>
                        <span className="text-[10px] text-[#8A8F98] font-mono">
                          {project.category || "Geral"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                          statusColor === "green"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                            : statusColor === "yellow"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            statusColor === "green"
                              ? "bg-emerald-400 animate-pulse"
                              : statusColor === "yellow"
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                        />
                        {statusLabel}
                      </span>
                      <span className="text-[10px] font-mono text-[#8A8F98] pl-1">
                        Score:{" "}
                        <strong
                          className={
                            fluencyScore >= 80
                              ? "text-emerald-400"
                              : fluencyScore >= 60
                              ? "text-amber-400"
                              : "text-rose-400"
                          }
                        >
                          {fluencyScore}/100
                        </strong>
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-3 font-mono text-[11px]">
                    {hasLiveTraffic ? (
                      <div className="space-y-0.5">
                        <div className="text-emerald-400 font-semibold">
                          {fmtBRL(bruto)}{" "}
                          <span className="text-[10px] text-[#8A8F98] font-normal">
                            ({roas !== null ? `${roas}x` : "—"})
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8A8F98]">
                          Ads: {fmtBRL(gasto)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#8A8F98]">Sem tráfego ({days}d)</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0 ${
                            hasAvatar ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"
                          }`}
                        >
                          Avatar {hasAvatar ? "✓" : "✗"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0 ${
                            hasCheckout ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"
                          }`}
                        >
                          Checkout {hasCheckout ? "✓" : "✗"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0 ${
                            hasLinks ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"
                          }`}
                        >
                          Funil {hasLinks ? "✓" : "✗"}
                        </Badge>
                      </div>
                      {leakBrl > 0 && (
                        <span className="text-[10px] font-mono text-rose-400 font-semibold">
                          ⚠️ Vazamento: ~{fmtBRL(leakBrl)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[11px] text-[#C1C7CD] flex items-center gap-1.5">
                      {statusColor === "yellow" && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      {statusColor === "red" && <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
                      {statusColor === "green" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                      <span className="truncate max-w-[230px]" title={gargalo}>
                        {gargalo}
                      </span>
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[11px] text-white/90 font-medium flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-[#D6FF4B] shrink-0" />
                      <span className="truncate max-w-[240px]" title={proximaAcao}>
                        {proximaAcao}
                      </span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {primaryBottleneck && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setActiveRemediation({
                              diagnostic: primaryBottleneck,
                              projectName: project.name,
                              projectId: project.id,
                            })
                          }
                          className="h-7 text-[11px] font-mono border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 gap-1"
                          title="Abrir Playbook de Correção do Gargalo"
                        >
                          <Zap className="h-3 w-3" /> Corrigir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/funis?view=painel&projeto=${project.id}`)}
                        className="h-7 text-[11px] font-mono text-[#8A8F98] hover:text-white px-2"
                        title="Abrir Telemetria Ao Vivo do Funil"
                      >
                        <Activity className="h-3 w-3 mr-1" /> Funil
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenGrowthCopilot(project)}
                        className="h-7 text-[11px] font-mono border-[#1B1E23] hover:border-[#D6FF4B]/50 hover:bg-[#D6FF4B]/10 hover:text-[#D6FF4B] gap-1"
                      >
                        <Target className="h-3 w-3" /> Verba
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 4 && filterHealth === "all" && (
          <div className="border-t border-[#1B1E23] bg-[#0E1013] px-4 py-2 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowAllRows((prev) => !prev)}
              className="text-xs font-mono text-[#D6FF4B] hover:underline flex items-center gap-1.5"
            >
              {showAllRows
                ? "▲ Recolher Semáforo (mostrar top 4)"
                : `▼ Expandir todos os ${filtered.length} projetos no Semáforo`}
            </button>
          </div>
        )}
      </CardContent>

      {/* Modal de Playbook acionável direto do Semáforo Executivo */}
      <FunnelRemediationModal
        open={Boolean(activeRemediation)}
        onOpenChange={(open) => {
          if (!open) setActiveRemediation(null);
        }}
        diagnostic={activeRemediation?.diagnostic ?? null}
        projectName={activeRemediation?.projectName}
        projectId={activeRemediation?.projectId}
      />
    </Card>
  );
}
