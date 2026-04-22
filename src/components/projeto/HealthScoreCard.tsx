import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, TrendingUp, Activity, FileText, Target } from "lucide-react";
import { HealthBreakdown } from "@/lib/healthScore";

interface Props {
  health: HealthBreakdown;
}

export function HealthScoreCard({ health }: Props) {
  const ringColor = health.score >= 80 ? "stroke-emerald-400"
    : health.score >= 60 ? "stroke-emerald-400"
    : health.score >= 40 ? "stroke-amber-400"
    : "stroke-red-400";

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (health.score / 100) * circumference;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" /> Health Score do Projeto
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Donut */}
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" className="fill-none stroke-muted" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="36"
                className={`fill-none ${ringColor} transition-all`}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-2xl font-bold ${health.cor}`}>{health.score}</div>
              <div className="text-[9px] text-muted-foreground uppercase">de 100</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="flex-1 min-w-[200px] space-y-2">
            <div className={`text-xs font-semibold ${health.cor}`}>{health.statusLabel}</div>
            <Breakdown icon={<TrendingUp className="h-3 w-3" />} label="ROAS" value={health.roasScore} />
            <Breakdown icon={<Target className="h-3 w-3" />} label={`Conversão (${health.conversao.toFixed(1)}%)`} value={health.conversaoScore} />
            <Breakdown icon={<Activity className="h-3 w-3" />} label="Atividade 7d" value={health.atividadeScore} />
            <Breakdown icon={<FileText className="h-3 w-3" />} label="Conteúdo 14d" value={health.conteudoScore} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Breakdown({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground truncate">{label}</span>
          <span className="text-foreground font-medium">{Math.round(value)}</span>
        </div>
        <Progress value={value} className="h-1" />
      </div>
    </div>
  );
}
