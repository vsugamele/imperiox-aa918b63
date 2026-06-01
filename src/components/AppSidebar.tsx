import {
  LayoutDashboard, FolderKanban, ListTodo, Kanban, Users, DollarSign,
  Search, Brain, Workflow, FileText, MessageSquare, Link2, Image,
  Zap, UsersRound, Building2, Settings, LogOut, Crown, Target, KeyRound, BookOpen, Sparkles, Mail, LifeBuoy, Layers, Activity, Clapperboard, Library, Bot, Compass, Radio, FlaskConical
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const operarItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Imperius", url: "/imperius", icon: Bot },
  { title: "Assistente", url: "/assistente", icon: Compass },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare },
  { title: "OpenFlow", url: "/openflow", icon: Workflow },
  { title: "Recuperação", url: "/recuperacao", icon: LifeBuoy },
];

const venderItems = [
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Campanhas", url: "/campanhas", icon: Target },
  { title: "Lançamentos", url: "/lancamentos", icon: Activity },
  { title: "Finanças", url: "/financas", icon: DollarSign },
  { title: "Gerenciador Ads", url: "/gerenciador", icon: Activity },
  { title: "Funis", url: "/funis", icon: Target },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Cohort & LTV", url: "/cohort", icon: Layers },
  { title: "Nutrição", url: "/nutricao", icon: Mail },
  { title: "Webinar", url: "/webinar", icon: Radio },
  { title: "Tracker UTM", url: "/tracker", icon: Link2 },
];

const inteligenciaItems = [
  { title: "Mentes IA", url: "/mentes", icon: Brain },
  { title: "Market Intel", url: "/market-intel", icon: Search },
  { title: "Conteúdo IA", url: "/conteudo-ia", icon: Zap },
  { title: "VSL Lab", url: "/vsl-lab", icon: FlaskConical },
  { title: "Criativos IA", url: "/criativos", icon: Sparkles },
  { title: "Studio", url: "/studio", icon: Clapperboard },
  { title: "Swipe File", url: "/swipe", icon: Library },
  { title: "Referências", url: "/referencias", icon: Image },
  { title: "Skills", url: "/skills", icon: Zap },
];

const planejarItems = [
  { title: "Kanban", url: "/kanban", icon: Kanban },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo },
  { title: "Docs / KB", url: "/docs", icon: FileText },
];

const configurarItems = [
  { title: "Empresa", url: "/empresa", icon: Building2 },
  { title: "Equipe", url: "/equipe", icon: UsersRound },
  { title: "Cofre", url: "/cofre", icon: KeyRound },
  { title: "Config", url: "/configuracoes", icon: Settings },
  { title: "Guia", url: "/guia", icon: BookOpen },
];

function NavGroup({ label, items, isLast }: { label: string; items: typeof operarItems; isLast?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup className={!isLast ? "pb-2 mb-2 border-b border-sidebar-border/40" : ""}>
      {!collapsed && (
        <SidebarGroupLabel className="nav-kicker px-3">
          · {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  className="nav-item"
                  activeClassName="nav-item-active"
                >
                  <item.icon className="nav-icon mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className={`relative ${collapsed ? "py-5 flex justify-center" : "px-4 py-5"}`}>
        {collapsed ? (
          <Crown className="h-5 w-5 text-gold drop-shadow-[0_0_8px_hsl(var(--gold)/0.55)]" />
        ) : (
          <div className="flex flex-col gap-1">
            <span className="brand-kicker">Imperio</span>
            <span className="brand-wordmark">HQ</span>
          </div>
        )}
        <div className="editorial-divider absolute left-3 right-3 bottom-0" />
      </div>

      <SidebarContent className="mt-3">
        <NavGroup label="Operar" items={operarItems} />
        <NavGroup label="Vender" items={venderItems} />
        <NavGroup label="Inteligência" items={inteligenciaItems} />
        <NavGroup label="Planejar" items={planejarItems} />
        <NavGroup label="Configurar" items={configurarItems} isLast />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="nav-item hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="nav-icon mr-2 h-4 w-4" />
              {!collapsed && (
                <span className="text-[11px] uppercase tracking-[0.18em]">Sair</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
