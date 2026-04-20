import {
  LayoutDashboard, FolderKanban, ListTodo, Kanban, Users, DollarSign,
  Search, Brain, Workflow, FileText, MessageSquare, Link2, Image,
  Zap, UsersRound, Building2, Settings, LogOut, Crown, Target, KeyRound, MessageCircle, BookOpen, Sparkles
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-primary" },
  { title: "Projetos", url: "/projetos", icon: FolderKanban, color: "text-primary" },
  { title: "Kanban", url: "/kanban", icon: Kanban, color: "text-primary" },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo, color: "text-primary" },
  { title: "Chat", url: "/chat", icon: MessageCircle, color: "text-primary" },
];

const crmItems = [
  { title: "Leads", url: "/leads", icon: Users, color: "text-emerald-400" },
  { title: "Finanças", url: "/financas", icon: DollarSign, color: "text-emerald-400" },
  { title: "Market Intel", url: "/market-intel", icon: Search, color: "text-emerald-400" },
  { title: "Funis", url: "/funis", icon: Target, color: "text-emerald-400" },
];

const aiItems = [
  { title: "Mentes IA", url: "/mentes", icon: Brain, color: "text-violet-400" },
  { title: "Conteúdo IA", url: "/conteudo-ia", icon: Zap, color: "text-violet-400" },
  { title: "Criativos IA", url: "/criativos", icon: Sparkles, color: "text-violet-400" },
  { title: "OpenFlow", url: "/openflow", icon: Workflow, color: "text-violet-400" },
];

const toolsItems = [
  { title: "Docs / KB", url: "/docs", icon: FileText, color: "text-cyan-400" },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, color: "text-cyan-400" },
  { title: "Tracker UTM", url: "/tracker", icon: Link2, color: "text-cyan-400" },
  { title: "Referências", url: "/referencias", icon: Image, color: "text-cyan-400" },
  { title: "Skills", url: "/skills", icon: Zap, color: "text-cyan-400" },
  { title: "Cofre", url: "/cofre", icon: KeyRound, color: "text-cyan-400" },
];

const orgItems = [
  { title: "Equipe", url: "/equipe", icon: UsersRound, color: "text-amber-400" },
  { title: "Empresa", url: "/empresa", icon: Building2, color: "text-amber-400" },
  { title: "Config", url: "/configuracoes", icon: Settings, color: "text-amber-400" },
  { title: "Guia", url: "/guia", icon: BookOpen, color: "text-amber-400" },
];

function NavGroup({ label, items }: { label: string; items: typeof mainItems }) {
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
        <NavGroup label="Principal" items={mainItems} />
        <NavGroup label="CRM & Intel" items={crmItems} />
        <NavGroup label="IA" items={aiItems} />
        <NavGroup label="Ferramentas" items={toolsItems} />
        <NavGroup label="Organização" items={orgItems} />
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
