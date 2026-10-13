import { useState, useMemo } from "react";
import {
  TrendingUp,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  KanbanSquare,
  Loader2,
  Rocket,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-message";
import type { FunnelLive } from "@shared/funnel-live";
import { calculateSafeScaleProtocol } from "@shared/funnel-sentinel";

interface FunnelSafeScalePanelProps {
  funnel: FunnelLive;
  days?: number;
  projectId?: string | null;
  projectName?: string;
  className?: string;
}

function fmtBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
}

export function FunnelSafeScalePanel({
  funnel,
  days = 7,
  projectId,
  projectName = "Projeto",
  className,
}: FunnelSafeScalePanelProps) {
  const protocol = useMemo(() => calculateSafeScaleProtocol(funnel, days), [funnel, days]);
  const [expanded, setExpanded] = useState<boolean>(() => protocol.isScaleReady);
  const [copied, setCopied] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  const handleCopyProtocol = () => {
    const text = [
      `🚀 [PROTOCOLO DE ESCALA SEGURA - ${projectName}]`,
      `Status: ${protocol.isScaleReady ? "JANELA DE ESCALA ATIVA" : "TRAVA DE SEGURANÇA ATIVA"}`,
      `Score de Fluidez: ${protocol.fluencyScore}/100`,
      `Orçamento Diário Atual: ${fmtBRL(protocol.currentDailySpend)} ➔ Recomendado: ${fmtBRL(protocol.recommendedDailySpend)} (+${protocol.budgetIncreasePct}%)`,
      `Faturamento Diário Projetado: ${fmtBRL(protocol.projectedDailyRevenue)}/dia`,
      `Teto de CPA (Circuit Breaker): R$ ${protocol.cpaCeilingBreaker.toFixed(2)}`,
      `Divisão: ${protocol.verticalVsHorizontalSplit.guidance}`,
      "",
      "Passos de Execução:",
      ...protocol.steps,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Protocolo de escala copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDispatchScaleTask = async () => {
    setDispatching(true);
    try {
      let firstColId: string | null = null;
      const { data: cols } = await supabase
        .from("imphq_kanban_columns")
        .select("id")
        .in("board", ["operacional", "campanhas", "geral"])
        .order("position", { ascending: true })
        .limit(1);
      if (cols && cols.length > 0) {
        firstColId = cols[0].id;
      }

      const { error } = await supabase.from("imphq_kanban_cards").insert({
        title: `[ESCALA +${protocol.budgetIncreasePct}%] Subir verba diária de ${projectName} para ${fmtBRL(protocol.recommendedDailySpend)}`,
        description: [
          `🎯 **Projeto:** ${projectName}`,
          `📈 **Aumento Seguro Recomendado:** +${protocol.budgetIncreasePct}% (${fmtBRL(protocol.currentDailySpend)}/dia ➔ ${fmtBRL(protocol.recommendedDailySpend)}/dia)`,
          `🛡️ **Circuit Breaker (Teto CPA):** R$ ${protocol.cpaCeilingBreaker.toFixed(2)}`,
          `🧭 **Alocação:** ${protocol.verticalVsHorizontalSplit.guidance}`,
          "",
          "### Checklist de Escala:",
          ...protocol.steps.map((s) => `[ ] ${s}`),
        ].join("\n"),
        priority: "high",
        project_id: projectId ?? null,
        board: "operacional",
        column_id: firstColId,
        ai_generated: true,
        tags: [projectId || "geral", "escala-segura", "protocolo-verde"],
      });

      if (error) throw error;
      setDispatched(true);
      toast.success("Tarefa de escala enviada para o Kanban da equipe!");
    } catch (err) {
      toast.error("Erro ao despachar para o Kanban: " + errorMessage(err));
    } finally {
      setDispatching(false);
    }
  };

  if (!protocol.isScaleReady) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/70 bg-card/50 px-3.5 py-2.5 text-xs transition-all",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-foreground">Motor de Escala Segura:</span>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-300">
              Trava Preventiva Ativa
            </Badge>
            <span className="hidden md:inline text-[11px] text-muted-foreground">
              · {protocol.blockReason}
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Ocultar critérios <ChevronUp className="h-3 w-3 ml-1" />
              </>
            ) : (
              <>
                Ver protocolo de destrave <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 pt-2.5 border-t border-border/50 grid gap-3 sm:grid-cols-3 text-[11px]">
            <div className="space-y-1 sm:col-span-2">
              <div className="font-semibold text-foreground">Por que não escalar verba agora:</div>
              <p className="text-muted-foreground">{protocol.blockReason}</p>
              <ul className="space-y-1 pt-1 text-muted-foreground">
                {protocol.steps.map((s, idx) => (
                  <li key={idx} className="font-mono text-[10px]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border/60 bg-background/50 p-2.5 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Teto de Segurança (Circuit Breaker)
              </span>
              <span className="text-sm font-mono font-bold text-amber-400 block">
                CPA Máx: R$ {protocol.cpaCeilingBreaker.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Orçamento atual mantido em {fmtBRL(protocol.currentDailySpend)}/dia até o Score atingir ≥ 75.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "border-emerald-500/40 bg-gradient-to-r from-emerald-950/25 via-card to-card shadow-sm overflow-hidden",
        className
      )}
    >
      <CardHeader className="p-3.5 pb-2.5 border-b border-emerald-500/20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
              <Rocket className="h-3.5 w-3.5" />
            </span>
            <CardTitle className="text-sm font-semibold text-foreground">
              Motor de Escala Segura · Protocolo de Funil Verde
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            >
              {protocol.scaleTier === "agressivo_controlado"
                ? `Escala Acelerada (+${protocol.budgetIncreasePct}%)`
                : `Escala Segura (+${protocol.budgetIncreasePct}%)`}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyProtocol}
              className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copiar Protocolo
            </Button>

            <Button
              size="sm"
              disabled={dispatching || dispatched}
              onClick={handleDispatchScaleTask}
              className="h-7 text-xs gap-1 bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
            >
              {dispatching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : dispatched ? (
                <Check className="h-3 w-3" />
              ) : (
                <KanbanSquare className="h-3 w-3" />
              )}
              {dispatched ? "No Kanban ✓" : "Despachar Escala"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground block">
              Verba Diária (48h)
            </span>
            <div className="font-mono font-bold text-sm text-foreground mt-0.5">
              {fmtBRL(protocol.currentDailySpend)} ➔{" "}
              <span className="text-emerald-400">{fmtBRL(protocol.recommendedDailySpend)}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">
              +{protocol.budgetIncreasePct}% sem resetar aprendizado
            </span>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground block">
              Fat. Diário Projetado
            </span>
            <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
              {fmtBRL(protocol.projectedDailyRevenue)}/dia
            </div>
            <span className="text-[10px] text-muted-foreground">
              Projeção 30d: {fmtBRL(protocol.projectedDailyRevenue * 30)}
            </span>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground block">
              ROAS Pós-Elasticidade
            </span>
            <div className="font-mono font-bold text-sm text-foreground mt-0.5">
              {protocol.currentRoas}x ➔{" "}
              <span className="text-primary">{protocol.projectedRoasAfterElasticity}x</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Margem absorve compressão natural
            </span>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground block">
              Circuit Breaker (CPA Máx)
            </span>
            <div className="font-mono font-bold text-sm text-amber-400 mt-0.5">
              R$ {protocol.cpaCeilingBreaker.toFixed(2)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Trava automática de proteção de lucro
            </span>
          </div>
        </div>

        {/* Divisão Vertical vs Horizontal e Passos */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Distribuição Recomendada: {protocol.verticalVsHorizontalSplit.verticalPct}% Escala Vertical ·{" "}
              {protocol.verticalVsHorizontalSplit.horizontalPct}% Escala Horizontal
            </span>
            <span className="text-muted-foreground text-[11px]">
              {protocol.verticalVsHorizontalSplit.guidance}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${protocol.verticalVsHorizontalSplit.verticalPct}%` }}
            />
            <div
              className="bg-sky-500 h-full transition-all"
              style={{ width: `${protocol.verticalVsHorizontalSplit.horizontalPct}%` }}
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-3 pt-1">
            {protocol.steps.map((step, i) => (
              <div
                key={i}
                className="rounded border border-border/50 bg-card/60 p-2 text-[11px] text-muted-foreground"
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
