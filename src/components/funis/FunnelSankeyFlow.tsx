import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  LifeBuoy,
  Megaphone,
  MousePointerClick,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FunnelLive, Stage, StageId, StageStatus } from "@shared/funnel-live";

interface FunnelSankeyFlowProps {
  funnel: FunnelLive;
  onSelectStage?: (stageId: StageId) => void;
  className?: string;
}

const STAGE_META: Record<
  StageId,
  {
    icon: typeof Megaphone;
    shortTitle: string;
    tempTag: string;
    primaryMetricLabels: string[];
    accentHex: string;
  }
> = {
  anuncio: {
    icon: Megaphone,
    shortTitle: "E1 · Anúncio",
    tempTag: "❄️ Topo",
    primaryMetricLabels: ["Cliques", "Impressões"],
    accentHex: "#38bdf8",
  },
  pagina: {
    icon: MousePointerClick,
    shortTitle: "E2 · Página / VSL",
    tempTag: "☀️ Meio",
    primaryMetricLabels: ["Visitas", "Cliques no botão"],
    accentHex: "#fbbf24",
  },
  checkout: {
    icon: ShoppingCart,
    shortTitle: "E3 · Checkout",
    tempTag: "🔥 Fundo",
    primaryMetricLabels: ["Checkouts iniciados", "Pedidos gerados"],
    accentHex: "#fb923c",
  },
  venda: {
    icon: Target,
    shortTitle: "E4 · Venda Paga",
    tempTag: "💰 Conversão",
    primaryMetricLabels: ["Vendas", "Faturamento"],
    accentHex: "#34d399",
  },
  extra: {
    icon: Sparkles,
    shortTitle: "E5 · Bump / Upsell",
    tempTag: "💎 LTV",
    primaryMetricLabels: ["Extras vendidos", "Receita extra"],
    accentHex: "#c084fc",
  },
  recuperacao: {
    icon: LifeBuoy,
    shortTitle: "E6 · WhatsApp",
    tempTag: "🛟 Recup.",
    primaryMetricLabels: ["Recuperados", "Pedidos com régua"],
    accentHex: "#2dd4bf",
  },
};

const STATUS_COLORS: Record<
  StageStatus,
  { stroke: string; fill: string; badgeCls: string; label: string }
> = {
  ok: {
    stroke: "#10b981",
    fill: "rgba(16, 185, 129, 0.24)",
    badgeCls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    label: "Saudável",
  },
  atencao: {
    stroke: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.24)",
    badgeCls: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    label: "Atenção",
  },
  gargalo: {
    stroke: "#f43f5e",
    fill: "rgba(244, 63, 94, 0.28)",
    badgeCls: "border-rose-500/50 bg-rose-500/20 text-rose-300 animate-pulse",
    label: "Gargalo",
  },
  sem_dado: {
    stroke: "#64748b",
    fill: "rgba(100, 116, 139, 0.16)",
    badgeCls: "border-border bg-secondary/40 text-muted-foreground",
    label: "Sem dado",
  },
  medicao_incompleta: {
    stroke: "#eab308",
    fill: "rgba(234, 179, 8, 0.18)",
    badgeCls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    label: "Falta pixel",
  },
};

function extractVolume(stage: Stage): { count: number; label: string } {
  const meta = STAGE_META[stage.id];
  for (const label of meta.primaryMetricLabels) {
    const found = stage.metrics.find((m) => m.label === label);
    if (found && found.value !== null && found.value > 0) {
      return { count: found.value, label: found.label };
    }
  }
  const firstInt = stage.metrics.find((m) => m.fmt === "int");
  return {
    count: firstInt?.value ?? 0,
    label: firstInt?.label ?? "Volume",
  };
}

/**
 * Gera um caminho SVG estilo Sankey (feixe contínuo que afunila de h1 para h2)
 * centrado em centerY.
 */
function buildSankeyRibbonPath(
  x1: number,
  x2: number,
  centerY: number,
  h1: number,
  h2: number
): string {
  const top1 = centerY - h1 / 2;
  const bot1 = centerY + h1 / 2;
  const top2 = centerY - h2 / 2;
  const bot2 = centerY + h2 / 2;
  const midX = (x1 + x2) / 2;

  return [
    `M ${x1} ${top1}`,
    `C ${midX} ${top1}, ${midX} ${top2}, ${x2} ${top2}`,
    `L ${x2} ${bot2}`,
    `C ${midX} ${bot2}, ${midX} ${bot1}, ${x1} ${bot1}`,
    "Z",
  ].join(" ");
}

/**
 * Gera um ramo descendente de "vazamento/perda" saindo da base do feixe quando há queda entre etapas.
 */
function buildLeakDropPath(
  x1: number,
  x2: number,
  centerY: number,
  h1: number,
  h2: number
): string {
  const dropHeight = Math.max(6, Math.min(22, (h1 - h2) * 0.55));
  const startX = x1 + (x2 - x1) * 0.28;
  const endX = x1 + (x2 - x1) * 0.78;
  const startTop = centerY + h1 * 0.25;
  const startBot = centerY + h1 * 0.5;
  const endTop = centerY + h1 * 0.5 + 16;
  const endBot = endTop + dropHeight;
  const ctrlX = (startX + endX) / 2;

  return [
    `M ${startX} ${startTop}`,
    `C ${ctrlX} ${startTop}, ${ctrlX} ${endTop}, ${endX} ${endTop}`,
    `L ${endX} ${endBot}`,
    `C ${ctrlX} ${endBot}, ${ctrlX} ${startBot}, ${startX} ${startBot}`,
    "Z",
  ].join(" ");
}

export function FunnelSankeyFlow({
  funnel,
  onSelectStage,
  className,
}: FunnelSankeyFlowProps) {
  const nodes = useMemo(() => {
    const raw = funnel.etapas.map((stage) => {
      const vol = extractVolume(stage);
      return {
        stage,
        count: vol.count,
        unitLabel: vol.label,
      };
    });

    // Normaliza alturas visuais do feixe (de 92px no topo até no mínimo 18px no fim)
    const maxCount = Math.max(1, ...raw.map((r) => r.count));
    const defaultRatios = [1.0, 0.72, 0.42, 0.28, 0.18, 0.16];

    return raw.map((item, idx) => {
      const hasRealVolume = maxCount > 1 && item.count > 0;
      const ratio = hasRealVolume
        ? Math.max(0.16, Math.min(1, Math.pow(item.count / maxCount, 0.42)))
        : defaultRatios[idx] ?? 0.2;
      const heightPx = Math.round(18 + ratio * 74); // 18px a 92px
      return {
        ...item,
        heightPx,
      };
    });
  }, [funnel.etapas]);

  const svgWidth = 1080;
  const svgHeight = 165;
  const centerY = 74;
  const colWidth = svgWidth / nodes.length;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-gradient-to-b from-card/95 via-[#0c0f14] to-card/90 p-3.5 shadow-inner space-y-3",
        className
      )}
      aria-label="Fluxo visual Sankey de conversão e vazamento do funil"
    >
      {/* Header da Camada Visual */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-foreground">
            🌊 Rio de Conversão & Sangria por Etapa (Sankey Ao Vivo)
          </span>
          <Badge
            variant="outline"
            className="text-[10px] border-primary/30 bg-primary/10 text-primary font-mono"
          >
            Espessura = Volume · Ramo Vermelho = Vazamento
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Fluxo Saudável
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Atrito Moderado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" /> Vazamento / Gargalo
          </span>
        </div>
      </div>

      {/* SVG Sankey Stream */}
      <div className="relative w-full overflow-x-auto pb-1">
        <div className="min-w-[780px]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-[155px] overflow-visible select-none"
          >
            <defs>
              {nodes.slice(0, -1).map((curr, idx) => {
                const next = nodes[idx + 1];
                const isBottleneck =
                  funnel.gargalo === next.stage.id || next.stage.status === "gargalo";
                const c1 = STATUS_COLORS[curr.stage.status]?.stroke ?? "#38bdf8";
                const c2 = isBottleneck
                  ? "#f43f5e"
                  : STATUS_COLORS[next.stage.status]?.stroke ?? "#10b981";
                return (
                  <linearGradient
                    key={`grad-${curr.stage.id}-${next.stage.id}`}
                    id={`sankey-grad-${idx}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={c1} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={c2} stopOpacity={isBottleneck ? 0.52 : 0.34} />
                  </linearGradient>
                );
              })}
            </defs>

            {/* Raias verticais sutis de fundo */}
            {nodes.map((node, idx) => {
              const xCenter = idx * colWidth + colWidth / 2;
              return (
                <g key={`lane-${node.stage.id}`}>
                  <line
                    x1={xCenter}
                    y1={12}
                    x2={xCenter}
                    y2={svgHeight - 14}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })}

            {/* Feixes Sankey e Ramos de Vazamento entre Etapas */}
            {nodes.slice(0, -1).map((curr, idx) => {
              const next = nodes[idx + 1];
              const x1 = idx * colWidth + colWidth / 2 + 24;
              const x2 = (idx + 1) * colWidth + colWidth / 2 - 24;
              const ribbonPath = buildSankeyRibbonPath(
                x1,
                x2,
                centerY,
                curr.heightPx,
                next.heightPx
              );

              const isBottleneck =
                funnel.gargalo === next.stage.id || next.stage.status === "gargalo";
              const isWarning = next.stage.status === "atencao";
              const strokeColor = isBottleneck
                ? "#f43f5e"
                : isWarning
                ? "#f59e0b"
                : "#10b981";

              const conv = next.stage.conversao;
              const dropPct =
                conv?.value !== null && conv?.value !== undefined
                  ? Math.max(0, Math.round(100 - conv.value))
                  : null;

              return (
                <g
                  key={`ribbon-${curr.stage.id}-${next.stage.id}`}
                  className="cursor-pointer group"
                  onClick={() => onSelectStage?.(next.stage.id)}
                >
                  {/* Ramo vermelho de sangria/drop-off */}
                  {(isBottleneck || isWarning || (dropPct !== null && dropPct >= 30)) && (
                    <g>
                      <path
                        d={buildLeakDropPath(x1, x2, centerY, curr.heightPx, next.heightPx)}
                        fill={isBottleneck ? "rgba(244, 63, 94, 0.35)" : "rgba(245, 158, 11, 0.2)"}
                        stroke={isBottleneck ? "#f43f5e" : "#f59e0b"}
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                      <text
                        x={x1 + (x2 - x1) * 0.72}
                        y={centerY + curr.heightPx * 0.5 + 32}
                        textAnchor="middle"
                        className={cn(
                          "text-[9px] font-mono font-semibold fill-current",
                          isBottleneck ? "text-rose-400" : "text-amber-300/80"
                        )}
                      >
                        {isBottleneck
                          ? `💸 Sangria (${conv?.value ?? 0}% vs ${conv?.referencia ?? 0}%)`
                          : dropPct !== null
                          ? `-${dropPct}% drop`
                          : ""}
                      </text>
                    </g>
                  )}

                  {/* Corpo do feixe principal */}
                  <path
                    d={ribbonPath}
                    fill={`url(#sankey-grad-${idx})`}
                    stroke={strokeColor}
                    strokeWidth={isBottleneck ? 1.8 : 1.1}
                    strokeOpacity={0.75}
                    className="transition-opacity group-hover:opacity-95"
                  />

                  {/* Linha central animada de partículas de fluxo */}
                  <line
                    x1={x1}
                    y1={centerY}
                    x2={x2}
                    y2={centerY}
                    stroke={strokeColor}
                    strokeWidth={2}
                    strokeDasharray="5 7"
                    strokeOpacity={0.85}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="24"
                      to="0"
                      dur={isBottleneck ? "1.8s" : "1.1s"}
                      repeatCount="indefinite"
                    />
                  </line>

                  {/* Pílula de conversão no centro da transição */}
                  {conv && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${centerY})`}>
                      <rect
                        x={-34}
                        y={-11}
                        width={68}
                        height={22}
                        rx={6}
                        fill="#0b0d12"
                        stroke={strokeColor}
                        strokeWidth={isBottleneck ? 1.5 : 1}
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-bold fill-white"
                      >
                        {conv.value !== null ? `${conv.value}%` : "—"}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Colunas/Portais de cada Etapa */}
            {nodes.map((node, idx) => {
              const xCenter = idx * colWidth + colWidth / 2;
              const isBottleneck =
                funnel.gargalo === node.stage.id || node.stage.status === "gargalo";
              const stColor = isBottleneck
                ? STATUS_COLORS.gargalo
                : STATUS_COLORS[node.stage.status] ?? STATUS_COLORS.sem_dado;

              return (
                <g
                  key={`pillar-${node.stage.id}`}
                  className="cursor-pointer"
                  onClick={() => onSelectStage?.(node.stage.id)}
                >
                  {/* Barra vertical calibrada pelo volume */}
                  <rect
                    x={xCenter - 18}
                    y={centerY - node.heightPx / 2}
                    width={36}
                    height={node.heightPx}
                    rx={8}
                    fill={stColor.fill}
                    stroke={stColor.stroke}
                    strokeWidth={isBottleneck ? 2.2 : 1.5}
                  />

                  {/* Nome da etapa acima */}
                  <text
                    x={xCenter}
                    y={16}
                    textAnchor="middle"
                    className="text-[10px] font-semibold fill-foreground"
                  >
                    {STAGE_META[node.stage.id].shortTitle}
                  </text>

                  {/* Volume dentro/abaixo do pilar */}
                  <text
                    x={xCenter}
                    y={centerY + 4}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold fill-white"
                  >
                    {node.count > 0 ? node.count.toLocaleString("pt-BR") : "—"}
                  </text>

                  <text
                    x={xCenter}
                    y={svgHeight - 4}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-muted-foreground"
                  >
                    {node.unitLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Barra rápida interativa de estágios (clicável para abrir a gaveta lateral) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 pt-1">
        {nodes.map(({ stage }) => {
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          const isBottleneck = funnel.gargalo === stage.id || stage.status === "gargalo";
          const st = isBottleneck ? STATUS_COLORS.gargalo : STATUS_COLORS[stage.status];
          const deltaPp = stage.conversao?.deltaPp ?? null;
          const trend = stage.conversao?.trend;

          return (
            <button
              key={`quick-${stage.id}`}
              type="button"
              onClick={() => onSelectStage?.(stage.id)}
              className={cn(
                "flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-all hover:bg-secondary/40",
                isBottleneck
                  ? "border-rose-500/50 bg-rose-500/10"
                  : "border-border/60 bg-background/40"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-foreground truncate">
                  <Icon className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{meta.shortTitle}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                  <span>{meta.tempTag}</span>
                  {deltaPp !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center font-semibold",
                        trend === "up"
                          ? "text-emerald-400"
                          : trend === "down"
                          ? "text-rose-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {trend === "up" && <TrendingUp className="h-2.5 w-2.5" />}
                      {trend === "down" && <TrendingDown className="h-2.5 w-2.5" />}
                      {deltaPp >= 0 ? `+${deltaPp}` : deltaPp}pp
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold border",
                  st.badgeCls
                )}
              >
                {stage.conversao?.value !== null && stage.conversao?.value !== undefined
                  ? `${stage.conversao.value}%`
                  : st.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
