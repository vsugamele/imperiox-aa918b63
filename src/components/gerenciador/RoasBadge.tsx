import { cn } from "@/lib/utils";

export function RoasBadge({ value }: { value: number }) {
  const color =
    value >= 2 ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" :
    value >= 1 ? "text-amber-300 bg-amber-500/10 border-amber-500/30" :
    "text-red-300 bg-red-500/10 border-red-500/30";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-medium tabular-nums", color)}>
      {value > 0 ? `${value.toFixed(2)}×` : "—"}
    </span>
  );
}

export function CpaCell({ cpa, ticket }: { cpa: number; ticket?: number }) {
  if (!cpa) return <span className="text-muted-foreground">—</span>;
  const bad = ticket ? cpa > ticket * 0.5 : false;
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] tabular-nums",
      bad ? "text-red-300 bg-red-500/10" : "text-foreground"
    )}>
      R$ {cpa.toFixed(2)}
    </span>
  );
}
