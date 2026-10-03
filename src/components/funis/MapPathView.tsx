// Visão "Caminho" do mapa (Story MAP2.3): o fluxo que leva à venda em linha, com a entrega de cada passo,
// métrica × meta e onde está travado. Alternativas aparecem como ramos do passo de onde saem.
import { useMemo, useState } from "react";
import { ArrowDownRight, ChevronDown, ChevronRight, Crosshair, MapPin, MoreHorizontal, RotateCcw, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildMapPath, metricVerdict, parseMetricRule, pathFocus, type MetricVerdict, type ScaleRefs } from "@shared/map-path";
import { readStageContract } from "@shared/map-contract";
import { elementType, FUNNEL_PHASES, phaseOf } from "@shared/map-elements";
import { METRIC_KEYS } from "@shared/metric-keys";
import type { MapNode } from "@/components/funis/map-node-model";

export type PathRole = "principal" | "alternativa" | null;

interface MapPathViewProps {
  nodes: MapNode[];
  edges: Array<{ source: string; target: string }>;
  /** Valores reais de 7 dias por chave de métrica (null = sem dado). */
  metricValues?: Record<string, number | null> | null;
  /** Parâmetros da esteira de escala do projeto, para metas relativas ("até o CPA alvo"). */
  scaleRefs?: ScaleRefs | null;
  today: string;
  onOpen: (id: string) => void;
  onSetRole: (id: string, role: PathRole) => void;
}

const VERDICT_STYLE: Record<MetricVerdict, { dot: string; label: string }> = {
  verde: { dot: "bg-success", label: "na meta" },
  amarelo: { dot: "bg-warning", label: "perto da meta" },
  vermelho: { dot: "bg-destructive", label: "fora da meta" },
  sem_regua: { dot: "bg-muted-foreground/40", label: "meta sem número" },
  sem_dado: { dot: "bg-muted-foreground/40", label: "sem dado" },
};

const PHASE_LABEL = Object.fromEntries(FUNNEL_PHASES.map((p) => [p.key, p.label]));
const METRIC = new Map(METRIC_KEYS.map((m) => [m.key, m]));

function formatValue(value: number, unidade: string | undefined): string {
  if (unidade === "percentual") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (unidade === "moeda") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function stepMetric(node: MapNode, values: Record<string, number | null> | null | undefined, refs: ScaleRefs | null | undefined) {
  const target = node.metrics_target && typeof node.metrics_target === "object" && !Array.isArray(node.metrics_target)
    ? node.metrics_target as Record<string, unknown> : null;
  const key = typeof target?.key === "string" ? target.key : null;
  if (!key) return null;
  const meta = typeof target?.meta === "string" ? target.meta : null;
  const info = METRIC.get(key);
  const real = values ? values[key] ?? null : null;
  const verdict = metricVerdict(real, parseMetricRule(meta, refs ?? {}));
  return { label: info?.label ?? key, meta, real: real === null ? null : formatValue(real, info?.unidade), verdict, semFonte: info ? !info.disponivel : false };
}

function delivery(node: MapNode): { label: string; text: string } | null {
  const fields = readStageContract({ ...node, checklist: node.checklist }).fields;
  const output = fields.find((f) => f.key === "output")?.value;
  if (output) return { label: "Entrega", text: output };
  const ready = fields.find((f) => f.key === "ready")?.value;
  return ready ? { label: "Pronto quando", text: ready } : null;
}

export function MapPathView({ nodes, edges, metricValues, scaleRefs, today, onOpen, onSetRole }: MapPathViewProps) {
  const [showFora, setShowFora] = useState(false);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const path = useMemo(() => buildMapPath(nodes, edges), [nodes, edges]);
  const focus = useMemo(() => pathFocus(path.principal, nodes, today), [path.principal, nodes, today]);
  const objetivo = path.objetivo ? byId.get(path.objetivo) : null;

  const roleMenu = (node: MapNode, onMain: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Opções de ${node.label}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onOpen(node.id)}><MapPin className="h-3.5 w-3.5 mr-2" /> Ver no mapa</DropdownMenuItem>
        {onMain
          ? <DropdownMenuItem onClick={() => onSetRole(node.id, "alternativa")}><StarOff className="h-3.5 w-3.5 mr-2" /> Tirar do caminho principal</DropdownMenuItem>
          : <DropdownMenuItem onClick={() => onSetRole(node.id, "principal")}><Star className="h-3.5 w-3.5 mr-2" /> Pôr no caminho principal</DropdownMenuItem>}
        {node.path_role && <DropdownMenuItem onClick={() => onSetRole(node.id, null)}><RotateCcw className="h-3.5 w-3.5 mr-2" /> Voltar ao automático</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const branch = (id: string) => {
    const node = byId.get(id);
    if (!node) return null;
    return (
      <div key={id} className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-card/40 px-2.5 py-1.5">
        <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <button type="button" className="min-w-0 flex-1 text-left text-[13px] text-foreground/90 truncate hover:text-primary" onClick={() => onOpen(id)}>{node.label}</button>
        <span className="text-[11px] text-muted-foreground shrink-0">{elementType(node.kind)?.label ?? node.kind}</span>
        {node.path_role === "alternativa" && <span className="text-[11px] text-muted-foreground shrink-0">(manual)</span>}
        {roleMenu(node, false)}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-16">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Caminho principal</h2>
          <p className="text-sm text-muted-foreground">
            {path.principal.length
              ? <>{path.principal.length} passo(s) até <span className="text-foreground">{objetivo?.label ?? "o fim do caminho"}</span>. Calculado pelas setas; ajuste em cada passo.</>
              : "Este mapa ainda não tem compra nem checkout ligados por setas. Ligue as etapas até o checkout ou marque passos como principal."}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {(["verde", "amarelo", "vermelho", "sem_dado"] as MetricVerdict[]).map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", VERDICT_STYLE[v].dot)} />{VERDICT_STYLE[v].label}</span>
            ))}
            <span>· métricas dos últimos 7 dias</span>
          </div>
        </div>

        {focus && byId.get(focus.id) && (
          <button type="button" onClick={() => onOpen(focus.id)}
            className="mb-5 flex w-full items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-left hover:bg-warning/15">
            <Crosshair className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Travado no passo {path.principal.indexOf(focus.id) + 1}: {byId.get(focus.id)!.label}</p>
              <p className="text-xs text-muted-foreground">{focus.motivo}</p>
            </div>
          </button>
        )}

        <ol className="relative">
          {path.principal.map((id, i) => {
            const node = byId.get(id);
            if (!node) return null;
            const metric = stepMetric(node, metricValues, scaleRefs);
            const entrega = delivery(node);
            const isFocus = focus?.id === id;
            const done = node.step_status === "done";
            const alts = path.alternativas.get(id) ?? [];
            return (
              <li key={id} className="relative pl-12 pb-5">
                {i < path.principal.length - 1 && <span className="absolute left-[17px] top-9 bottom-0 w-[3px] rounded bg-primary/40" aria-hidden />}
                <span className={cn("absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  done ? "border-success bg-success/15 text-success" : isFocus ? "border-warning bg-warning/15 text-warning" : "border-primary/60 bg-card text-foreground")}>
                  {i + 1}
                </span>
                <div className={cn("rounded-lg border bg-card p-3", isFocus ? "border-warning/60 ring-1 ring-warning/30" : "border-border")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <button type="button" className="text-left text-[15px] font-medium text-foreground hover:text-primary" onClick={() => onOpen(id)}>{node.label}</button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full bg-secondary px-2 py-0.5">{PHASE_LABEL[phaseOf(node.kind)] ?? "—"}</span>
                        <span>{elementType(node.kind)?.label ?? node.kind}</span>
                        {done && <span className="text-success">feito</span>}
                        {node.path_role === "principal" && <span>(manual)</span>}
                      </div>
                    </div>
                    {roleMenu(node, true)}
                  </div>
                  {entrega && (
                    <p className="mt-2 text-[13px] text-foreground/90 leading-snug"><span className="text-muted-foreground">{entrega.label}: </span>{entrega.text}</p>
                  )}
                  {metric && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-secondary/50 px-2.5 py-1.5 text-[12px]">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", VERDICT_STYLE[metric.verdict].dot)} aria-hidden />
                      <span className="text-foreground">{metric.label}</span>
                      <span className="font-mono text-foreground">{metric.real ?? "—"}</span>
                      {metric.meta && <span className="text-muted-foreground">· meta: {metric.meta}</span>}
                      <span className="text-muted-foreground">· {metric.semFonte ? "sem fonte de dado ainda" : VERDICT_STYLE[metric.verdict].label}</span>
                    </div>
                  )}
                </div>
                {alts.length > 0 && (
                  <div className="mt-2 ml-4 space-y-1.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alternativas a partir daqui</p>
                    {alts.map(branch)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {path.depois.length > 0 && (
          <section className="mt-2">
            <h3 className="mb-2 text-sm font-medium text-foreground">Depois da venda</h3>
            <div className="space-y-1.5">{path.depois.map(branch)}</div>
          </section>
        )}

        {path.fora.length > 0 && (
          <section className="mt-5">
            <button type="button" onClick={() => setShowFora((v) => !v)} className="mb-2 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              {showFora ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Fora do caminho ({path.fora.length})
            </button>
            {showFora && <div className="space-y-1.5">{path.fora.map(branch)}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
