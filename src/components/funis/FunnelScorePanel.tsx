import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Dimension {
  id: string;
  label: string;
  nota: number;
  diagnostico: string;
  sugestao: string;
}

interface ScoreResult {
  score_global?: number;
  dimensoes?: Dimension[];
  top_oportunidades?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  product: any;
  existingAssets: Array<{ catId: string; itemId: string; status?: string }>;
}

export function FunnelScorePanel({ open, onClose, projectId, product, existingAssets }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-score", {
        body: { project_id: projectId, product, existing_assets: existingAssets },
      });
      if (error) throw error;
      setResult((data as any)?.score || {});
    } catch (e: any) {
      toast.error(e?.message || "Erro ao calcular score");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const notaColor = (n: number) =>
    n >= 8 ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/40" :
    n >= 5 ? "text-amber-300 bg-amber-500/15 border-amber-500/40" :
             "text-red-300 bg-red-500/15 border-red-500/40";

  const globalColor =
    !result?.score_global ? "text-muted-foreground" :
    result.score_global >= 70 ? "text-emerald-300" :
    result.score_global >= 40 ? "text-amber-300" : "text-red-300";

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-[#0a0608] border-l border-border/60 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-sky-400" />
          <h3 className="font-display text-sm text-foreground/90">Score do Funil</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!result && !loading && (
          <div className="text-center py-8 space-y-3">
            <p className="text-xs text-muted-foreground leading-5">
              Avalia 10 dimensões do funil (copy, estrutura, CTAs, confiança, urgência, prova social, oferta, bumps, recovery, mobile) e devolve nota + sugestão.
            </p>
            <Button onClick={run} size="sm" className="bg-sky-600 hover:bg-sky-500">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Calcular score
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            <p className="text-xs text-muted-foreground">Avaliando funil...</p>
          </div>
        )}

        {result && !loading && (
          <>
            {typeof result.score_global === "number" && (
              <div className="rounded-2xl border border-border/40 bg-secondary/30 p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score Global</p>
                <p className={cn("text-5xl font-display font-bold mt-1", globalColor)}>
                  {result.score_global}
                  <span className="text-xl text-muted-foreground">/100</span>
                </p>
              </div>
            )}

            {result.top_oportunidades && result.top_oportunidades.length > 0 && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Top oportunidades</p>
                <ul className="space-y-1.5">
                  {result.top_oportunidades.map((op, i) => (
                    <li key={i} className="text-xs text-foreground/90 leading-5 flex gap-2">
                      <span className="text-emerald-400 font-bold">→</span>
                      <span>{op}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.dimensoes && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dimensões</p>
                {result.dimensoes.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border/40 bg-secondary/20 p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{d.label}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold flex-shrink-0", notaColor(d.nota))}>
                        {d.nota}/10
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-4">{d.diagnostico}</p>
                    {d.sugestao && (
                      <p className="text-[10px] text-sky-300/90 leading-4">💡 {d.sugestao}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button size="sm" variant="outline" className="w-full" onClick={run}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Recalcular
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
