import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Target, ShoppingCart, MousePointerClick, Eye, AlertTriangle,
  Activity, Zap, TrendingUp, TrendingDown, Minus, Globe, Timer
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { getPeriodRange } from "@/lib/periodUtils";
import { localDaysAgo } from "@/lib/periodUtils";

interface AdsGlobal {
  gasto: number;
  cpl: number;
  cpc: number;
  cpa: number;
  cpm: number;
  compras: number;
  checkouts: number;
  cliques: number;
  impressoes: number;
  alcance: number;
  freq: number;
  hookRate: number;
  roasReal: number;
  receitaReal: number;
  vendasReais: number;
  lpToCko: number;
  ckoToSale: number;
  custoCheckout: number;
  topCampanhas: any[];
  adsByProject: any[];
  freqAlerts: string[];
  diagnosticos: CampaignDiag[];
}

interface CampaignDiag {
  name: string;
  cpa7: number;
  cpa5: number;
  cpa3: number;
  trend: "MELHORANDO" | "PIORANDO" | "INSTÁVEL";
  gargalo: "ANÚNCIO" | "PÁGINA" | "CHECKOUT" | "TÉCNICO" | "NENHUM";
  manobra: string;
  gasto7: number;
  checkouts: number;
  compras: number;
  lpToCko: number;
  ckoToSale: number;
  freq: number;
  custoCheckout: number;
}

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  allProjects: any[];
}

function calcCpa(items: any[]): number {
  const gasto = items.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
  const compras = items.reduce((s: number, a: any) => s + (a.compras || 0), 0);
  return compras > 0 ? gasto / compras : 0;
}

export default function DashboardAds({ period, projectFilter, productFilter, allProjects }: Props) {
  const [adsGlobal, setAdsGlobal] = useState<AdsGlobal>({
    gasto: 0, cpl: 0, cpc: 0, cpa: 0, cpm: 0, compras: 0, checkouts: 0,
    cliques: 0, impressoes: 0, alcance: 0, freq: 0, hookRate: 0,
    roasReal: 0, receitaReal: 0, vendasReais: 0,
    lpToCko: 0, ckoToSale: 0, custoCheckout: 0,
    topCampanhas: [], adsByProject: [], freqAlerts: [], diagnosticos: [],
  });

  useEffect(() => {
    async function load() {
      const { from } = getPeriodRange(period);
      const since = from.split("T")[0];

      // Parallel fetch: ads + vendas reais
      const [adsRes, vendasRes] = await Promise.all([
        supabase.from("imphq_ads_spend").select("*").gte("data_ref", since),
        supabase.from("imphq_vendas").select("valor, produto_nome, project_id").gte("created_at", from).eq("status", "aprovado"),
      ]);

      const projMap = new Map((allProjects || []).map((p: any) => [p.id, p]));
      let items = (adsRes.data || []) as any[];
      if (projectFilter !== "all") items = items.filter((a: any) => a.project_id === projectFilter);

      let vendas = (vendasRes.data || []) as any[];
      if (projectFilter !== "all") vendas = vendas.filter((v: any) => v.project_id === projectFilter);
      if (productFilter && productFilter !== "all") vendas = vendas.filter((v: any) => v.produto_nome === productFilter);

      const gasto = items.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
      const leads = items.reduce((s: number, a: any) => s + (a.leads || 0), 0);
      const compras = items.reduce((s: number, a: any) => s + (a.compras || 0), 0);
      const checkouts = items.reduce((s: number, a: any) => s + (a.checkouts_iniciados || 0), 0);
      const cliques = items.reduce((s: number, a: any) => s + (a.cliques || 0), 0);
      const impressoes = items.reduce((s: number, a: any) => s + (a.impressoes || 0), 0);
      const alcance = items.reduce((s: number, a: any) => s + (a.alcance || 0), 0);

      // Avg frequency
      const freqItems = items.filter((a: any) => a.frequencia && a.frequencia > 0);
      const freq = freqItems.length > 0 ? freqItems.reduce((s: number, a: any) => s + parseFloat(a.frequencia), 0) / freqItems.length : 0;

      // Avg hook rate
      const hookItems = items.filter((a: any) => a.hook_rate && a.hook_rate > 0);
      const hookRate = hookItems.length > 0 ? hookItems.reduce((s: number, a: any) => s + parseFloat(a.hook_rate), 0) / hookItems.length : 0;

      // CPM médio
      const cpmItems = items.filter((a: any) => a.cpm && a.cpm > 0);
      const cpm = cpmItems.length > 0 ? cpmItems.reduce((s: number, a: any) => s + parseFloat(a.cpm), 0) / cpmItems.length : (impressoes > 0 ? (gasto / impressoes) * 1000 : 0);

      // Vendas reais
      const receitaReal = vendas.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
      const vendasReais = vendas.length;
      const roasReal = gasto > 0 ? receitaReal / gasto : 0;

      // Rates
      const lpToCko = cliques > 0 ? (checkouts / cliques) * 100 : 0;
      const ckoToSale = checkouts > 0 ? (compras / checkouts) * 100 : 0;
      const custoCheckout = checkouts > 0 ? gasto / checkouts : 0;

      // Top campanhas
      const campMap = new Map<string, { gasto: number; ctr: number; compras: number; checkouts: number; cliques: number; impressoes: number; count: number }>();
      items.forEach((a: any) => {
        const name = a.campanha || "Sem nome";
        const prev = campMap.get(name) || { gasto: 0, ctr: 0, compras: 0, checkouts: 0, cliques: 0, impressoes: 0, count: 0 };
        campMap.set(name, {
          gasto: prev.gasto + (parseFloat(a.valor) || 0),
          ctr: prev.ctr + (parseFloat(a.ctr) || 0),
          compras: prev.compras + (a.compras || 0),
          checkouts: prev.checkouts + (a.checkouts_iniciados || 0),
          cliques: prev.cliques + (a.cliques || 0),
          impressoes: prev.impressoes + (a.impressoes || 0),
          count: prev.count + 1,
        });
      });
      const topCampanhas = Array.from(campMap.entries()).map(([name, v]) => ({
        name,
        gasto: v.gasto,
        ctr: v.count > 0 ? v.ctr / v.count : 0,
        compras: v.compras,
        checkouts: v.checkouts,
        cpa: v.compras > 0 ? v.gasto / v.compras : 0,
      })).sort((a, b) => b.gasto - a.gasto).slice(0, 5);

      // Ads by project
      const projAds = new Map<string, number>();
      items.forEach((a: any) => { projAds.set(a.project_id, (projAds.get(a.project_id) || 0) + (parseFloat(a.valor) || 0)); });
      const adsByProject = Array.from(projAds.entries()).map(([pid, val]) => {
        const p = projMap.get(pid);
        return { name: p ? `${p.icon || "📁"} ${p.name}` : pid?.slice(0, 8) || "?", value: val };
      }).sort((a, b) => b.value - a.value).slice(0, 5);

      // Frequency alerts
      const sevenAgo = localDaysAgo(7);
      const recentAds = items.filter((a: any) => a.data_ref >= sevenAgo);
      const freqAlerts: string[] = [];
      const freqCamp = new Map<string, { freq: number; count: number }>();
      recentAds.forEach((a: any) => {
        if (a.frequencia > 0 && a.campanha) {
          const prev = freqCamp.get(a.campanha) || { freq: 0, count: 0 };
          freqCamp.set(a.campanha, { freq: prev.freq + parseFloat(a.frequencia), count: prev.count + 1 });
        }
      });
      freqCamp.forEach((v, name) => {
        const avg = v.freq / v.count;
        if (avg > 3) freqAlerts.push(`⚠ "${name.slice(0, 40)}" com frequência alta (${avg.toFixed(1)}) — risco de saturação`);
      });

      // === Yoshitani 7/5/3 Diagnostic ===
      const d7 = localDaysAgo(7);
      const d5 = localDaysAgo(5);
      const d3 = localDaysAgo(3);

      const diagCampMap = new Map<string, any[]>();
      items.forEach((a: any) => {
        const name = a.campanha || "Sem nome";
        if (!diagCampMap.has(name)) diagCampMap.set(name, []);
        diagCampMap.get(name)!.push(a);
      });

      const diagnosticos: CampaignDiag[] = [];
      diagCampMap.forEach((campItems, name) => {
        const items7 = campItems.filter((a: any) => a.data_ref >= d7);
        const items5 = campItems.filter((a: any) => a.data_ref >= d5);
        const items3 = campItems.filter((a: any) => a.data_ref >= d3);
        if (items7.length === 0) return;

        const cpa7 = calcCpa(items7);
        const cpa5 = calcCpa(items5);
        const cpa3 = calcCpa(items3);
        const gasto7 = items7.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
        const compras7 = items7.reduce((s: number, a: any) => s + (a.compras || 0), 0);
        const checkouts7 = items7.reduce((s: number, a: any) => s + (a.checkouts_iniciados || 0), 0);
        const cliques7 = items7.reduce((s: number, a: any) => s + (a.cliques || 0), 0);
        const impressoes7 = items7.reduce((s: number, a: any) => s + (a.impressoes || 0), 0);

        const dLpToCko = cliques7 > 0 ? (checkouts7 / cliques7) * 100 : 0;
        const dCkoToSale = checkouts7 > 0 ? (compras7 / checkouts7) * 100 : 0;
        const dCustoCheckout = checkouts7 > 0 ? gasto7 / checkouts7 : 0;
        const landingRate = impressoes7 > 0 ? (cliques7 / impressoes7) * 100 : 0;

        const dFreqItems = items7.filter((a: any) => a.frequencia && a.frequencia > 0);
        const dFreq = dFreqItems.length > 0 ? dFreqItems.reduce((s: number, a: any) => s + parseFloat(a.frequencia), 0) / dFreqItems.length : 0;

        let trend: CampaignDiag["trend"] = "INSTÁVEL";
        if (cpa3 > 0 && cpa5 > 0 && cpa7 > 0) {
          if (cpa3 < cpa5 && cpa5 < cpa7) trend = "MELHORANDO";
          else if (cpa3 > cpa5 && cpa5 > cpa7) trend = "PIORANDO";
        }

        const metaCpa = compras7 > 0 ? gasto7 / compras7 * 0.8 : cpa7 * 0.8;
        let gargalo: CampaignDiag["gargalo"] = "NENHUM";
        if (cpa7 > metaCpa && dCustoCheckout > metaCpa * 0.5) gargalo = "ANÚNCIO";
        else if (dLpToCko < 10 && dLpToCko > 0) gargalo = "PÁGINA";
        else if (dCkoToSale < 50 && dCkoToSale > 0) gargalo = "CHECKOUT";
        else if (landingRate < 85 && landingRate > 0) gargalo = "TÉCNICO";

        let manobra = "MANUTENÇÃO";
        if (cpa3 > metaCpa * 2) manobra = "PAUSE IMEDIATO";
        else if (trend === "MELHORANDO" && cpa3 < metaCpa) manobra = "ESCALA +20%";
        else if (trend === "PIORANDO") manobra = "CORTE -50%";

        diagnosticos.push({
          name, cpa7, cpa5, cpa3, trend, gargalo, manobra,
          gasto7, checkouts: checkouts7, compras: compras7,
          lpToCko: dLpToCko, ckoToSale: dCkoToSale, freq: dFreq, custoCheckout: dCustoCheckout,
        });
      });

      diagnosticos.sort((a, b) => b.gasto7 - a.gasto7);

      setAdsGlobal({
        gasto, cpl: leads > 0 ? gasto / leads : 0,
        cpc: cliques > 0 ? gasto / cliques : 0,
        cpa: compras > 0 ? gasto / compras : 0,
        cpm, compras, checkouts, cliques, impressoes, alcance, freq, hookRate,
        roasReal, receitaReal, vendasReais,
        lpToCko, ckoToSale, custoCheckout,
        topCampanhas, adsByProject, freqAlerts, diagnosticos,
      });
    }
    load();
  }, [period, projectFilter, productFilter, allProjects]);

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "MELHORANDO") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend === "PIORANDO") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-amber-400" />;
  };

  const trendColor = (t: string) => t === "MELHORANDO" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : t === "PIORANDO" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  const gargaloColor = (g: string) => g === "NENHUM" ? "bg-emerald-500/15 text-emerald-400" : g === "ANÚNCIO" ? "bg-red-500/15 text-red-400" : g === "PÁGINA" ? "bg-orange-500/15 text-orange-400" : g === "CHECKOUT" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400";

  // KPI cards — Yoshitani priority (CPA first, diagnostic metrics, then vanity)
  const kpis = [
    { label: "CPA (Métrica-Mãe)", value: adsGlobal.cpa > 0 ? `R$ ${adsGlobal.cpa.toFixed(2)}` : "—", icon: Target, color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
    { label: "Custo/Checkout", value: adsGlobal.custoCheckout > 0 ? `R$ ${adsGlobal.custoCheckout.toFixed(2)}` : "—", icon: ShoppingCart, color: "text-orange-400", bg: "from-orange-500/15 to-orange-500/5" },
    { label: "ROAS Real", value: adsGlobal.roasReal > 0 ? `${adsGlobal.roasReal.toFixed(2)}x` : "—", icon: TrendingUp, color: adsGlobal.roasReal >= 2 ? "text-emerald-400" : "text-amber-400", bg: adsGlobal.roasReal >= 2 ? "from-emerald-500/15 to-emerald-500/5" : "from-amber-500/15 to-amber-500/5" },
    { label: "Investido", value: `R$ ${adsGlobal.gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Zap, color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
    { label: "Receita Vendas", value: `R$ ${adsGlobal.receitaReal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Megaphone, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
    { label: "Vendas Reais", value: String(adsGlobal.vendasReais), icon: ShoppingCart, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
    { label: "Compras (Pixel)", value: String(adsGlobal.compras), icon: ShoppingCart, color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5" },
    { label: "Init. Checkout", value: String(adsGlobal.checkouts), icon: Activity, color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5" },
    { label: "LP → Checkout", value: `${adsGlobal.lpToCko.toFixed(1)}%`, icon: Activity, color: adsGlobal.lpToCko > 0 && adsGlobal.lpToCko < 10 ? "text-red-400" : "text-emerald-400", bg: adsGlobal.lpToCko > 0 && adsGlobal.lpToCko < 10 ? "from-red-500/15 to-red-500/5" : "from-emerald-500/15 to-emerald-500/5" },
    { label: "Checkout → Venda", value: `${adsGlobal.ckoToSale.toFixed(1)}%`, icon: Activity, color: adsGlobal.ckoToSale > 0 && adsGlobal.ckoToSale < 50 ? "text-red-400" : "text-emerald-400", bg: adsGlobal.ckoToSale > 0 && adsGlobal.ckoToSale < 50 ? "from-red-500/15 to-red-500/5" : "from-emerald-500/15 to-emerald-500/5" },
    { label: "CPL", value: adsGlobal.cpl > 0 ? `R$ ${adsGlobal.cpl.toFixed(2)}` : "—", icon: Target, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5" },
    { label: "CPC", value: adsGlobal.cpc > 0 ? `R$ ${adsGlobal.cpc.toFixed(2)}` : "—", icon: MousePointerClick, color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5" },
    { label: "CPM Médio", value: adsGlobal.cpm > 0 ? `R$ ${adsGlobal.cpm.toFixed(2)}` : "—", icon: Eye, color: "text-muted-foreground", bg: "from-muted/15 to-muted/5" },
    { label: "Alcance Total", value: adsGlobal.alcance > 0 ? adsGlobal.alcance.toLocaleString("pt-BR") : "—", icon: Globe, color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5" },
    { label: "Frequência", value: adsGlobal.freq > 0 ? adsGlobal.freq.toFixed(2) : "—", icon: AlertTriangle, color: adsGlobal.freq > 3 ? "text-red-400" : "text-muted-foreground", bg: adsGlobal.freq > 3 ? "from-red-500/15 to-red-500/5" : "from-muted/15 to-muted/5" },
    { label: "Hook Rate", value: adsGlobal.hookRate > 0 ? `${adsGlobal.hookRate.toFixed(1)}%` : "—", icon: Eye, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5" },
  ];

  if (adsGlobal.gasto === 0 && adsGlobal.diagnosticos.length === 0) return null;

  return (
    <>
      {/* Frequency Alerts */}
      {adsGlobal.freqAlerts.length > 0 && adsGlobal.freqAlerts.map((a, i) => (
        <div key={`freq-${i}`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">{a}</span>
        </div>
      ))}

      {/* === KPI Grid — Yoshitani Priority === */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-blue-400" /> Investimento em Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {kpis.map(k => (
              <div key={k.label} className={`rounded-lg border border-border bg-gradient-to-br ${k.bg} p-3`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <k.icon className={`h-3.5 w-3.5 shrink-0 ${k.color}`} />
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">{k.label}</p>
                </div>
                <p className={`text-sm font-mono font-bold ${k.color} truncate`}>{k.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* === Yoshitani 7/5/3 Diagnostic Summary === */}
      {adsGlobal.diagnosticos.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-red-400" />
              ⚔️ Diagnóstico Yoshitani — Tendência 7/5/3
            </CardTitle>
            <p className="text-xs text-muted-foreground">CPA, tendência, gargalo cirúrgico e manobra por campanha</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {adsGlobal.diagnosticos.slice(0, 5).map((d, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Gasto 7d: R$ {d.gasto7.toFixed(2)} · {d.compras} compras · {d.checkouts} checkouts
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={trendColor(d.trend)}>
                      <TrendIcon trend={d.trend} />
                      <span className="ml-1 text-[10px]">{d.trend}</span>
                    </Badge>
                    <Badge variant="outline" className={gargaloColor(d.gargalo)}>
                      <span className="text-[10px]">{d.gargalo}</span>
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 text-[11px]">
                  {[
                    { label: "CPA 7d", val: d.cpa7 > 0 ? `R$ ${d.cpa7.toFixed(2)}` : "—" },
                    { label: "CPA 5d", val: d.cpa5 > 0 ? `R$ ${d.cpa5.toFixed(2)}` : "—" },
                    { label: "CPA 3d", val: d.cpa3 > 0 ? `R$ ${d.cpa3.toFixed(2)}` : "—" },
                    { label: "$/Checkout", val: d.custoCheckout > 0 ? `R$ ${d.custoCheckout.toFixed(2)}` : "—" },
                    { label: "LP→CKO", val: d.lpToCko > 0 ? `${d.lpToCko.toFixed(1)}%` : "—", warn: d.lpToCko > 0 && d.lpToCko < 10 },
                    { label: "CKO→Venda", val: d.ckoToSale > 0 ? `${d.ckoToSale.toFixed(1)}%` : "—", warn: d.ckoToSale > 0 && d.ckoToSale < 50 },
                    { label: "Freq.", val: d.freq > 0 ? d.freq.toFixed(1) : "—", warn: d.freq > 3 },
                  ].map(m => (
                    <div key={m.label} className="bg-background/50 rounded px-2 py-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <p className={`font-mono font-bold ${(m as any).warn ? "text-red-400" : ""}`}>{m.val}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">MANOBRA:</span>
                  <Badge variant="outline" className={
                    d.manobra.includes("ESCALA") ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                    d.manobra.includes("PAUSE") ? "bg-red-500/15 text-red-400 border-red-500/30" :
                    d.manobra.includes("CORTE") ? "bg-orange-500/15 text-orange-400 border-orange-500/30" :
                    "bg-secondary text-muted-foreground"
                  }>
                    <span className="text-[10px]">{d.manobra}</span>
                  </Badge>
                  {d.gargalo === "ANÚNCIO" && <span className="text-[10px] text-muted-foreground">💡 Novos criativos/hooks</span>}
                  {d.gargalo === "PÁGINA" && <span className="text-[10px] text-muted-foreground">💡 CRO na página</span>}
                  {d.gargalo === "CHECKOUT" && <span className="text-[10px] text-muted-foreground">💡 Fricção no pagamento</span>}
                  {d.gargalo === "TÉCNICO" && <span className="text-[10px] text-muted-foreground">💡 Velocidade/promessa</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ads by Project + Top Campaigns */}
      {(adsGlobal.adsByProject.length > 0 || adsGlobal.topCampanhas.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {adsGlobal.adsByProject.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-blue-400" /> Gasto Ads por Projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={adsGlobal.adsByProject} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} name="Gasto" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {adsGlobal.topCampanhas.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" /> Top Campanhas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {adsGlobal.topCampanhas.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        CTR: {c.ctr.toFixed(2)}% · {c.compras} compras · {c.checkouts} CKOs
                        {c.cpa > 0 && ` · CPA: R$ ${c.cpa.toFixed(2)}`}
                      </p>
                    </div>
                    <span className="text-sm font-mono font-bold text-blue-400 shrink-0 ml-2">R$ {c.gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
