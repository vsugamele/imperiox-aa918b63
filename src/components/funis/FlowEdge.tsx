import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "framer-motion";
import { FLOW_METRIC_LABEL, flowMotion, type NodeVolume } from "@shared/flow-volume";

export interface FlowEdgeData extends Record<string, unknown> {
  /** Volume real dos últimos 7 dias que passa pela seta (UX1.4). */
  volume?: NodeVolume | null;
}

/**
 * Seta do mapa com partículas proporcionais ao volume real: mais volume, mais partículas e mais rápidas.
 * Sem volume, a seta fica parada. Quem pede menos movimento no sistema operacional não vê partículas.
 */
export function FlowEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, label, labelStyle, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth } = props;
  const data = props.data as FlowEdgeData | undefined;
  const reduceMotion = useReducedMotion();
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const volume = data?.volume ?? null;
  const motion = flowMotion(volume?.value ?? 0);
  const color = typeof style?.stroke === "string" ? style.stroke : "hsl(var(--primary))";
  const title = volume ? `${volume.value} ${FLOW_METRIC_LABEL[volume.metric]} nos últimos 7 dias` : null;

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} label={label} labelX={labelX} labelY={labelY}
        labelStyle={labelStyle} labelBgStyle={labelBgStyle} labelBgPadding={labelBgPadding} labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={interactionWidth} />
      {title && <path d={path} fill="none" stroke="transparent" strokeWidth={14} data-testid="flow-edge-volume"><title>{title}</title></path>}
      {!reduceMotion && Array.from({ length: motion.particles }, (_, i) => (
        <circle key={i} r={3.5} fill={color} opacity={0.9} data-testid="flow-particle" style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
          <animateMotion dur={`${motion.durationSec}s`} repeatCount="indefinite" path={path} begin={`${(i * motion.durationSec) / motion.particles}s`} />
        </circle>
      ))}
    </>
  );
}
