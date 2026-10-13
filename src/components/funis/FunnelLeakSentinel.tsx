import { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ArrowRight,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  CheckCircle2,
  BellRing,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FunnelLive } from "@shared/funnel-live";
import {
  scanFunnelAnomalies,
  type FunnelAnomaly,
  type SentinelReport,
} from "@shared/funnel-sentinel";
import type { FunnelDiagnosticItem } from "@shared/funnel-diagnostics";
import { FunnelRemediationModal } from "./FunnelRemediationModal";

interface FunnelLeakSentinelProps {
  funnel: FunnelLive;
  projectId?: string;
  projectName?: string;
  className?: string;
  onOpenSimulator?: () => void;
  defaultExpanded?: boolean;
}

function fmtBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

export function FunnelLeakSentinel({
  funnel,
  projectId,
  projectName = "Projeto",
  className,
  onOpenSimulator,
  defaultExpanded = true,
}: FunnelLeakSentinelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [activeRemediation, setActiveRemediation] = useState<FunnelDiagnosticItem | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const sentinelReport = useMemo(() => {
    return scanFunnelAnomalies(funnel, projectId);
  }, [funnel, projectId]);

  const activeAnomalies = useMemo(() => {
    return sentinelReport.activeAnomalies.filter((a) => !dismissedIds.has(a.id));
  }, [sentinelReport, dismissedIds]);

  const totalLeakBrl = useMemo(() => {
    return activeAnomalies.reduce((sum, a) => sum + a.impactBrlEstimate, 0);
  }, [activeAnomalies]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const handleOpenPlaybook = (anomaly: FunnelAnomaly) => {
    // Adaptar Anomaly para FunnelDiagnosticItem do modal
    const diagnosticItem: FunnelDiagnosticItem = {
      id: anomaly.id,
      severity: anomaly.severity === "critica" ? "critico" : "alerta",
      stagePair: [anomaly.stageId],
      title: anomaly.title,
      badge: anomaly.badge,
      metricComparison: `${anomaly.metricCurrent}${anomaly.unit === "%" ? "%" : anomaly.unit === "brl" ? " R$" : ""} (Esperado: ${anomaly.metricBaseline}${anomaly.unit === "%" ? "%" : anomaly.unit === "brl" ? " R$" : ""})`,
      rootCause: anomaly.triggerDescription,
      recommendation: anomaly.actionSuggestion,
      action: {
        type: anomaly.playbookType,
        label: `Corrigir ${anomaly.title}`,
        hint: anomaly.actionSuggestion,
      },
      estimatedLeak: fmtBRL(anomaly.impactBrlEstimate),
    };
    setActiveRemediation(diagnosticItem);
  };

  if (activeAnomalies.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground",
          className
        )}
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="font-medium text-foreground">
            Sentinela de Vazamento Proativo:
          </span>
          <span className="text-emerald-400 font-mono">0 anomalias ativas</span>
          <span className="text-muted-foreground hidden sm:inline">
            · Métricas de chegada, checkout e gateway operando dentro dos limites de segurança.
          </span>
        </div>
        {onOpenSimulator && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onOpenSimulator}
          >
            <SlidersHorizontal className="h-3 w-3 mr-1" /> Simular Escala
          </Button>
        )}
      </div>
    );
  }

  const hasCritical = activeAnomalies.some((a) => a.severity === "critica");

  return (
    <Card
      className={cn(
        "border shadow-sm transition-all overflow-hidden",
        hasCritical
          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-background to-background"
          : "border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-background to-background",
        className
      )}
    >
      <CardHeader className="p-3.5 pb-2.5 border-b border-border/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <ShieldAlert className={cn("h-4 w-4", hasCritical ? "text-rose-400" : "text-amber-400")} />
              Sentinela de Vazamento Proativo
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-bold tracking-wider font-mono px-1.5 py-0.5",
                hasCritical
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-300"
                  : "border-amber-500/50 bg-amber-500/20 text-amber-300"
              )}
            >
              {activeAnomalies.length} {activeAnomalies.length === 1 ? "Vazamento Detectado" : "Vazamentos Detectados"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Perda Estimada em Risco:{" "}
              <strong className={cn("font-mono font-bold", hasCritical ? "text-rose-400" : "text-amber-400")}>
                ~{fmtBRL(totalLeakBrl)}
              </strong>
            </span>

            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? "Recolher alertas" : "Expandir alertas"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3.5 space-y-2.5">
          {activeAnomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={cn(
                "rounded-md border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors",
                anomaly.severity === "critica"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              )}
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[9px] uppercase font-bold tracking-wider px-1 py-0.5 rounded border",
                      anomaly.severity === "critica"
                        ? "border-rose-500/60 bg-rose-500/20 text-rose-300"
                        : "border-amber-500/60 bg-amber-500/20 text-amber-300"
                    )}
                  >
                    {anomaly.severity === "critica" ? "Crítico" : "Alerta"}
                  </span>
                  <span className="font-semibold text-foreground">{anomaly.title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-border/60 text-muted-foreground">
                    Etapa: {anomaly.stageId}
                  </Badge>
                </div>

                <p className="text-xs opacity-90 leading-relaxed">
                  {anomaly.triggerDescription}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                  <span>
                    Desvio: <strong className="text-foreground">{anomaly.dropPct}%</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Vazamento Estimado:{" "}
                    <strong className="text-rose-400 font-mono">~{fmtBRL(anomaly.impactBrlEstimate)}</strong>
                  </span>
                  <span>·</span>
                  <span className="text-muted-foreground/90">
                    💡 {anomaly.actionSuggestion}
                  </span>
                </div>
              </div>

              {/* Botões de Ação para cada anomalia */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 bg-primary text-black font-semibold hover:bg-primary/90 shadow-xs"
                  onClick={() => handleOpenPlaybook(anomaly)}
                >
                  <Zap className="h-3 w-3" />
                  {anomaly.type === "surto_cpa_fatiga" ? "Ganchos P1–P5 ⚡" : "Playbook ⚡"}
                </Button>

                {onOpenSimulator && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-border/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                    onClick={onOpenSimulator}
                  >
                    <SlidersHorizontal className="h-3 w-3" /> Simular
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
                  onClick={() => handleDismiss(anomaly.id)}
                  title="Ocultar esta notificação nesta sessão"
                >
                  Silenciar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      )}

      {/* Modal de Remediação Autônoma */}
      <FunnelRemediationModal
        open={Boolean(activeRemediation)}
        onOpenChange={(open) => {
          if (!open) setActiveRemediation(null);
        }}
        diagnostic={activeRemediation}
        projectName={projectName}
        projectId={projectId}
      />
    </Card>
  );
}
