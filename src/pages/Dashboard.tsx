import { useEffect, useState } from "react";
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
import ConversionFunnel from "@/components/dashboard/ConversionFunnel";
import AcquisitionFunnel from "@/components/dashboard/AcquisitionFunnel";
import HotLeadAlerts from "@/components/dashboard/HotLeadAlerts";
import PredictiveDashboard from "@/components/dashboard/PredictiveDashboard";
import LiveFunnelPanel from "@/components/dashboard/LiveFunnelPanel";
import DailyBriefing from "@/components/dashboard/DailyBriefing";
import RecoveryGlobalCard from "@/components/dashboard/RecoveryGlobalCard";
import AIRevenueRecoveredCard from "@/components/dashboard/AIRevenueRecoveredCard";
import FacebookHealthAlert from "@/components/dashboard/FacebookHealthAlert";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { PageHeader } from "@/components/shared/PageHeader";
import TodayCard from "@/components/dashboard/TodayCard";


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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do seu império digital"
        primaryAction={
          <div className="flex items-center gap-2">
            <SectionInfo {...sectionHelpTexts.dashboard} />
            <Link
              to={dashProject !== "all" ? `/recuperacao?projeto=${dashProject}` : "/recuperacao"}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.02]",
                recoveryRisk > 0
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400 animate-pulse"
                  : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
              )}
            >
              <LifeBuoy className="h-4 w-4" />
              <span>Recuperação{recoveryRisk > 0 ? ` · R$ ${recoveryRisk.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} em risco` : ""}</span>
            </Link>
          </div>
        }
      />

      <TodayCard projectId={dashProject} />


      {/* Period + Project + Product Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <Select value={dashPeriod} onValueChange={setDashPeriod}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {allProjects.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Package className="h-4 w-4 text-muted-foreground ml-1" />
        <Select value={dashProduct} onValueChange={setDashProduct}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {allProducts.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto px-3 py-1 rounded-md border border-border bg-secondary/30">
          <GitCompareArrows className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="compare-toggle" className="text-xs cursor-pointer select-none">Comparar período anterior</Label>
          <Switch id="compare-toggle" checked={compareMode} onCheckedChange={setCompareMode} />
        </div>
        <RevenueModeToggle />
      </div>

      <FacebookHealthAlert />
      <DailyBriefing projectFilter={dashProject} />
      <LiveFunnelPanel projectFilter={dashProject} />
      <PredictiveDashboard period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <HotLeadAlerts projectFilter={dashProject} />
      <DashboardAlerts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <DashboardStats period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} compare={compareMode} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardRevenue period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} compare={compareMode} />
        </div>
        <AcquisitionFunnel period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardAds period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} allProjects={allProjects} />
        </div>
        <RecoveryGlobalCard projectFilter={dashProject} onRiskChange={setRecoveryRisk} />
      </div>
      <AIRevenueRecoveredCard projectFilter={dashProject} />
      <DashboardCharts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <DashboardCards period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} />
      <ActivityFeed period={dashPeriod} projectFilter={dashProject} />
      <GrowthDashboard projectFilter={dashProject} />
    </div>
  );
}
