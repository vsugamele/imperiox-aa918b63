import type { Tables } from "@/integrations/supabase/types";
type AdSpend = Tables<"imphq_ads_spend">;
type RevenueRow = Pick<Tables<"imphq_vendas">,"id"|"project_id"|"produto_nome"|"valor"|"valor_liquido"|"plataforma"|"data_venda"|"utm_campaign"|"utm_content"|"utm_term"|"status"|"tipo_venda">;
/** Só venda paga conta no faturamento (recusado, pix gerado e reembolso ficam de fora). */
const PAID_STATUSES = ["aprovado", "approved", "paid", "completed"];
/** Limites do dia em BRT: data_venda é timestamp, então "≤ 2026-10-07" cortava o próprio dia (o filtro "Hoje" dava zero). */
const brtStart = (day: string) => `${day}T00:00:00-03:00`;
const brtNextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T00:00:00-03:00`;
};
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Calendar, Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateStr, localDaysAgo } from "@/lib/periodUtils";
import { CampanhasTable } from "@/components/gerenciador/CampanhasTable";
import { AcoesHistorico } from "@/components/gerenciador/AcoesHistorico";
import { KpiCardsHeader } from "@/components/gerenciador/KpiCardsHeader";
import { AlertsHeader } from "@/components/gerenciador/AlertsHeader";
import { AttributionDiagnostic } from "@/components/gerenciador/AttributionDiagnostic";
import { IntegrationsHealthStrip } from "@/components/gerenciador/IntegrationsHealthStrip";
import { TictoEventFlowDiagnostic } from "@/components/gerenciador/TictoEventFlowDiagnostic";
import { RulesPanel } from "@/components/gerenciador/RulesPanel";
import { CreateCampaignModal } from "@/components/gerenciador/CreateCampaignModal";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { useRevenueMode, getRevenue } from "@/lib/revenueMode";


const PERIODS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "60 dias", days: 60 },
];

export default function Gerenciador() {
  const [projects, setProjects] = useState<{ id: string; name: string; data?: unknown }[]>([]);
  const [projectId, setProjectId] = useState<string>("__all__");
  const [days, setDays] = useState<number>(30);
  const [ads, setAds] = useState<AdSpend[]>([]);
  const [adsPrev, setAdsPrev] = useState<AdSpend[]>([]);
  const [vendas, setVendas] = useState<RevenueRow[]>([]);
  const [vendasPrev, setVendasPrev] = useState<RevenueRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [forcedSearch, setForcedSearch] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);


  // Carregar projetos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name, data").order("name");
      setProjects((data as { id: string; name: string; data?: unknown }[]) || []);
    })();
  }, []);

  // Carregar ads + vendas (atual + período anterior em paralelo)
  useEffect(() => {
    (async () => {
      const span = Math.max(1, days);
      const from = localDaysAgo(days);
      const to = toLocalDateStr();
      const fromPrev = localDaysAgo(days * 2 + 1);
      const toPrev = localDaysAgo(span + 1);

      const baseAds = (gte: string, lte: string) => {
        let q = supabase.from("imphq_ads_spend").select("*").gte("data_ref", gte).lte("data_ref", lte).not("ad_id", "ilike", "CAMP:%").limit(2000);
        if (projectId !== "__all__") q = q.eq("project_id", projectId);
        return q;
      };
      const baseVendas = (gte: string, lte: string) => {
        let q = supabase.from("imphq_vendas").select("id, project_id, produto_nome, valor, valor_liquido, plataforma, data_venda, utm_campaign, utm_content, utm_term, status, tipo_venda")
          .in("status", PAID_STATUSES).gte("data_venda", brtStart(gte)).lt("data_venda", brtNextDay(lte)).limit(5000);
        if (projectId !== "__all__") q = q.eq("project_id", projectId);
        return q;
      };

      const [a1, a2, v1, v2] = await Promise.all([
        baseAds(from, to),
        baseAds(fromPrev, toPrev),
        baseVendas(from, to),
        baseVendas(fromPrev, toPrev),
      ]);

      setAds(a1.data || []);
      setAdsPrev(a2.data || []);
      setVendas(v1.data || []);
      setVendasPrev(v2.data || []);
    })();
  }, [projectId, days, refreshKey]);

  const periodLabel = useMemo(() => {
    const from = localDaysAgo(days);
    const to = toLocalDateStr();
    const fmt = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
    return `${fmt(from)} → ${fmt(to)}`;
  }, [days]);

  // Totais (atual e anterior) — Meta apenas
  const metaAds = useMemo(() => ads.filter(a => a.plataforma === "Facebook" || a.plataforma === "Meta"), [ads]);
  const metaAdsPrev = useMemo(() => adsPrev.filter(a => a.plataforma === "Facebook" || a.plataforma === "Meta"), [adsPrev]);

  const [revenueMode] = useRevenueMode();

  const totals = useMemo(() => {
    const sum = (arr: AdSpend[], key: "valor" | "compras") => arr.reduce((s, x) => s + Number(x[key] || 0), 0);
    const sumVendas = (arr: RevenueRow[]) => arr.reduce((s, v) => s + getRevenue(v, revenueMode), 0);
    // Compras = vendas reais do checkout (order bump soma no faturamento, não conta venda); o pixel duplica e fica de referência.
    const realSales = (arr: RevenueRow[]) => arr.filter((v) => !/bump/i.test(v.tipo_venda ?? "")).length;
    return {
      cur: { valor: sum(metaAds, "valor"), compras: realSales(vendas), pixel: sum(metaAds, "compras"), receita: sumVendas(vendas) },
      prev: { valor: sum(metaAdsPrev, "valor"), compras: realSales(vendasPrev), pixel: sum(metaAdsPrev, "compras"), receita: sumVendas(vendasPrev) },
    };
  }, [metaAds, metaAdsPrev, vendas, vendasPrev, revenueMode]);

  // Meta de CPA do projeto ou calculada pelo ticket médio global
  const cpaTarget = useMemo(() => {
    const currentProject = projects.find(p => p.id === projectId);
    const pData = currentProject?.data as Record<string, unknown> | null;
    if (typeof pData?.cpa_alvo === "number" && pData.cpa_alvo > 0) return pData.cpa_alvo;
    const avgTicket = vendas.length > 0 ? (totals.cur.receita / vendas.length) : 0;
    return avgTicket > 0 ? avgTicket * 0.4 : 50;
  }, [projects, projectId, vendas, totals.cur.receita]);

  // Série diária de gasto por campaign_id (para sparkline)
  const dailySpendByCamp = useMemo(() => {
    const m = new Map<string, Map<string, number>>(); // camp -> (date -> spend)
    const dates = new Set<string>();
    for (const a of metaAds) {
      const k = a.campaign_id || a.campanha || "—";
      const d = String(a.data_ref || "").slice(0, 10);
      if (!d) continue;
      dates.add(d);
      if (!m.has(k)) m.set(k, new Map());
      const inner = m.get(k)!;
      inner.set(d, (inner.get(d) || 0) + Number(a.valor || 0));
    }
    const ordered = Array.from(dates).sort();
    const result = new Map<string, number[]>();
    m.forEach((inner, camp) => {
      result.set(camp, ordered.map(d => inner.get(d) || 0));
    });
    return result;
  }, [metaAds]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      if (projectId === "__all__") {
        const { data, error } = await supabase.functions.invoke("facebook-ads-sync-all", {
          body: {},
        });
        if (error) throw error;
        if (data?.error) {
          toast.error(`Falha no sync da Meta: ${data.details || data.error}`);
        } else {
          const syncedCount = data?.synced ?? data?.results?.length ?? 0;
          toast.success(`Sincronização com a Meta concluída (${syncedCount} projeto(s))!`);
          setRefreshKey((k) => k + 1);
        }
      } else {
        const { data, error } = await supabase.functions.invoke("facebook-ads-sync", {
          body: { project_id: projectId },
        });
        if (error) throw error;
        if (data?.error) {
          toast.error(`Falha no sync da Meta: ${data.details || data.error}`);
        } else {
          toast.success("Sincronização com o Meta Ads concluída com sucesso!");
          setRefreshKey((k) => k + 1);
        }
      }
    } catch (e) {
      toast.error(`Erro ao sincronizar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const exportCsv = () => {
    if (ads.length === 0) return;
    const headers = Object.keys(ads[0]);
    const csv = [
      headers.join(","),
      ...ads.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gerenciador-${periodLabel.replace(/[^\d]/g, "")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Gerenciador</h1>
          <p className="text-xs text-muted-foreground mt-1">Controle direto das suas campanhas Meta — pausar, ativar e diagnosticar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px] h-9 bg-secondary/30 border-border/40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[160px] h-9 bg-secondary/30 border-border/40 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="default"
            size="sm"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="gap-1.5 h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
            title={projectId === "__all__" ? "Sincronizar todos os projetos configurados com a Meta" : "Sincronizar projeto selecionado com o Meta Ads"}
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar Meta Agora
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 h-9 text-xs">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-9 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nova Campanha
          </Button>
          <RevenueModeToggle />
          <span className="text-xs text-muted-foreground tabular-nums px-2">{periodLabel}</span>
        </div>
      </div>

      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId !== "__all__" ? projectId : undefined}
        onCreated={() => setRefreshKey(k => k + 1)}
      />


      <Tabs defaultValue="meta" className="space-y-4">
        <TabsList className="bg-transparent border-b border-border/30 rounded-none h-auto p-0 gap-1">
          <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 py-2 text-xs uppercase tracking-wider">Meta Ads</TabsTrigger>
          <TabsTrigger value="google" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 py-2 text-xs uppercase tracking-wider">Google Ads</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6 mt-4">
          {/* Saúde das integrações */}
          <IntegrationsHealthStrip />

          {/* KPI Cards com Δ% vs período anterior */}
          <KpiCardsHeader current={totals.cur} previous={totals.prev} />

          {/* Alertas críticos */}
          <AlertsHeader ads={metaAds} onFilter={(term) => setForcedSearch(term)} projectId={projectId !== "__all__" ? projectId : undefined} />

          {/* Painel de Regras Automáticas */}
          <RulesPanel />

          {/* Diagnóstico de atribuição */}
          <AttributionDiagnostic vendas={vendas} />
          <TictoEventFlowDiagnostic projectId={projectId !== "__all__" ? projectId : undefined} />

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Todas as Campanhas</p>
            <CampanhasTable
              ads={metaAds}
              adsPrev={metaAdsPrev}
              vendas={vendas}
              projectId={projectId !== "__all__" ? projectId : undefined}
              cpaTarget={cpaTarget}
              onAfterToggle={() => setRefreshKey(k => k + 1)}
              forcedSearch={forcedSearch}
              onSearchChange={() => setForcedSearch(undefined)}
              dailySpendByCamp={dailySpendByCamp}
            />
          </div>

          <AcoesHistorico projectId={projectId !== "__all__" ? projectId : undefined} />
        </TabsContent>

        <TabsContent value="google" className="mt-4">
          <Card className="bg-secondary/30 border-border/40">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Google Ads em breve. Conecte sua conta na seção Empresa para começar.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
