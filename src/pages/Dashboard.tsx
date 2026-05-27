import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Package, GitCompareArrows, LifeBuoy } from "lucide-react";
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

  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, icon").then(({ data }) => setAllProjects(data || []));
    supabase.from("imphq_vendas").select("produto_nome").neq("produto_nome", "").not("produto_nome", "is", null).then(({ data }) => {
      const unique = [...new Set((data || []).map((v: any) => v.produto_nome as string))].sort();
      setAllProducts(unique);
    });
    if (user) {
      supabase.from("imphq_team_members").select("role").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        const r = (data?.role || "").toLowerCase();
        setIsAdmin(r === "admin" || r === "owner");
      });
    }
  }, [user]);

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

      <FacebookHealthAlert />

      {/* HOJE + LIVE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayCard projectId={dashProject} />
        <LiveFunnelPanel projectFilter={dashProject} />
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
