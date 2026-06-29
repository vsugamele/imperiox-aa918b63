import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake, Sun } from "lucide-react";

type Qualificacao = {
  orcamento?: string;
  urgencia?: number;
  nivel_experiencia?: string;
  temperatura?: "frio" | "morno" | "quente";
  score?: number;
  resumo?: string;
};

export function QualificationBadge({ q, compact }: { q?: Qualificacao | null; compact?: boolean }) {
  if (!q?.temperatura) return null;
  const map: Record<string, { icon: any; color: string; label: string }> = {
    quente: { icon: Flame, color: "border-rose-500/40 text-rose-400 bg-rose-500/10", label: "Quente" },
    morno: { icon: Sun, color: "border-amber-500/40 text-amber-400 bg-amber-500/10", label: "Morno" },
    frio: { icon: Snowflake, color: "border-sky-500/40 text-sky-400 bg-sky-500/10", label: "Frio" },
  };
  const cfg = map[q.temperatura] || map.frio;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} text-[10px] gap-1 px-1.5`} title={q.resumo}>
      <Icon className="h-3 w-3" />
      {compact ? "" : cfg.label}
      {q.score != null && <span className="opacity-70">· {q.score}</span>}
    </Badge>
  );
}
