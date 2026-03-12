import {
  LayoutDashboard, FolderKanban, ListTodo, Kanban, Users, DollarSign,
  Search, Brain, Workflow, FileText, MessageSquare, Link2, Image,
  Zap, UsersRound, Building2, Settings, LogOut, Crown, Target
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Kanban", url: "/kanban", icon: Kanban },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo },
];

const crmItems = [
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Finanças", url: "/financas", icon: DollarSign },
  { title: "Market Intel", url: "/market-intel", icon: Search },
  { title: "Funis", url: "/funis", icon: Target },
];

const aiItems = [
  { title: "Mentes IA", url: "/mentes", icon: Brain },
  { title: "OpenFlow", url: "/openflow", icon: Workflow },
];

const toolsItems = [
  { title: "Docs / KB", url: "/docs", icon: FileText },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare },
  { title: "Tracker UTM", url: "/tracker", icon: Link2 },
  { title: "Referências", url: "/referencias", icon: Image },
  { title: "Skills", url: "/skills", icon: Zap },
];

const orgItems = [
  { title: "Equipe", url: "/equipe", icon: UsersRound },
  { title: "Empresa", url: "/empresa", icon: Building2 },
  { title: "Config", url: "/configuracoes", icon: Settings },
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
                  <item.icon className="mr-2 h-4 w-4 shrink-0" />
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
