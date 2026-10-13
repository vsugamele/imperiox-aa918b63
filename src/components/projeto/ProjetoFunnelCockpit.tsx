import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  LifeBuoy,
  RefreshCw,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useFunnelLive } from "@/hooks/useFunnelLive";
import { runFunnelDiagnostics, type FunnelDiagnosticItem } from "@shared/funnel-diagnostics";
import { REFERENCIA, type StageId, type StageStatus } from "@shared/funnel-live";
import { FunnelRemediationModal } from "@/components/funis/FunnelRemediationModal";
import { FunnelWhatIfSimulator } from "@/components/funis/FunnelWhatIfSimulator";
import { FunnelLeakSentinel } from "@/components/funis/FunnelLeakSentinel";

interface ProjetoFunnelCockpitProps {
  projectId: string;
  projectName?: string;
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
] as const;

function fmtBRL(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

function fmtInt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("pt-BR");
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
}

const STAGE_ICONS: Record<StageId, { icon: typeof Snowflake; color: string; tempLabel: string }> = {
  anuncio: { icon: Snowflake, color: "text-sky-400 bg-sky-500/10 border-sky-500/20", tempLabel: "Topo · Frio" },
  pagina: { icon: Sun, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", tempLabel: "Meio · Morno" },
  checkout: { icon: Flame, color: "text-orange-400 bg-orange-500/10 border-orange-500/20", tempLabel: "Fundo · Quente" },
  venda: { icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", tempLabel: "Conversão" },
  extra: { icon: Sparkles, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", tempLabel: "LTV Extra" },
  recuperacao: { icon: LifeBuoy, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", tempLabel: "Recuperação" },
};

const STATUS_BADGES: Record<StageStatus, { label: string; cls: string }> = {
  ok: { label: "Saudável", cls: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
  atencao: { label: "Atenção", cls: "border-amber-500/30 text-amber-400 bg-amber-500/10" },
  gargalo: { label: "Gargalo", cls: "border-rose-500/40 text-rose-400 bg-rose-500/15 animate-pulse" },
  sem_dado: { label: "Sem dado", cls: "border-border text-muted-foreground/70" },
  medicao_incompleta: { label: "Incompleto", cls: "border-amber-500/30 text-amber-300/80" },
};

export function ProjetoFunnelCockpit({
  projectId,
  projectName = "Projeto",
  onNavigateTab,
  className,
}: ProjetoFunnelCockpitProps) {
  const [days, setDays] = useState<number>(7);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [activeRemediation, setActiveRemediation] = useState<FunnelDiagnosticItem | null>(null);

  const { data: funnel, isLoading, error, refetch, isRefetching } = useFunnelLive({
    projectId,
    produto: selectedProduct,
    days,
  });

  const report = useMemo(() => {
    if (!funnel) return null;
    return runFunnelDiagnostics(funnel);
  }, [funnel]);

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-border/60 bg-card p-4 space-y-4", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !funnel || !report) {
    return (
      <div className={cn("rounded-lg border border-border/60 bg-card p-4 text-xs text-muted-foreground", className)}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-foreground font-medium">
            <Activity className="h-4 w-4 text-primary" /> Cockpit de Telemetria do Funil
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </div>
        <p className="mt-2 text-rose-400">
          Dados de telemetria indisponíveis no momento: {error instanceof Error ? error.message : "Sem conexão."}
        </p>
      </div>
    );
  }

  const { score, scoreLabel, primaryBottleneck, healthyStagesCount, totalStagesCount } = report;

  const scoreColor =
    score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
    score >= 60 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
    "text-rose-400 border-rose-500/40 bg-rose-500/10";

  const stageMap = new Map(funnel.etapas.map((s) => [s.id, s]));
  const anuncio = stageMap.get("anuncio");
  const pagina = stageMap.get("pagina");
  const checkout = stageMap.get("checkout");
  const venda = stageMap.get("venda");
  const extra = stageMap.get("extra");
  const recuperacao = stageMap.get("recuperacao");

  // Conversões chave
  const ctrVal = anuncio?.conversao?.value ?? null;
  const chegadaVal = pagina?.conversao?.value ?? null;
  const inicioVal = checkout?.conversao?.value ?? null;
  const aprovacaoVal = venda?.conversao?.value ?? null;
  const extraVal = extra?.conversao?.value ?? null;
  const recupVal = recuperacao?.conversao?.value ?? null;

  return (
    <Card className={cn("border border-border/70 bg-card/90 shadow-sm relative overflow-hidden", className)}>
      {/* Glow de fundo sutil conforme a saúde do funil */}
      <div
        className={cn(
          "absolute -top-12 -right-12 h-44 w-44 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors",
          score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500"
        )}
      />

      <CardHeader className="p-4 pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          {/* Título & Badge de Telemetria Ao Vivo */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                Saúde & Telemetria do Funil
              </CardTitle>
            </div>

            <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", scoreColor)}>
              Score de Fluidez: {score}/100 ({scoreLabel})
            </Badge>

            <span className="text-[11px] text-muted-foreground hidden md:inline">
              · {healthyStagesCount} de {totalStagesCount} etapas no padrão saudável
            </span>
          </div>

          {/* Controles de Período, Produto e Ações */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Período */}
            <div className="flex items-center rounded-md border border-border/80 bg-secondary/30 p-0.5">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDays(p.days)}
                  className={cn(
                    "px-2 py-1 text-[11px] rounded transition-colors font-medium",
                    days === p.days
                      ? "bg-primary text-black font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Seletor de Produto (se o projeto tiver produtos cadastrados) */}
            {funnel.produtos.length > 1 && (
              <Select
                value={selectedProduct ?? "todos"}
                onValueChange={(v) => setSelectedProduct(v === "todos" ? null : v)}
              >
                <SelectTrigger className="h-7 text-xs w-[140px] bg-secondary/30 border-border/80">
                  <SelectValue placeholder="Produto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {funnel.produtos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Atualizar */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Recarregar telemetria"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            </Button>

            {/* Link para Painel Completo de Funis */}
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-7 text-xs gap-1 border-border/60 hover:border-gold/40 text-muted-foreground hover:text-foreground"
            >
              <Link to={`/funis?view=painel&projeto=${projectId}`}>
                <span>Painel Completo</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>

            {/* Toggle Expandir/Recolher */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* ───────── BLOCO 0: SENTINELA DE VAZAMENTO PROATIVO ───────── */}
        <FunnelLeakSentinel
          funnel={funnel}
          projectId={projectId}
          projectName={projectName}
          onOpenSimulator={() => setShowSimulator(true)}
          defaultExpanded={false}
        />

        {/* ───────── BLOCO 1: GARGALO ATIVO & CAUSA RAIZ CRUZADA ───────── */}
        {primaryBottleneck ? (
          <div
            className={cn(
              "rounded-lg border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all",
              primaryBottleneck.severity === "critico"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                : "bg-amber-500/10 border-amber-500/30 text-amber-200"
            )}
          >
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2",
                    primaryBottleneck.severity === "critico"
                      ? "border-rose-500/50 bg-rose-500/20 text-rose-300"
                      : "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  )}
                >
                  {primaryBottleneck.severity === "critico" ? "⚠️ Gargalo Crítico" : "⚡ Alerta Operacional"}
                </Badge>

                <span className="text-xs font-semibold text-foreground">
                  {primaryBottleneck.title}
                </span>

                <span className="text-[11px] font-mono opacity-80">
                  [{primaryBottleneck.stagePair.join(" ➔ ")}]
                </span>
              </div>

              <p className="text-xs opacity-90 leading-relaxed">
                <strong>Diagnóstico:</strong> {primaryBottleneck.metricComparison}.{" "}
                <span className="opacity-80">{primaryBottleneck.rootCause}</span>
              </p>

              <p className="text-[11px] text-muted-foreground">
                🎯 <strong>Prescrição:</strong> {primaryBottleneck.recommendation}
              </p>
            </div>

            {/* Ações Imediatas */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-primary text-black font-semibold hover:bg-primary/90 shadow-sm"
                onClick={() => setActiveRemediation(primaryBottleneck)}
              >
                <Zap className="h-3.5 w-3.5" />
                Playbook de Solução
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-border/80 hover:bg-secondary/40"
                onClick={() => setShowSimulator((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                {showSimulator ? "Fechar Simulador" : "Simular Impacto"}
              </Button>

              {onNavigateTab && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
                  onClick={() => onNavigateTab("raiox")}
                  title="Abrir no Raio-X & Funil"
                >
                  Raio-X ↗
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Funil em Operação Harmoniosa:</strong> Todas as conversões medidas estão saudáveis em relação às referências de mercado.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => setShowSimulator((v) => !v)}
            >
              <SlidersHorizontal className="h-3 w-3 mr-1" /> Simular Escala
            </Button>
          </div>
        )}

        {/* ───────── BLOCO 2: MINI-MAPA DAS 6 ETAPAS INTERCONECTADAS ───────── */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-primary" /> Mapa de Conversão Passo a Passo ({days}d)
              </span>
              <span className="text-[11px]">
                Gasto: <strong className="text-foreground">{fmtBRL(funnel.totais.gasto)}</strong> ·
                Faturamento: <strong className="text-emerald-400">{fmtBRL(funnel.totais.bruto)}</strong> ·
                ROAS: <strong className="text-primary">{funnel.totais.roas ? `${funnel.totais.roas.toFixed(2)}x` : "—"}</strong>
              </span>
            </div>

            {/* Grid Horizontal Responsivo com os 6 Nós do Funil */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* ETAPA 1: ANÚNCIO */}
              <StageNodeCard
                stageId="anuncio"
                title="1. Anúncio"
                status={anuncio?.status ?? "sem_dado"}
                primaryValue={fmtBRL(anuncio?.metrics.find((m) => m.label === "Gasto")?.value)}
                primaryLabel="Gasto"
                secondaryMetric={{
                  label: "Cliques",
                  value: fmtInt(anuncio?.metrics.find((m) => m.label === "Cliques")?.value),
                }}
                tertiaryMetric={{
                  label: "CPC",
                  value: fmtBRL(anuncio?.metrics.find((m) => m.label === "CPC")?.value),
                }}
                conversion={{
                  label: "CTR",
                  value: ctrVal,
                  reference: REFERENCIA.ctr,
                }}
                onNavigate={() => onNavigateTab?.("midia")}
              />

              {/* ETAPA 2: PÁGINA */}
              <StageNodeCard
                stageId="pagina"
                title="2. Página"
                status={pagina?.status ?? "sem_dado"}
                primaryValue={fmtInt(pagina?.metrics.find((m) => m.label === "Visitas")?.value)}
                primaryLabel="Visitas"
                secondaryMetric={{
                  label: "Cliques Botão",
                  value: fmtInt(pagina?.metrics.find((m) => m.label === "Cliques no botão")?.value),
                }}
                tertiaryMetric={{
                  label: "Status",
                  value: pagina?.status === "medicao_incompleta" ? "Falta pixel" : "Medido",
                }}
                conversion={{
                  label: "Chegada",
                  value: chegadaVal,
                  reference: REFERENCIA.chegada,
                  hint: "Cliques ➔ Visitas",
                }}
                onNavigate={() => onNavigateTab?.("sites")}
              />

              {/* ETAPA 3: CHECKOUT */}
              <StageNodeCard
                stageId="checkout"
                title="3. Checkout"
                status={checkout?.status ?? "sem_dado"}
                primaryValue={fmtInt(checkout?.metrics.find((m) => m.label === "Checkouts iniciados")?.value)}
                primaryLabel="Iniciados"
                secondaryMetric={{
                  label: "Pedidos",
                  value: fmtInt(checkout?.metrics.find((m) => m.label === "Pedidos gerados")?.value),
                }}
                tertiaryMetric={{
                  label: "Drop",
                  value: checkout?.metrics.find((m) => m.label === "Checkouts iniciados")?.value && checkout?.metrics.find((m) => m.label === "Pedidos gerados")?.value
                    ? `${Math.max(0, 100 - Math.round((Number(checkout.metrics.find((m) => m.label === "Pedidos gerados")?.value) / Number(checkout.metrics.find((m) => m.label === "Checkouts iniciados")?.value)) * 100))}%`
                    : "—",
                }}
                conversion={{
                  label: "Início",
                  value: inicioVal,
                  reference: REFERENCIA.inicio_checkout,
                  hint: "Visitas ➔ Checkout",
                }}
                onNavigate={() => onNavigateTab?.("identidade")}
              />

              {/* ETAPA 4: VENDA */}
              <StageNodeCard
                stageId="venda"
                title="4. Venda"
                status={venda?.status ?? "sem_dado"}
                primaryValue={fmtInt(venda?.metrics.find((m) => m.label === "Vendas")?.value)}
                primaryLabel="Aprovadas"
                secondaryMetric={{
                  label: "Fat. Bruto",
                  value: fmtBRL(venda?.metrics.find((m) => m.label === "Faturamento")?.value),
                }}
                tertiaryMetric={{
                  label: "CPA",
                  value: fmtBRL(venda?.metrics.find((m) => m.label === "CPA")?.value),
                }}
                conversion={{
                  label: "Aprovação",
                  value: aprovacaoVal,
                  reference: REFERENCIA.aprovacao,
                  hint: "Pedidos ➔ Pagos",
                }}
                onNavigate={() => onNavigateTab?.("financas")}
              />

              {/* ETAPA 5: BUMP & UPSELL */}
              <StageNodeCard
                stageId="extra"
                title="5. Bump & Upsell"
                status={extra?.status ?? "sem_dado"}
                primaryValue={fmtInt(extra?.metrics.find((m) => m.label === "Extras vendidos")?.value)}
                primaryLabel="Extras Pagos"
                secondaryMetric={{
                  label: "Receita Extra",
                  value: fmtBRL(extra?.metrics.find((m) => m.label === "Receita extra")?.value),
                }}
                tertiaryMetric={{
                  label: "LTV Boost",
                  value: extra?.metrics.find((m) => m.label === "Receita extra")?.value && venda?.metrics.find((m) => m.label === "Faturamento")?.value
                    ? `+${fmtPct((Number(extra.metrics.find((m) => m.label === "Receita extra")?.value) / Math.max(1, Number(venda.metrics.find((m) => m.label === "Faturamento")?.value))) * 100)}`
                    : "—",
                }}
                conversion={{
                  label: "Aceite",
                  value: extraVal,
                  reference: REFERENCIA.extra,
                  hint: "Extras / Vendas",
                }}
                onNavigate={() => onNavigateTab?.("ecossistema")}
              />

              {/* ETAPA 6: WHATSAPP */}
              <StageNodeCard
                stageId="recuperacao"
                title="6. WhatsApp"
                status={recuperacao?.status ?? "sem_dado"}
                primaryValue={fmtInt(recuperacao?.metrics.find((m) => m.label === "Recuperados")?.value)}
                primaryLabel="Recuperados"
                secondaryMetric={{
                  label: "Na Régua",
                  value: fmtInt(recuperacao?.metrics.find((m) => m.label === "Pedidos com régua")?.value),
                }}
                tertiaryMetric={{
                  label: "Conversão",
                  value: fmtPct(recupVal),
                }}
                conversion={{
                  label: "Recup.",
                  value: recupVal,
                  reference: REFERENCIA.recuperacao,
                  hint: "Recup. / Régua",
                }}
                onNavigate={() => onNavigateTab?.("comando")}
              />
            </div>
          </div>
        )}

        {/* ───────── BLOCO 3: SIMULADOR WHAT-IF INTEGRADO (EXPANSÍVEL) ───────── */}
        {showSimulator && (
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Simulador de Impacto Financeiro (O que Acontece se Corrigirmos o Gargalo?)
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setShowSimulator(false)}
              >
                Ocultar simulador
              </Button>
            </div>
            <FunnelWhatIfSimulator funnel={funnel} projectName={projectName} />
          </div>
        )}
      </CardContent>

      {/* Modal de Remediação Autônoma com Playbooks de 1 Clique */}
      <FunnelRemediationModal
        open={Boolean(activeRemediation)}
        onOpenChange={(open) => {
          if (!open) setActiveRemediation(null);
        }}
        diagnostic={activeRemediation}
        projectName={projectName}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTE: CARD INDIVIDUAL DE CADA ETAPA DO FUNIL
// ─────────────────────────────────────────────────────────────────────────────

interface StageNodeCardProps {
  stageId: StageId;
  title: string;
  status: StageStatus;
  primaryValue: string;
  primaryLabel: string;
  secondaryMetric: { label: string; value: string };
  tertiaryMetric: { label: string; value: string };
  conversion?: {
    label: string;
    value: number | null;
    reference: number;
    hint?: string;
  } | null;
  onNavigate?: () => void;
}

function StageNodeCard({
  stageId,
  title,
  status,
  primaryValue,
  primaryLabel,
  secondaryMetric,
  tertiaryMetric,
  conversion,
  onNavigate,
}: StageNodeCardProps) {
  const meta = STAGE_ICONS[stageId];
  const Icon = meta.icon;
  const statusInfo = STATUS_BADGES[status] ?? STATUS_BADGES.sem_dado;

  return (
    <div
      onClick={onNavigate}
      className={cn(
        "rounded-lg border p-2.5 flex flex-col justify-between transition-all bg-card/60 hover:bg-secondary/30 select-none group",
        status === "gargalo"
          ? "border-rose-500/40 shadow-xs ring-1 ring-rose-500/20"
          : status === "atencao"
          ? "border-amber-500/40"
          : "border-border/60 hover:border-border",
        onNavigate && "cursor-pointer"
      )}
    >
      {/* Top Header do Card */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Icon className={cn("h-3 w-3", meta.color.split(" ")[0])} />
            {title}
          </span>
          <Badge variant="outline" className={cn("text-[9px] px-1 py-0 uppercase font-mono", statusInfo.cls)}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* Métrica Primária */}
        <div className="pt-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
            {primaryLabel}
          </span>
          <div className="text-base font-bold font-mono text-foreground tracking-tight">
            {primaryValue}
          </div>
        </div>
      </div>

      {/* Métricas Secundárias */}
      <div className="border-t border-border/40 pt-1.5 mt-2 space-y-1 text-[10px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{secondaryMetric.label}</span>
          <span className="font-mono text-foreground font-medium">{secondaryMetric.value}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{tertiaryMetric.label}</span>
          <span className="font-mono text-foreground font-medium">{tertiaryMetric.value}</span>
        </div>
      </div>

      {/* Conversão da Etapa */}
      {conversion && (
        <div className="mt-2 pt-1.5 border-t border-dashed border-border/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/90 font-medium">
              {conversion.label}
            </span>
            <span
              className={cn(
                "font-mono font-semibold",
                conversion.value === null
                  ? "text-muted-foreground"
                  : conversion.value >= conversion.reference
                  ? "text-emerald-400"
                  : conversion.value >= conversion.reference * 0.5
                  ? "text-amber-400"
                  : "text-rose-400"
              )}
            >
              {conversion.value !== null ? `${conversion.value}%` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 mt-0.5">
            <span>Ref: {conversion.reference}%</span>
            {conversion.hint && <span className="truncate max-w-[80px]">{conversion.hint}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
