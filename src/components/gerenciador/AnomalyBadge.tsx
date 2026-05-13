import { AlertTriangle } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface Props {
  series: number[]; // série diária (cronológica) de uma métrica
  label?: string;   // ex.: "gasto"
  inverse?: boolean; // se true, queda é alerta (ex: CTR). Default: alta é alerta (ex: CPA)
}

/**
 * Mostra um ⚠️ se o último ponto diverge >2σ da média dos pontos anteriores.
 */
export function AnomalyBadge({ series, label = "métrica", inverse = false }: Props) {
  if (!series || series.length < 4) return null;
  const last = series[series.length - 1];
  const prev = series.slice(0, -1);
  const mean = prev.reduce((s, x) => s + x, 0) / prev.length;
  const variance = prev.reduce((s, x) => s + (x - mean) ** 2, 0) / prev.length;
  const sd = Math.sqrt(variance);
  if (sd === 0 || mean === 0) return null;
  const z = (last - mean) / sd;
  const triggered = inverse ? z < -2 : z > 2;
  if (!triggered) return null;
  const pct = mean ? ((last - mean) / mean) * 100 : 0;

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-amber-400 cursor-help">
          <AlertTriangle className="h-3 w-3" />
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-56 text-xs bg-secondary/95 border-border/40">
        <p className="font-medium">Anomalia detectada</p>
        <p className="text-muted-foreground mt-1">
          Hoje: <span className="tabular-nums text-foreground">{last.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
        </p>
        <p className="text-muted-foreground">
          Média: <span className="tabular-nums text-foreground">{mean.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span> ({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)
        </p>
        <p className="text-muted-foreground mt-1 text-[10px]">σ-score: {z.toFixed(1)} · {label}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
