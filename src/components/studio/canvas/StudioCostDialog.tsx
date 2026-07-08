import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Loader2, Play, Coins, Clock } from "lucide-react";

interface Estimate {
  total_credits: number;
  total_seconds: number;
  total_nodes: number;
  cached_nodes: number;
  breakdown: {
    node_id: string; tipo: string; titulo: string; model: string | null;
    credits: number; seconds: number; cached: boolean;
  }[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estimate: Estimate | null;
  loading?: boolean;
  onConfirm: (opts: { forceRerun: boolean }) => void;
}

export function StudioCostDialog({ open, onOpenChange, estimate, loading, onConfirm }: Props) {
  const [force, setForce] = useState(false);
  const seconds = estimate?.total_seconds || 0;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/95 backdrop-blur max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-primary">Confirmar execução</DialogTitle>
        </DialogHeader>

        {!estimate ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Coins className="h-3.5 w-3.5" /> Custo estimado
                </div>
                <div className="font-display text-2xl font-bold text-primary">~{estimate.total_credits}</div>
                <div className="text-[10px] text-muted-foreground">créditos</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" /> Tempo estimado
                </div>
                <div className="font-display text-2xl font-bold">~{min > 0 ? `${min}m ${sec}s` : `${sec}s`}</div>
                <div className="text-[10px] text-muted-foreground">{estimate.total_nodes} nós · {estimate.cached_nodes} em cache</div>
              </div>
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-1 rounded border border-border/60 bg-background/30 p-2">
              {estimate.breakdown.map(b => (
                <div key={b.node_id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-background/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase text-muted-foreground w-14 shrink-0">{b.tipo}</span>
                    <span className="truncate">{b.titulo || b.model || "—"}</span>
                  </div>
                  {b.cached ? (
                    <span className="text-emerald-400 text-[10px] font-mono">CACHE · 0</span>
                  ) : (
                    <span className="text-primary font-mono">{b.credits}</span>
                  )}
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
              Forçar regeneração de tudo (ignorar cache)
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={loading || !estimate} onClick={() => { onConfirm({ forceRerun: force }); onOpenChange(false); }} className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Executar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
