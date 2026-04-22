import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Clock, Calendar, Users, MapPin, Cake, Sparkles, Loader2,
  TrendingDown, AlertTriangle, Zap, Target, Activity, DollarSign, ChevronRight,
  Package, BarChart3, Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAll } from "@/lib/supabasePaginate";
import {
  aggregateAudience, aggregateAds, buildFunnel, buildDiagnostics,
  semaforo, semColor, semaforoBenchmark, fmtMoney, fmtNum,
  DAYS, UF_REGION_EMOJI, type AudienceRow, type AdsRow,
} from "./insights/aggregations";
import { ProductInsightDrawer } from "./insights/ProductInsightDrawer";
import { KpiHeroCard } from "@/components/shared/KpiHeroCard";

const ALL_PRODUCTS = "__all__";

interface Props { projectId: string }

export function ProjetoInsights({ projectId }: Props) {
  const [period, setPeriod] = useState("90d");
  const [source, setSource] = useState<"vendas" | "leads">("vendas");
  const [produto, setProduto] = useState<string>(ALL_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<AudienceRow[]>([]);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [adsRows, setAdsRows] = useState<AdsRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsProgress, setAdsProgress] = useState(0);
  const [drillProduct, setDrillProduct] = useState<string | null>(null);

  // Lista de produtos (até 5k vendas para popular o select)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("imphq_vendas")
        .select("produto_nome").eq("project_id", projectId)
        .not("produto_nome", "is", null).limit(5000);
      if (cancel) return;
      const uniq = Array.from(new Set(((data ?? []) as any[]).map(d => d.produto_nome).filter(Boolean))) as string[];
      setProdutos(uniq.sort());
    })();
    return () => { cancel = true; };
  }, [projectId]);

  // Audiência + Ads em paralelo, com paginação adaptativa
  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true); setAdsLoading(true);
      setProgress(0); setAdsProgress(0);
      const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      const audiencePromise = (async (): Promise<AudienceRow[]> => {
        if (source === "vendas") {
          const vendas = await fetchAll<any>(
            (from, to) => {
              let q = supabase.from("imphq_vendas")
                .select("created_at, valor, lead_id, produto_nome")
                .eq("project_id", projectId).eq("status", "aprovado")
                .gte("created_at", since).range(from, to);
              if (produto !== ALL_PRODUCTS) q = q.eq("produto_nome", produto);
              return q;
            },
            1000, 50000, n => !cancel && setProgress(n),
          );
          const leadIds = [...new Set(vendas.map(v => v.lead_id).filter(Boolean))] as string[];
          const leadsMap = new Map<string, any>();
          for (let i = 0; i < leadIds.length; i += 500) {
            const slice = leadIds.slice(i, i + 500);
            const { data: leads } = await (supabase as any).from("imphq_leads")
              .select("id, nome, genero, phone, data").in("id", slice);
            ((leads ?? []) as any[]).forEach(l => leadsMap.set(l.id, l));
          }
          return vendas.map(v => ({
            ts: v.created_at, valor: Number(v.valor || 0),
            lead: leadsMap.get(v.lead_id), produto: v.produto_nome,
          }));
        } else {
          const leads = await fetchAll<any>(
            (from, to) => {
              let q: any = (supabase as any).from("imphq_leads")
                .select("criado_em, nome, genero, phone, data, ultimo_produto")
                .eq("project_id", projectId).gte("criado_em", since).range(from, to);
              if (produto !== ALL_PRODUCTS) q = q.eq("ultimo_produto", produto);
              return q;
            },
            1000, 50000, n => !cancel && setProgress(n),
          );
          return leads.map((l: any) => ({ ts: l.criado_em, lead: l, produto: l.ultimo_produto }));
        }
      })();

      const adsPromise = fetchAll<any>(
        (from, to) => {
          let q = supabase.from("imphq_ads_spend")
            .select("data_ref, campanha, valor, impressoes, alcance, link_clicks, cliques, landing_page_views, add_to_cart, init_checkout, checkouts_iniciados, compras, resultados, hook_rate, hold_rate, ctr, cpm, frequencia")
            .eq("project_id", projectId).gte("data_ref", sinceDate).range(from, to);
          if (produto !== ALL_PRODUCTS) q = q.ilike("campanha", `%${produto}%`);
          return q;
        },
        1000, 50000, n => !cancel && setAdsProgress(n),
      ).then(rs => rs.map((r: any) => ({
        ...r, valor: +r.valor||0, impressoes: +r.impressoes||0, alcance: +r.alcance||0,
        link_clicks: +r.link_clicks||0, cliques: +r.cliques||0,
        landing_page_views: +r.landing_page_views||0, add_to_cart: +r.add_to_cart||0,
        init_checkout: +r.init_checkout||0, checkouts_iniciados: +r.checkouts_iniciados||0,
        compras: +r.compras||0, resultados: +r.resultados||0,
      })) as AdsRow[]);

      const [aud, ads] = await Promise.all([audiencePromise, adsPromise]);
      if (cancel) return;
      setRows(aud); setAdsRows(ads);
      setLoading(false); setAdsLoading(false);
    }
    load();
    return () => { cancel = true; };
  }, [projectId, period, source, produto]);

  const insights = useMemo(() => aggregateAudience(rows), [rows]);
  const adsAgg = useMemo(() => aggregateAds(adsRows), [adsRows]);
  const funnelSteps = useMemo(() => buildFunnel(adsAgg), [adsAgg]);
  const diagnostics = useMemo(() => buildDiagnostics(adsAgg, adsRows.length > 0), [adsAgg, adsRows]);

  const maxHour = Math.max(1, ...insights.hourly);
  const maxDay = Math.max(1, ...insights.weekday);
  const maxUF = insights.topUFs[0]?.[1] ?? 1;
  const totalRecords = rows.length;
  const maxProductValor = Math.max(1, ...insights.topProducts.map(p => p.valor || p.count));

  const audienceEmpty = !loading && totalRecords === 0;
  const adsEmpty = !adsLoading && adsRows.length === 0;
  const lpSlow = adsAgg.linkClicks > 0 && adsAgg.lp_views > 0 && adsAgg.clickToLpRatio > 1.4;

  return (
    <div className="space-y-6">
      {/* ========== 1. BARRA DE FILTROS (sticky) ========== */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm uppercase tracking-wider text-primary font-sans font-semibold">Insights de Audiência</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Tabs value={source} onValueChange={(v) => setSource(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="vendas" className="text-xs h-7">Vendas</TabsTrigger>
                <TabsTrigger value="leads" className="text-xs h-7">Leads</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PRODUCTS}>Todos os produtos</SelectItem>
                {produtos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="180d">6 meses</SelectItem>
                <SelectItem value="365d">12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(loading || adsLoading) && (progress > 0 || adsProgress > 0) && (
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando {fmtNum(progress + adsProgress)} registros…
          </p>
        )}
      </div>

      {/* ========== 2. RESUMO EXECUTIVO ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryKpi label="Registros" value={loading ? null : fmtNum(totalRecords)} icon={<Users className="h-3.5 w-3.5" />} />
        <SummaryKpi
          label={source === "vendas" ? "Faturado" : "Leads capturados"}
          value={loading ? null : (source === "vendas" ? fmtMoney(insights.totalValor) : fmtNum(totalRecords))}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          accent
        />
        <SummaryKpi
          label="Ticket médio"
          value={loading ? null : (source === "vendas" ? fmtMoney(insights.ticketMedio) : "—")}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
        <SummaryKpi
          label="Melhor janela"
          value={loading ? null : (totalRecords > 0 ? `${DAYS[insights.peakDay]} · ${String(insights.peakHour).padStart(2, "0")}h` : "—")}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
      </div>

      {/* ========== 3. TABS NAVEGÁVEIS ========== */}
      <Tabs defaultValue="audiencia" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="audiencia" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Audiência</TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Tráfego & Ads</TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
        </TabsList>

        {/* ---------- TAB 1: AUDIÊNCIA ---------- */}
        <TabsContent value="audiencia" className="space-y-4 mt-0">
          {loading ? (
            <LoadingGrid />
          ) : audienceEmpty ? (
            <EmptyState message={`Sem dados de ${source === "vendas" ? "vendas" : "leads"} no período selecionado.`} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* QUANDO — Heatmap horário */}
              <SectionCard
                icon={<Clock className="h-4 w-4 text-primary" />}
                title="Horários de Pico (BRT)"
                desc="Distribuição por hora do dia · top 3 destacados"
                action={
                  <div className="flex gap-1">
                    {insights.hourRanking.slice(0, 3).map((x, i) => (
                      <Badge key={x.h} variant={i === 0 ? "default" : "outline"} className="text-[10px]">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {String(x.h).padStart(2, "0")}h
                      </Badge>
                    ))}
                  </div>
                }
              >
                {[0, 1].map(row => (
                  <div key={row}>
                    <p className="text-[9px] text-muted-foreground mb-0.5">{row === 0 ? "AM (00–11h)" : "PM (12–23h)"}</p>
                    <div className="grid grid-cols-12 gap-0.5">
                      {insights.hourly.slice(row * 12, row * 12 + 12).map((v, idx) => {
                        const h = row * 12 + idx;
                        const intensity = v / maxHour;
                        const rank = insights.hourRanking.findIndex(x => x.h === h);
                        const valor = insights.hourlyValor[h];
                        const pctTotal = totalRecords ? (v / totalRecords) * 100 : 0;
                        return (
                          <HoverCard key={h} openDelay={0}>
                            <HoverCardTrigger asChild>
                              <div
                                className={`aspect-square rounded-sm border flex items-center justify-center cursor-default ${rank >= 0 && rank < 3 ? "border-primary" : "border-border/40"}`}
                                style={{ background: `hsl(var(--primary) / ${0.08 + intensity * 0.85})` }}
                              >
                                <span className="text-[8px] font-bold text-foreground/70">{h}</span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-60 text-xs space-y-1">
                              <p className="font-bold flex items-center gap-1">
                                {String(h).padStart(2, "0")}:00 BRT
                                {rank >= 0 && rank < 3 && (
                                  <Badge variant="default" className="ml-1 text-[9px]">
                                    {rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉"} #{rank + 1}
                                  </Badge>
                                )}
                              </p>
                              <p>Contagem: <span className="font-semibold">{v}</span> ({pctTotal.toFixed(1)}% do total)</p>
                              {source === "vendas" && valor > 0 && (
                                <>
                                  <p>Faturado: <span className="text-primary font-semibold">{fmtMoney(valor)}</span></p>
                                  <p className="text-muted-foreground">Ticket médio: {fmtMoney(v ? valor / v : 0)}</p>
                                </>
                              )}
                              {v === 0 && <p className="text-muted-foreground italic">Nenhum registro nesta hora.</p>}
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </SectionCard>

              {/* QUANDO — Dias da semana */}
              <SectionCard
                icon={<Calendar className="h-4 w-4 text-primary" />}
                title="Dias da Semana"
                desc="Volume e receita por dia"
                action={<Badge variant="outline" className="text-[10px]">Melhor: {DAYS[insights.peakDay]}</Badge>}
              >
                <div className="space-y-1.5">
                  {insights.weekday.map((v, w) => {
                    const valor = insights.weekdayValor[w];
                    const pctTotal = totalRecords ? (v / totalRecords) * 100 : 0;
                    return (
                      <HoverCard key={w} openDelay={0}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center gap-2 cursor-default">
                            <span className="text-xs text-muted-foreground w-10">{DAYS[w]}</span>
                            <div className="flex-1 h-5 rounded bg-secondary relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 transition-all" style={{
                                width: `${(v / maxDay) * 100}%`,
                                background: "linear-gradient(90deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.9))",
                              }} />
                              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium gap-2">
                                {source === "vendas" && valor > 0 && (
                                  <span className="text-primary/90">{fmtMoney(valor)}</span>
                                )}
                                <span>{v}</span>
                              </span>
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="text-xs w-56 space-y-1">
                          <p className="font-bold">{DAYS[w]}</p>
                          <p>Contagem: <span className="font-semibold">{v}</span> ({pctTotal.toFixed(1)}% do total)</p>
                          {source === "vendas" && valor > 0 && (
                            <>
                              <p>Faturado: <span className="text-primary font-semibold">{fmtMoney(valor)}</span></p>
                              <p className="text-muted-foreground">Ticket médio: {fmtMoney(v ? valor / v : 0)}</p>
                            </>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </SectionCard>

              {/* QUEM — Gênero */}
              <SectionCard
                icon={<Users className="h-4 w-4 text-primary" />}
                title="Gênero"
                desc="Distribuição inferida pelo nome"
                action={<Badge variant="outline" className="text-[10px]">Inferido</Badge>}
              >
                <div className="flex items-center justify-center gap-6 py-2">
                  <Donut f={insights.gender.F} m={insights.gender.M} u={insights.gender.U} total={insights.totalGender} />
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-500"/> <span className="text-pink-400 font-bold w-10">{insights.gender.F}</span> Feminino · {Math.round((insights.gender.F / insights.totalGender) * 100)}%</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"/> <span className="text-blue-400 font-bold w-10">{insights.gender.M}</span> Masculino · {Math.round((insights.gender.M / insights.totalGender) * 100)}%</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"/> <span className="text-muted-foreground font-bold w-10">{insights.gender.U}</span> N/D · {Math.round((insights.gender.U / insights.totalGender) * 100)}%</div>
                  </div>
                </div>
              </SectionCard>

              {/* QUEM & ONDE — Faixa Etária + UFs */}
              <SectionCard
                icon={<Cake className="h-4 w-4 text-primary" />}
                title="Faixa Etária & Localização"
                desc="Idade calculada e top estados pelo DDD"
              >
                {(() => {
                  const ageEntries = Object.entries(insights.ageBuckets).filter(([k, v]) => k !== "?" && v > 0);
                  const total = ageEntries.reduce((a, [, v]) => a + v, 0);
                  const maxBucket = Math.max(1, ...ageEntries.map(([, v]) => v));
                  if (!ageEntries.length) return <p className="text-[10px] text-muted-foreground italic">Sem dados de idade.</p>;
                  return (
                    <div className="space-y-1">
                      {ageEntries.map(([range, v]) => {
                        const pct = total > 0 ? (v / total) * 100 : 0;
                        const isMax = v === maxBucket;
                        return (
                          <div key={range} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-12">{range}</span>
                            <div className="flex-1 h-4 rounded bg-secondary relative overflow-hidden">
                              <div className={`absolute inset-y-0 left-0 ${isMax ? "bg-primary" : "bg-primary/50"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] w-20 text-right tabular-nums">{v} · {pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {insights.ageBuckets["?"] > 0 && (
                  <p className="text-[10px] text-muted-foreground italic">{insights.ageBuckets["?"]} sem data de nascimento.</p>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-semibold">Top 10 Estados (DDD)</h4>
                </div>
                {insights.topUFs.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">Sem telefones com DDD válido.</p>
                ) : (
                  <div className="space-y-1 pt-1">
                    {insights.topUFs.map(([uf, n]) => {
                      const pct = (n / maxUF) * 100;
                      return (
                        <div key={uf} className="flex items-center gap-2">
                          <span className="text-xs w-14 flex items-center gap-1">
                            <span>{UF_REGION_EMOJI[uf] || "📍"}</span>
                            <span className="font-bold">{uf}</span>
                          </span>
                          <div className="flex-1 h-3.5 rounded bg-secondary relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] w-10 text-right tabular-nums">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </TabsContent>

        {/* ---------- TAB 2: TRÁFEGO & ADS ---------- */}
        <TabsContent value="ads" className="space-y-4 mt-0">
          {adsLoading ? (
            <LoadingGrid />
          ) : adsEmpty ? (
            <EmptyState message={`Sem dados de Ads no período${produto !== ALL_PRODUCTS ? " com esse produto" : ""}. Verifique a sincronização do Facebook Ads.`} />
          ) : (
            <>
              {/* Diagnóstico automático no topo */}
              <SectionCard
                icon={<Zap className="h-4 w-4 text-primary" />}
                title="Diagnóstico Automático"
                desc="Sinais detectados no funil de tráfego"
              >
                <div className="space-y-2">
                  {diagnostics.map((d, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-md border flex items-start gap-2 ${
                        d.severity === "danger" ? "border-red-500/40 bg-red-500/5" :
                        d.severity === "warn" ? "border-amber-500/40 bg-amber-500/5" :
                        "border-emerald-500/40 bg-emerald-500/5"
                      }`}
                    >
                      {d.severity === "danger" ? <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" /> :
                       d.severity === "warn" ? <TrendingDown className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /> :
                       <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                      <div>
                        <p className={`text-sm font-semibold ${
                          d.severity === "danger" ? "text-red-300" :
                          d.severity === "warn" ? "text-amber-300" : "text-emerald-300"
                        }`}>{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Alerta destacado de LP lenta */}
              {lpSlow && (
                <div className="p-4 rounded-md border-2 border-red-500/60 bg-red-500/10 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-300">Lentidão Detectada na Landing Page</p>
                    <p className="text-xs text-red-200/80 mt-1">
                      Razão cliques/LP = <strong>{adsAgg.clickToLpRatio.toFixed(2)}x</strong> — apenas {((adsAgg.lp_views / adsAgg.linkClicks) * 100).toFixed(0)}% dos cliques chegam à página ({fmtNum(adsAgg.linkClicks)} cliques → {fmtNum(adsAgg.lp_views)} views).
                      <br /><span className="opacity-70">Sugestão: rode PageSpeed Insights, valide redirects/pixel e otimize Core Web Vitals.</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Funil */}
              <SectionCard
                icon={<Target className="h-4 w-4 text-primary" />}
                title="Funil de Conversão"
                desc="6 etapas · passe o mouse para detalhes"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {funnelSteps.map((step) => {
                    const dropBad = step.drop != null && step.drop > 70;
                    return (
                      <HoverCard key={step.key} openDelay={0}>
                        <HoverCardTrigger asChild>
                          <div className="p-3 rounded-md bg-secondary/40 border border-border relative cursor-default">
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span>{step.icon}</span> {step.label}
                            </div>
                            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{fmtNum(step.value)}</p>
                            {step.conv != null && (
                              <p className={`text-[10px] mt-0.5 ${dropBad ? "text-red-400" : "text-emerald-400"}`}>
                                {step.conv.toFixed(1)}% da etapa anterior
                                {dropBad && <span className="block text-red-300/80">⚠ drop {step.drop?.toFixed(0)}%</span>}
                              </p>
                            )}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="text-xs w-64 space-y-1">
                          <p className="font-bold flex items-center gap-1">{step.icon} {step.label}</p>
                          <p>Volume: <span className="font-semibold">{fmtNum(step.value)}</span></p>
                          {step.conv != null && (
                            <p>Conversão da etapa anterior: <span className={dropBad ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>{step.conv.toFixed(1)}%</span></p>
                          )}
                          {step.drop != null && step.drop > 0 && (
                            <p>Drop-off: <span className={dropBad ? "text-red-400" : "text-amber-400"}>{step.drop.toFixed(0)}%</span></p>
                          )}
                          {step.fromImpressions != null && (
                            <p className="text-muted-foreground">% das impressões: {step.fromImpressions.toFixed(2)}%</p>
                          )}
                          {step.costPerEvent != null && (
                            <p className="text-muted-foreground">Custo médio: {fmtMoney(step.costPerEvent)}</p>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </SectionCard>

              {/* KPIs Hero com semáforo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiHeroCard
                  label="ROAS"
                  value={adsAgg.spend > 0 && insights.totalValor > 0 ? insights.totalValor / adsAgg.spend : 0}
                  format="multiplier"
                  benchmark={{ good: 2, warn: 1 }}
                  tooltip="Receita de vendas dividido pelo gasto em ads. ≥2x é saudável; <1x você está perdendo dinheiro."
                  icon={<DollarSign className="h-3 w-3" />}
                />
                <KpiHeroCard
                  label="CPA"
                  value={adsAgg.compras > 0 ? adsAgg.spend / adsAgg.compras : 0}
                  format="currency"
                  inverse
                  benchmark={{ good: 50, warn: 100 }}
                  tooltip="Custo por aquisição. Gasto total ÷ número de compras. Quanto menor, melhor."
                  icon={<Target className="h-3 w-3" />}
                />
                <KpiHeroCard
                  label="Hook Rate"
                  value={adsAgg.hook}
                  format="percent"
                  benchmark={{ good: 25, warn: 15 }}
                  tooltip={semaforoBenchmark.hook}
                  icon={<Zap className="h-3 w-3" />}
                />
                <KpiHeroCard
                  label="Frequência"
                  value={adsAgg.freq}
                  format="multiplier"
                  inverse
                  benchmark={{ good: 1.8, warn: 3 }}
                  tooltip={semaforoBenchmark.freq}
                  icon={<Activity className="h-3 w-3" />}
                />
              </div>

              {/* KPIs detalhados (existentes) */}
              <SectionCard
                icon={<BarChart3 className="h-4 w-4 text-primary" />}
                title="KPIs Detalhados com Semáforo"
                desc="Métricas-chave com benchmarks de mercado"
              >
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <KpiBox label="Investido" value={fmtMoney(adsAgg.spend)} icon={<DollarSign className="h-3 w-3" />} />
                  <KpiBox label="CTR médio" value={`${adsAgg.ctr.toFixed(2)}%`} color={semColor(semaforo("ctr", adsAgg.ctr))} hint={semaforoBenchmark.ctr} status={semaforo("ctr", adsAgg.ctr)} />
                  <KpiBox label="CPM" value={fmtMoney(adsAgg.cpm)} hint="Custo por mil impressões." />
                  <KpiBox label="Hook Rate" value={`${adsAgg.hook.toFixed(1)}%`} color={semColor(semaforo("hook", adsAgg.hook))} hint={semaforoBenchmark.hook} status={semaforo("hook", adsAgg.hook)} />
                  <KpiBox label="Hold Rate" value={`${adsAgg.hold.toFixed(1)}%`} color={semColor(semaforo("hold", adsAgg.hold))} hint={semaforoBenchmark.hold} status={semaforo("hold", adsAgg.hold)} />
                  <KpiBox label="Frequência" value={adsAgg.freq.toFixed(2)} color={semColor(semaforo("freq", adsAgg.freq))} hint={semaforoBenchmark.freq} status={semaforo("freq", adsAgg.freq)} />
                </div>
              </SectionCard>
            </>
          )}
        </TabsContent>

        {/* ---------- TAB 3: PRODUTOS ---------- */}
        <TabsContent value="produtos" className="space-y-4 mt-0">
          {loading ? (
            <LoadingGrid />
          ) : insights.topProducts.length === 0 ? (
            <EmptyState message="Sem produtos com registros no período. Tente ampliar o período ou limpar o filtro." />
          ) : (
            <SectionCard
              icon={<Package className="h-4 w-4 text-primary" />}
              title="Ranking de Produtos"
              desc="Clique em um produto para abrir o drill-down completo"
            >
              <div className="space-y-1">
                {insights.topProducts.map(p => {
                  const ref = p.valor || p.count;
                  const pct = (ref / maxProductValor) * 100;
                  const pctTotal = totalRecords ? (p.count / totalRecords) * 100 : 0;
                  return (
                    <button
                      key={p.nome}
                      onClick={() => setDrillProduct(p.nome)}
                      className="w-full flex items-center gap-3 group hover:bg-secondary/60 rounded-md px-3 py-2.5 transition-colors text-left border border-transparent hover:border-border"
                    >
                      <span className="text-xs flex-1 truncate text-foreground group-hover:text-primary font-medium">{p.nome}</span>
                      <div className="w-40 h-2.5 rounded bg-secondary relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-24 text-right tabular-nums">{p.count} reg · {pctTotal.toFixed(0)}%</span>
                      {p.valor > 0 && (
                        <span className="text-xs text-primary w-24 text-right tabular-nums font-semibold">{fmtMoney(p.valor)}</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </TabsContent>
      </Tabs>

      <ProductInsightDrawer
        open={drillProduct !== null}
        onClose={() => setDrillProduct(null)}
        projectId={projectId}
        produto={drillProduct}
        source={source}
        period={period}
      />
    </div>
  );
}

// ===== Subcomponentes de layout =====
function SectionCard({
  icon, title, desc, action, children,
}: { icon: React.ReactNode; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">{icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
            </div>
          </div>
          {action}
        </div>
        <div className="space-y-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function SummaryKpi({
  label, value, icon, accent,
}: { label: string; value: string | null; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </p>
        {value === null ? (
          <Skeleton className="h-7 w-24 mt-1.5" />
        ) : (
          <p className={`text-2xl font-bold tabular-nums mt-1 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="bg-card border-border border-dashed">
      <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-2">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </CardContent>
    </Card>
  );
}

// ===== Subcomponentes =====
function KpiBox({ label, value, icon, color, hint, status }: { label: string; value: string; icon?: React.ReactNode; color?: string; hint?: string; status?: "ok" | "warn" | "bad" }) {
  const inner = (
    <div className="p-2.5 rounded-md bg-secondary/40 border border-border cursor-default">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</p>
      <p className={`text-base font-bold tabular-nums ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
  if (!hint) return inner;
  return (
    <HoverCard openDelay={0}>
      <HoverCardTrigger asChild>{inner}</HoverCardTrigger>
      <HoverCardContent className="text-xs w-60 space-y-1">
        <p className="font-bold">{label}</p>
        <p className="text-muted-foreground">{hint}</p>
        {status && (
          <p className={semColor(status)}>
            Status: {status === "ok" ? "✓ Saudável" : status === "warn" ? "⚠ Atenção" : "✗ Ruim"}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function Donut({ f, m, u, total }: { f: number; m: number; u: number; total: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const fLen = (f / total) * c;
  const mLen = (m / total) * c;
  const uLen = (u / total) * c;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(236 72 153 / 0.85)" strokeWidth="14"
        strokeDasharray={`${fLen} ${c - fLen}`} strokeDashoffset="0" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(59 130 246 / 0.85)" strokeWidth="14"
        strokeDasharray={`${mLen} ${c - mLen}`} strokeDashoffset={`-${fLen}`} />
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted-foreground) / 0.4)" strokeWidth="14"
        strokeDasharray={`${uLen} ${c - uLen}`} strokeDashoffset={`-${fLen + mLen}`} />
      <text x="50" y="54" textAnchor="middle" className="rotate-90 origin-center" style={{ fontSize: 14, fill: "hsl(var(--foreground))", fontWeight: 700, transform: "rotate(90deg)", transformOrigin: "50px 50px" }}>
        {total}
      </text>
    </svg>
  );
}
