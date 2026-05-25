import { Card, CardContent } from "@/components/ui/card";

interface Props { score: number; label: string; nextAction?: string; }

function color(score: number) {
  if (score >= 75) return { ring: "stroke-emerald-500", text: "text-emerald-400" };
  if (score >= 45) return { ring: "stroke-amber-500", text: "text-amber-400" };
  return { ring: "stroke-red-500", text: "text-red-400" };
}

export function HealthCard({ score, label, nextAction }: Props) {
  const c = color(score);
  const dash = 2 * Math.PI * 28;
  return (
    <Card className="bg-secondary/30">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
            <circle cx="32" cy="32" r="28" className="stroke-border" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r="28" className={c.ring} strokeWidth="6" fill="none"
              strokeDasharray={dash} strokeDashoffset={dash * (1 - score / 100)} strokeLinecap="round" />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center font-display text-xl ${c.text}`}>{score}</div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          {nextAction && <p className="text-sm leading-6 mt-1">→ {nextAction}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
