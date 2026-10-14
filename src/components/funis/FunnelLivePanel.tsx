import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, HelpCircle, MousePointerClick, Radar, ShoppingCart, Sparkles, Target, MessageCircle, Megaphone, TrendingUp, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import {
  FUNNEL_ARCHETYPES,
  inferFunnelArchetype,
  type FunnelArchetypeId,
  type Metric,
  type Stage,
  type StageId,
  type StageStatus,
} from "@shared/funnel-live";
import { useFunnelLive } from "@/hooks/useFunnelLive";
import { PageSplitsSection, type PageSplitPresetDraft } from "@/components/funis/PageSplitsSection";
import { FunnelCrossStageDiagnostics } from "@/components/funis/FunnelCrossStageDiagnostics";
import { FunnelWhatIfSimulator } from "@/components/funis/FunnelWhatIfSimulator";
import { FunnelLeakSentinel } from "@/components/funis/FunnelLeakSentinel";
import { FunnelSafeScalePanel } from "@/components/funis/FunnelSafeScalePanel";
import { FunnelCxRadar } from "@/components/funis/FunnelCxRadar";
import { FunnelImpactMemory } from "@/components/funis/FunnelImpactMemory";
import { StageDrillDownDrawer } from "@/components/funis/StageDrillDownDrawer";
import { FunnelRemediationModal } from "@/components/funis/FunnelRemediationModal";
import { FunnelSankeyFlow } from "@/components/funis/FunnelSankeyFlow";
import { MapNodeVisualPreview } from "@/components/funis/MapNodeVisualPreview";
import type { FunnelDiagnosticItem } from "@shared/funnel-diagnostics";

interface ProjectOption { id: string; name: string; category?: string | null }

const STAGE_ICON: Record<StageId, typeof Megaphone> = { anuncio: Megaphone, pagina: MousePointerClick, checkout: ShoppingCart, venda: Target, extra: Sparkles, recuperacao: MessageCircle };

const STATUS_STYLE: Record<StageStatus, { ring: string; pill: string; label: string }> = {
  ok: { ring: "border-success/40", pill: "border-success/40 bg-success/10 text-success", label: "Saudável" },
  atencao: { ring: "border-warning/50", pill: "border-warning/50 bg-warning/10 text-warning", label: "Atenção" },
  gargalo: { ring: "border-destructive/60", pill: "border-destructive/50 bg-destructive/10 text-destructive", label: "Gargalo" },
  sem_dado: { ring: "border-border border-dashed", pill: "border-border text-muted-foreground", label: "Sem dado" },
  medicao_incompleta: { ring: "border-border border-dashed", pill: "border-warning/40 text-warning", label: "Medição incompleta" },
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function fmt(m: Pick<Metric, "value" | "fmt">): string {
  if (m.value === null) return "—";
  if (m.fmt === "brl") return brl(m.value);
  if (m.fmt === "pct") return `${m.value.toLocaleString("pt-BR")}%`;
  return m.value.toLocaleString("pt-BR");
}

/** Painel ao vivo: o funil do produto em linha, com os números reais de cada etapa e o gargalo destacado. */
export function FunnelLivePanel({ projects, initialProjectId }: { projects: ProjectOption[]; initialProjectId?: string | null }) {
  const [projectId, setProjectId] = useState<string | null>(() => {
    if (initialProjectId) return initialProjectId;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("imphq_last_selected_project");
      if (saved) return saved;
    }
    return null;
  });
  const [produto, setProduto] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [archetype, setArchetype] = useState<FunnelArchetypeId>("low_ticket_vsl");
  const [splitPreset, setSplitPreset] = useState<PageSplitPresetDraft | null>(null);
  const [inspectStageId, setInspectStageId] = useState<StageId | null>(null);
  const [activeRemediation, setActiveRemediation] = useState<FunnelDiagnosticItem | null>(null);

  useEffect(() => {
    if (!projectId && projects.length) {
      const stored = typeof window !== "undefined" ? localStorage.getItem("imphq_last_selected_project") : null;
      const matched = stored ? projects.find((p) => p.id === stored) : null;
      const fallback = projects.find((p) => p.id === "jp_freitas")?.id ?? projects[0].id;
      const chosen = matched ? matched.id : fallback;
      setProjectId(chosen);
      const proj = projects.find((p) => p.id === chosen);
      if (proj) {
        setArchetype(inferFunnelArchetype(proj.category, proj.name));
      }
      if (typeof window !== "undefined" && chosen) {
        localStorage.setItem("imphq_last_selected_project", chosen);
      }
    }
  }, [projects, projectId]);

  const handleSelectProject = (v: string) => {
    setProjectId(v);
    setProduto(null);
    const proj = projects.find((p) => p.id === v);
    if (proj) {
      setArchetype(inferFunnelArchetype(proj.category, proj.name));
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("imphq_last_selected_project", v);
    }
  };

  const { data, isLoading, error } = useFunnelLive({ projectId, produto, days, archetype });
  const currentProjectName = projects.find((p) => p.id === projectId)?.name;
  const activeBenchmark = FUNNEL_ARCHETYPES[data?.archetype ?? archetype] ?? FUNNEL_ARCHETYPES.low_ticket_vsl;

  return (
    <section className="space-y-5" aria-label="Painel ao vivo do funil">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projeto</div>
          <Select value={projectId || ""} onValueChange={handleSelectProject}>
            <SelectTrigger className="h-9 w-56 border-border/80 bg-card/60" aria-label="Projeto"><SelectValue placeholder="Escolha o projeto" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Produto</div>
          <Select value={produto ?? "todos"} onValueChange={(v) => setProduto(v === "todos" ? null : v)}>
            <SelectTrigger className="h-9 w-56 border-border/80 bg-card/60" aria-label="Produto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {(data?.produtos ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Arquétipo (Benchmark)</div>
          <Select value={archetype} onValueChange={(v) => setArchetype(v as FunnelArchetypeId)}>
            <SelectTrigger className="h-9 w-56 border-border/80 bg-card/60" aria-label="Arquétipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(FUNNEL_ARCHETYPES).map((arch) => (
                <SelectItem key={arch.id} value={arch.id}>{arch.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="inline-flex rounded-md border border-border/80 bg-card/60 p-0.5" role="tablist" aria-label="Período">
          {[1, 7, 14, 30].map((d) => (
            <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)}
              className={cn("rounded px-2.5 py-1 text-xs font-medium transition-colors", days === d ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {d === 1 ? "Hoje" : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <PageSkeleton variant="cards" label="Somando o funil" />}
      {error && <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage(error)}</div>}

      {!projectId && !isLoading && (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/40 p-8 text-center sm:p-12 animate-fade-in">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gauge className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Selecione um projeto para ver a telemetria ao vivo
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Acompanhe em tempo real as taxas de conversão de cada nó do funil, telemetria de tráfego, vendas e detecção automática de gargalos operacionais.
          </p>
          {projects.length > 0 ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="w-full text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Selecione um projeto rápido:
              </span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProject(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  <Target className="h-3.5 w-3.5 text-primary" />
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">Nenhum projeto cadastrado no momento.</p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Resultado do período">
            <Kpi label="Gasto" value={data.totais.gasto === null ? "—" : brl(data.totais.gasto)} hint={data.adsDoProjetoInteiro ? "projeto inteiro" : undefined} />
            <Kpi
              label="Faturamento"
              value={brl(data.totais.bruto)}
              delta={data.totais.brutoDeltaPct !== null && data.totais.brutoDeltaPct !== undefined ? `${data.totais.brutoDeltaPct >= 0 ? "+" : ""}${data.totais.brutoDeltaPct}% vs. ant.` : undefined}
              deltaPositive={(data.totais.brutoDeltaPct ?? 0) >= 0}
            />
            <Kpi label="Líquido" value={brl(data.totais.liquido)} />
            <Kpi label="Saldo" value={data.totais.saldo === null ? "—" : brl(data.totais.saldo)} tone={data.totais.saldo === null ? undefined : data.totais.saldo >= 0 ? "good" : "bad"} />
            <Kpi
              label="ROAS"
              value={data.totais.roas === null ? "—" : `${data.totais.roas.toLocaleString("pt-BR")}x`}
              delta={data.totais.roasDelta !== null && data.totais.roasDelta !== undefined ? `${data.totais.roasDelta >= 0 ? "+" : ""}${data.totais.roasDelta}x vs. ant.` : undefined}
              deltaPositive={(data.totais.roasDelta ?? 0) >= 0}
            />
            <Kpi label="CPA" value={data.totais.cpa === null ? "—" : brl(data.totais.cpa)} />
          </div>

          {data.gargalo && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground" role="status">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>Gargalo agora: <strong>{data.etapas.find((e) => e.id === data.gargalo)?.label}</strong>. É a etapa mais abaixo da referência ({data.archetypeLabel}); clique em qualquer etapa para inspecionar em detalhe.</span>
            </motion.div>
          )}

          {/* Diagrama Visual de Fluxo Sankey / Rio de Conversão & Sangria */}
          <FunnelSankeyFlow
            funnel={data}
            onSelectStage={(id) => setInspectStageId(id)}
          />

          <ol className="flex flex-col gap-2 xl:flex-row xl:items-stretch" aria-label="Etapas do funil">
            {data.etapas.map((e, i) => (
              <li key={e.id} className="flex flex-col items-stretch gap-2 xl:flex-1 xl:flex-row xl:items-center">
                {i > 0 && <Connector stage={e} />}
                <StageCard
                  stage={e}
                  index={i}
                  isGargalo={data.gargalo === e.id}
                  stageUrl={e.id === "pagina" ? data.paginas[0]?.url : null}
                  onClick={() => setInspectStageId(e.id)}
                />
              </li>
            ))}
          </ol>

          {/* Sentinela de Vazamento Proativo: monitoramento de desvios, quedas de chegada e surtos de CPA */}
          <FunnelLeakSentinel
            funnel={data}
            projectId={projectId ?? undefined}
            projectName={currentProjectName}
          />

          {/* Radar de CX, Fricção Cartão ➔ PIX, Reembolsos & Blindagem Pós-Compra */}
          <FunnelCxRadar
            funnel={data}
            projectId={projectId}
            projectName={currentProjectName}
          />

          {/* Motor de Escala Segura: protocolo prescritivo de verba quando o funil atinge saúde verde */}
          <FunnelSafeScalePanel
            funnel={data}
            days={days}
            projectId={projectId}
            projectName={currentProjectName}
          />

          {/* Diagnóstico Cruzado Inteligente: vazamentos entre etapas, pagespeed, VSL, checkout e recuperação */}
          <FunnelCrossStageDiagnostics
            funnel={data}
            projectId={projectId}
            controlUrl={data.paginas[0]?.url ?? null}
            onLaunchAbTest={(preset) => setSplitPreset(preset)}
          />

          {/* Memória de Impacto (Antes vs. Depois das Intervenções) */}
          <FunnelImpactMemory
            funnel={data}
            projectId={projectId}
            projectName={currentProjectName}
          />

          {/* Simulador de Alavancagem Financeira What-If: projeção de faturamento ao destravar gargalos */}
          <FunnelWhatIfSimulator
            funnel={data}
            primaryBottleneck={data.gargalo ? {
              id: `bottleneck-${data.gargalo}`,
              stagePair: [data.gargalo],
              severity: "critico",
              title: `Gargalo em ${data.etapas.find((e) => e.id === data.gargalo)?.label}`,
              badge: "Gargalo Ativo",
              metricComparison: "",
              rootCause: "",
              recommendation: "",
              action: { type: "copy_vsl", label: "", hint: "" },
            } : null}
            projectName={currentProjectName}
          />

          {projectId && (
            <PageSplitsSection
              projectId={projectId}
              presetDraft={splitPreset}
              onClearPreset={() => setSplitPreset(null)}
            />
          )}

          {data.paginas.length > 0 && (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Páginas medidas">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Radar className="h-4 w-4" /> Páginas com rastreador</h3>
              <ul className="space-y-1 text-xs">
                {data.paginas.slice(0, 8).map((p) => (
                  <li key={p.url} className="flex justify-between gap-2 font-mono"><span className="truncate text-foreground">{p.url}</span><span className="shrink-0 text-muted-foreground">{p.values.sessoes_pagina} visitas · {p.values.cliques_cta ?? 0} cliques</span></li>
                ))}
              </ul>
            </section>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Referências usadas para apontar o gargalo ({data.archetypeLabel}): CTR {activeBenchmark.ctr}%, chegada na página {activeBenchmark.chegada}%, início de checkout {activeBenchmark.inicio_checkout}%,
            aprovação {activeBenchmark.aprovacao}%, bump/upsell {activeBenchmark.extra}%, recuperação {activeBenchmark.recuperacao}%. Gasto e cliques vêm do Zernio; vendas da plataforma; páginas do rastreador.
          </p>

          <StageDrillDownDrawer
            open={Boolean(inspectStageId)}
            onOpenChange={(open) => {
              if (!open) setInspectStageId(null);
            }}
            stageId={inspectStageId}
            funnel={data}
            projectId={projectId}
            projectName={currentProjectName}
            onOpenRemediation={(item) => setActiveRemediation(item)}
            onLaunchAbTest={(preset) => setSplitPreset(preset)}
          />

          <FunnelRemediationModal
            open={Boolean(activeRemediation)}
            onOpenChange={(open) => {
              if (!open) setActiveRemediation(null);
            }}
            diagnostic={activeRemediation}
            projectName={currentProjectName}
            projectId={projectId}
            controlUrl={data.paginas[0]?.url ?? null}
            onLaunchAbTest={(preset) => setSplitPreset(preset)}
          />
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, hint, tone, delta, deltaPositive }: { label: string; value: string; hint?: string; tone?: "good" | "bad"; delta?: string; deltaPositive?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-1 text-[11px] uppercase text-muted-foreground">
        <span>{label}{hint && <span className="normal-case"> · {hint}</span>}</span>
        {delta && (
          <span className={cn("font-mono text-[10px] font-semibold normal-case", deltaPositive ? "text-emerald-400" : "text-rose-400")}>
            {delta}
          </span>
        )}
      </div>
      <div className={cn("font-mono text-lg font-semibold", tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</div>
    </div>
  );
}

function Connector({ stage }: { stage: Stage }) {
  const c = stage.conversao;
  const style = STATUS_STYLE[stage.status];
  const isProblem = stage.status === "gargalo" || stage.status === "atencao";
  return (
    <div className="flex items-center justify-center gap-1 xl:flex-col" aria-label={c ? `${c.label}: ${c.value === null ? "sem dado" : `${c.value}%`}` : undefined}>
      <ArrowRight className={cn("h-4 w-4 rotate-90 xl:rotate-0 transition-colors", isProblem ? "text-destructive" : "text-muted-foreground")} />
      {c && (
        <span
          className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium shadow-2xs", style.pill)}
          title={`Conversão ${c.label}: ${c.value === null ? "—" : `${c.value}%`} (ref: ${c.referencia}%)`}
        >
          {c.value === null ? "—" : `${c.value.toLocaleString("pt-BR")}%`}
        </span>
      )}
    </div>
  );
}

function StageCard({ stage, index, isGargalo, stageUrl, onClick }: { stage: Stage; index: number; isGargalo: boolean; stageUrl?: string | null; onClick?: () => void }) {
  const Icon = STAGE_ICON[stage.id];
  const style = STATUS_STYLE[stage.status];
  const deltaPp = stage.conversao?.deltaPp ?? null;
  const trend = stage.conversao?.trend;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        "flex-1 space-y-2 rounded-lg border-2 bg-card p-3 transition-colors hover:bg-secondary/20 cursor-pointer",
        isGargalo ? "border-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.15)]" : style.ring
      )}
      aria-label={`Etapa ${stage.label}`}
    >
      <MapNodeVisualPreview
        kind={stage.id}
        label={stage.label}
        url={stageUrl}
        compact
        metricBadge={stage.conversao?.value !== null && stage.conversao?.value !== undefined ? `${stage.conversao.label}: ${stage.conversao.value}%` : null}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {stage.label}</span>
        <span className={cn("rounded-full border px-1.5 py-px text-[10px] uppercase", isGargalo ? STATUS_STYLE.gargalo.pill : style.pill)}>
          {stage.status === "ok" && <CheckCircle2 className="mr-0.5 inline h-3 w-3" />}{isGargalo ? "Gargalo" : style.label}
        </span>
      </div>
      <dl className="space-y-1">
        {stage.metrics.map((m) => (
          <div key={m.label} className="flex justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">{m.label}</dt>
            <dd className="font-mono font-semibold text-foreground">{fmt(m)}</dd>
          </div>
        ))}
      </dl>
      {stage.conversao && (
        <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span>
            {stage.conversao.label}: <span className="font-mono text-foreground">{stage.conversao.value === null ? "—" : `${stage.conversao.value}%`}</span> · ref. {stage.conversao.referencia}%
          </span>
          {deltaPp !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold",
                trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-muted-foreground"
              )}
              title={`Variação vs. período anterior (${stage.conversao.prevValue ?? "—"}%)`}
            >
              {trend === "up" && <TrendingUp className="h-2.5 w-2.5" />}
              {trend === "down" && <TrendingDown className="h-2.5 w-2.5" />}
              {deltaPp >= 0 ? `+${deltaPp}` : deltaPp}pp
            </span>
          )}
        </div>
      )}
      {stage.nota && <p className="text-[11px] text-warning">{stage.nota}</p>}
    </motion.article>
  );
}

