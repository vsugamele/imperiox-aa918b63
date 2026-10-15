// Visão "Caminho" do mapa (Story MAP2.3): o fluxo que leva à venda em linha, com a entrega de cada passo,
// métrica × meta e onde está travado. Alternativas aparecem como ramos do passo de onde saem.
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  DollarSign,
  ExternalLink,
  Eye,
  Globe,
  Layout,
  Layers,
  MapPin,
  Monitor,
  MoreHorizontal,
  Play,
  RotateCcw,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  StarOff,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildMapPath, metricVerdict, parseMetricRule, pathFocus, type MetricVerdict } from "@shared/map-path";
import { readStageContract } from "@shared/map-contract";
import { elementType, FUNNEL_PHASES, phaseOf } from "@shared/map-elements";
import { METRIC_KEYS } from "@shared/metric-keys";
import type { NodeMetricSnapshot, ProjectMetricSnapshot } from "@/lib/map-stage-metrics";
import type { MapNode } from "@/components/funis/map-node-model";
import { MapNodeVisualPreview, resolveVisualPreviewForNode } from "@/components/funis/MapNodeVisualPreview";

export type PathRole = "principal" | "alternativa" | null;

export interface StageVisualBlueprint {
  isPage: boolean;
  formatBadge: string;
  wireframeType: "vsl" | "advertorial" | "pdp" | "captura" | "checkout" | "ads" | "whatsapp";
  blocks: string[];
  primaryCta: string;
}

export function getStageVisualBlueprint(node: MapNode): StageVisualBlueprint {
  const combined = `${node.kind ?? ""} ${node.label ?? ""}`.toLowerCase();

  if (combined.includes("advertorial") || combined.includes("pre-sell") || combined.includes("presell")) {
    return {
      isPage: true,
      formatBadge: "Página Editorial / Advertorial",
      wireframeType: "advertorial",
      blocks: ["Manchete Editorial", "História / Descoberta", "Prova Científica", "CTA Nativo → VSL"],
      primaryCta: "Ler matéria / Assistir apresentação",
    };
  }
  if (combined.includes("pdp") || combined.includes("ecommerce") || combined.includes("kit") || combined.includes("loja")) {
    return {
      isPage: true,
      formatBadge: "Página de Produto (PDP)",
      wireframeType: "pdp",
      blocks: ["Galeria do Produto", "Seletor de Kits (1/3/5)", "Tabela Nutricional / Fórmula", "Reviews + Comprar"],
      primaryCta: "Escolher Kit e Ir ao Checkout",
    };
  }
  if (combined.includes("quiz") || combined.includes("captura") || combined.includes("optin") || combined.includes("lead") || combined.includes("webinar")) {
    return {
      isPage: true,
      formatBadge: "Página de Captura / Quiz",
      wireframeType: "captura",
      blocks: ["Headline de Diagnóstico", "Perguntas Interativas / Form", "Captura WhatsApp + E-mail", "Redirecionamento"],
      primaryCta: "Destravar Resultado / Entrar no Grupo",
    };
  }
  if (combined.includes("checkout") || combined.includes("compra") || combined.includes("venda") || combined.includes("upsell") || combined.includes("downsell") || combined.includes("obrigado")) {
    return {
      isPage: true,
      formatBadge: combined.includes("upsell") || combined.includes("downsell") ? "Página de Upsell / Oferta VIP" : "Tela de Checkout & Pagamento",
      wireframeType: "checkout",
      blocks: ["Resumo do Kit + Garantia", "PIX Instantâneo / Cartão 12x", "Order Bump 1-Clique", "Confirmação Segura"],
      primaryCta: "Finalizar Pedido com PIX / Cartão",
    };
  }
  if (combined.includes("whatsapp") || combined.includes("x1") || combined.includes("recupera") || combined.includes("manychat") || combined.includes("direct")) {
    return {
      isPage: false,
      formatBadge: "Fluxo Conversacional (X1 / WhatsApp)",
      wireframeType: "whatsapp",
      blocks: ["Abordagem Personalizada", "Áudio + Quebra de Objeção", "Prova Social Real", "Link Direto de Checkout"],
      primaryCta: "Enviar Link de Pagamento no X1",
    };
  }
  if (combined.includes("vsl") || combined.includes("pagina") || combined.includes("página") || combined.includes("lp") || combined.includes("site") || combined.includes("oferta")) {
    return {
      isPage: true,
      formatBadge: "Página de Vendas / VSL",
      wireframeType: "vsl",
      blocks: ["Headline + Subheadline", "Player VSL + Retenção", "Empilhamento da Oferta", "Garantia + Provas Sociais"],
      primaryCta: "Quero Garantir Meu Acesso Agora",
    };
  }
  return {
    isPage: false,
    formatBadge: "Criativo / Anúncio em Tráfego",
    wireframeType: "ads",
    blocks: ["Hook Visual (0-3s)", "Corpo / Mecanismo Único", "Prova Visual Rápida", "CTA Clique no Anúncio"],
    primaryCta: "Toque em Saiba Mais",
  };
}

export interface MapPathViewProps {
  nodes: MapNode[];
  edges: Array<{ source: string; target: string }>;
  /** Cada etapa recebe somente as métricas do seu projeto e URL. */
  metricsByNode?: Record<string, NodeMetricSnapshot>;
  /** Métricas agregadas por projeto (alimentam o topo do funil e preenchem passos sem URL específica). */
  projectMetrics?: Record<string, ProjectMetricSnapshot>;
  today: string;
  onOpen: (id: string) => void;
  onSetRole: (id: string, role: PathRole) => void;
  onSwitchToCanvas?: () => void;
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

function stepMetric(node: MapNode, snapshot: NodeMetricSnapshot | undefined) {
  const target = node.metrics_target && typeof node.metrics_target === "object" && !Array.isArray(node.metrics_target)
    ? node.metrics_target as Record<string, unknown> : null;
  const key = typeof target?.key === "string" ? target.key : null;
  if (!key) return null;
  const meta = typeof target?.meta === "string" ? target.meta : null;
  const info = METRIC.get(key);
  const real = snapshot?.status === "ready" ? snapshot.values[key] ?? null : null;
  const verdict = metricVerdict(real, parseMetricRule(meta, snapshot?.refs ?? {}));
  return { label: info?.label ?? key, meta, real: real === null ? null : formatValue(real, info?.unidade), verdict, semFonte: info ? !info.disponivel : false };
}

function delivery(node: MapNode): { label: string; text: string } | null {
  const fields = readStageContract({ ...node, checklist: node.checklist }).fields;
  const output = fields.find((f) => f.key === "output")?.value;
  if (output) return { label: "Entrega", text: output };
  const ready = fields.find((f) => f.key === "ready")?.value;
  return ready ? { label: "Pronto quando", text: ready } : null;
}

export function MapPathView({
  nodes,
  edges,
  metricsByNode,
  projectMetrics,
  today,
  onOpen,
  onSetRole,
  onSwitchToCanvas,
}: MapPathViewProps) {
  const [showFora, setShowFora] = useState(false);
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  const [previewMode, setPreviewMode] = useState<"visual" | "wireframe" | "live">("visual");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const path = useMemo(() => buildMapPath(nodes, edges), [nodes, edges]);
  const focus = useMemo(() => pathFocus(path.principal, nodes, today), [path.principal, nodes, today]);
  const objetivo = path.objetivo ? byId.get(path.objetivo) : null;

  // Funnel-wide health summary (rendered when projectMetrics is provided)
  const funnelTotals = useMemo(() => {
    if (!projectMetrics || Object.keys(projectMetrics).length === 0) {
      return {
        hasAnyMetric: false,
        gastoAds: 0,
        vendas: 0,
        receita: 0,
        sessoes: 0,
        checkouts: 0,
        cpaReal: null,
        cpaTarget: undefined,
        roas: null,
        checkoutRate: null,
        salesConvRate: null,
      };
    }
    const projectsWithData = Object.values(projectMetrics);
    let gastoAds = 0;
    let vendas = 0;
    let receita = 0;
    let sessoes = 0;
    let checkouts = 0;
    let cpaTarget: number | undefined;

    for (const p of projectsWithData) {
      if (typeof p.values.gasto_ads === "number") gastoAds += p.values.gasto_ads;
      if (typeof p.values.vendas === "number") vendas += p.values.vendas;
      if (typeof p.values.receita === "number") receita += p.values.receita;
      if (typeof p.values.sessoes_pagina === "number") sessoes += p.values.sessoes_pagina;
      if (typeof p.values.cliques_checkout === "number") checkouts += p.values.cliques_checkout;
      if (p.refs?.cpaAlvo && !cpaTarget) cpaTarget = p.refs.cpaAlvo;
    }

    const cpaReal = vendas > 0 && gastoAds > 0 ? gastoAds / vendas : null;
    const roas = gastoAds > 0 && receita > 0 ? receita / gastoAds : null;
    const checkoutRate = sessoes > 0 && checkouts > 0 ? (checkouts / sessoes) * 100 : null;
    const salesConvRate = checkouts > 0 && vendas > 0 ? (vendas / checkouts) * 100 : null;
    const hasAnyMetric = gastoAds > 0 || vendas > 0 || receita > 0 || sessoes > 0 || checkouts > 0;

    return {
      hasAnyMetric,
      gastoAds,
      vendas,
      receita,
      sessoes,
      checkouts,
      cpaReal,
      cpaTarget,
      roas,
      checkoutRate,
      salesConvRate,
    };
  }, [projectMetrics]);

  // Candidate sequence if main path is empty due to lack of connected DAG
  const candidateNodes = useMemo(() => {
    if (path.principal.length > 0) return [];
    const nonStructural = nodes.filter((n) => {
      const family = elementType(n.kind)?.family;
      return family !== "estrutura" && family !== "midia";
    });
    const phaseWeight = (kind: string) => {
      const phase = phaseOf(kind);
      if (phase === "aquisicao") return 10;
      if (kind === "vsl" || kind === "pagina_vendas" || kind === "advertorial" || kind === "quiz") return 20;
      if (kind === "checkout") return 30;
      if (kind === "compra" || kind === "venda") return 40;
      if (phase === "ascensao") return 50;
      if (phase === "relacionamento") return 60;
      return 70;
    };
    return [...nonStructural].sort((a, b) => {
      const wa = phaseWeight(a.kind);
      const wb = phaseWeight(b.kind);
      if (wa !== wb) return wa - wb;
      return (a.position?.x ?? 0) - (b.position?.x ?? 0);
    });
  }, [nodes, path.principal]);

  const metricLine = (node: MapNode) => {
    const snapshot = metricsByNode?.[node.id];
    const metric = stepMetric(node, snapshot);
    if (!metric) return null;
    const updated = snapshot?.updatedAt ? new Date(snapshot.updatedAt) : null;
    const updatedLabel = updated && Number.isFinite(updated.getTime()) ? updated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <div className="mt-2.5 rounded-lg border border-border/70 bg-secondary/30 p-2.5 text-[12px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-sm", VERDICT_STYLE[metric.verdict].dot)} aria-hidden />
          <span className="font-medium text-foreground">{metric.label}</span>
          <span className="font-mono font-semibold text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/40">{metric.real ?? "—"}</span>
          {metric.meta && <span className="text-muted-foreground">· meta: {metric.meta}</span>}
          <span className={cn(
            "text-[11px] font-medium px-1.5 py-0.5 rounded",
            metric.verdict === "verde" && "text-success bg-success/10",
            metric.verdict === "amarelo" && "text-warning bg-warning/10",
            metric.verdict === "vermelho" && "text-destructive bg-destructive/10",
            (metric.verdict === "sem_dado" || metric.verdict === "sem_regua") && "text-muted-foreground"
          )}>
            · {snapshot?.status === "error" ? "falha de leitura" : metric.semFonte ? "sem fonte de dado ainda" : VERDICT_STYLE[metric.verdict].label}
          </span>
        </div>
        {snapshot?.scope === "etapa" && snapshot.status === "ready" && (
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/40 pt-1.5 text-[11px]">
            <div className="rounded bg-background/60 px-2 py-1">
              <span className="text-muted-foreground block text-[10px]">Sessões com CTA</span>
              <span className="font-mono font-medium text-foreground">{snapshot.values.cliques_cta ?? "—"}</span>
            </div>
            <div className="rounded bg-background/60 px-2 py-1">
              <span className="text-muted-foreground block text-[10px]">Taxa de CTA</span>
              <span className="font-mono font-medium text-foreground">
                {snapshot.values.taxa_clique_cta === null || snapshot.values.taxa_clique_cta === undefined ? "—" : formatValue(snapshot.values.taxa_clique_cta, "percentual")}
              </span>
            </div>
            <div className="rounded bg-background/60 px-2 py-1">
              <span className="text-muted-foreground block text-[10px]">Checkout iniciado</span>
              <span className="font-mono font-medium text-foreground">{snapshot.values.cliques_checkout ?? "—"}</span>
            </div>
            {/* Preserving exact text representation for tests */}
            <p className="sr-only">
              Sessões com CTA: {snapshot.values.cliques_cta ?? "—"} · Taxa de CTA: {snapshot.values.taxa_clique_cta === null || snapshot.values.taxa_clique_cta === undefined ? "—" : formatValue(snapshot.values.taxa_clique_cta, "percentual")} · Checkout iniciado: {snapshot.values.cliques_checkout ?? "—"}
            </p>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground break-all">
          {snapshot?.scope === "projeto" ? "Projeto" : "Esta URL"} · {snapshot?.projectId ?? "sem projeto"} · {snapshot?.source ?? "sem dado"}{updatedLabel ? ` · atualizado ${updatedLabel}` : ""}
        </p>
      </div>
    );
  };

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
      <div key={id} className="rounded-md border border-dashed border-border/70 bg-card/40 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <ArrowDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <button type="button" className="min-w-0 flex-1 text-left text-[13px] text-foreground/90 truncate hover:text-primary font-medium" onClick={() => onOpen(id)}>{node.label}</button>
          <span className="text-[11px] text-muted-foreground shrink-0">{elementType(node.kind)?.label ?? node.kind}</span>
          {node.path_role === "alternativa" && <span className="text-[11px] text-muted-foreground shrink-0">(manual)</span>}
          {roleMenu(node, false)}
        </div>
        {metricLine(node)}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-16">
        {/* Header com propósito claro e alternador de visão */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Caminho Operacional</span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Caminho principal</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {path.principal.length
                ? <>{path.principal.length} passo(s) até <span className="font-semibold text-foreground">{objetivo?.label ?? "o fim do caminho"}</span>. Calculado pelas setas; ajuste em cada passo.</>
                : "Este mapa ainda não tem compra nem checkout ligados por setas. Ligue as etapas até o checkout ou marque passos como principal."}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {(["verde", "amarelo", "vermelho", "sem_dado"] as MetricVerdict[]).map((v) => (
                <span key={v} className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", VERDICT_STYLE[v].dot)} />{VERDICT_STYLE[v].label}</span>
              ))}
              <span>· métricas dos últimos 7 dias</span>
            </div>
          </div>

          {onSwitchToCanvas && (
            <Button size="sm" variant="outline" onClick={onSwitchToCanvas} className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" /> Abrir no Canvas 2D
            </Button>
          )}
        </div>

        {/* Resumo Executivo da Saúde do Funil (quando há métricas de projeto) */}
        {funnelTotals.hasAnyMetric && (
          <div className="mb-5 rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Saúde Geral do Funil (Últimos 7 dias)
              </span>
              {funnelTotals.cpaReal && funnelTotals.cpaTarget && (
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  funnelTotals.cpaReal <= funnelTotals.cpaTarget
                    ? "bg-success/15 text-success"
                    : funnelTotals.cpaReal <= funnelTotals.cpaTarget * 1.2
                    ? "bg-warning/15 text-warning"
                    : "bg-destructive/15 text-destructive"
                )}>
                  {funnelTotals.cpaReal <= funnelTotals.cpaTarget ? "🟢 CPA no Alvo" : "🔴 CPA Alto"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">Gasto em Ads</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  R$ {formatValue(funnelTotals.gastoAds, "moeda")}
                </span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">Visitas / Sessões</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {funnelTotals.sessoes.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">Checkouts</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-bold text-foreground">{funnelTotals.checkouts}</span>
                  {funnelTotals.checkoutRate !== null && (
                    <span className="text-[10px] text-muted-foreground">({funnelTotals.checkoutRate.toFixed(1)}%)</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">Vendas Aprovadas</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-bold text-success">{funnelTotals.vendas}</span>
                  {funnelTotals.salesConvRate !== null && (
                    <span className="text-[10px] text-muted-foreground">({funnelTotals.salesConvRate.toFixed(1)}% conv)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">Faturamento</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  R$ {formatValue(funnelTotals.receita, "moeda")}
                </span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">CPA Real vs Meta</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {funnelTotals.cpaReal ? `R$ ${formatValue(funnelTotals.cpaReal, "moeda")}` : "—"}
                  {funnelTotals.cpaTarget && <span className="text-[11px] font-normal text-muted-foreground"> / R$ {funnelTotals.cpaTarget}</span>}
                </span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-2.5 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">ROAS Geral</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {funnelTotals.roas ? `${funnelTotals.roas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Gargalo Travado (onde o funil está parado ou sangrando) */}
        {focus && byId.get(focus.id) && (
          <button
            type="button"
            onClick={() => onOpen(focus.id)}
            className="mb-5 flex w-full items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-left transition-all hover:bg-warning/15 hover:border-warning/60 shadow-sm"
          >
            <Crosshair className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-warning/20 px-1.5 py-0.2 text-[10px] font-bold text-warning uppercase">Gargalo Identificado</span>
                <p className="text-sm font-semibold text-foreground">
                  Travado no passo {path.principal.indexOf(focus.id) + 1}: {byId.get(focus.id)!.label}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{focus.motivo}</p>
            </div>
            <span className="text-xs font-medium text-warning flex items-center gap-1 shrink-0 self-center">
              Resolver <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        )}

        {/* Linha principal com os passos numerados, preview visual real da página/etapa e métricas */}
        {path.principal.length > 0 ? (
          <ol className="relative space-y-4">
            {path.principal.map((id, i) => {
              const node = byId.get(id);
              if (!node) return null;
              const entrega = delivery(node);
              const isFocus = focus?.id === id;
              const done = node.step_status === "done";
              const alts = path.alternativas.get(id) ?? [];
              const phase = phaseOf(node.kind);
              const isLast = i === path.principal.length - 1;
              const blueprint = getStageVisualBlueprint(node);
              const hasLiveUrl = Boolean(node.url && /^https?:\/\//i.test(node.url.trim()));

              return (
                <li key={id} className="relative pl-12">
                  {/* Linha conectora vertical */}
                  {!isLast && (
                    <span
                      className="absolute left-[17px] top-11 bottom-[-16px] w-[3px] rounded-full bg-border transition-colors group-hover:bg-primary/50"
                      aria-hidden
                    />
                  )}

                  {/* Círculo do número com status visual */}
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition-all",
                      done
                        ? "border-success bg-success/15 text-success"
                        : isFocus
                        ? "border-warning bg-warning/20 text-warning ring-2 ring-warning/30"
                        : "border-primary/50 bg-card text-foreground"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>

                  {/* Card da etapa com Preview Visual Real ao lado */}
                  <div
                    className={cn(
                      "rounded-xl border bg-card p-4 transition-all shadow-sm hover:border-primary/40",
                      isFocus ? "border-warning/60 ring-1 ring-warning/30 bg-warning/[0.02]" : "border-border"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      {/* Coluna esquerda: Dados, Anatomia da Página e Métrica */}
                      <div className="min-w-0 flex-1 w-full">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="text-left text-base font-semibold text-foreground hover:text-primary transition-colors"
                                onClick={() => onOpen(id)}
                              >
                                {node.label}
                              </button>
                              {blueprint.isPage && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border",
                                    hasLiveUrl
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  )}
                                >
                                  <Layout className="h-2.5 w-2.5" />
                                  {hasLiveUrl ? "Página no Ar" : "Etapa de Página (Protótipo)"}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className={cn(
                                "rounded-full px-2 py-0.5 font-medium text-[10px]",
                                phase === "aquisicao" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                                phase === "conversao" && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                                phase === "ascensao" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                                phase === "relacionamento" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                phase === "operacao" && "bg-secondary text-foreground"
                              )}>
                                {PHASE_LABEL[phase] ?? "—"}
                              </span>
                              <span className="rounded bg-secondary/80 px-1.5 py-0.5 font-medium text-[10px] text-foreground/80">
                                {elementType(node.kind)?.label ?? node.kind}
                              </span>
                              <span className="text-[10px] text-muted-foreground/80">
                                · {blueprint.formatBadge}
                              </span>
                              {done && <span className="font-semibold text-success">feito</span>}
                              {node.path_role === "principal" && <span className="text-[10px] text-muted-foreground">(manual)</span>}
                            </div>
                          </div>

                          {roleMenu(node, true)}
                        </div>

                        {/* URL real conectada (quando houver) */}
                        {hasLiveUrl && (
                          <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px]">
                            <Globe className="h-3 w-3 text-emerald-400 shrink-0" />
                            <a
                              href={node.url!}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-emerald-300 hover:underline truncate flex-1"
                            >
                              {node.url}
                            </a>
                            <ExternalLink className="h-3 w-3 text-emerald-400/80 shrink-0" />
                          </div>
                        )}

                        {/* Blocos Visuais da Página / Etapa (mostra a estrutura real da tela) */}
                        <div className="mt-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {blueprint.blocks.map((blk, blkIdx) => (
                              <span
                                key={blk}
                                className="inline-flex items-center gap-1 rounded border border-border/60 bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-foreground/85"
                              >
                                <span className="font-mono text-[9px] text-primary font-bold">{blkIdx + 1}.</span>
                                {blk}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Entrega / Saída da etapa */}
                        {entrega && (
                          <div className="mt-2.5 rounded-md bg-secondary/30 px-2.5 py-1.5 text-[12px] text-foreground/90 border border-border/30">
                            <span className="font-medium text-muted-foreground">{entrega.label}: </span>
                            <span>{entrega.text}</span>
                          </div>
                        )}

                        {/* Métrica da etapa */}
                        {metricLine(node)}
                      </div>

                      {/* Coluna direita: Miniatura Visual Real da Página / Etapa + Ações */}
                      <div className="w-full sm:w-52 shrink-0 flex flex-col gap-1.5">
                        <MapNodeVisualPreview
                          kind={node.kind}
                          label={node.label}
                          url={node.url}
                          customImageUrl={node.image_url}
                          compact={false}
                          onOpenLightbox={() => {
                            setPreviewNode(node);
                            setPreviewMode(hasLiveUrl ? "visual" : "wireframe");
                          }}
                          className="h-28 border-primary/25 shadow-md"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 flex-1 gap-1 text-[11px] font-medium"
                            onClick={() => {
                              setPreviewNode(node);
                              setPreviewMode(hasLiveUrl ? "visual" : "wireframe");
                            }}
                          >
                            <Eye className="h-3 w-3 text-primary" />
                            {blueprint.isPage ? "Ver Página" : "Ver Visual"}
                          </Button>
                          {hasLiveUrl ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                              asChild
                            >
                              <a href={node.url!} target="_blank" rel="noreferrer" title="Abrir URL em nova aba">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => onOpen(node.id)}
                              title="Vincular URL ou editar etapa"
                            >
                              + URL
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ramos de apoio / alternativas (ex: recuperação, downsell, remarketing) */}
                  {alts.length > 0 && (
                    <div className="mt-2.5 ml-3 space-y-1.5 border-l-2 border-dashed border-border/60 pl-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3" />
                        Alternativas a partir daqui
                      </p>
                      {alts.map(branch)}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : candidateNodes.length > 0 ? (
          /* Sugestão de Sequência Automática quando as setas não formam um caminho estrito */
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Sequência Sugerida pelo Funil ({candidateNodes.length} etapas)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Organizamos as etapas deste mapa por ordem de fase (Tráfego ➔ Página ➔ Checkout ➔ Venda).
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 text-xs font-semibold"
                onClick={() => {
                  candidateNodes.forEach((n) => onSetRole(n.id, "principal"));
                }}
              >
                <Star className="h-3.5 w-3.5" /> Ativar como Caminho Principal
              </Button>
            </div>

            <div className="space-y-2">
              {candidateNodes.map((n, idx) => (
                <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <button type="button" onClick={() => onOpen(n.id)} className="font-medium text-foreground hover:text-primary truncate">
                      {n.label}
                    </button>
                    <span className="rounded-full bg-secondary px-2 py-0.2 text-[10px] text-muted-foreground shrink-0">
                      {PHASE_LABEL[phaseOf(n.kind)] ?? n.kind}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setPreviewNode(n);
                        setPreviewMode(n.url ? "visual" : "wireframe");
                      }}
                    >
                      <Eye className="h-3 w-3" /> Visual
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onSetRole(n.id, "principal")}>
                      <Star className="h-3 w-3" /> Fixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Pós-venda */}
        {path.depois.length > 0 && (
          <section className="mt-6 rounded-xl border border-border/60 bg-card/30 p-3.5">
            <h3 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Depois da venda ({path.depois.length})
            </h3>
            <div className="space-y-1.5">{path.depois.map(branch)}</div>
          </section>
        )}

        {/* Fora do caminho principal */}
        {path.fora.length > 0 && (
          <section className="mt-5">
            <button
              type="button"
              onClick={() => setShowFora((v) => !v)}
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFora ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Fora do caminho ({path.fora.length})
            </button>
            {showFora && <div className="space-y-1.5">{path.fora.map(branch)}</div>}
          </section>
        )}

        {/* Modal Interativo de Inspeção Visual da Página / Etapa */}
        <Dialog open={Boolean(previewNode)} onOpenChange={(open) => !open && setPreviewNode(null)}>
          <DialogContent className="max-w-4xl border-border bg-card p-0 overflow-hidden">
            {previewNode && (() => {
              const bp = getStageVisualBlueprint(previewNode);
              const resolved = resolveVisualPreviewForNode(previewNode.kind, previewNode.label, previewNode.url);
              const hasUrl = Boolean(previewNode.url && /^https?:\/\//i.test(previewNode.url.trim()));
              return (
                <div>
                  <DialogHeader className="border-b border-border/70 bg-secondary/30 px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                            {bp.formatBadge}
                          </span>
                          <DialogTitle className="text-base font-bold text-foreground">
                            {previewNode.label}
                          </DialogTitle>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {hasUrl ? previewNode.url : "Sem URL publicada vinculada ainda — exibindo protótipo visual e estrutura da etapa"}
                        </p>
                      </div>

                      {/* Controles de Modo e Dispositivo */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setPreviewMode("visual")}
                            className={cn(
                              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                              previewMode === "visual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Print / Visual
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMode("wireframe")}
                            className={cn(
                              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                              previewMode === "wireframe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            Wireframe da Página
                          </button>
                          {hasUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewMode("live")}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                                previewMode === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Página ao Vivo
                            </button>
                          )}
                        </div>

                        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("desktop")}
                            className={cn(
                              "rounded-md p-1.5 transition-colors",
                              previewDevice === "desktop" ? "bg-secondary text-foreground" : "text-muted-foreground"
                            )}
                            title="Visão Desktop"
                          >
                            <Monitor className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("mobile")}
                            className={cn(
                              "rounded-md p-1.5 transition-colors",
                              previewDevice === "mobile" ? "bg-secondary text-foreground" : "text-muted-foreground"
                            )}
                            title="Visão Mobile"
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Corpo do Inspetor Visual */}
                  <div className="p-5 bg-[#090b10] max-h-[72vh] overflow-y-auto">
                    <div
                      className={cn(
                        "mx-auto transition-all duration-200",
                        previewDevice === "mobile" ? "max-w-[380px]" : "max-w-full"
                      )}
                    >
                      {/* Barra de navegador simulada */}
                      <div className="flex items-center justify-between gap-2 rounded-t-xl border border-white/10 bg-[#12151e] px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                        </div>
                        <div className="flex-1 truncate rounded bg-black/50 px-3 py-1 text-center font-mono text-[11px] text-white/75 border border-white/10">
                          {hasUrl ? previewNode.url : `https://prototipo.imperio.hq/${previewNode.kind || "pagina"}`}
                        </div>
                        {hasUrl && (
                          <a
                            href={previewNode.url!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
                          >
                            Abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {/* Conteúdo conforme modo */}
                      {previewMode === "live" && hasUrl ? (
                        <div className="h-[460px] w-full overflow-hidden rounded-b-xl border-x border-b border-white/10 bg-white">
                          <iframe
                            src={previewNode.url!}
                            title={previewNode.label}
                            className="h-full w-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                        </div>
                      ) : previewMode === "visual" ? (
                        <div className="overflow-hidden rounded-b-xl border-x border-b border-white/10 bg-[#0d1017]">
                          <MapNodeVisualPreview
                            kind={previewNode.kind}
                            label={previewNode.label}
                            url={previewNode.url}
                            customImageUrl={previewNode.image_url}
                            compact={false}
                            className="h-72 rounded-none border-0"
                          />
                          <div className="p-4 border-t border-white/10 bg-card/90">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Estrutura Visual desta Etapa ({bp.formatBadge})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {bp.blocks.map((b, idx) => (
                                <div key={b} className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="font-medium text-foreground">{b}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Wireframe Visual Realista da Página */
                        <div className="rounded-b-xl border-x border-b border-white/10 bg-gradient-to-b from-[#111520] to-[#0b0d14] p-6 text-white space-y-4">
                          {/* Topo / Headline da Página */}
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                            <span className="inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-300 mb-1.5">
                              Bloco 1 · {bp.blocks[0]}
                            </span>
                            <h4 className="text-lg font-bold tracking-tight text-white">
                              {previewNode.label} — Headline de Conversão Principal
                            </h4>
                            <p className="mt-1 text-xs text-white/70 max-w-xl mx-auto">
                              {previewNode.description || "Promessa direta conectada ao mecanismo único e à dor central do avatar do projeto."}
                            </p>
                          </div>

                          {/* Bloco Central Visual (Player VSL / Artigo Advertorial / Galeria PDP / Checkout PIX) */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 rounded-xl border border-white/15 bg-black/50 p-5 flex flex-col items-center justify-center min-h-[180px] text-center relative overflow-hidden">
                              <img
                                src={resolved.assetPath}
                                alt={previewNode.label}
                                className="absolute inset-0 h-full w-full object-cover opacity-30"
                              />
                              <div className="relative z-10 flex flex-col items-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg mb-2">
                                  <Play className="h-5 w-5 fill-current" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                  Bloco 2 · {bp.blocks[1]}
                                </span>
                                <p className="mt-1 text-xs text-white/80 max-w-sm">
                                  Elemento visual central da etapa ({bp.formatBadge})
                                </p>
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 flex flex-col justify-between space-y-3">
                              <div>
                                <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                                  Bloco 3 · {bp.blocks[2]}
                                </span>
                                <ul className="mt-2 space-y-1.5 text-xs text-white/80">
                                  {bp.blocks.map((blk) => (
                                    <li key={blk} className="flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                      <span>{blk}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="rounded-lg bg-emerald-500 text-black font-bold text-xs py-2.5 px-3 text-center shadow-md">
                                {bp.primaryCta}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rodapé de Ações Rápidas do Modal */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <span className="text-xs text-muted-foreground">
                        Quer trocar a URL, subir print personalizado ou editar o contrato desta página?
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const id = previewNode.id;
                            setPreviewNode(null);
                            onOpen(id);
                          }}
                        >
                          Editar Etapa / Colar URL
                        </Button>
                        {hasUrl && (
                          <Button size="sm" asChild>
                            <a href={previewNode.url!} target="_blank" rel="noreferrer" className="gap-1.5">
                              Abrir Página Real <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
