import { useEffect, useMemo, useState } from "react";
import {
  fetchCohortDataset,
  buildCohortMatrix,
  buildChannelLtv,
  formatBRL,
  type LeadRow,
  type VendaRow,
  type AdsSpendRow,
} from "@/lib/cohortAnalysis";
import { CohortMatrix } from "@/components/cohort/CohortMatrix";
import { LtvByChannelTable } from "@/components/cohort/LtvByChannelTable";
import { CohortDrillPanel } from "@/components/cohort/CohortDrillPanel";
import { CreativeLtvTable } from "@/components/cohort/CreativeLtvTable";
import { fetchCreativeDataset, buildCreativeRoas, type CreativeGroupBy, type AdSpendDetailedRow, type VendaDetailedRow } from "@/lib/creativeLtv";
import { KpiHeroCard } from "@/components/shared/KpiHeroCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Crown, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionInfo } from "@/components/SectionInfo";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { useRevenueMode } from "@/lib/revenueMode";

export default function Cohort() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [ads, setAds] = useState<AdsSpendRow[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("all");
  const [metric, setMetric] = useState<"rate" | "revenue" | "buyers">("rate");
  const [drill, setDrill] = useState<{ cohort: string; offset: number } | null>(null);
  const [creativeAds, setCreativeAds] = useState<AdSpendDetailedRow[]>([]);
  const [creativeVendas, setCreativeVendas] = useState<VendaDetailedRow[]>([]);
  const [groupBy, setGroupBy] = useState<CreativeGroupBy>("campanha");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name")
        .or("is_archived.eq.false,is_archived.is.null")
        .order("name");
      setProjects((data || []) as any);
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const pid = projectId === "all" ? undefined : projectId;
    Promise.all([fetchCohortDataset(pid), fetchCreativeDataset(pid)]).then(([d, c]) => {
      if (!alive) return;
      setLeads(d.leads);
      setVendas(d.vendas);
      setAds(d.ads);
      setCreativeAds(c.ads);
      setCreativeVendas(c.vendas);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  const matrix = useMemo(() => buildCohortMatrix(leads, vendas), [leads, vendas]);
  const channels = useMemo(() => buildChannelLtv(leads, vendas, ads), [leads, vendas, ads]);
  const creativeBuild = useMemo(() => buildCreativeRoas(creativeAds, creativeVendas, groupBy), [creativeAds, creativeVendas, groupBy]);
  const creativeRows = creativeBuild.rows;
  const matchingReport = creativeBuild.report;

  const totals = useMemo(() => {
    const totalRev = vendas.reduce((s, v) => s + (v.valor || 0), 0);
    const totalLeads = leads.length;
    const totalBuyers = new Set(vendas.map((v) => v.lead_id).filter(Boolean)).size;
    const conv = totalLeads > 0 ? (totalBuyers / totalLeads) * 100 : 0;
    const ltv = totalLeads > 0 ? totalRev / totalLeads : 0;
    const totalCac = ads.reduce((s, a) => s + (a.valor || 0), 0);
    const cacAvg = totalBuyers > 0 ? totalCac / totalBuyers : 0;
    const ratio = cacAvg > 0 ? ltv / cacAvg : 0;
    const top3Channels = channels
      .filter((c) => c.ltvCacRatio > 0)
      .slice(0, 3)
      .map((c) => c.channel);
    return { totalRev, totalLeads, totalBuyers, conv, ltv, cacAvg, ratio, top3Channels };
  }, [leads, vendas, ads, channels]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Crown className="h-7 w-7 text-primary" />
            Cohort & LTV
            <SectionInfo title="Cohort & LTV" description="Descobre qual canal traz cliente que fica e recompra. Cohort por mês de aquisição × meses subsequentes. LTV/CAC por utm_source." />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quem traz cliente que fica. Receita acumulada por safra de leads e canal.
          </p>
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiHeroCard label="Leads totais" value={totals.totalLeads} format="number" icon={<Layers className="h-3 w-3" />} />
        <KpiHeroCard label="Compradores" value={totals.totalBuyers} format="number" />
        <KpiHeroCard label="LTV médio" value={totals.ltv} format="currency" tooltip="Receita total / leads únicos" />
        <KpiHeroCard
          label="LTV/CAC"
          value={totals.ratio}
          format="multiplier"
          benchmark={{ good: 3, warn: 1 }}
          tooltip="Quanto retorna por real investido em ads"
          icon={<TrendingUp className="h-3 w-3" />}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Calculando cohort…
        </div>
      ) : (
        <Tabs defaultValue="matrix" className="space-y-4">
          <TabsList>
            <TabsTrigger value="matrix">Matriz Cohort</TabsTrigger>
            <TabsTrigger value="channels">LTV por Canal</TabsTrigger>
            <TabsTrigger value="creative">🎯 ROAS por Criativo</TabsTrigger>
            <TabsTrigger value="top">Top Canais</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Métrica:</span>
              <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rate">% recompra</SelectItem>
                  <SelectItem value="buyers">Compradores</SelectItem>
                  <SelectItem value="revenue">Receita</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-2 text-[10px] uppercase tracking-wider">Clique numa célula pra ver leads</span>
            </div>
            <CohortMatrix
              data={matrix}
              metric={metric}
              onCellClick={(c, o) => setDrill({ cohort: c, offset: o })}
            />
          </TabsContent>

          <TabsContent value="channels">
            <LtvByChannelTable data={channels} />
          </TabsContent>

          <TabsContent value="creative">
            <CreativeLtvTable data={creativeRows} groupBy={groupBy} onGroupByChange={setGroupBy} report={matchingReport} />
          </TabsContent>

          <TabsContent value="top">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                  Top 5 canais por LTV/CAC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {channels.filter((c) => c.ltvCacRatio > 0).slice(0, 5).map((c, i) => (
                    <div key={c.channel} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl font-display font-bold text-primary w-8">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="font-mono font-semibold capitalize truncate">{c.channel}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.leads} leads · {c.buyers} compradores · {formatBRL(c.revenue)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-display font-bold text-primary tabular-nums">
                          {c.ltvCacRatio.toFixed(2)}x
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">LTV/CAC</p>
                      </div>
                    </div>
                  ))}
                  {channels.filter((c) => c.ltvCacRatio > 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Configure ads e capture utm_source nos leads pra calcular ratio.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <CohortDrillPanel
        open={!!drill}
        onOpenChange={(o) => !o && setDrill(null)}
        cohortMonth={drill?.cohort || null}
        monthOffset={drill?.offset ?? null}
        leads={leads}
        vendas={vendas}
      />
    </div>
  );
}
