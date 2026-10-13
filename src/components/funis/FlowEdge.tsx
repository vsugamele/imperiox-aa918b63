import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "framer-motion";
import { FLOW_METRIC_LABEL, flowMotion, type NodeVolume, type EdgeTransitionMetrics } from "@shared/flow-volume";
import { AlertTriangle, CheckCircle2, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowEdgeData extends Record<string, unknown> {
  /** Volume real dos últimos 7 dias que passa pela seta (UX1.4). */
  volume?: NodeVolume | null;
  /** Métricas de transição e saúde calculadas pelo motor analítico (UX1.5 / Sinergia 2D). */
  transition?: EdgeTransitionMetrics | null;
  /** Status da transição */
  status?: "ok" | "atencao" | "gargalo" | "sem_dado";
  /** Estimativa de vazamento em R$ se for gargalo */
  leakEstimateBrl?: number | null;
}

/**
 * Seta do mapa 2D com sinergia à telemetria ao vivo:
 * - Partículas de fluxo proporcionais ao volume real.
 * - Brilho e cor dinâmicos (verde para saudável, âmbar para atenção, vermelho pulsante para vazamento).
 * - Badge flutuante de conversão e vazamento no centro da transição entre os nós.
 */
export function FlowEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    label,
    labelStyle,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    interactionWidth,
  } = props;

  const data = props.data as FlowEdgeData | undefined;
  const reduceMotion = useReducedMotion();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const volume = data?.volume ?? null;
  const transition = data?.transition ?? null;
  const status = transition?.status ?? data?.status ?? "ok";
  const motion = flowMotion(volume?.value ?? 0);

  // Cores dinâmicas de acordo com o status da transição
  let edgeColor = typeof style?.stroke === "string" ? style.stroke : "hsl(var(--primary))";
  let filterShadow = `drop-shadow(0 0 4px ${edgeColor})`;

  if (status === "gargalo") {
    edgeColor = "#f43f5e"; // Rose 500
    filterShadow = "drop-shadow(0 0 6px rgba(244, 63, 94, 0.8))";
  } else if (status === "atencao") {
    edgeColor = "#f59e0b"; // Amber 500
    filterShadow = "drop-shadow(0 0 5px rgba(245, 158, 11, 0.7))";
  } else if (status === "ok" && transition?.conversionRate !== null) {
    edgeColor = "#10b981"; // Emerald 500
    filterShadow = "drop-shadow(0 0 4px rgba(16, 185, 129, 0.6))";
  }

  const customStyle = {
    ...style,
    stroke: edgeColor,
    strokeWidth: status === "gargalo" ? 2.5 : style?.strokeWidth ?? 1.5,
  };

  const volumeTitle = volume
    ? `${volume.value} ${FLOW_METRIC_LABEL[volume.metric]} nos últimos 7 dias`
    : null;

  const tooltipTitle = [
    volumeTitle,
    transition?.conversionRate !== null && transition?.conversionRate !== undefined
      ? `${transition.labelConversion}: ${transition.conversionRate}% (Referência: ${transition.referenceRate}%)`
      : null,
    transition?.dropPct ? `⚠️ Desvio de ${transition.dropPct}% abaixo da meta` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={customStyle}
        markerEnd={markerEnd}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={interactionWidth}
      />

      {tooltipTitle && (
        <path d={path} fill="none" stroke="transparent" strokeWidth={16} data-testid="flow-edge-volume">
          <title>{tooltipTitle}</title>
        </path>
      )}

      {/* Partículas animadas ao longo da seta */}
      {!reduceMotion &&
        Array.from({ length: motion.particles }, (_, i) => (
          <circle
            key={i}
            r={status === "gargalo" ? 4 : 3.5}
            fill={edgeColor}
            opacity={0.95}
            data-testid="flow-particle"
            style={{ filter: filterShadow }}
          >
            <animateMotion
              dur={`${motion.durationSec}s`}
              repeatCount="indefinite"
              path={path}
              begin={`${(i * motion.durationSec) / motion.particles}s`}
            />
          </circle>
        ))}

      {/* Badge Interativo de Conversão & Vazamento no Centro da Seta (EdgeLabelRenderer) */}
      {transition && transition.conversionRate !== null && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan z-20"
          >
            <div
              title={tooltipTitle}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold shadow-md transition-all select-none",
                status === "gargalo"
                  ? "bg-rose-500/90 text-white border border-rose-400 ring-2 ring-rose-500/30 animate-pulse"
                  : status === "atencao"
                  ? "bg-amber-500/90 text-black border border-amber-400"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
              )}
            >
              {status === "gargalo" ? (
                <AlertTriangle className="h-3 w-3 shrink-0 text-white" />
              ) : status === "atencao" ? (
                <Zap className="h-3 w-3 shrink-0 text-black" />
              ) : (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
              )}
              <span>
                {transition.labelConversion}: {transition.conversionRate}%
              </span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
