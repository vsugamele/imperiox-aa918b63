import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: number;
  previous: number;
  /** Se true, queda é boa (ex: CPA, CPC, CPM). */
  inverse?: boolean;
  className?: string;
}

export function DeltaBadge({ current, previous, inverse = false, className }: Props) {
  if (!previous || previous === 0) {
    return <span className={cn("text-[9px] text-muted-foreground/50", className)}>—</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) {
    return <span className={cn("text-[9px] text-muted-foreground/60 tabular-nums", className)}>0%</span>;
  }
  const isUp = pct > 0;
  // "Bom" quando: subiu e não é inverse, OU caiu e é inverse
  const isGood = inverse ? !isUp : isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] font-medium tabular-nums",
        isGood ? "text-emerald-400" : "text-red-400",
        className
      )}
    >
      {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
