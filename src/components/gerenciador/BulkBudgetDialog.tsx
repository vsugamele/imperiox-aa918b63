import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export type BulkBudgetMode = "increase_pct" | "decrease_pct" | "set_fixed";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  loading?: boolean;
  onConfirm: (mode: BulkBudgetMode, value: number) => void | Promise<void>;
}

export function BulkBudgetDialog({ open, onOpenChange, count, loading, onConfirm }: Props) {
  const [mode, setMode] = useState<BulkBudgetMode>("increase_pct");
  const [value, setValue] = useState<string>("10");

  const submit = () => {
    const n = Number(value.replace(",", "."));
    if (!n || isNaN(n) || n <= 0) return;
    onConfirm(mode, n);
  };

  const modes: { key: BulkBudgetMode; label: string; icon: any; suffix: string; tone: string }[] = [
    { key: "increase_pct", label: "Aumentar", icon: TrendingUp, suffix: "%", tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" },
    { key: "decrease_pct", label: "Reduzir", icon: TrendingDown, suffix: "%", tone: "text-amber-300 border-amber-400/40 bg-amber-500/10" },
    { key: "set_fixed", label: "Definir", icon: DollarSign, suffix: "R$", tone: "text-primary border-primary/40 bg-primary/10" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 border-border/40 backdrop-blur max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-light tracking-tight">Ajustar orçamento em massa</DialogTitle>
          <DialogDescription className="text-xs leading-7">
            Você está prestes a alterar o orçamento diário de <strong className="text-primary">{count}</strong> campanha{count > 1 ? "s" : ""}. A mudança é aplicada na Meta imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {modes.map(({ key, label, icon: Icon, tone }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-xs transition",
                  mode === key ? tone : "border-border/30 text-muted-foreground hover:bg-secondary/30"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              className="h-10 bg-background/40 border-border/40 tabular-nums text-base"
              autoFocus
            />
            <span className="text-sm text-muted-foreground w-12">{modes.find(m => m.key === mode)?.suffix}</span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-5">
            {mode === "increase_pct" && `Cada orçamento atual será multiplicado por ${(1 + Number(value || 0) / 100).toFixed(2)}.`}
            {mode === "decrease_pct" && `Cada orçamento atual será multiplicado por ${(1 - Number(value || 0) / 100).toFixed(2)}.`}
            {mode === "set_fixed" && `Todas as campanhas selecionadas terão o orçamento diário fixado em R$ ${Number(value || 0).toFixed(2)}.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Aplicar a {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
