import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Package, GitCompareArrows, LifeBuoy, Brain, ChevronRight, Loader2 } from "lucide-react";
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

export default function Dashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dashPeriod, setDashPeriod] = useState("30d");
  const [dashProject, setDashProject] = useState("all");
  const [dashProduct, setDashProduct] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [recoveryRisk, setRecoveryRisk] = useState(0);
  const [projectComparison, setProjectComparison] = useState<any[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    const queries: PromiseLike<any>[] = [
      supabase.from("imphq_projects").select("id, name, icon").then(({ data }) => setAllProjects(data || [])),
      supabase.from("imphq_vendas").select("produto_nome").neq("produto_nome", "").not("produto_nome", "is", null).then(({ data }) => {
        const unique = [...new Set((data || []).map((v: any) => v.produto_nome as string))].sort();
        setAllProducts(unique);
      }),
    ];
    if (user) {
      queries.push(
        supabase.from("imphq_team_members").select("role").eq("user_id", user.id).maybeSingle().then(({ data }) => {
          const r = (data?.role || "").toLowerCase();
          setIsAdmin(r === "admin" || r === "owner");
        })
      );
    }
    Promise.all(queries);
  }, [user]);

  useEffect(() => {
    if (dashProject !== "all") return;
    
    async function loadComparisonData() {
      setLoadingComparison(true);
      try {
        const { from, to } = getPeriodRange(dashPeriod);
        const fromDate = from.split("T")[0];
        const toDate = to.split("T")[0];

        // 1. Fetch all projects
        const { data: projs } = await supabase.from("imphq_projects").select("id, name, icon");
        if (!projs) return;

        // 2. Fetch approved sales grouped by project
        const { data: sales } = await supabase
          .from("imphq_vendas")
          .select("project_id, valor, valor_liquido")
          .gte("data_venda", from)
          .lte("data_venda", to)
          .in("status", ["aprovado", "approved", "paid", "completed"]);

        // 3. Fetch ads spend grouped by project
        const { data: ads } = await supabase
          .from("imphq_ads_spend")
          .select("project_id, valor, moeda")
          .gte("data_ref", fromDate)
          .lte("data_ref", toDate);

        // 4. Fetch leads count grouped by project
        const { data: leads } = await supabase
          .from("imphq_leads")
          .select("project_id, criado_em")
          .gte("criado_em", from)
          .lte("criado_em", to);

        // Aggregate data
        const aggregated = projs.map(p => {
          const projectSales = (sales || []).filter(s => s.project_id === p.id);
          const revenue = projectSales.reduce((acc, s) => acc + (Number(s.valor) || 0), 0);
          const salesCount = projectSales.length;

          const projectAds = (ads || []).filter(a => a.project_id === p.id);
          const adsSpend = projectAds.reduce((acc, a) => {
            const v = Number(a.valor) || 0;
            return acc + (a.moeda === "USD" ? v * 5.2 : v); // BRL conversions
          }, 0);

          const projectLeads = (leads || []).filter(l => l.project_id === p.id);
          const leadsCount = projectLeads.length;

          const roas = adsSpend > 0 ? revenue / adsSpend : 0;

          return {
            id: p.id,
            name: p.name,
            icon: p.icon || "📁",
            revenue,
            adsSpend,
            roas,
            leadsCount,
            salesCount
          };
        });

        // Sort by revenue descending
        aggregated.sort((a, b) => b.revenue - a.revenue);
        setProjectComparison(aggregated);
      } catch (err) {
        console.error("Erro ao carregar comparação de projetos:", err);
      } finally {
        setLoadingComparison(false);
      }
    }

    loadComparisonData();
  }, [dashProject, dashPeriod, allProjects]);

  const projectLabel = useMemo(() => {
    if (dashProject === "all") return "all";
    const p = allProjects.find((p) => p.id === dashProject);
    return p ? `${p.icon || "📁"} ${p.name}` : dashProject;
  }, [dashProject, allProjects]);

  return (
    <div className="space-y-10 animate-fade-in max-w-[1600px] mx-auto">
      {/* HERO EDITORIAL */}
      <DashboardHero
        projectFilter={dashProject}
        projectLabel={projectLabel}
        productLabel={dashProduct}
      />

      {/* RESUMO EXECUTIVO — visão consolidada */}
      <ExecutiveSummary projectFilter={dashProject} />


      {/* FILTROS — barra discreta */}
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

      {/* COCKPIT KPI STRIP */}
      <section>
        <DashboardStats
          period={dashPeriod}
          projectFilter={dashProject}
          productFilter={dashProduct}
          compare={compareMode}
          variant="strip"
        />
      </section>

      {/* IMPERIUS STRIP */}
      <section>
        <ImperiusStrip projectId={dashProject} />
      </section>

      {/* COMPARATIVO DE PROJETOS */}
      {dashProject === "all" && (
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

      {/* PRODUCT COPILOT AD BANNER */}
      <section className="relative rounded-xl border border-gold/30 bg-gradient-to-r from-gold/5 via-secondary/10 to-transparent p-5 backdrop-blur-md overflow-hidden animate-fade-in group">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
          <Brain className="h-24 w-24 text-gold" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase bg-gold/15 text-gold px-2.5 py-0.5 rounded-full border border-gold/30">Cérebro IA</span>
              <span className="text-[10px] text-muted-foreground font-mono">NOVO RECURSO</span>
            </div>
            <h3 className="font-serif text-lg text-foreground font-medium">Modelador de Oferta & Copilot de Produtos</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Escreva ganchos de tráfego, timeline de VSL, stack de bônus e o mecanismo único para qualquer projeto com o novo assistente interativo da Imperio HQ.
            </p>
          </div>
          <Link
            to="/product-copilot"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-slate-950 text-xs font-semibold hover:bg-gold/80 transition-all self-start md:self-center shrink-0 shadow-lg shadow-gold/10"
          >
            <span>Modelar Novo Produto</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <FacebookHealthAlert />

      {/* HOJE + LIVE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayCard projectId={dashProject} />
        <LiveFunnelPanel projectFilter={dashProject} />
      </section>

      {/* CÉREBRO DA IA — INSPETOR DE RAG & MEMÓRIA */}
      <section className="space-y-3">
        <SectionHead kicker="Inteligência da IA" title="Central de Conhecimento & RAG Inspector" />
        <RagInspector projectFilter={dashProject} />
      </section>

      {/* FÁBRICA DE CRIATIVOS */}
      <section className="space-y-3">
        <SectionHead kicker="Fábrica de Criativos" title="Creative Factory & Fábrica de Ângulos" />
        <DashboardCreativeHub projectId={dashProject} />
      </section>

      {/* PREDITIVO + HOT LEADS + ALERTS */}
      <section className="space-y-4">
        <SectionHead kicker="Sinais" title="Hoje em risco" />
        <PredictiveDashboard period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
        <HotLeadAlerts projectFilter={dashProject} />
        <DashboardAlerts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      </section>

      {/* RECEITA + FUNIL / RECUPERAÇÃO */}
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

      {/* ADS + AI RECUPERADO */}
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

      {/* CHARTS + CARDS */}
      <section>
        <SectionHead kicker="Detalhes" title="O retrato completo" />
        <DashboardCharts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
        <div className="mt-6">
          <DashboardCards period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} />
        </div>
      </section>

      {/* RELATÓRIO SEMANAL */}
      <section>
        <SectionHead kicker="Resumo" title="Relatório da semana" />
        <WeeklyReportWidget projectFilter={dashProject} />
      </section>

      {/* ATIVIDADE + CRESCIMENTO */}
      <section>
        <SectionHead kicker="Pulso" title="Atividade e crescimento" />
        <ActivityFeed period={dashPeriod} projectFilter={dashProject} />
        <div className="mt-6">
          <GrowthDashboard projectFilter={dashProject} />
        </div>
      </section>
    </div>
  );
}
