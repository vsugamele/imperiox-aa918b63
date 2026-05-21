import {
  LayoutDashboard, FolderKanban, ListTodo, Kanban, Users, DollarSign,
  Search, Brain, Workflow, FileText, MessageSquare, Link2, Image,
  Zap, UsersRound, Building2, Settings, LogOut, Crown, Target, KeyRound, MessageCircle, BookOpen, Sparkles, Mail, LifeBuoy, Layers, Activity, Clapperboard, Library, Bot
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

// Reorganizado por INTENÇÃO (não por feature)
// Operar = dia-a-dia / responder agora
// Vender = construir oferta e escalar
// Inteligência = IA, pesquisa, criação
// Configurar = setup e governança
const operarItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-primary" },
  { title: "Imperius", url: "/imperius", icon: Bot, color: "text-primary" },
  { title: "Leads", url: "/leads", icon: Users, color: "text-primary" },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, color: "text-primary" },
  { title: "OpenFlow", url: "/openflow", icon: Workflow, color: "text-primary" },
  { title: "Recuperação", url: "/recuperacao", icon: LifeBuoy, color: "text-primary" },
  
];

const venderItems = [
  { title: "Projetos", url: "/projetos", icon: FolderKanban, color: "text-emerald-400" },
  { title: "Campanhas", url: "/campanhas", icon: Target, color: "text-emerald-400" },
  { title: "Lançamentos", url: "/lancamentos", icon: Activity, color: "text-emerald-400" },
  { title: "Finanças", url: "/financas", icon: DollarSign, color: "text-emerald-400" },
  { title: "Gerenciador Ads", url: "/gerenciador", icon: Activity, color: "text-emerald-400" },
  { title: "Funis", url: "/funis", icon: Target, color: "text-emerald-400" },
  { title: "Metas", url: "/metas", icon: Target, color: "text-emerald-400" },
  { title: "Cohort & LTV", url: "/cohort", icon: Layers, color: "text-emerald-400" },
  { title: "Nutrição", url: "/nutricao", icon: Mail, color: "text-emerald-400" },
  { title: "Tracker UTM", url: "/tracker", icon: Link2, color: "text-emerald-400" },
];

const inteligenciaItems = [
  { title: "Mentes IA", url: "/mentes", icon: Brain, color: "text-violet-400" },
  { title: "Market Intel", url: "/market-intel", icon: Search, color: "text-violet-400" },
  { title: "Conteúdo IA", url: "/conteudo-ia", icon: Zap, color: "text-violet-400" },
  { title: "Criativos IA", url: "/criativos", icon: Sparkles, color: "text-violet-400" },
  { title: "Studio", url: "/studio", icon: Clapperboard, color: "text-violet-400" },
  { title: "Swipe File", url: "/swipe", icon: Library, color: "text-violet-400" },
  { title: "Referências", url: "/referencias", icon: Image, color: "text-violet-400" },
  { title: "Skills", url: "/skills", icon: Zap, color: "text-violet-400" },
];

const planejarItems = [
  { title: "Kanban", url: "/kanban", icon: Kanban, color: "text-cyan-400" },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo, color: "text-cyan-400" },
  { title: "Docs / KB", url: "/docs", icon: FileText, color: "text-cyan-400" },
];

const configurarItems = [
  { title: "Empresa", url: "/empresa", icon: Building2, color: "text-amber-400" },
  { title: "Equipe", url: "/equipe", icon: UsersRound, color: "text-amber-400" },
  { title: "Cofre", url: "/cofre", icon: KeyRound, color: "text-amber-400" },
  { title: "Config", url: "/configuracoes", icon: Settings, color: "text-amber-400" },
  { title: "Guia", url: "/guia", icon: BookOpen, color: "text-amber-400" },
];

function NavGroup({ label, items }: { label: string; items: typeof operarItems }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-muted-foreground/60 text-[10px] uppercase tracking-widest">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  className="text-sidebar-foreground/70 hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium border-r-2 border-primary"
                >
                  <item.icon className={`mr-2 h-4 w-4 shrink-0 ${item.color}`} />
                  {!collapsed && <span className="text-sm">{item.title}</span>}
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
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <Crown className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-display text-xl font-bold text-primary">Imperio HQ</span>
        )}
      </div>

      <SidebarContent className="mt-2">
        <NavGroup label="Operar" items={operarItems} />
        <NavGroup label="Vender" items={venderItems} />
        <NavGroup label="Inteligência" items={inteligenciaItems} />
        <NavGroup label="Planejar" items={planejarItems} />
        <NavGroup label="Configurar" items={configurarItems} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span className="text-sm">Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
