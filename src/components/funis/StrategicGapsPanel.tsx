import { GapRule, NodeLite, EdgeLite, analyzeGaps } from "@/components/funis/strategic-gaps";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";








const impactStyle: Record<string, string> = {
  alto: "bg-red-500/10 text-red-400 border-red-500/30",
  medio: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  baixo: "bg-muted text-muted-foreground border-border/40",
};



interface Props {
  nodes: NodeLite[];
  edges?: EdgeLite[];
  onCreateNode: (kind: string, label: string) => void;
}

export function StrategicGapsPanel({ nodes, edges = [], onCreateNode }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const gaps = useMemo(() => analyzeGaps(nodes, edges).filter(g => !dismissed.has(g.id)), [nodes, edges, dismissed]);


  if (gaps.length === 0) {
    return (
      <div className="w-[300px] bg-card/90 backdrop-blur border border-emerald-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-medium text-emerald-400">Ecossistema completo</p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Nenhum gap estratégico detectado neste mapa.</p>
      </div>
    );
  }

  const criticos = gaps.filter(g => g.impact === "alto").length;

  return (
    <div className="w-[320px] bg-card/95 backdrop-blur border border-border/60 rounded-lg overflow-hidden shadow-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold truncate">Gaps estratégicos</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[9px]">{gaps.length}</Badge>
          {criticos > 0 && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-red-500/10 text-red-400 border-red-500/30">
              {criticos} crítico{criticos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="max-h-[420px] overflow-y-auto border-t border-border/40">
          {gaps.map(g => (
            <div key={g.id} className="p-3 border-b border-border/30 last:border-b-0 hover:bg-secondary/20">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-medium leading-4">{g.title}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={`text-[9px] h-4 px-1 ${impactStyle[g.impact]}`}>{g.impact}</Badge>
                  <button
                    onClick={() => setDismissed(s => new Set(s).add(g.id))}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Ignorar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-4 mb-2">{g.desc}</p>
              {g.suggest.kind !== "__orphan__" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 w-full"
                  onClick={() => onCreateNode(g.suggest.kind, g.suggest.label)}
                >
                  <Plus className="h-3 w-3" /> Criar {g.suggest.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
