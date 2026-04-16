import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  delta: number | null;
  /** When true, a negative delta is GOOD (e.g. cost reduction). Defaults to false. */
  inverse?: boolean;
  className?: string;
}

export function DeltaBadge({ delta, inverse = false, className }: Props) {
  if (delta === null || delta === undefined || !isFinite(delta)) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-[10px] text-muted-foreground", className)}>
        <Minus className="h-2.5 w-2.5" />
        —
      </span>
    );
  }

  const isPositive = delta > 0;
  const isNeutral = Math.abs(delta) < 0.5;
  const isGood = isNeutral ? null : inverse ? !isPositive : isPositive;

  const colorClass = isGood === null
    ? "text-muted-foreground"
    : isGood
    ? "text-emerald-400"
    : "text-red-400";

  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold", colorClass, className)}>
      <Icon className="h-2.5 w-2.5" />
      {isPositive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}
