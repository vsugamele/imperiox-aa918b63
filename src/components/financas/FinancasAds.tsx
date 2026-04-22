import { useState, useEffect, useMemo } from "react";
import { toLocalDateStr, localDaysAgo } from "@/lib/periodUtils";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Upload, MousePointerClick, Eye, Target, BarChart3, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, AlertTriangle, ShoppingCart, Zap, Activity } from "lucide-react";
import { toast } from "sonner";
import { AdsImportDialog } from "./AdsImportDialog";
import { KpiHeroCard } from "@/components/shared/KpiHeroCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdsSpend {
  id: string;
  project_id: string;
  plataforma: string;
  campanha: string | null;
  conjunto_anuncios?: string | null;
  anuncio?: string | null;
  data_ref: string;
  valor: number;
  impressoes: number;
  alcance?: number;
  cliques: number;
  leads: number;
  compras?: number;
  custo_por_compra?: number;
  checkouts_iniciados?: number;
  hook_rate?: number;
  hold_rate?: number;
  stop_rate?: number;
  ctr?: number;
  cpm?: number;
  cpck?: number;
  frequencia?: number;
  moeda: string;
}

interface VendaItem {
  id: string; project_id: string; produto_nome: string; valor: number;
  plataforma: string; data_venda: string; tipo_produto?: string;
  utm_source?: string; utm_campaign?: string;
}

interface Props {
  ads: AdsSpend[];
  projects: { id: string; name: string }[];
  onRefresh: () => void;
  filterProjectId: string;
  vendas?: VendaItem[];
}

interface CampaignDiag {
  name: string;
  cpa7: number;
  cpa5: number;
  cpa3: number;
  metaCpa: number;
  trend: "MELHORANDO" | "PIORANDO" | "INSTÁVEL";
  gargalo: "ANÚNCIO" | "PÁGINA" | "CHECKOUT" | "TÉCNICO" | "NENHUM";
  manobra: string;
  gasto7: number;
  checkouts: number;
  compras: number;
  lpToCko: number;
  ckoToSale: number;
  landingRate: number;
  freq: number;
  custoCheckout: number;
}

const PAGE_SIZE = 50;

function calcCpa(items: AdsSpend[]): number {
  const gasto = items.reduce((s, a) => s + a.valor, 0);
  const compras = items.reduce((s, a) => s + (a.compras || 0), 0);
  return compras > 0 ? gasto / compras : 0;
}

function analyzeCampaigns(ads: AdsSpend[]): CampaignDiag[] {
  const d7 = localDaysAgo(7);
  const d5 = localDaysAgo(5);
  const d3 = localDaysAgo(3);

  // Normalize campaign name by stripping date prefix [DD/MM] to merge renamed campaigns
  const normCamp = (n: string) => n.replace(/^\[\d{2}\/\d{2}\]\s*/, "").trim() || n;
  const campMap = new Map<string, AdsSpend[]>();
  ads.forEach(a => {
    const name = normCamp(a.campanha || "Sem nome");
    if (!campMap.has(name)) campMap.set(name, []);
    campMap.get(name)!.push(a);
  });

  const results: CampaignDiag[] = [];

  campMap.forEach((items, name) => {
    const items7 = items.filter(a => a.data_ref >= d7);
    const items5 = items.filter(a => a.data_ref >= d5);
    const items3 = items.filter(a => a.data_ref >= d3);

    if (items7.length === 0) return;

    const cpa7 = calcCpa(items7);
    const cpa5 = calcCpa(items5);
    const cpa3 = calcCpa(items3);

    const gasto7 = items7.reduce((s, a) => s + a.valor, 0);
    const compras7 = items7.reduce((s, a) => s + (a.compras || 0), 0);
    const checkouts7 = items7.reduce((s, a) => s + (a.checkouts_iniciados || 0), 0);
    const cliques7 = items7.reduce((s, a) => s + a.cliques, 0);
    const impressoes7 = items7.reduce((s, a) => s + a.impressoes, 0);

    // Meta CPA: average custo_por_compra or fallback
    const metaCpa = compras7 > 0 ? gasto7 / compras7 * 0.8 : cpa7 * 0.8; // 80% do CPA atual como meta

    // Tendência 7/5/3
    let trend: CampaignDiag["trend"] = "INSTÁVEL";
    if (cpa3 > 0 && cpa5 > 0 && cpa7 > 0) {
      if (cpa3 < cpa5 && cpa5 < cpa7) trend = "MELHORANDO";
      else if (cpa3 > cpa5 && cpa5 > cpa7) trend = "PIORANDO";
    }

    // Rates
    const lpToCko = cliques7 > 0 ? (checkouts7 / cliques7) * 100 : 0;
    const ckoToSale = checkouts7 > 0 ? (compras7 / checkouts7) * 100 : 0;
    const landingRate = impressoes7 > 0 ? (cliques7 / impressoes7) * 100 : 0;
    const custoCheckout = checkouts7 > 0 ? gasto7 / checkouts7 : 0;

    // Frequência média
    const freqItems = items7.filter(a => a.frequencia && a.frequencia > 0);
    const freq = freqItems.length > 0 ? freqItems.reduce((s, a) => s + (a.frequencia || 0), 0) / freqItems.length : 0;

    // Gargalo cirúrgico
    let gargalo: CampaignDiag["gargalo"] = "NENHUM";
    if (cpa7 > metaCpa && custoCheckout > metaCpa * 0.5) gargalo = "ANÚNCIO";
    else if (lpToCko < 10 && lpToCko > 0) gargalo = "PÁGINA";
    else if (ckoToSale < 50 && ckoToSale > 0) gargalo = "CHECKOUT";
    else if (landingRate < 85 && landingRate > 0) gargalo = "TÉCNICO";

    // Manobra
    let manobra = "MANUTENÇÃO";
    if (cpa3 > metaCpa * 2) manobra = "PAUSE IMEDIATO";
    else if (trend === "MELHORANDO" && cpa3 < metaCpa) manobra = "ESCALA VERTICAL (+20%)";
    else if (trend === "PIORANDO") manobra = "CORTE / REDUÇÃO -50%";

    results.push({
      name, cpa7, cpa5, cpa3, metaCpa, trend, gargalo, manobra,
      gasto7, checkouts: checkouts7, compras: compras7,
      lpToCko, ckoToSale, landingRate, freq, custoCheckout,
    });
  });

  return results.sort((a, b) => b.gasto7 - a.gasto7);
}

export function FinancasAds({ ads, projects, onRefresh, filterProjectId, vendas = [] }: Props) {
  const [showVendas, setShowVendas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<AdsSpend | null>(null);
  const [form, setForm] = useState({ project_id: "", plataforma: "Facebook", campanha: "", data_ref: "", valor: "", impressoes: "0", cliques: "0", leads: "0" });
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [ads]);

  // === KPIs Globais ===
  const totalGasto = ads.reduce((a, b) => a + b.valor, 0);
  const totalCliques = ads.reduce((a, b) => a + b.cliques, 0);
  const totalLeads = ads.reduce((a, b) => a + b.leads, 0);
  const totalImpr = ads.reduce((a, b) => a + b.impressoes, 0);
  const totalCompras = ads.reduce((a, b) => a + (b.compras || 0), 0);
  const totalCheckouts = ads.reduce((a, b) => a + (b.checkouts_iniciados || 0), 0);
  const avgCTR = ads.length > 0 ? ads.reduce((a, b) => a + (b.ctr || 0), 0) / ads.length : 0;
  const avgHookRate = ads.length > 0 ? ads.reduce((a, b) => a + (b.hook_rate || 0), 0) / ads.length : 0;
  const avgFreq = ads.length > 0 ? ads.filter(a => a.frequencia && a.frequencia > 0).reduce((s, a) => ({ sum: s.sum + (a.frequencia || 0), n: s.n + 1 }), { sum: 0, n: 0 }) : { sum: 0, n: 0 };
  const avgFreqVal = avgFreq.n > 0 ? avgFreq.sum / avgFreq.n : 0;
  const avgCPM = ads.length > 0 ? ads.filter(a => a.cpm && a.cpm > 0).reduce((s, a) => ({ sum: s.sum + (a.cpm || 0), n: s.n + 1 }), { sum: 0, n: 0 }) : { sum: 0, n: 0 };
  const avgCPMVal = avgCPM.n > 0 ? avgCPM.sum / avgCPM.n : 0;

  const cpc = totalCliques > 0 ? totalGasto / totalCliques : 0;
  const cpl = totalLeads > 0 ? totalGasto / totalLeads : 0;
  const cpa = totalCompras > 0 ? totalGasto / totalCompras : 0;
  const custoCheckout = totalCheckouts > 0 ? totalGasto / totalCheckouts : 0;
  const lpToCkoGlobal = totalCliques > 0 ? (totalCheckouts / totalCliques) * 100 : 0;
  const ckoToSaleGlobal = totalCheckouts > 0 ? (totalCompras / totalCheckouts) * 100 : 0;

  // === Diagnóstico Yoshitani por Campanha ===
  const diagnosticos = useMemo(() => analyzeCampaigns(ads), [ads]);

  const totalPages = Math.max(1, Math.ceil(ads.length / PAGE_SIZE));
  const paginatedAds = ads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // === KPI Cards (Yoshitani priority: CPA first, then diagnostic metrics) ===
  const kpis = [
    { label: "CPA (Métrica-Mãe)", value: cpa > 0 ? `R$ ${cpa.toFixed(2)}` : "—", icon: Target, color: "text-red-400" },
    { label: "Custo/Checkout", value: custoCheckout > 0 ? `R$ ${custoCheckout.toFixed(2)}` : "—", icon: ShoppingCart, color: "text-orange-400" },
    { label: "Total Investido", value: `R$ ${totalGasto.toFixed(2)}`, icon: Zap, color: "text-red-400" },
    { label: "Compras", value: totalCompras.toString(), icon: BarChart3, color: "text-emerald-400" },
    { label: "LP → Checkout", value: `${lpToCkoGlobal.toFixed(1)}%`, icon: Activity, color: lpToCkoGlobal < 10 ? "text-red-400" : "text-emerald-400" },
    { label: "Checkout → Venda", value: `${ckoToSaleGlobal.toFixed(1)}%`, icon: Activity, color: ckoToSaleGlobal < 50 ? "text-red-400" : "text-emerald-400" },
    { label: "CPL", value: `R$ ${cpl.toFixed(2)}`, icon: Target, color: "text-amber-400" },
    { label: "CPC", value: `R$ ${cpc.toFixed(2)}`, icon: MousePointerClick, color: "text-blue-400" },
    { label: "CTR Médio", value: `${avgCTR.toFixed(2)}%`, icon: MousePointerClick, color: "text-blue-400" },
    { label: "CPM Médio", value: avgCPMVal > 0 ? `R$ ${avgCPMVal.toFixed(2)}` : "—", icon: Eye, color: "text-muted-foreground" },
    { label: "Frequência", value: avgFreqVal > 0 ? avgFreqVal.toFixed(2) : "—", icon: AlertTriangle, color: avgFreqVal > 3 ? "text-red-400" : "text-muted-foreground" },
    { label: "Hook Rate", value: `${avgHookRate.toFixed(1)}%`, icon: Eye, color: "text-amber-400" },
  ];

  const openNew = () => {
    setEditing(null);
    setForm({ project_id: filterProjectId || "", plataforma: "Facebook", campanha: "", data_ref: toLocalDateStr(), valor: "", impressoes: "0", cliques: "0", leads: "0" });
    setShowForm(true);
  };

  const openEdit = (a: AdsSpend) => {
    setEditing(a);
    setForm({ project_id: a.project_id, plataforma: a.plataforma, campanha: a.campanha || "", data_ref: a.data_ref, valor: String(a.valor), impressoes: String(a.impressoes), cliques: String(a.cliques), leads: String(a.leads) });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.project_id) { toast.error("Selecione um projeto"); return; }
    if (!form.data_ref) { toast.error("Data obrigatória"); return; }
    const payload = {
      project_id: form.project_id,
      plataforma: form.plataforma,
      campanha: form.campanha || null,
      data_ref: form.data_ref,
      valor: parseFloat(form.valor) || 0,
      impressoes: parseInt(form.impressoes) || 0,
      cliques: parseInt(form.cliques) || 0,
      leads: parseInt(form.leads) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("imphq_ads_spend").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Atualizado!");
    } else {
      const { error } = await supabase.from("imphq_ads_spend").insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Gasto adicionado!");
    }
    setShowForm(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_ads_spend").delete().eq("id", id);
    toast.success("Removido");
    onRefresh();
  };

  const getProjectName = (pid: string) => projects.find(p => p.id === pid)?.name || pid;

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "MELHORANDO") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (trend === "PIORANDO") return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-amber-400" />;
  };

  const trendColor = (t: string) => t === "MELHORANDO" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : t === "PIORANDO" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  const gargaloColor = (g: string) => g === "NENHUM" ? "bg-emerald-500/15 text-emerald-400" : g === "ANÚNCIO" ? "bg-red-500/15 text-red-400" : g === "PÁGINA" ? "bg-orange-500/15 text-orange-400" : g === "CHECKOUT" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400";

  return (
    <div className="space-y-6">
      {/* KPI Hero Cards (4 principais com semáforo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiHeroCard
          label="ROAS Real"
          value={totalGasto > 0 && vendas.length > 0 ? vendas.reduce((s, v) => s + v.valor, 0) / totalGasto : 0}
          format="multiplier"
          benchmark={{ good: 2, warn: 1 }}
          tooltip="Receita atribuída ÷ Investimento em ads. ≥2x saudável; <1x está perdendo dinheiro."
          icon={<Zap className="h-3 w-3" />}
        />
        <KpiHeroCard
          label="CPA Médio"
          value={cpa}
          format="currency"
          inverse
          benchmark={{ good: 50, warn: 100 }}
          tooltip="Custo por aquisição: gasto total ÷ compras. Quanto menor, melhor."
          icon={<Target className="h-3 w-3" />}
        />
        <KpiHeroCard
          label="Investido"
          value={totalGasto}
          format="currency"
          tooltip="Total gasto em ads no período filtrado."
          icon={<DollarSign className="h-3 w-3" />}
        />
        <KpiHeroCard
          label="Lucro Ads"
          value={vendas.reduce((s, v) => s + v.valor, 0) - totalGasto}
          format="currency"
          benchmark={{ good: 0, warn: -100 }}
          tooltip="Receita atribuída – gasto em ads. Lucro bruto direto da campanha."
          icon={<BarChart3 className="h-3 w-3" />}
        />
      </div>

      {/* Frequência Alert */}
      {avgFreqVal > 3 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">⚠ Frequência média alta ({avgFreqVal.toFixed(1)}) — risco de saturação de público. Considere novos criativos ou públicos.</span>
        </div>
      )}

      {/* === DIAGNÓSTICO YOSHITANI === */}
      {diagnosticos.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-red-400" />
              ⚔️ Diagnóstico Yoshitani — Tendência 7/5/3
            </CardTitle>
            <p className="text-xs text-muted-foreground">Análise por campanha: CPA, tendência, gargalo cirúrgico e manobra recomendada</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnosticos.slice(0, 10).map((d, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-3 bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Gasto 7d: R$ {d.gasto7.toFixed(2)} · {d.compras} compras · {d.checkouts} checkouts
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={trendColor(d.trend)}>
                      <TrendIcon trend={d.trend} />
                      <span className="ml-1 text-[10px]">{d.trend}</span>
                    </Badge>
                    <Badge variant="outline" className={gargaloColor(d.gargalo)}>
                      <span className="text-[10px]">{d.gargalo}</span>
                    </Badge>
                  </div>
                </div>

                {/* CPA Trend Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">CPA 7d</span>
                    <p className="font-mono font-bold">{d.cpa7 > 0 ? `R$ ${d.cpa7.toFixed(2)}` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">CPA 5d</span>
                    <p className="font-mono font-bold">{d.cpa5 > 0 ? `R$ ${d.cpa5.toFixed(2)}` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">CPA 3d</span>
                    <p className="font-mono font-bold">{d.cpa3 > 0 ? `R$ ${d.cpa3.toFixed(2)}` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">$/Checkout</span>
                    <p className="font-mono font-bold">{d.custoCheckout > 0 ? `R$ ${d.custoCheckout.toFixed(2)}` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">LP→CKO</span>
                    <p className={`font-mono font-bold ${d.lpToCko > 0 && d.lpToCko < 10 ? "text-red-400" : ""}`}>{d.lpToCko > 0 ? `${d.lpToCko.toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">CKO→Venda</span>
                    <p className={`font-mono font-bold ${d.ckoToSale > 0 && d.ckoToSale < 50 ? "text-red-400" : ""}`}>{d.ckoToSale > 0 ? `${d.ckoToSale.toFixed(1)}%` : "—"}</p>
                  </div>
                  <div className="bg-background/50 rounded px-2 py-1.5">
                    <span className="text-muted-foreground">Freq.</span>
                    <p className={`font-mono font-bold ${d.freq > 3 ? "text-red-400" : ""}`}>{d.freq > 0 ? d.freq.toFixed(1) : "—"}</p>
                  </div>
                </div>

                {/* Manobra */}
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
                  {d.gargalo === "ANÚNCIO" && (
                    <span className="text-[10px] text-muted-foreground ml-2">💡 Foco: novos criativos/hooks</span>
                  )}
                  {d.gargalo === "PÁGINA" && (
                    <span className="text-[10px] text-muted-foreground ml-2">💡 Foco: CRO na página de vendas</span>
                  )}
                  {d.gargalo === "CHECKOUT" && (
                    <span className="text-[10px] text-muted-foreground ml-2">💡 Foco: fricção no pagamento</span>
                  )}
                  {d.gargalo === "TÉCNICO" && (
                    <span className="text-[10px] text-muted-foreground ml-2">💡 Foco: velocidade/promessa</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vendas que geraram receita */}
      {vendas.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowVendas(!showVendas)}>
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-400" />
                💰 Vendas no período — R$ {vendas.reduce((s, v) => s + v.valor, 0).toFixed(2)} ({vendas.length} vendas)
              </span>
              <span className="text-xs text-muted-foreground">{showVendas ? "▲ Recolher" : "▼ Expandir"}</span>
            </CardTitle>
          </CardHeader>
          {showVendas && (
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>UTM Source</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.slice(0, 100).map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-medium">{v.produto_nome}</TableCell>
                        <TableCell className="text-[10px]">
                          <Badge variant="outline" className="text-[9px]">{v.tipo_produto || "principal"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{v.plataforma}</TableCell>
                        <TableCell className="font-mono text-emerald-400 text-xs">R$ {v.valor.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.utm_source || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{v.data_venda ? toLocalDateStr(new Date(v.data_venda)) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {vendas.length > 100 && <p className="text-[10px] text-muted-foreground mt-1">Mostrando 100 de {vendas.length}</p>}
            </CardContent>
          )}
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Gasto</Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>CPA</TableHead>
              <TableHead>CKOs</TableHead>
              <TableHead>Compras</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>CPM</TableHead>
              <TableHead>Freq.</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead className="w-[70px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAds.map(a => {
              const rowCpa = (a.compras && a.compras > 0) ? a.valor / a.compras : (a.custo_por_compra || 0);
              return (
                <TableRow key={a.id} className="group hover:bg-muted/30">
                  <TableCell className="text-xs">{getProjectName(a.project_id)}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{a.campanha || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{a.data_ref}</TableCell>
                  <TableCell className="font-mono text-red-400 text-xs">R$ {a.valor.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-xs">{rowCpa > 0 ? `R$ ${rowCpa.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.checkouts_iniciados || 0}</TableCell>
                  <TableCell className="font-mono text-xs">{a.compras || 0}</TableCell>
                  <TableCell className="font-mono text-xs">{(a.ctr || 0).toFixed(2)}%</TableCell>
                  <TableCell className="font-mono text-xs">{a.cpm ? `R$ ${Number(a.cpm).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className={`font-mono text-xs ${(a.frequencia || 0) > 3 ? "text-red-400 font-bold" : ""}`}>{a.frequencia ? Number(a.frequencia).toFixed(1) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{(a.hook_rate || 0).toFixed(1)}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {ads.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                <div className="space-y-2">
                  <p>Nenhum dado de Ads disponível</p>
                  <p className="text-[11px]">Importe um CSV ou conecte a API do Facebook para importação automática.</p>
                </div>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">{ads.length} registros · Página {page + 1} de {totalPages}</p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Gasto" : "Novo Gasto de Ads"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={form.data_ref} onChange={e => setForm({ ...form, data_ref: e.target.value })} /></div>
            </div>
            <div><Label>Campanha</Label><Input value={form.campanha} onChange={e => setForm({ ...form, campanha: e.target.value })} placeholder="Nome da campanha" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Impressões</Label><Input type="number" value={form.impressoes} onChange={e => setForm({ ...form, impressoes: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliques</Label><Input type="number" value={form.cliques} onChange={e => setForm({ ...form, cliques: e.target.value })} /></div>
              <div><Label>Leads</Label><Input type="number" value={form.leads} onChange={e => setForm({ ...form, leads: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AdsImportDialog open={showImport} onOpenChange={setShowImport} projects={projects} onImported={onRefresh} />
    </div>
  );
}
