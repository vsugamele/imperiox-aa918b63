import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Flame, Skull, Pause, Sparkles, Clock, X } from "lucide-react";

export type QuickFilterKey =
  | "SANGRANDO"
  | "CAMPEOES"
  | "VALIDANDO"
  | "PAUSADO"
  | "SATURADO"
  | "ESCALAR"
  | "MATAR"
  | "SEM_VENDA"
  | null;

interface Props {
  active: QuickFilterKey;
  counts: Record<string, number>;
  onChange: (k: QuickFilterKey) => void;
}

const CHIPS: { key: Exclude<QuickFilterKey, null>; label: string; icon: LucideIcon; tone: string; description: string }[] = [
  { key: "SANGRANDO", label: "Sangrando", icon: Skull, tone: "text-red-300 border-red-400/40 bg-red-500/15", description: "Gasto > 1.5x CPA-alvo sem vendas (Pausar)" },
  { key: "CAMPEOES", label: "Campeões", icon: Sparkles, tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/15", description: "CPA na meta e ROAS > 2.0x (Escalar)" },
  { key: "VALIDANDO", label: "Em Validação", icon: Clock, tone: "text-yellow-300 border-yellow-400/40 bg-yellow-500/15", description: "Menos de 50 cliques ou gasto inicial (Aguardar)" },
  { key: "PAUSADO", label: "Pausados", icon: Pause, tone: "text-muted-foreground border-border/40 bg-secondary/40", description: "Campanhas pausadas" },
  { key: "SATURADO", label: "Saturados", icon: Flame, tone: "text-orange-300 border-orange-400/40 bg-orange-500/15", description: "Frequência > 4" },
];

export function QuickFilters({ active, counts, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {CHIPS.map(({ key, label, icon: Icon, tone, description }) => {
        const isActive = active === key;
        const count = counts[key] || 0;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? null : key)}
            title={description}
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
