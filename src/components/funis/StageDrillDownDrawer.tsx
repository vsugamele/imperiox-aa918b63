import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  FlaskConical,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Radar,
  CreditCard,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunnelLive, PageRow, StageId } from "@shared/funnel-live";
import { runFunnelDiagnostics, type FunnelDiagnosticItem } from "@shared/funnel-diagnostics";

interface StageDrillDownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: StageId | null;
  funnel: FunnelLive;
  pages?: PageRow[];
  projectId?: string | null;
  projectName?: string;
  onOpenRemediation?: (item: FunnelDiagnosticItem) => void;
  onLaunchAbTest?: (preset: { nome: string; controlUrl: string; challengerUrl: string }) => void;
  onNavigateTab?: (tab: string) => void;
}

const STAGE_TAB_MAP: Record<StageId, { tab: string; label: string }> = {
  anuncio: { tab: "midia", label: "Abrir Aba Mídia & Criativos" },
  pagina: { tab: "sites", label: "Abrir Aba Sites & Landing Pages" },
  checkout: { tab: "identidade", label: "Abrir Setup, Pixels & Checkout" },
  venda: { tab: "financas", label: "Abrir Aba Finanças & Vendas" },
  extra: { tab: "ecossistema", label: "Abrir Ecossistema & Bumps" },
  recuperacao: { tab: "comando", label: "Abrir Comando & Recuperação" },
};

function fmtBRL(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(val);
}

export function StageDrillDownDrawer({
  open,
  onOpenChange,
  stageId,
  funnel,
  pages = [],
  projectName = "Projeto",
  onOpenRemediation,
  onLaunchAbTest,
  onNavigateTab,
}: StageDrillDownDrawerProps) {
  if (!stageId) return null;

  const stage = funnel.etapas.find((e) => e.id === stageId);
  if (!stage) return null;

  const diagReport = runFunnelDiagnostics(funnel);
  const stageDiagnostics = diagReport.diagnostics.filter((d) =>
    d.stagePair.includes(stageId)
  );

  const conv = stage.conversao;
  const tabTarget = STAGE_TAB_MAP[stageId];

  const handleOpenDefaultPlaybook = () => {
    if (!onOpenRemediation) return;
    if (stageDiagnostics.length > 0) {
      onOpenRemediation(stageDiagnostics[0]);
      onOpenChange(false);
      return;
    }
    const defaultTypeMap = {
      anuncio: "creatives",
      pagina: "pagespeed",
      checkout: "copy_vsl",
      venda: "checkout_friction",
      extra: "bumps",
      recuperacao: "recovery_wa",
    } as const;

    onOpenRemediation({
      id: `drilldown-${stageId}`,
      severity: stage.status === "gargalo" ? "critico" : "alerta",
      stagePair: [stageId],
      title: `Otimização da Etapa: ${stage.label}`,
      badge: stage.label,
      metricComparison: conv
        ? `${conv.value ?? 0}% vs ${conv.referencia}% ref.`
        : "Inspeção direta",
      rootCause: stage.nota || "Análise detalhada acionada pela gaveta de inspeção da etapa.",
      recommendation: `Aplicar playbook tático da etapa ${stage.label}.`,
      action: {
        type: defaultTypeMap[stageId],
        label: `Playbook ${stage.label}`,
        hint: "",
      },
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto space-y-5">
        <SheetHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] uppercase",
                stage.status === "ok"
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : stage.status === "gargalo"
                  ? "border-rose-500/40 text-rose-400 bg-rose-500/15"
                  : "border-amber-500/40 text-amber-400 bg-amber-500/10"
              )}
            >
              {stage.status === "ok"
                ? "Etapa Saudável"
                : stage.status === "gargalo"
                ? "Gargalo Ativo"
                : stage.status === "atencao"
                ? "Em Atenção"
                : "Medição / Sem Dado"}
            </Badge>

            {funnel.archetypeLabel && (
              <span className="text-[10px] font-mono text-muted-foreground">
                Régua: {funnel.archetypeLabel}
              </span>
            )}
          </div>

          <SheetTitle className="text-base font-bold text-foreground">
            Raio-X da Etapa · {stage.label}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Inspeção granular de métricas, páginas, atrito de pagamento e alavancas de execução para {projectName}.
          </SheetDescription>
        </SheetHeader>

        {/* Bloco 1: Conversão da Etapa vs Benchmark + Tendência Temporal */}
        {conv && (
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{conv.label}</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-base font-bold text-foreground">
                  {conv.value !== null ? `${conv.value}%` : "—"}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  / ref. {conv.referencia}%
                </span>
                {conv.deltaPp !== null && conv.deltaPp !== undefined && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0 flex items-center gap-0.5",
                      conv.deltaPp > 0
                        ? "border-emerald-500/40 text-emerald-400"
                        : conv.deltaPp < 0
                        ? "border-rose-500/40 text-rose-400"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {conv.deltaPp > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : conv.deltaPp < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {conv.deltaPp > 0 ? `+${conv.deltaPp}` : conv.deltaPp} pp vs. período ant.
                  </Badge>
                )}
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  conv.value === null
                    ? "w-0"
                    : conv.value >= conv.referencia
                    ? "bg-emerald-500"
                    : conv.value >= conv.referencia * 0.5
                    ? "bg-amber-500"
                    : "bg-rose-500"
                )}
                style={{
                  width: `${Math.min(
                    100,
                    conv.value !== null && conv.referencia > 0
                      ? Math.round((conv.value / conv.referencia) * 100)
                      : 0
                  )}%`,
                }}
              />
            </div>

            {stage.nota && (
              <p className="text-[11px] text-amber-400 pt-1">{stage.nota}</p>
            )}
          </div>
        )}

        {/* Bloco 2: Métricas da Etapa */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Métricas Medidas na Etapa
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {stage.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border/70 bg-card/60 p-2.5"
              >
                <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                  {m.label}
                </span>
                <span className="text-sm font-mono font-bold text-foreground mt-0.5 block">
                  {m.value === null
                    ? "—"
                    : m.fmt === "brl"
                    ? fmtBRL(m.value)
                    : m.fmt === "pct"
                    ? `${m.value}%`
                    : m.value.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 3: Drill-down específico por tipo de etapa */}
        {stageId === "pagina" && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5 text-primary" /> URLs Rastreadas nesta Etapa
            </h4>
            {pages.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
                Nenhuma URL com sessões medidas neste período. Verifique se o script de tracking está ativo na Landing Page.
              </p>
            ) : (
              <div className="space-y-2">
                {pages.slice(0, 6).map((p) => {
                  const sess = Number(p.values.sessoes_pagina ?? 0);
                  const ctas = Number(p.values.cliques_cta ?? 0);
                  const ctaRate = sess > 0 ? ((ctas / sess) * 100).toFixed(1) : "0.0";
                  return (
                    <div
                      key={p.url}
                      className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] truncate text-foreground">
                          {p.url}
                        </span>
                        {onLaunchAbTest && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 shrink-0"
                            onClick={() => {
                              onLaunchAbTest({
                                nome: `Split A/B · ${p.url.replace(/^https?:\/\//, "").slice(0, 24)}`,
                                controlUrl: p.url,
                                challengerUrl: `${p.url}${p.url.includes("?") ? "&" : "?"}v=b`,
                              });
                              onOpenChange(false);
                            }}
                          >
                            <FlaskConical className="h-3 w-3 mr-1" /> Testar A/B
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>{sess} visitas</span>
                        <span>·</span>
                        <span>{ctas} cliques CTA</span>
                        <span>·</span>
                        <span className="text-primary">{ctaRate}% engajamento</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(stageId === "checkout" || stageId === "venda") && funnel.cx && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> Raio-X de Pagamento & CX
            </h4>
            <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos Aprovados:</span>
                <strong className="font-mono text-emerald-400">{funnel.cx.aprovadasCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cartões Recusados (Antifraude/Saldo):</span>
                <strong className="font-mono text-amber-400">{funnel.cx.recusadasCartaoCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PIX / Boletos Pendentes:</span>
                <strong className="font-mono text-foreground">{funnel.cx.pendentesCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reembolsos / Chargebacks:</span>
                <strong className="font-mono text-rose-400">
                  {funnel.cx.reembolsadasCount} ({funnel.cx.taxaReembolsoPct}%)
                </strong>
              </div>
              <div className="pt-2 border-t border-border/60 flex justify-between">
                <span className="font-semibold text-foreground">Potencial Cartão ➔ PIX:</span>
                <strong className="font-mono text-emerald-400">
                  {fmtBRL(funnel.cx.valorRecusadoRecuperavel)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Bloco 4: Diagnósticos Cruzados vinculados a esta etapa */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Diagnóstico desta Etapa
          </h4>
          {stageDiagnostics.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Nenhum vazamento crítico detectado nesta etapa no momento.</span>
            </div>
          ) : (
            stageDiagnostics.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>{d.title}</span>
                </div>
                <p className="text-muted-foreground text-[11px]">{d.rootCause}</p>
                <p className="text-primary text-[11px] font-medium">🎯 {d.recommendation}</p>
              </div>
            ))
          )}
        </div>

        {/* Rodapé de Ações Rápidas sem sair do Funil */}
        <div className="pt-3 border-t border-border flex flex-col gap-2">
          <Button
            size="sm"
            onClick={handleOpenDefaultPlaybook}
            className="w-full gap-1.5 font-semibold"
          >
            {stageId === "anuncio" ? (
              <>
                <Megaphone className="h-3.5 w-3.5" /> Abrir Gerador de Ganchos P1–P5 & Playbook
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" /> Abrir Playbook de Correção & Despacho Kanban
              </>
            )}
          </Button>

          {onNavigateTab && tabTarget && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onNavigateTab(tabTarget.tab);
                onOpenChange(false);
              }}
              className="w-full gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {tabTarget.label}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
