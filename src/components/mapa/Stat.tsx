import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/AnimatedNumber";

interface StatProps {
  label: string;
  value: string | number;
  tone?: string;
  hint?: string;
}

export function Stat({ label, value, tone, hint }: StatProps) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-subtle">{label}</div>
      <div className={cn("mt-1 font-mono text-xl text-foreground", tone)}>{typeof value === "number" ? <AnimatedNumber value={value} /> : value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
