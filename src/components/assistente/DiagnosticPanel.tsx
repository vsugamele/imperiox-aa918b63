import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Gargalo { titulo: string; desc: string; impacto: "alto" | "medio" | "baixo"; }
interface Props { gargalos: Gargalo[]; }

const impactoStyle: Record<string, string> = {
  alto: "bg-red-500/10 text-red-400 border-red-500/30",
  medio: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  baixo: "bg-muted text-muted-foreground",
};

export function DiagnosticPanel({ gargalos }: Props) {
  if (!gargalos.length) return <p className="text-xs text-muted-foreground">Nenhum gargalo detectado.</p>;
  return (
    <ul className="space-y-3">
      {gargalos.map((g, i) => (
        <li key={i} className="rounded-md border border-border/50 p-3 bg-secondary/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5">{g.titulo}</p>
                <p className="text-xs text-muted-foreground leading-6 mt-0.5">{g.desc}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] ${impactoStyle[g.impacto] || ""}`}>{g.impacto}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
