import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DeltaBadge } from "@/components/dashboard/DeltaBadge";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Format = "currency" | "number" | "percent" | "multiplier";

interface Props {
  label: string;
  value: number | null | undefined;
  format?: Format;
  /** Previous-period value for delta calculation */
  previousValue?: number | null;
  /** Or provide a precomputed delta % directly */
  delta?: number | null;
  /** When true, lower is better (CPA, CPC etc) */
  inverse?: boolean;
  /** Benchmark thresholds for status semaphore */
  benchmark?: { good: number; warn: number };
  tooltip?: string;
  icon?: React.ReactNode;
  className?: string;
}

function formatValue(v: number | null | undefined, fmt: Format): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  switch (fmt) {
    case "currency": return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "percent": return `${v.toFixed(1)}%`;
    case "multiplier": return `${v.toFixed(2)}x`;
    case "number":
    default: return v.toLocaleString("pt-BR");
  }
}

function getStatus(value: number | null | undefined, benchmark: Props["benchmark"], inverse: boolean): "good" | "warn" | "bad" | null {
  if (value === null || value === undefined || !isFinite(value) || !benchmark) return null;
  if (inverse) {
    if (value <= benchmark.good) return "good";
    if (value <= benchmark.warn) return "warn";
    return "bad";
  }
  if (value >= benchmark.good) return "good";
  if (value >= benchmark.warn) return "warn";
  return "bad";
}

const STATUS_DOT: Record<string, string> = {
  good: "bg-emerald-400 shadow-[0_0_8px_hsl(var(--primary)/0.4)]",
  warn: "bg-amber-400",
  bad: "bg-red-400",
};

const STATUS_GLOW: Record<string, string> = {
  good: "from-emerald-500/10 to-transparent",
  warn: "from-amber-500/10 to-transparent",
  bad: "from-red-500/10 to-transparent",
};

export function KpiHeroCard({
  label, value, format = "number", previousValue, delta, inverse = false,
  benchmark, tooltip, icon, className,
}: Props) {
  const computedDelta = delta !== undefined
    ? delta
    : (previousValue !== null && previousValue !== undefined && previousValue !== 0 && value !== null && value !== undefined)
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null;

  const status = getStatus(value, benchmark, inverse);

  const card = (
    <Card className={cn("relative overflow-hidden border-border", className)}>
      {status && (
        <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", STATUS_GLOW[status])} />
      )}
      <CardContent className="relative p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            {icon}
            {label}
            {tooltip && <Info className="h-2.5 w-2.5 opacity-60" />}
          </p>
          {status && <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[status])} />}
        </div>
        <p className="text-2xl font-bold tabular-nums font-mono text-foreground leading-tight">
          {formatValue(value, format)}
        </p>
        {computedDelta !== null && (
          <div className="flex items-center gap-1">
            <DeltaBadge delta={computedDelta} inverse={inverse} />
            <span className="text-[9px] text-muted-foreground">vs período ant.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!tooltip) return card;
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent className="text-xs w-64 space-y-1.5">
        <p className="font-bold">{label}</p>
        <p className="text-muted-foreground">{tooltip}</p>
        {benchmark && (
          <div className="text-[10px] text-muted-foreground border-t border-border pt-1.5 space-y-0.5">
            <p className="text-emerald-400">✓ Bom: {inverse ? "≤" : "≥"} {formatValue(benchmark.good, format)}</p>
            <p className="text-amber-400">⚠ Atenção: {inverse ? "≤" : "≥"} {formatValue(benchmark.warn, format)}</p>
            <p className="text-red-400">✗ Crítico: {inverse ? ">" : "<"} {formatValue(benchmark.warn, format)}</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
