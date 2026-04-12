import { useEffect, useState } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Package } from "lucide-react";
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardRevenue from "@/components/dashboard/DashboardRevenue";
import DashboardAds from "@/components/dashboard/DashboardAds";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DashboardCards from "@/components/dashboard/DashboardCards";
import DashboardAlerts from "@/components/dashboard/DashboardAlerts";
import GrowthDashboard from "@/components/dashboard/GrowthDashboard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

export default function Dashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dashPeriod, setDashPeriod] = useState("30d");
  const [dashProject, setDashProject] = useState("all");
  const [dashProduct, setDashProduct] = useState("all");
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);

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
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">Dashboard <SectionInfo {...sectionHelpTexts.dashboard} /></h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do seu império digital</p>
      </div>

      {/* Period + Project + Product Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <Select value={dashPeriod} onValueChange={setDashPeriod}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
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
      </div>

      <DashboardAlerts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <DashboardStats period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <DashboardRevenue period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} />
      <DashboardAds period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} allProjects={allProjects} />
      <DashboardCharts period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} />
      <DashboardCards period={dashPeriod} projectFilter={dashProject} productFilter={dashProduct} isAdmin={isAdmin} />
      <ActivityFeed />
      <GrowthDashboard />
    </div>
  );
}
