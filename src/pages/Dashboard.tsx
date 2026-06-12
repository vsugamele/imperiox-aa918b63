import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Package, GitCompareArrows, LifeBuoy, Loader2, Crown, Megaphone, DollarSign, LayoutGrid } from "lucide-react";
import { getPeriodRange } from "@/lib/periodUtils";
import { cn } from "@/lib/utils";
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardRevenue from "@/components/dashboard/DashboardRevenue";
import DashboardAds from "@/components/dashboard/DashboardAds";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DashboardCards from "@/components/dashboard/DashboardCards";
import DashboardAlerts from "@/components/dashboard/DashboardAlerts";
import GrowthDashboard from "@/components/dashboard/GrowthDashboard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import AcquisitionFunnel from "@/components/dashboard/AcquisitionFunnel";
import HotLeadAlerts from "@/components/dashboard/HotLeadAlerts";
import PredictiveDashboard from "@/components/dashboard/PredictiveDashboard";
import LiveFunnelPanel from "@/components/dashboard/LiveFunnelPanel";
import RecoveryGlobalCard from "@/components/dashboard/RecoveryGlobalCard";
import AIRevenueRecoveredCard from "@/components/dashboard/AIRevenueRecoveredCard";
import FacebookHealthAlert from "@/components/dashboard/FacebookHealthAlert";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import TodayCard from "@/components/dashboard/TodayCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ImperiusStrip } from "@/components/dashboard/ImperiusStrip";
import ExecutiveSummary from "@/components/dashboard/ExecutiveSummary";
import { WeeklyReportWidget } from "@/components/dashboard/WeeklyReportWidget";
import { LazySection } from "@/components/dashboard/LazySection";


function SectionHead({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <div className="kicker mb-1">{kicker}</div>
        <h2 className="section-title">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type DashView = "completo" | "executivo" | "marketing" | "financeiro";
const VIEW_LS_KEY = "imphq.dashboard.view";

const VIEW_SECTIONS: Record<DashView, Set<string>> = {
  completo: new Set(["hero","resumo","kpi","imperius","comparativo","fb-health","hoje","preditivo","receita","ads","charts","semanal","atividade"]),
  executivo: new Set(["hero","resumo","kpi","imperius","comparativo","receita","semanal","atividade"]),
  marketing: new Set(["kpi","imperius","hoje","preditivo","ads","charts","atividade","fb-health"]),
  financeiro: new Set(["resumo","kpi","receita","ads","charts","semanal","comparativo"]),
};

export default function Dashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dashPeriod, setDashPeriod] = useState("30d");
  const [dashProject, setDashProject] = useState("all");
  const [dashProduct, setDashProduct] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [recoveryRisk, setRecoveryRisk] = useState(0);
  const [view, setView] = useState<DashView>(() => {
    try { return (localStorage.getItem(VIEW_LS_KEY) as DashView) || "completo"; } catch { return "completo"; }
  });
  useEffect(() => { try { localStorage.setItem(VIEW_LS_KEY, view); } catch {} }, [view]);
  const show = (id: string) => VIEW_SECTIONS[view].has(id);

  // Reference queries — shared hook (TanStack) deduplicates across the whole app
  const { data: allProjects = [] } = useProjectList({ includeArchived: true });


  const { data: allProducts = [] } = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("imphq_vendas")
        .select("produto_nome")
        .neq("produto_nome", "")
        .not("produto_nome", "is", null);
      return [...new Set((data || []).map((v: any) => v.produto_nome as string))].sort();
    },
    staleTime: 10 * 60_000,
  });

  useQuery({
    queryKey: ["dashboard", "role", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("imphq_team_members").select("role").eq("user_id", user!.id).maybeSingle();
      const r = (data?.role || "").toLowerCase();
      setIsAdmin(r === "admin" || r === "owner");
      return data;
    },
  });

  // Comparison data — only when "all" projects selected, cached per period
  const { data: projectComparison = [], isFetching: loadingComparison } = useQuery({
    queryKey: ["dashboard", "comparison", dashPeriod, allProjects.length],
    enabled: dashProject === "all" && allProjects.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { from, to } = getPeriodRange(dashPeriod);
      const fromDate = from.split("T")[0];
      const toDate = to.split("T")[0];

      const [projsRes, salesRes, adsRes, leadsRes] = await Promise.all([
        supabase.from("imphq_projects").select("id, name, icon"),
        supabase
          .from("imphq_vendas")
          .select("project_id, valor, valor_liquido")
          .gte("data_venda", from)
          .lte("data_venda", to)
          .in("status", ["aprovado", "approved", "paid", "completed"]),
        supabase
          .from("imphq_ads_spend")
          .select("project_id, valor, moeda")
          .gte("data_ref", fromDate)
          .lte("data_ref", toDate),
        supabase
          .from("imphq_leads")
          .select("project_id, criado_em")
          .gte("criado_em", from)
          .lte("criado_em", to),
      ]);

      const projs = projsRes.data || [];
      const sales = salesRes.data || [];
      const ads = adsRes.data || [];
      const leads = leadsRes.data || [];

      const aggregated = projs.map(p => {
        const projectSales = sales.filter(s => s.project_id === p.id);
        const revenue = projectSales.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
        const salesCount = projectSales.length;
        const projectAds = ads.filter(a => a.project_id === p.id);
        const adsSpend = projectAds.reduce((acc, a) => {
          const v = Number(a.valor) || 0;
          return acc + (a.moeda === "USD" ? v * 5.2 : v);
        }, 0);
        const leadsCount = leads.filter(l => l.project_id === p.id).length;
        const roas = adsSpend > 0 ? revenue / adsSpend : 0;
        return { id: p.id, name: p.name, icon: p.icon || "📁", revenue, adsSpend, roas, leadsCount, salesCount };
      });

      aggregated.sort((a, b) => b.revenue - a.revenue);
      return aggregated;
    },
  });

  const projectLabel = useMemo(() => {
    if (dashProject === "all") return "all";
    const p = allProjects.find((p) => p.id === dashProject);
    return p ? `${p.icon || "📁"} ${p.name}` : dashProject;
  }, [dashProject, allProjects]);

  return (
    <div className="space-y-10 animate-fade-in max-w-[1600px] mx-auto">
      {/* HERO EDITORIAL */}
      {show("hero") && (
        <DashboardHero
          projectFilter={dashProject}
          projectLabel={projectLabel}
          productLabel={dashProduct}
        />
      )}

      {/* RESUMO EXECUTIVO — visão consolidada */}
      {show("resumo") && <ExecutiveSummary projectFilter={dashProject} />}




      {/* FILTROS — barra discreta sticky */}
      <div className="sticky top-14 z-20 -mx-2 px-2 py-2 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={dashPeriod} onValueChange={setDashPeriod}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-transparent border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dashProject} onValueChange={setDashProject}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-transparent border-border/60"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {allProjects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Package className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          <Select value={dashProduct} onValueChange={setDashProduct}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-transparent border-border/60"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Produtos</SelectItem>
              {allProducts.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto px-3 py-1 rounded-md border border-border/60 bg-secondary/20">
            <GitCompareArrows className="h-3 w-3 text-muted-foreground" />
            <Label htmlFor="compare-toggle" className="text-[11px] cursor-pointer select-none">Comparar período</Label>
            <Switch id="compare-toggle" checked={compareMode} onCheckedChange={setCompareMode} />
          </div>
          <RevenueModeToggle />
          <SectionInfo {...sectionHelpTexts.dashboard} />
          <div className="flex items-center gap-0.5 border border-border/60 rounded-md p-0.5 bg-secondary/20" title="Visão do Dashboard">
            {([
              ["completo", LayoutGrid, "Tudo"],
              ["executivo", Crown, "Executivo"],
              ["marketing", Megaphone, "Marketing"],
              ["financeiro", DollarSign, "Financeiro"],
            ] as const).map(([key, Icon, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-1 rounded text-[10px] uppercase tracking-wider transition",
                  view === key ? "bg-gold/15 text-gold" : "text-muted-foreground/70 hover:text-foreground"
                )}
                title={label}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
          <Link
            to={dashProject !== "all" ? `/recuperacao?projeto=${dashProject}` : "/recuperacao"}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all",
              recoveryRisk > 0
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <LifeBuoy className="h-3 w-3" />
            <span>Recuperação{recoveryRisk > 0 ? ` · R$ ${recoveryRisk.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""}</span>
          </Link>
        </div>
      </div>


      {/* COCKPIT KPI STRIP */}
      {show("kpi") && (
        <section>
          <DashboardStats
            period={dashPeriod}
            projectFilter={dashProject}
            productFilter={dashProduct}
            compare={compareMode}
            variant="strip"
          />
        </section>
      )}

      {/* IMPERIUS STRIP */}
      {show("imperius") && (
        <section>
          <ImperiusStrip projectId={dashProject} />
        </section>
      )}

      {/* COMPARATIVO DE PROJETOS */}
      {show("comparativo") && dashProject === "all" && (
        <section className="space-y-3">
          <SectionHead kicker="Consolidado" title="Performance Comparativa de Projetos" />
          <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden p-6">
            {loadingComparison ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                <span>Carregando comparativo...</span>
              </div>
            ) : projectComparison.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Nenhum dado encontrado para o período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-medium">
                      <th className="py-3 px-4">Projeto</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">Gastos Ads</th>
                      <th className="py-3 px-4 text-right">ROAS</th>
                      <th className="py-3 px-4 text-right">Vendas</th>
                      <th className="py-3 px-4 text-right">Leads</th>
                      <th className="py-3 px-4 text-right">Contribuição %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectComparison.map((p) => {
                      const totalRev = projectComparison.reduce((sum, item) => sum + item.revenue, 0);
                      const contrib = totalRev > 0 ? (p.revenue / totalRev) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors">
                          <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                            <span className="text-base">{p.icon || "📁"}</span>
                            <span>{p.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">
                            {p.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground">
                            {p.adsSpend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className={cn(
                            "py-3.5 px-4 text-right font-medium",
                            p.roas >= 2.0 ? "text-emerald-400" : p.roas >= 1.0 ? "text-amber-400" : "text-rose-400"
                          )}>
                            {p.roas.toFixed(2)}x
                          </td>
                          <td className="py-3.5 px-4 text-right text-foreground font-medium">
                            {p.salesCount}
                          </td>
                          <td className="py-3.5 px-4 text-right text-muted-foreground">
                            {p.leadsCount}
                          </td>
                          <td className="py-3.5 px-4 text-right text-gold font-mono font-medium">
                            {contrib.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {show("fb-health") && <FacebookHealthAlert />}

      {/* HOJE + LIVE */}
      {show("hoje") && (
        <LazySection minHeight={320}>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayCard projectId={dashProject} />
            <LiveFunnelPanel projectFilter={dashProject} />
          </section>
        </LazySection>
      )}

      {/* PREDITIVO + HOT LEADS + ALERTS */}
      {show("preditivo") && (
        <LazySection minHeight={400}>
          <section className="space-y-4">
            <SectionHead kicker="Sinais" title="Hoje em risco" />
            <PredictiveDashboard period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
            <HotLeadAlerts projectFilter={dashProject} />
            <DashboardAlerts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
          </section>
        </LazySection>
      )}

      {/* RECEITA + FUNIL / RECUPERAÇÃO */}
      {show("receita") && (
        <LazySection minHeight={420}>
          <section>
            <SectionHead kicker="Receita & Aquisição" title="Como o dinheiro entra" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <DashboardRevenue period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} compare={compareMode} />
              </div>
              <div className="lg:col-span-4 space-y-6">
                <AcquisitionFunnel period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
                <RecoveryGlobalCard projectFilter={dashProject} onRiskChange={setRecoveryRisk} />
              </div>
            </div>
          </section>
        </LazySection>
      )}

      {/* ADS + AI RECUPERADO */}
      {show("ads") && (
        <LazySection minHeight={400}>
          <section>
            <SectionHead kicker="Mídia paga" title="Onde o capital queima" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <DashboardAds period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} allProjects={allProjects} />
              </div>
              <div className="lg:col-span-4">
                <AIRevenueRecoveredCard projectFilter={dashProject} />
              </div>
            </div>
          </section>
        </LazySection>
      )}

      {/* CHARTS + CARDS */}
      {show("charts") && (
        <LazySection minHeight={500}>
          <section>
            <SectionHead kicker="Detalhes" title="O retrato completo" />
            <DashboardCharts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
            <div className="mt-6">
              <DashboardCards period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} />
            </div>
          </section>
        </LazySection>
      )}

      {/* RELATÓRIO SEMANAL */}
      {show("semanal") && (
        <LazySection minHeight={260}>
          <section>
            <SectionHead kicker="Resumo" title="Relatório da semana" />
            <WeeklyReportWidget projectFilter={dashProject} />
          </section>
        </LazySection>
      )}

      {/* ATIVIDADE + CRESCIMENTO */}
      {show("atividade") && (
        <LazySection minHeight={400}>
          <section>
            <SectionHead kicker="Pulso" title="Atividade e crescimento" />
            <ActivityFeed period={dashPeriod} projectFilter={dashProject} />
            <div className="mt-6">
              <GrowthDashboard projectFilter={dashProject} />
            </div>
          </section>
        </LazySection>
      )}
    </div>
  );
}
