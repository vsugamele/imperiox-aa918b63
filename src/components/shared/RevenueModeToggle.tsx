import { useRevenueMode } from "@/lib/revenueMode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Scissors, Info } from "lucide-react";

interface Props {
  className?: string;
}

/**
 * Alterna globalmente entre receita Bruta (faturamento total) e Líquida
 * (sua parte real após divisão com expert / co-produtor / taxas).
 * Persiste em localStorage e propaga para todos os componentes via event bus.
 */
export function RevenueModeToggle({ className = "" }: Props) {
  const [mode, setMode] = useRevenueMode();
  const isLiquid = mode === "liquido";

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-md border border-border bg-secondary/30 ${className}`}
      >
        <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
        <Label htmlFor="revenue-mode-toggle" className="text-xs cursor-pointer select-none">
          Sua parte (líquido)
        </Label>
        <Switch
          id="revenue-mode-toggle"
          checked={isLiquid}
          onCheckedChange={(v) => setMode(v ? "liquido" : "bruto")}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
            Quando ligado, todos os números de receita, ROAS e CPA usam a sua{" "}
            <strong>comissão de produtor</strong> (descontando expert, taxas e plataforma).
            Quando desligado, mostra o faturamento bruto da transação.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
