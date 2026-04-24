import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MetaEntry {
  score?: number;
  evidence_ids?: string[];
  source?: string;
  reason?: string;
}

interface Props {
  meta?: MetaEntry | null;
  size?: "xs" | "sm";
  className?: string;
}

/**
 * Confidence pill driven by `_avatar_meta[campo]`:
 *   🟢 ≥75   🟡 50-74   🔴 <50   ⚪ sem dados
 */
export function ConfidenceBadge({ meta, size = "xs", className }: Props) {
  const score = typeof meta?.score === "number" ? Math.max(0, Math.min(100, meta!.score!)) : null;

  let emoji = "⚪";
  let label = "—";
  let cls = "border-border bg-secondary/40 text-muted-foreground";

  if (score === null) {
    emoji = "⚪";
    label = "sem dados";
  } else if (score >= 75) {
    emoji = "🟢";
    label = `${score}`;
    cls = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  } else if (score >= 50) {
    emoji = "🟡";
    label = `${score}`;
    cls = "border-amber-500/40 bg-amber-500/10 text-amber-300";
  } else {
    emoji = "🔴";
    label = `${score}`;
    cls = "border-red-500/40 bg-red-500/10 text-red-300";
  }

  const evidence = meta?.evidence_ids || [];
  const reason = meta?.reason;
  const source = meta?.source;

  const textSize = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${cls} ${textSize} font-mono gap-1 cursor-help ${className || ""}`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-foreground">
              Confiança: {score === null ? "sem dados" : `${score}/100`}
            </div>
            {source && <div className="text-muted-foreground">Fonte: {source}</div>}
            {reason && <div className="text-muted-foreground">{reason}</div>}
            {evidence.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-0.5">Evidências:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {evidence.slice(0, 6).map((id, i) => (
                    <li key={i} className="font-mono text-[10px] break-all">{id}</li>
                  ))}
                  {evidence.length > 6 && (
                    <li className="text-muted-foreground">+{evidence.length - 6} mais</li>
                  )}
                </ul>
              </div>
            )}
            {!source && !reason && evidence.length === 0 && score !== null && (
              <div className="text-muted-foreground">Sem detalhes adicionais.</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Computes the average confidence across `_avatar_meta` entries.
 * Returns null if no entries with numeric score.
 */
export function computeAvatarHealthScore(avatar: any): { avg: number | null; total: number; filled: number } {
  const meta = avatar?._avatar_meta || {};
  const entries = Object.values(meta) as MetaEntry[];
  const scored = entries.filter(e => typeof e?.score === "number");
  if (scored.length === 0) return { avg: null, total: entries.length, filled: 0 };
  const sum = scored.reduce((s, e) => s + (e.score || 0), 0);
  return { avg: Math.round(sum / scored.length), total: entries.length, filled: scored.length };
}
