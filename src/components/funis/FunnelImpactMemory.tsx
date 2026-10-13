import { useState, useEffect, useMemo, useCallback } from "react";
import {
  History,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FunnelLive, StageId } from "@shared/funnel-live";
import type { ActionType } from "@shared/funnel-diagnostics";
import {
  createInterventionSnapshot,
  evaluateInterventionImpact,
  type FunnelInterventionSnapshot,
} from "@shared/funnel-sentinel";

const STORAGE_PREFIX = "imphq_funnel_interventions_";

export function recordFunnelIntervention(
  funnel: FunnelLive,
  params: {
    projectId: string;
    title: string;
    stageId: StageId;
    actionType: ActionType;
  }
): FunnelInterventionSnapshot {
  const snap = createInterventionSnapshot(funnel, params);
  if (typeof window !== "undefined") {
    const key = `${STORAGE_PREFIX}${params.projectId || "global"}`;
    try {
      const existingRaw = localStorage.getItem(key);
      const list: FunnelInterventionSnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
      const next = [snap, ...list].slice(0, 15);
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("imphq-intervention-recorded", { detail: snap }));
    } catch {
      // Ignore storage quota errors
    }
  }
  return snap;
}

interface FunnelImpactMemoryProps {
  funnel: FunnelLive;
  projectId?: string | null;
  projectName?: string;
  className?: string;
}

export function FunnelImpactMemory({
  funnel,
  projectId,
  projectName = "Projeto",
  className,
}: FunnelImpactMemoryProps) {
  const storageKey = `${STORAGE_PREFIX}${projectId || "global"}`;
  const [snapshots, setSnapshots] = useState<FunnelInterventionSnapshot[]>([]);
  const [adding, setAdding] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedStage, setSelectedStage] = useState<StageId>(() => funnel.gargalo ?? "pagina");

  const loadSnapshots = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      setSnapshots(raw ? JSON.parse(raw) : []);
    } catch {
      setSnapshots([]);
    }
  }, [storageKey]);

  useEffect(() => {
    loadSnapshots();
    const handler = () => loadSnapshots();
    if (typeof window !== "undefined") {
      window.addEventListener("imphq-intervention-recorded", handler);
      return () => window.removeEventListener("imphq-intervention-recorded", handler);
    }
  }, [loadSnapshots]);

  const attributions = useMemo(() => {
    return snapshots.map((s) => evaluateInterventionImpact(s, funnel));
  }, [snapshots, funnel]);

  const handleSaveMilestone = () => {
    const stageActionMap: Record<StageId, ActionType> = {
      anuncio: "creatives",
      pagina: "pagespeed",
      checkout: "copy_vsl",
      venda: "checkout_friction",
      extra: "bumps",
      recuperacao: "recovery_wa",
    };
    const title =
      customTitle.trim() ||
      `Intervenção na etapa ${funnel.etapas.find((e) => e.id === selectedStage)?.label || selectedStage}`;

    recordFunnelIntervention(funnel, {
      projectId: projectId || "global",
      title,
      stageId: selectedStage,
      actionType: stageActionMap[selectedStage],
    });
    setCustomTitle("");
    setAdding(false);
    toast.success("Marco de intervenção salvo! O sistema comparará o Antes vs. Depois automaticamente.");
  };

  const handleDelete = (id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  return (
    <Card className={cn("border border-border/70 bg-card/70 shadow-xs", className)}>
      <CardHeader className="p-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <History className="h-3.5 w-3.5" />
            </span>
            <CardTitle className="text-xs sm:text-sm font-semibold text-foreground">
              Memória de Impacto · Antes vs. Depois das Intervenções
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">
              {attributions.length} {attributions.length === 1 ? "marco registrado" : "marcos registrados"}
            </Badge>
          </div>

          {!adding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" /> Registrar Marco Atual
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-3.5 pb-3.5 pt-0 space-y-2.5 text-xs">
        {adding && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`Ex.: Subi Ganchos P1–P5 ou Otimizei PageSpeed (${projectName})`}
                className="h-8 text-xs flex-1"
              />
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as StageId)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                aria-label="Etapa alvo da intervenção"
              >
                {funnel.etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    Etapa: {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Salva a foto exata das taxas atuais para medir o ganho nos próximos dias.
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveMilestone}>
                  Salvar Snapshot
                </Button>
              </div>
            </div>
          </div>
        )}

        {attributions.length === 0 && !adding ? (
          <div className="rounded-md border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              Registre um marco antes de alterar criativos, página ou checkout para rastrear o ganho real (Antes vs. Depois).
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {attributions.map((item) => {
              const dateStr = new Date(item.snapshot.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              });

              return (
                <div
                  key={item.snapshot.id}
                  className="rounded-lg border border-border/70 bg-background/50 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground">{dateStr}</span>
                      <span className="font-semibold text-foreground">{item.snapshot.title}</span>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase px-1.5 py-0">
                        {item.snapshot.stageId}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {item.summaryText} · Score: {item.snapshot.baseline.score} ➔ {item.currentScore}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono flex items-center gap-1",
                        item.verdict === "positivo"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : item.verdict === "negativo"
                          ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {item.verdict === "positivo" ? (
                        <>
                          <TrendingUp className="h-3 w-3" /> Ganho Real
                        </>
                      ) : item.verdict === "negativo" ? (
                        <>
                          <TrendingDown className="h-3 w-3" /> Regressão
                        </>
                      ) : (
                        <>
                          <Minus className="h-3 w-3" /> Em Maturação
                        </>
                      )}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.snapshot.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                      title="Remover marco"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
