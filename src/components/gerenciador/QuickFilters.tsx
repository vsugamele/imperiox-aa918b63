import { cn } from "@/lib/utils";
import { Flame, Skull, Snowflake, Pause, Sparkles, X } from "lucide-react";

export type QuickFilterKey = "ESCALAR" | "MATAR" | "SATURADO" | "SEM_VENDA" | "PAUSADO" | null;

interface Props {
  active: QuickFilterKey;
  counts: Record<Exclude<QuickFilterKey, null>, number>;
  onChange: (k: QuickFilterKey) => void;
}

const CHIPS: { key: Exclude<QuickFilterKey, null>; label: string; icon: any; tone: string }[] = [
  { key: "ESCALAR", label: "Escalar", icon: Sparkles, tone: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" },
  { key: "MATAR", label: "Matar", icon: Skull, tone: "text-red-300 border-red-400/30 bg-red-500/10" },
  { key: "SATURADO", label: "Saturado", icon: Flame, tone: "text-amber-300 border-amber-400/30 bg-amber-500/10" },
  { key: "SEM_VENDA", label: "Sem venda", icon: Snowflake, tone: "text-sky-300 border-sky-400/30 bg-sky-500/10" },
  { key: "PAUSADO", label: "Pausados", icon: Pause, tone: "text-muted-foreground border-border/40 bg-secondary/40" },
];

export function QuickFilters({ active, counts, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {CHIPS.map(({ key, label, icon: Icon, tone }) => {
        const isActive = active === key;
        const count = counts[key] || 0;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? null : key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] uppercase tracking-wider transition",
              isActive ? tone + " ring-1 ring-current/40" : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
      {active && (
        <button onClick={() => onChange(null)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5">
          <X className="h-3 w-3" /> limpar
        </button>
      )}
    </div>
  );
}
