import { METRIC_FIELDS, formatMetric, autoStatusColor } from "./kanbanTemplates";

const DOT: Record<string, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-destructive",
};

interface Props {
  metrics?: Record<string, any> | null;
  statusColor?: string | null;
  compact?: boolean;
}

/**
 * Renderiza `● HK-001 · hook 64,2% · body 4,9% · ROI 2,1x` inline no card.
 * Puxa apenas as métricas presentes; nada fica visível se o card não tiver dados.
 */
export function CardMetricsChips({ metrics, statusColor, compact = false }: Props) {
  const auto = autoStatusColor(metrics || undefined);
  const color = statusColor || auto;
  const parts = METRIC_FIELDS
    .filter((f) => metrics && metrics[f.key] !== undefined && metrics[f.key] !== null && metrics[f.key] !== "")
    .slice(0, compact ? 3 : 5)
    .map((f) => (
      <span key={f.key} className="tabular-nums">
        {f.label} {formatMetric(metrics![f.key], f.format)}
      </span>
    ));

  if (!color && parts.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/90">
      {color && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT[color] || "bg-muted-foreground/40"}`} />}
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/30">·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}
