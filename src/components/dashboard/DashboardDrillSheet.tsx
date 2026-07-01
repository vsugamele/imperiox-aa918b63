import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { ExternalLink, ShoppingCart, Users, DollarSign, TrendingUp, Wallet, Target, Megaphone, Activity, Zap, Clock, MessageCircle, RefreshCw } from "lucide-react";
import { getPeriodRange } from "@/lib/periodUtils";
import { toast } from "sonner";
import { countryFlag, countryName } from "@/lib/countryFlag";


export type DrillMetric =
  | "revenue"
  | "profit"
  | "roas"
  | "cost"
  | "sales"
  | "leads"
  | "ads_spend"
  | "ads_cpa"
  | "ads_checkout_cost"
  | "ads_purchases"
  | "campaign"
  | "pix_pending"
  | "funnel_stage"
  | "product"
  | "project_revenue"
  | "day_revenue";

export type FunnelStage = "leads" | "checkout" | "pix" | "approved" | "lost";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metric: DrillMetric | null;
  period: string;
  projectFilter: string;
  productFilter?: string;
  campaignName?: string;
  funnelStage?: FunnelStage;
  productName?: string;
  projectId?: string;
  dayKey?: string; // YYYY-MM-DD
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const titleMap: Record<DrillMetric, { title: string; desc: string; icon: any }> = {
  revenue: { title: "Receita do período", desc: "Vendas aprovadas detalhadas", icon: TrendingUp },
  profit: { title: "Lucro do período", desc: "Receita − Custos (Ads + Operacional)", icon: Wallet },
  roas: { title: "ROAS Real", desc: "Campanhas que compõem o ROAS", icon: Target },
  cost: { title: "Custo Total", desc: "Investimento em Ads e custos operacionais", icon: DollarSign },
  sales: { title: "Vendas detalhadas", desc: "Lista das vendas aprovadas", icon: ShoppingCart },
  leads: { title: "Leads recentes", desc: "Últimos leads capturados no período", icon: Users },
  ads_spend: { title: "Investimento em Ads", desc: "Campanhas por contribuição", icon: Zap },
  ads_cpa: { title: "CPA por campanha", desc: "Custo por aquisição detalhado", icon: Target },
  ads_checkout_cost: { title: "Custo por Checkout", desc: "Detalhamento por campanha", icon: ShoppingCart },
  ads_purchases: { title: "Compras (Pixel)", desc: "Compras atribuídas pelo Pixel", icon: ShoppingCart },
  campaign: { title: "Detalhe da campanha", desc: "Adsets, criativos e métricas", icon: Megaphone },
  pix_pending: { title: "PIX / Boleto pendentes", desc: "Pagamentos em pipeline aguardando confirmação", icon: Clock },
  funnel_stage: { title: "Etapa do funil", desc: "Leads / vendas que compõem esta etapa", icon: Activity },
  product: { title: "Detalhe do produto", desc: "Vendas e leads relacionados", icon: ShoppingCart },
  project_revenue: { title: "Receita do projeto", desc: "Vendas do projeto no período", icon: TrendingUp },
  day_revenue: { title: "Receita do dia", desc: "Vendas detalhadas do dia selecionado", icon: TrendingUp },
};

export default function DashboardDrillSheet({
  open,
  onOpenChange,
  metric,
  period,
  projectFilter,
  productFilter,
  campaignName,
  funnelStage,
  productName,
  projectId,
  dayKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [custos, setCustos] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<{ revenue: number; ads: number; op: number } | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<{ adsets: any[]; criativos: any[]; vendasUtm: any[] } | null>(null);
  const [pixPending, setPixPending] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  async function reprocessPix(vendaId: string) {
    const { error } = await supabase.from("imphq_vendas").update({ status: "aprovado" }).eq("id", vendaId);
    if (error) toast.error("Erro ao aprovar manualmente");
    else { toast.success("Marcado como aprovado"); setReloadKey(k => k + 1); }
  }

  useEffect(() => {
    if (!open || !metric) return;

    async function load() {
      setLoading(true);
      const { from, to } = getPeriodRange(period);
      const fromDate = from.split("T")[0];
      const toDate = to.split("T")[0];

      try {
        if (metric === "revenue" || metric === "sales") {
          let q: any = supabase
            .from("imphq_vendas")
            .select("id, produto_nome, valor, plataforma, data_venda, status, tipo_venda, lead_id, pais")
            .gte("data_venda", from)
            .lte("data_venda", to)
            .in("status", ["aprovado", "approved", "paid", "completed"])
            .order("data_venda", { ascending: false })
            .limit(200);
          if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
          if (productFilter && productFilter !== "all") q = q.eq("produto_nome", productFilter);
          const { data } = await q;
          setVendas(data || []);
        } else if (metric === "leads") {
          let q: any = supabase
            .from("imphq_leads")
            .select("id, nome, email, phone, status, score, plataforma, criado_em")
            .gte("criado_em", from)
            .lte("criado_em", to)
            .order("criado_em", { ascending: false })
            .limit(100);
          if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
          const { data } = await q;
          setLeads(data || []);
        } else if (metric === "profit" || metric === "cost") {
          let vendasQ: any = supabase
            .from("imphq_vendas")
            .select("valor")
            .gte("data_venda", from)
            .lte("data_venda", to)
            .in("status", ["aprovado", "approved", "paid", "completed"]);
          let adsQ: any = supabase
            .from("imphq_ads_spend")
            .select("valor, moeda, campanha")
            .gte("data_ref", fromDate)
            .lte("data_ref", toDate);
           let custosQ: any = supabase
            .from("imphq_project_costs")
            .select("nome, valor, moeda, categoria, data_pagamento")
            .gte("data_pagamento", fromDate)
            .lte("data_pagamento", toDate)
            .order("data_pagamento", { ascending: false });
          if (projectFilter !== "all") {
            vendasQ = vendasQ.eq("project_id", projectFilter);
            adsQ = adsQ.eq("project_id", projectFilter);
            custosQ = custosQ.eq("project_id", projectFilter);
          }
          if (productFilter && productFilter !== "all") vendasQ = vendasQ.eq("produto_nome", productFilter);

          const [vRes, aRes, cRes]: any = await Promise.all([vendasQ, adsQ, custosQ]);
          const sumCur = (rows: any[]) =>
            (rows || []).reduce((acc, r) => {
              const v = parseFloat(r.valor) || 0;
              return acc + (r.moeda === "USD" ? v * 5.2 : v);
            }, 0);
          const revenue = (vRes.data || []).reduce((a: number, v: any) => a + (parseFloat(v.valor) || 0), 0);
          const ads = sumCur(aRes.data || []);
          const op = sumCur(cRes.data || []);
          setBreakdown({ revenue, ads, op });
          
          const mappedCustos = (cRes.data || []).map((c: any) => ({
            ...c,
            descricao: c.nome,
            data: c.data_pagamento,
          }));
          setCustos(mappedCustos);
          // also aggregate ads by campaign for cost view
          const map = new Map<string, number>();
          (aRes.data || []).forEach((r: any) => {
            const v = parseFloat(r.valor) || 0;
            const real = r.moeda === "USD" ? v * 5.2 : v;
            const k = r.campanha || "Sem nome";
            map.set(k, (map.get(k) || 0) + real);
          });
          setCampanhas(
            Array.from(map.entries())
              .map(([name, gasto]) => ({ name, gasto }))
              .sort((a, b) => b.gasto - a.gasto)
              .slice(0, 30),
          );
        } else if (metric === "roas" || metric === "ads_spend" || metric === "ads_cpa" || metric === "ads_checkout_cost" || metric === "ads_purchases") {
          let adsQ: any = supabase
            .from("imphq_ads_spend")
            .select("valor, moeda, campanha, compras, checkouts_iniciados, cliques, impressoes")
            .gte("data_ref", fromDate)
            .lte("data_ref", toDate);
          let vendasQ: any = supabase
            .from("imphq_vendas")
            .select("valor, produto_nome")
            .gte("data_venda", from)
            .lte("data_venda", to)
            .in("status", ["aprovado", "approved", "paid", "completed"]);
          if (projectFilter !== "all") {
            adsQ = adsQ.eq("project_id", projectFilter);
            vendasQ = vendasQ.eq("project_id", projectFilter);
          }
          if (productFilter && productFilter !== "all") vendasQ = vendasQ.eq("produto_nome", productFilter);
          const [aRes, vRes]: any = await Promise.all([adsQ, vendasQ]);
          const totalRevenue = (vRes.data || []).reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);

          const map = new Map<string, { gasto: number; compras: number; checkouts: number; cliques: number; impressoes: number }>();
          (aRes.data || []).forEach((r: any) => {
            const v = parseFloat(r.valor) || 0;
            const real = r.moeda === "USD" ? v * 5.2 : v;
            const k = r.campanha || "Sem nome";
            const prev = map.get(k) || { gasto: 0, compras: 0, checkouts: 0, cliques: 0, impressoes: 0 };
            map.set(k, {
              gasto: prev.gasto + real,
              compras: prev.compras + (r.compras || 0),
              checkouts: prev.checkouts + (r.checkouts_iniciados || 0),
              cliques: prev.cliques + (r.cliques || 0),
              impressoes: prev.impressoes + (r.impressoes || 0),
            });
          });
          const totalGasto = Array.from(map.values()).reduce((s, c) => s + c.gasto, 0);
          const list = Array.from(map.entries()).map(([name, c]) => {
            const share = totalGasto > 0 ? c.gasto / totalGasto : 0;
            const receitaAtribuida = totalRevenue * share;
            return {
              name,
              ...c,
              cpa: c.compras > 0 ? c.gasto / c.compras : 0,
              custoCheckout: c.checkouts > 0 ? c.gasto / c.checkouts : 0,
              receitaAtribuida,
              roas: c.gasto > 0 ? receitaAtribuida / c.gasto : 0,
            };
          });
          // sort by relevant metric
          if (metric === "ads_cpa") list.sort((a, b) => b.cpa - a.cpa);
          else if (metric === "ads_checkout_cost") list.sort((a, b) => b.custoCheckout - a.custoCheckout);
          else if (metric === "ads_purchases") list.sort((a, b) => b.compras - a.compras);
          else if (metric === "roas") list.sort((a, b) => b.roas - a.roas);
          else list.sort((a, b) => b.gasto - a.gasto);
          setCampanhas(list.slice(0, 50));
        } else if (metric === "campaign" && campaignName) {
          let q: any = supabase
            .from("imphq_ads_spend")
            .select("data_ref, valor, moeda, adset, criativo, cliques, impressoes, compras, checkouts_iniciados, ctr, frequencia")
            .eq("campanha", campaignName)
            .gte("data_ref", fromDate)
            .lte("data_ref", toDate);
          if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
          const { data: rows } = await q;

          // adsets
          const adsetMap = new Map<string, { gasto: number; compras: number; checkouts: number }>();
          const criativoMap = new Map<string, { gasto: number; compras: number; ctr: number; n: number }>();
          (rows || []).forEach((r: any) => {
            const v = parseFloat(r.valor) || 0;
            const real = r.moeda === "USD" ? v * 5.2 : v;
            const ak = r.adset || "—";
            const ck = r.criativo || "—";
            const ap = adsetMap.get(ak) || { gasto: 0, compras: 0, checkouts: 0 };
            adsetMap.set(ak, { gasto: ap.gasto + real, compras: ap.compras + (r.compras || 0), checkouts: ap.checkouts + (r.checkouts_iniciados || 0) });
            const cp = criativoMap.get(ck) || { gasto: 0, compras: 0, ctr: 0, n: 0 };
            criativoMap.set(ck, { gasto: cp.gasto + real, compras: cp.compras + (r.compras || 0), ctr: cp.ctr + (parseFloat(r.ctr) || 0), n: cp.n + 1 });
          });

          // vendas via UTM utm_campaign matching campaign name
          let vQ: any = supabase
            .from("imphq_vendas")
            .select("id, produto_nome, valor, data_venda, plataforma, data")
            .gte("data_venda", from)
            .lte("data_venda", to)
            .in("status", ["aprovado", "approved", "paid", "completed"]);
          if (projectFilter !== "all") vQ = vQ.eq("project_id", projectFilter);
          const { data: vendasRaw } = await vQ;
          const vendasUtm = (vendasRaw || []).filter((v: any) => {
            const utms = v?.data?.utms || {};
            const cmp = (utms.utm_campaign || "").toString();
            return cmp && (cmp === campaignName || cmp.includes(campaignName) || campaignName.includes(cmp));
          });

          setCampaignDetail({
            adsets: Array.from(adsetMap.entries()).map(([name, c]) => ({ name, ...c })).sort((a, b) => b.gasto - a.gasto),
            criativos: Array.from(criativoMap.entries()).map(([name, c]) => ({ name, gasto: c.gasto, compras: c.compras, ctr: c.n > 0 ? c.ctr / c.n : 0 })).sort((a, b) => b.gasto - a.gasto).slice(0, 20),
            vendasUtm,
          });
        } else if (metric === "funnel_stage" && funnelStage) {
          // Filter leads or sales according to stage
          if (funnelStage === "leads") {
            let q: any = supabase.from("imphq_leads")
              .select("id, nome, email, phone, status, score, plataforma, criado_em")
              .gte("criado_em", from).lte("criado_em", to)
              .order("criado_em", { ascending: false }).limit(200);
            if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
            const { data } = await q;
            setLeads(data || []);
          } else {
            const stageStatusMap: Record<string, string[]> = {
              checkout: ["inicio_checkout", "pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente", "aprovado", "expirado", "cancelado", "recusado"],
              pix: ["pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente"],
              approved: ["aprovado", "approved", "paid", "completed"],
              lost: ["expirado", "cancelado", "recusado", "reembolsado", "chargedback"],
            };
            const statuses = stageStatusMap[funnelStage] || [];
            let q: any = supabase.from("imphq_vendas")
              .select("id, produto_nome, valor, plataforma, data_venda, status, tipo_venda, lead_id, pais")
              .gte("data_venda", from).lte("data_venda", to)
              .in("status", statuses)
              .order("data_venda", { ascending: false }).limit(200);
            if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
            if (productFilter && productFilter !== "all") q = q.eq("produto_nome", productFilter);
            const { data } = await q;
            setVendas(data || []);
          }
        } else if ((metric === "product" || metric === "project_revenue") && (productName || projectId)) {
          let q: any = supabase.from("imphq_vendas")
            .select("id, produto_nome, valor, plataforma, data_venda, status, tipo_venda, lead_id, pais")
            .gte("data_venda", from).lte("data_venda", to)
            .in("status", ["aprovado", "approved", "paid", "completed"])
            .order("data_venda", { ascending: false }).limit(200);
          if (productName) q = q.eq("produto_nome", productName);
          if (projectId) q = q.eq("project_id", projectId);
          else if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
          const { data } = await q;
          setVendas(data || []);
        } else if (metric === "day_revenue" && dayKey) {
          const dayStart = `${dayKey}T00:00:00`;
          const dayEnd = `${dayKey}T23:59:59`;
          let q: any = supabase.from("imphq_vendas")
            .select("id, produto_nome, valor, plataforma, data_venda, status, tipo_venda, lead_id, pais")
            .gte("data_venda", dayStart).lte("data_venda", dayEnd)
            .in("status", ["aprovado", "approved", "paid", "completed"])
            .order("data_venda", { ascending: false }).limit(200);
          if (projectFilter !== "all") q = q.eq("project_id", projectFilter);
          if (productFilter && productFilter !== "all") q = q.eq("produto_nome", productFilter);
          const { data } = await q;
          setVendas(data || []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, metric, period, projectFilter, productFilter, campaignName, funnelStage, productName, projectId, dayKey, reloadKey]);

  if (!metric) return null;
  const head = titleMap[metric];
  const Icon = head.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <Icon className="h-5 w-5 text-primary" />
            {metric === "campaign" ? campaignName : head.title}
          </SheetTitle>
          <SheetDescription>{head.desc}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 pr-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sales / Revenue */}
              {(metric === "revenue" || metric === "sales" || metric === "product" || metric === "project_revenue" || metric === "day_revenue" || (metric === "funnel_stage" && funnelStage !== "leads")) && (
                <>
                  <div className="text-xs text-muted-foreground">{vendas.length} venda(s) no período</div>
                  {vendas.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma venda encontrada.</p>}
                  {vendas.map(v => (
                    <div key={v.id} className="rounded-lg border border-border p-3 bg-secondary/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            {v.pais && v.pais !== "BR" && (
                              <span title={countryName(v.pais)} className="text-base leading-none">{countryFlag(v.pais)}</span>
                            )}
                            <span className="truncate">{v.produto_nome || "—"}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(v.data_venda).toLocaleString("pt-BR")} · {v.plataforma || "—"}{v.pais && v.pais !== "BR" ? ` · ${countryName(v.pais)}` : ""}
                          </p>

                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-bold text-emerald-400">{fmtBRL(parseFloat(v.valor) || 0)}</p>
                          {v.tipo_venda && v.tipo_venda !== "principal" && (
                            <Badge variant="outline" className="text-[9px] mt-0.5">{v.tipo_venda}</Badge>
                          )}
                        </div>
                      </div>
                      {v.lead_id && (
                        <Link to={`/leads?lead=${v.lead_id}`} className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 mt-1">
                          Ver lead <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Leads */}
              {(metric === "leads" || (metric === "funnel_stage" && funnelStage === "leads")) && (
                <>
                  <div className="text-xs text-muted-foreground">{leads.length} lead(s) no período</div>
                  {leads.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhum lead encontrado.</p>}
                  {leads.map(l => (
                    <Link key={l.id} to={`/leads?lead=${l.id}`} className="block rounded-lg border border-border p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{l.nome || l.email || "Sem nome"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{l.email}{l.phone ? ` · ${l.phone}` : ""}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(l.criado_em).toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-[9px]">{l.status}</Badge>
                          {l.score > 0 && <span className="text-[10px] font-mono text-amber-400">{l.score}pts</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {/* Profit / Cost breakdown */}
              {(metric === "profit" || metric === "cost") && breakdown && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border p-3 bg-emerald-500/10">
                      <p className="text-[10px] text-muted-foreground">Receita</p>
                      <p className="text-sm font-mono font-bold text-emerald-400">{fmtBRL(breakdown.revenue)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-red-500/10">
                      <p className="text-[10px] text-muted-foreground">Ads</p>
                      <p className="text-sm font-mono font-bold text-red-400">{fmtBRL(breakdown.ads)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-orange-500/10">
                      <p className="text-[10px] text-muted-foreground">Operacional</p>
                      <p className="text-sm font-mono font-bold text-orange-400">{fmtBRL(breakdown.op)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3 bg-secondary/30">
                    <p className="text-[10px] text-muted-foreground">{metric === "profit" ? "Lucro" : "Custo total"}</p>
                    <p className={`text-lg font-mono font-bold ${metric === "profit" ? (breakdown.revenue - breakdown.ads - breakdown.op >= 0 ? "text-emerald-400" : "text-red-400") : "text-red-400"}`}>
                      {fmtBRL(metric === "profit" ? breakdown.revenue - breakdown.ads - breakdown.op : breakdown.ads + breakdown.op)}
                    </p>
                  </div>

                  {campanhas.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground mt-4 mb-1">Ads por campanha</p>
                      {campanhas.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                          <p className="text-xs truncate flex-1">{c.name}</p>
                          <span className="text-xs font-mono font-bold text-red-400 shrink-0 ml-2">{fmtBRL(c.gasto)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {custos.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground mt-4 mb-1">Custos operacionais</p>
                      {custos.slice(0, 30).map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate">{c.descricao || c.categoria || "Custo"}</p>
                            <p className="text-[10px] text-muted-foreground">{c.data} · {c.categoria || "—"}</p>
                          </div>
                          <span className="text-xs font-mono font-bold text-orange-400 shrink-0 ml-2">{fmtBRL((parseFloat(c.valor) || 0) * (c.moeda === "USD" ? 5.2 : 1))}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* Campaigns list (roas, ads_spend, ads_cpa, etc) */}
              {(metric === "roas" || metric === "ads_spend" || metric === "ads_cpa" || metric === "ads_checkout_cost" || metric === "ads_purchases") && (
                <>
                  <div className="text-xs text-muted-foreground">{campanhas.length} campanha(s)</div>
                  {campanhas.length === 0 && <p className="text-sm text-muted-foreground italic">Sem dados de Ads no período.</p>}
                  {campanhas.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        // open nested campaign detail
                        const ev = new CustomEvent("dashboard-drill-campaign", { detail: { name: c.name } });
                        window.dispatchEvent(ev);
                      }}
                      className="w-full text-left rounded-lg border border-border p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Gasto {fmtBRL(c.gasto)} · {c.compras || 0} compras · {c.checkouts || 0} CKOs
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {metric === "roas" && <p className="text-sm font-mono font-bold text-emerald-400">{c.roas.toFixed(2)}x</p>}
                          {metric === "ads_cpa" && <p className="text-sm font-mono font-bold text-red-400">{c.cpa > 0 ? fmtBRL(c.cpa) : "—"}</p>}
                          {metric === "ads_checkout_cost" && <p className="text-sm font-mono font-bold text-orange-400">{c.custoCheckout > 0 ? fmtBRL(c.custoCheckout) : "—"}</p>}
                          {metric === "ads_purchases" && <p className="text-sm font-mono font-bold text-blue-400">{c.compras}</p>}
                          {metric === "ads_spend" && <p className="text-sm font-mono font-bold text-blue-400">{fmtBRL(c.gasto)}</p>}
                        </div>
                      </div>
                      {(metric === "roas" || metric === "ads_spend") && c.receitaAtribuida > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">Receita atribuída: {fmtBRL(c.receitaAtribuida)}</p>
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Single campaign detail */}
              {metric === "campaign" && campaignDetail && (
                <>
                  <p className="text-xs text-muted-foreground mt-1 mb-1">Adsets</p>
                  {campaignDetail.adsets.length === 0 && <p className="text-sm text-muted-foreground italic">Sem adsets.</p>}
                  {campaignDetail.adsets.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.compras} compras · {a.checkouts} CKOs</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-blue-400 shrink-0 ml-2">{fmtBRL(a.gasto)}</span>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground mt-3 mb-1">Criativos</p>
                  {campaignDetail.criativos.length === 0 && <p className="text-sm text-muted-foreground italic">Sem criativos.</p>}
                  {campaignDetail.criativos.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">CTR {c.ctr.toFixed(2)}% · {c.compras} compras</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-blue-400 shrink-0 ml-2">{fmtBRL(c.gasto)}</span>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground mt-3 mb-1">Vendas atribuídas (via UTM)</p>
                  {campaignDetail.vendasUtm.length === 0 && <p className="text-sm text-muted-foreground italic">Nenhuma venda com utm_campaign correspondente.</p>}
                  {campaignDetail.vendasUtm.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{v.produto_nome}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(v.data_venda).toLocaleString("pt-BR")} · {v.plataforma}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 shrink-0 ml-2">{fmtBRL(parseFloat(v.valor) || 0)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
