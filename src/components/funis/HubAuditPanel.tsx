import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2, AlertTriangle, Target, Plus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findItem, COLOR_TOKENS } from "./assetCatalog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SuggestedAsset {
  catId: string;
  itemId: string;
  score: number;
  motivo: string;
}

interface AuditResult {
  gargalo?: { etapa: string; diagnostico: string; metrica?: string };
  ativos_faltantes?: SuggestedAsset[];
  proxima_acao?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  product: any;
  existingAssets: Array<{ catId: string; itemId: string; status?: string }>;
  onAddAsset: (catId: string, itemId: string) => void;
}

export function HubAuditPanel({ open, onClose, projectId, product, existingAssets, onAddAsset }: Props) {
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [kpis, setKpis] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hub-auditor", {
        body: { project_id: projectId, product, existing_assets: existingAssets },
      });
      if (error) throw error;
      setAudit((data as any)?.audit || {});
      setKpis((data as any)?.kpis || null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao auditar");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const scoreColor = (s: number) =>
    s >= 80 ? "text-red-300 bg-red-500/15 border-red-500/40" :
    s >= 60 ? "text-amber-300 bg-amber-500/15 border-amber-500/40" :
              "text-sky-300 bg-sky-500/15 border-sky-500/40";

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#0a0608] border-l border-border/60 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-400" />
          <h3 className="font-display text-sm text-foreground/90">Auditor do Funil</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!audit && !loading && (
          <div className="text-center py-8 space-y-3">
            <p className="text-xs text-muted-foreground">
              Imperius analisa vendas, leads, ads e ativos atuais para detectar o gargalo e sugerir o próximo passo.
            </p>
            <Button onClick={run} size="sm" className="bg-pink-600 hover:bg-pink-500">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Rodar auditoria
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-pink-400" />
            <p className="text-xs text-muted-foreground">Analisando funil...</p>
          </div>
        )}

        {audit && !loading && (
          <>
            {kpis && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-2">
                  <p className="text-[9px] uppercase text-muted-foreground">Vendas</p>
                  <p className="text-sm font-semibold text-foreground">{kpis.totalVendas}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-2">
                  <p className="text-[9px] uppercase text-muted-foreground">CPA</p>
                  <p className="text-sm font-semibold text-foreground">R$ {Number(kpis.cpa || 0).toFixed(0)}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-2">
                  <p className="text-[9px] uppercase text-muted-foreground">Ticket</p>
                  <p className="text-sm font-semibold text-foreground">R$ {Number(kpis.ticketMedio || 0).toFixed(0)}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-2">
                  <p className="text-[9px] uppercase text-muted-foreground">CTR médio</p>
                  <p className="text-sm font-semibold text-foreground">{Number(kpis.avgCtr || 0).toFixed(1)}%</p>
                </div>
              </div>
            )}

            {audit.gargalo && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <p className="text-[10px] uppercase tracking-wider text-red-300 font-semibold">
                    Gargalo: {audit.gargalo.etapa}
                  </p>
                </div>
                <p className="text-xs text-foreground/90 leading-5">{audit.gargalo.diagnostico}</p>
                {audit.gargalo.metrica && (
                  <p className="text-[10px] text-muted-foreground">📊 {audit.gargalo.metrica}</p>
                )}
              </div>
            )}

            {audit.proxima_acao && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-emerald-400" />
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                    Próxima ação
                  </p>
                </div>
                <p className="text-xs text-foreground/90 leading-5">{audit.proxima_acao}</p>
              </div>
            )}

            {audit.ativos_faltantes && audit.ativos_faltantes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-pink-400" />
                  <p className="text-[10px] uppercase tracking-wider text-pink-300 font-semibold">
                    Ativos faltantes (priorizados)
                  </p>
                </div>
                {audit.ativos_faltantes
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((s, i) => {
                    const meta = findItem(s.catId, s.itemId);
                    if (!meta) return null;
                    const colors = COLOR_TOKENS[meta.cat.color];
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border bg-secondary/20 p-2.5 space-y-1.5",
                          colors.border
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[9px] uppercase tracking-wider font-semibold", colors.text)}>
                              {meta.cat.label}
                            </p>
                            <p className="text-xs font-semibold text-foreground leading-tight">
                              {meta.item.label}
                            </p>
                          </div>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-bold flex-shrink-0", scoreColor(s.score))}>
                            {s.score}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-4">{s.motivo}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-full text-[10px] gap-1"
                          onClick={() => { onAddAsset(s.catId, s.itemId); toast.success("Adicionado ao canvas"); }}
                        >
                          <Plus className="h-3 w-3" /> Adicionar ao canvas
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}

            <Button size="sm" variant="outline" className="w-full" onClick={run}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Rodar novamente
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
