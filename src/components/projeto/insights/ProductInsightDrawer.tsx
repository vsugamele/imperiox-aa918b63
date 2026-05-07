import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Clock, Calendar, Users, MapPin, Cake, Activity, Target, Zap, AlertTriangle, TrendingDown, Sparkles, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabasePaginate";
import {
  aggregateAudience, aggregateAds, buildFunnel, buildDiagnostics,
  semaforo, semColor, semaforoBenchmark, fmtMoney, fmtNum,
  DAYS, UF_REGION_EMOJI, type AudienceRow, type AdsRow,
} from "./aggregations";

type SaleScope = "realizada" | "gerada" | "todas";
const STATUS_BY_SCOPE: Record<SaleScope, string[] | null> = {
  realizada: ["aprovado"],
  gerada: ["pix_gerado", "boleto_gerado", "pendente"],
  todas: null,
};

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  produto: string | null;
  source: "vendas" | "leads";
  period: string; // "30d" | "90d" | "180d" | "365d"
}

export function ProductInsightDrawer({ open, onClose, projectId, produto, source, period }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<AudienceRow[]>([]);
  const [adsRows, setAdsRows] = useState<AdsRow[]>([]);
  const [scope, setScope] = useState<SaleScope>("realizada");

  useEffect(() => {
    if (!open || !produto) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setProgress(0);
      const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const sinceDate = since.slice(0, 10);

      const audiencePromise = (async (): Promise<AudienceRow[]> => {
        if (source === "vendas") {
          const statuses = STATUS_BY_SCOPE[scope];
          const vendas = await fetchAll<any>(
            (from, to) => {
              let q = supabase.from("imphq_vendas")
                .select("created_at, valor, lead_id, produto_nome, status")
                .eq("project_id", projectId)
                .eq("produto_nome", produto)
                .gte("created_at", since);
              if (statuses) q = q.in("status", statuses);
              return q.range(from, to);
            },
            1000, 20000, n => !cancel && setProgress(n),
          );
          const leadIds = [...new Set(vendas.map(v => v.lead_id).filter(Boolean))] as string[];
          const leadsMap = new Map<string, any>();
          if (leadIds.length) {
            for (let i = 0; i < leadIds.length; i += 500) {
              const slice = leadIds.slice(i, i + 500);
              const { data: leads } = await (supabase as any).from("imphq_leads")
                .select("id, nome, genero, phone, data").in("id", slice);
              ((leads ?? []) as any[]).forEach(l => leadsMap.set(l.id, l));
            }
          }
          return vendas.map(v => ({
            ts: v.created_at, valor: Number(v.valor || 0),
            lead: leadsMap.get(v.lead_id), produto: v.produto_nome,
          }));
        } else {
          const leads = await fetchAll<any>(
            (from, to) => (supabase as any).from("imphq_leads")
              .select("criado_em, nome, genero, phone, data, ultimo_produto")
              .eq("project_id", projectId).eq("ultimo_produto", produto)
              .gte("criado_em", since).range(from, to),
            1000, 20000, n => !cancel && setProgress(n),
          );
          return leads.map((l: any) => ({ ts: l.criado_em, lead: l, produto: l.ultimo_produto }));
        }
      })();

      const adsPromise = fetchAll<any>(
        (from, to) => supabase.from("imphq_ads_spend")
          .select("data_ref, campanha, valor, impressoes, alcance, link_clicks, cliques, landing_page_views, add_to_cart, init_checkout, checkouts_iniciados, compras, resultados, hook_rate, hold_rate, ctr, cpm, frequencia")
          .eq("project_id", projectId).gte("data_ref", sinceDate)
          .ilike("campanha", `%${produto}%`).range(from, to),
        1000, 20000,
      ).then(rs => rs.map((r: any) => ({
        ...r, valor: +r.valor||0, impressoes: +r.impressoes||0, alcance: +r.alcance||0,
        link_clicks: +r.link_clicks||0, cliques: +r.cliques||0,
        landing_page_views: +r.landing_page_views||0, add_to_cart: +r.add_to_cart||0,
        init_checkout: +r.init_checkout||0, checkouts_iniciados: +r.checkouts_iniciados||0,
        compras: +r.compras||0, resultados: +r.resultados||0,
      })) as AdsRow[]);

      const [aud, ads] = await Promise.all([audiencePromise, adsPromise]);
      if (cancel) return;
      setRows(aud);
      setAdsRows(ads);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, projectId, produto, source, period]);

  const ins = useMemo(() => aggregateAudience(rows), [rows]);
  const adsAgg = useMemo(() => aggregateAds(adsRows), [adsRows]);
  const funnel = useMemo(() => buildFunnel(adsAgg), [adsAgg]);
  const diagnostics = useMemo(() => buildDiagnostics(adsAgg, adsRows.length > 0), [adsAgg, adsRows]);

  const maxHour = Math.max(1, ...ins.hourly);
  const maxDay = Math.max(1, ...ins.weekday);
  const maxUF = ins.topUFs[0]?.[1] ?? 1;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Drill-down — {produto}
          </SheetTitle>
          <SheetDescription>
            Visão detalhada do produto · {source === "vendas" ? "Vendas" : "Leads"} · últimos {period}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Carregando {fmtNum(progress)} registros…</span>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Box label="Registros" value={fmtNum(ins.totalRecords)} />
              {source === "vendas" && <>
                <Box label="Faturado" value={fmtMoney(ins.totalValor)} accent />
                <Box label="Ticket médio" value={fmtMoney(ins.ticketMedio)} />
              </>}
              <Box label="Melhor janela" value={`${DAYS[ins.peakDay]} · ${String(ins.peakHour).padStart(2,"0")}h`} />
            </div>

            {ins.totalRecords === 0 && adsRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sem dados deste produto no período.
              </p>
            ) : (
              <>
                {/* Heatmap horário */}
                {ins.totalRecords > 0 && (
                  <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Picos horários</h3>
                      <div className="ml-auto flex gap-1 flex-wrap">
                        {ins.hourRanking.slice(0, 5).map((x, i) => (
                          <Badge key={x.h} variant={i === 0 ? "default" : "outline"} className="text-[10px]">
                            #{i + 1} {String(x.h).padStart(2,"0")}h · {x.v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {[0, 1].map(row => (
                      <div key={row}>
                        <p className="text-[9px] text-muted-foreground mb-0.5">{row === 0 ? "AM (00–11h)" : "PM (12–23h)"}</p>
                        <div className="grid grid-cols-12 gap-0.5">
                          {ins.hourly.slice(row * 12, row * 12 + 12).map((v, idx) => {
                            const h = row * 12 + idx;
                            const intensity = v / maxHour;
                            const rank = ins.hourRanking.findIndex(x => x.h === h);
                            const valor = ins.hourlyValor[h];
                            const pctTotal = ins.totalRecords ? (v / ins.totalRecords) * 100 : 0;
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
                                <HoverCardContent className="w-56 text-xs space-y-1">
                                  <p className="font-bold">{String(h).padStart(2, "0")}:00 BRT {rank >= 0 && rank < 3 && <Badge variant="default" className="ml-1 text-[9px]">#{rank+1}</Badge>}</p>
                                  <p>Contagem: <span className="font-semibold">{v}</span> ({pctTotal.toFixed(1)}% do total)</p>
                                  {source === "vendas" && valor > 0 && <>
                                    <p>Faturado: <span className="text-primary font-semibold">{fmtMoney(valor)}</span></p>
                                    <p className="text-muted-foreground">Ticket médio: {fmtMoney(v ? valor / v : 0)}</p>
                                  </>}
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dias da semana + demografia */}
                {ins.totalRecords > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Dias da Semana</h3>
                      </div>
                      <div className="space-y-1.5">
                        {ins.weekday.map((v, w) => (
                          <div key={w} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-10">{DAYS[w]}</span>
                            <div className="flex-1 h-5 rounded bg-secondary relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0" style={{
                                width: `${(v / maxDay) * 100}%`,
                                background: "linear-gradient(90deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.9))",
                              }} />
                              <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium gap-2">
                                {source === "vendas" && ins.weekdayValor[w] > 0 && (
                                  <span className="text-primary/90">{fmtMoney(ins.weekdayValor[w])}</span>
                                )}
                                <span>{v}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Gênero</h3>
                      </div>
                      <div className="text-xs space-y-1.5">
                        <Bar label="Feminino" v={ins.gender.F} total={ins.totalGender} color="bg-pink-500" />
                        <Bar label="Masculino" v={ins.gender.M} total={ins.totalGender} color="bg-blue-500" />
                        <Bar label="N/D" v={ins.gender.U} total={ins.totalGender} color="bg-muted-foreground" />
                      </div>

                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Cake className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Faixas etárias</h3>
                        </div>
                        {Object.entries(ins.ageBuckets).filter(([k, v]) => k !== "?" && v > 0).map(([range, v]) => (
                          <div key={range} className="text-[11px] text-muted-foreground">{range}: <span className="text-foreground font-semibold">{v}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* UFs */}
                {ins.topUFs.length > 0 && (
                  <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Top 10 Estados (DDD)</h3>
                    </div>
                    <div className="space-y-1">
                      {ins.topUFs.map(([uf, n]) => {
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
                  </div>
                )}

                {/* Funil de Ads do produto */}
                {adsRows.length > 0 && (
                  <div className="p-4 rounded-md bg-secondary/30 border border-border space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Funil de Ads (campanhas com "{produto}")</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      <KpiBox label="Investido" value={fmtMoney(adsAgg.spend)} icon={<DollarSign className="h-3 w-3" />} />
                      <KpiBox label="CTR" value={`${adsAgg.ctr.toFixed(2)}%`} color={semColor(semaforo("ctr", adsAgg.ctr))} hint={semaforoBenchmark.ctr} />
                      <KpiBox label="CPM" value={fmtMoney(adsAgg.cpm)} />
                      <KpiBox label="Hook" value={`${adsAgg.hook.toFixed(1)}%`} color={semColor(semaforo("hook", adsAgg.hook))} hint={semaforoBenchmark.hook} />
                      <KpiBox label="Hold" value={`${adsAgg.hold.toFixed(1)}%`} color={semColor(semaforo("hold", adsAgg.hold))} hint={semaforoBenchmark.hold} />
                      <KpiBox label="Frequência" value={adsAgg.freq.toFixed(2)} color={semColor(semaforo("freq", adsAgg.freq))} hint={semaforoBenchmark.freq} />
                    </div>

                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" /> Funil
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {funnel.map((step) => (
                          <FunnelStep key={step.key} step={step} />
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> Diagnóstico
                      </h4>
                      <div className="space-y-2">
                        {diagnostics.map((d, i) => (
                          <div key={i} className={`p-2.5 rounded-md border flex items-start gap-2 ${
                            d.severity === "danger" ? "border-red-500/40 bg-red-500/5" :
                            d.severity === "warn" ? "border-amber-500/40 bg-amber-500/5" :
                            "border-emerald-500/40 bg-emerald-500/5"
                          }`}>
                            {d.severity === "danger" ? <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" /> :
                             d.severity === "warn" ? <TrendingDown className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /> :
                             <Sparkles className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                            <div>
                              <p className={`text-xs font-semibold ${
                                d.severity === "danger" ? "text-red-300" :
                                d.severity === "warn" ? "text-amber-300" : "text-emerald-300"
                              }`}>{d.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{d.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Box({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-md bg-secondary/40 border border-border">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Bar({ label, v, total, color }: { label: string; v: number; total: number; color: string }) {
  const pct = total ? (v / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 rounded bg-secondary overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums text-foreground font-semibold">{v} · {pct.toFixed(0)}%</span>
    </div>
  );
}

function KpiBox({ label, value, icon, color, hint }: { label: string; value: string; icon?: React.ReactNode; color?: string; hint?: string }) {
  const inner = (
    <div className="p-2.5 rounded-md bg-secondary/40 border border-border cursor-default">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-bold tabular-nums ${color || "text-foreground"}`}>{value}</p>
    </div>
  );
  if (!hint) return inner;
  return (
    <HoverCard openDelay={0}><HoverCardTrigger asChild>{inner}</HoverCardTrigger>
      <HoverCardContent className="text-xs w-56">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-muted-foreground">{hint}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

function FunnelStep({ step }: { step: ReturnType<typeof buildFunnel>[number] }) {
  const dropBad = step.drop != null && step.drop > 70;
  return (
    <HoverCard openDelay={0}>
      <HoverCardTrigger asChild>
        <div className="p-3 rounded-md bg-secondary/40 border border-border cursor-default">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{step.icon}</span>{step.label}
          </div>
          <p className="text-base font-bold text-foreground mt-1 tabular-nums">{fmtNum(step.value)}</p>
          {step.conv != null && (
            <p className={`text-[10px] mt-0.5 ${dropBad ? "text-red-400" : "text-emerald-400"}`}>
              {step.conv.toFixed(1)}% etapa anterior
            </p>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="text-xs w-60 space-y-1">
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
}
