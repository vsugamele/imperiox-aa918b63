import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodRange } from "@/lib/periodUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import DashboardDrillSheet, { DrillMetric, FunnelStage } from "./DashboardDrillSheet";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
}

interface Stage {
  key: string;
  label: string;
  count: number;
  stage: FunnelStage;
  color: string;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function AcquisitionFunnel({ period, projectFilter, productFilter }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillStage, setDrillStage] = useState<FunnelStage | null>(null);

  const openStage = (s: FunnelStage) => { setDrillStage(s); setDrillOpen(true); };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from: since, to } = getPeriodRange(period);

      // Ads metrics
      let adsQ = supabase.from("imphq_ads_spend")
        .select("impressoes, link_clicks, cliques, landing_page_views, add_to_cart, init_checkout, compras")
        .gte("data_ref", since.split("T")[0]).lte("data_ref", to.split("T")[0]);
      if (projectFilter && projectFilter !== "all") adsQ = adsQ.eq("project_id", projectFilter);

      // Sales (compras reais — fonte de verdade)
      let vendasQ = supabase.from("imphq_vendas").select("status, produto_nome")
        .gte("created_at", since).lte("created_at", to);
      if (projectFilter && projectFilter !== "all") vendasQ = vendasQ.eq("project_id", projectFilter);

      const [adsRes, vendasRes] = await Promise.all([adsQ, vendasQ]);

      const ads = (adsRes.data || []) as any[];
      const sum = (k: string) => ads.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);

      const impressoes = sum("impressoes");
      const cliques = sum("link_clicks") || sum("cliques");
      const pageViews = sum("landing_page_views");
      const addToCart = sum("add_to_cart");
      const initCheckout = sum("init_checkout");

      // Compras = vendas aprovadas reais (mais confiável que pixel)
      const vendas = (vendasRes.data || []) as any[];
      const compras = vendas.filter((v) => {
        if (productFilter && productFilter !== "all") {
          if (!v.produto_nome || v.produto_nome.toLowerCase() !== productFilter.toLowerCase()) return false;
        }
        return (v.status || "").toLowerCase() === "aprovado";
      }).length;

      const data: Stage[] = [
        { key: "impressoes", label: "IMPRESSÕES",     count: impressoes,   stage: "leads",    color: "hsl(var(--primary) / 0.95)" },
        { key: "cliques",    label: "CLIQUES",        count: cliques,      stage: "leads",    color: "hsl(var(--primary) / 0.85)" },
        { key: "pageview",   label: "PAGE VIEW",      count: pageViews,    stage: "leads",    color: "hsl(var(--primary) / 0.75)" },
        { key: "atc",        label: "ADD TO CART",    count: addToCart,    stage: "checkout", color: "hsl(var(--primary) / 0.65)" },
        { key: "ic",         label: "INIT. CHECKOUT", count: initCheckout, stage: "checkout", color: "hsl(var(--primary) / 0.55)" },
        { key: "compras",    label: "COMPRAS",        count: compras,      stage: "approved", color: "hsl(var(--primary) / 0.45)" },
      ];

      setStages(data);
      setLoading(false);
    }
    load();
  }, [period, projectFilter, productFilter]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">Funil de Aquisição</CardTitle></CardHeader>
        <CardContent><div className="h-80 animate-pulse bg-secondary/30 rounded" /></CardContent>
      </Card>
    );
  }

  // Cálculo das larguras: top = 100%, bottom = 25%, decresce proporcional
  const topW = 100;
  const bottomW = 28;
  const n = stages.length;
  const stepH = 56; // altura de cada faixa
  const totalH = n * stepH;
  const viewW = 360;

  const widthAt = (i: number) => {
    const t = i / n; // 0..1
    return topW - (topW - bottomW) * t;
  };

  // Conversion vs first non-zero stage
  const baseline = stages.find((s) => s.count > 0)?.count || 0;

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Funil de Aquisição
            <span className="ml-auto text-[10px] text-muted-foreground font-normal">Clique para detalhar</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-stretch">
            {/* SVG Funnel */}
            <div className="relative">
              <svg viewBox={`0 0 ${viewW} ${totalH}`} width="100%" height={totalH} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="funnelShade" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                {stages.map((s, i) => {
                  const wTop = widthAt(i);
                  const wBot = widthAt(i + 1);
                  const xTopL = ((100 - wTop) / 2) * (viewW / 100);
                  const xTopR = xTopL + wTop * (viewW / 100);
                  const xBotL = ((100 - wBot) / 2) * (viewW / 100);
                  const xBotR = xBotL + wBot * (viewW / 100);
                  const y0 = i * stepH;
                  const y1 = y0 + stepH - 3; // gap entre faixas
                  return (
                    <g key={s.key} className="cursor-pointer" onClick={() => openStage(s.stage)}>
                      <polygon
                        points={`${xTopL},${y0} ${xTopR},${y0} ${xBotR},${y1} ${xBotL},${y1}`}
                        fill={s.color}
                        stroke="hsl(var(--primary))"
                        strokeOpacity="0.25"
                        strokeWidth="0.5"
                        className="transition-opacity hover:opacity-80"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right column — métricas */}
            <div className="flex flex-col justify-between gap-1 min-w-[160px]">
              {stages.map((s, i) => {
                const pct = baseline > 0 && i > 0 ? (s.count / baseline) * 100 : i === 0 ? 100 : 0;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => openStage(s.stage)}
                    style={{ height: stepH - 3 }}
                    className="text-left rounded-md bg-secondary/40 hover:bg-secondary/70 border border-border/40 hover:border-primary/40 px-3 py-1.5 transition-colors"
                  >
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="font-mono text-sm font-bold text-foreground leading-tight">
                      {fmt(s.count)}
                      {i > 0 && (
                        <span className="ml-1.5 text-[10px] font-normal text-primary/80">
                          ({pct.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Impressões → Cliques → Page View → Add to Cart → Init Checkout → Compras
          </p>
        </CardContent>
      </Card>

      <DashboardDrillSheet
        open={drillOpen}
        onOpenChange={setDrillOpen}
        metric={drillStage ? "funnel_stage" as DrillMetric : null}
        period={period}
        projectFilter={projectFilter}
        productFilter={productFilter}
        funnelStage={drillStage || undefined}
      />
    </>
  );
}
