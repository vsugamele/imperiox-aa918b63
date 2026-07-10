import { CheckCircle2, CircleDot, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SaveStatus } from "./useAutoSave";

interface Props {
  status: SaveStatus;
  error?: string | null;
  lastSavedAt?: Date | null;
  onRetry?: () => void;
}

function fmt(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SaveIndicator({ status, error, lastSavedAt, onRetry }: Props) {
  const base =
    "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold border transition-colors";

  if (status === "saving") {
    return (
      <div className={`${base} bg-amber-500/10 border-amber-500/30 text-amber-300`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </div>
    );
  }
  if (status === "dirty") {
    return (
      <div className={`${base} bg-rose-500/10 border-rose-500/30 text-rose-300`}>
        <CircleDot className="h-3 w-3" /> Não salvo
      </div>
    );
  }
  if (status === "error") {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-8 px-2.5 bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20 gap-1.5 text-[11px] font-semibold"
            >
              <AlertTriangle className="h-3 w-3" /> Erro — Tentar novamente
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {error || "Falha ao salvar"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <div className={`${base} bg-emerald-500/10 border-emerald-500/30 text-emerald-300`}>
      <CheckCircle2 className="h-3 w-3" />
      Salvo{lastSavedAt ? ` · ${fmt(lastSavedAt)}` : ""}
    </div>
  );
}
