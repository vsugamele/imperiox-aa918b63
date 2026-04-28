import { Button } from "@/components/ui/button";
import { Play, Pause, Copy, X, Loader2, DollarSign } from "lucide-react";

interface Props {
  count: number;
  loading?: boolean;
  onActivate: () => void;
  onPause: () => void;
  onDuplicate: () => void;
  onAdjustBudget: () => void;
  onClear: () => void;
}

export function BulkActionsBar({ count, loading, onActivate, onPause, onDuplicate, onAdjustBudget, onClear }: Props) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary/90 border border-primary/30 shadow-2xl backdrop-blur">
      <span className="text-xs text-foreground/90 px-2">
        {loading && <Loader2 className="inline h-3 w-3 mr-1.5 animate-spin" />}
        <strong className="text-primary tabular-nums">{count}</strong> selecionada{count > 1 ? "s" : ""}
      </span>
      <span className="h-4 w-px bg-border/50" />
      <Button size="sm" variant="ghost" disabled={loading} onClick={onActivate} className="h-7 text-xs gap-1.5 hover:text-emerald-300">
        <Play className="h-3 w-3" /> Ativar
      </Button>
      <Button size="sm" variant="ghost" disabled={loading} onClick={onPause} className="h-7 text-xs gap-1.5 hover:text-amber-300">
        <Pause className="h-3 w-3" /> Pausar
      </Button>
      <Button size="sm" variant="ghost" disabled={loading} onClick={onAdjustBudget} className="h-7 text-xs gap-1.5 hover:text-primary">
        <DollarSign className="h-3 w-3" /> Orçamento
      </Button>
      <Button size="sm" variant="ghost" disabled={loading} onClick={onDuplicate} className="h-7 text-xs gap-1.5 hover:text-primary">
        <Copy className="h-3 w-3" /> Duplicar
      </Button>
      <span className="h-4 w-px bg-border/50" />
      <Button size="icon" variant="ghost" disabled={loading} onClick={onClear} className="h-7 w-7">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
