import {
  LayoutDashboard, FolderKanban, ListTodo, Users, DollarSign,
  Search, Brain, FileText, MessageSquare, Link2,
  Zap, UsersRound, Building2, Settings, LogOut, Crown,
  KeyRound, BookOpen, Sparkles, Mail, LifeBuoy, Clapperboard,
  Library, Bot, Compass, Radio, Target, Activity, Star, StarOff,
  Inbox, Pencil, Workflow, Globe, Coins, Stethoscope, BarChart3,
  Palette,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useSidebarFavorites } from "@/hooks/useSidebarFavorites";

// ── Nav items ──────────────────────────────────────────────────────────
// Reorganizado em 5 hubs para reduzir ruído e criar caminhos claros.
const hojeitems = [
  { title: "Cockpit",          url: "/cockpit",    icon: LayoutDashboard },
  { title: "Imperius",         url: "/imperius",   icon: Bot,             badge: "imperius" as const },
  { title: "Caixa de Entrada", url: "/inbox",      icon: Inbox,           badge: "inbox" as const },
  { title: "Leads",            url: "/leads",      icon: Users,           badge: "leads" as const },
  { title: "Dashboard",        url: "/dashboard",  icon: Activity,        badge: "rag" as const },
  { title: "Recuperação",      url: "/recuperacao",icon: LifeBuoy },
];

const venderItems = [
  { title: "Projetos",   url: "/projetos",  icon: FolderKanban },
  { title: "Campanhas",  url: "/campanhas", icon: Target },
  { title: "Funis",      url: "/funis",     icon: Target },
  { title: "LinfaFlow X1", url: "/funis/linfaflow-x1-ready", icon: Stethoscope },
  { title: "LinfaFlow Care", url: "/funis/linfaflow-care", icon: MessageSquare },
  { title: "Care Conversão", url: "/funis/linfaflow-care-dashboard", icon: BarChart3 },
  { title: "Sites",      url: "/sites",     icon: Globe },
  { title: "OpenFlow",   url: "/openflow",  icon: Workflow },
];

const inteligenciaItems = [
  { title: "Inteligência IA",  url: "/inteligencia-ia",icon: Brain },
  { title: "Assistente",       url: "/assistente",     icon: Compass },
  { title: "Estúdio",          url: "/studio",         icon: Clapperboard },
  { title: "Copy Lab",         url: "/copy-lab",       icon: Zap },
  { title: "Hook Labs",        url: "/hooks",          icon: Sparkles },
  { title: "Swipe File",       url: "/swipe",          icon: Library },
  { title: "Market Intel",     url: "/market-intel",   icon: Search },
  { title: "Skills",           url: "/skills",         icon: Zap },
];

const capitalItems = [
  { title: "Gerenciador Ads",  url: "/gerenciador",       icon: Activity },
  { title: "Tracker",          url: "/tracker",           icon: Link2 },
  { title: "Atribuição",       url: "/atribuicao",        icon: Radio },
  { title: "Finanças",         url: "/financas",          icon: DollarSign },
  { title: "Custos IA",        url: "/custos-ia",         icon: Coins },
  { title: "Custos IA · Chat", url: "/openrouter-custos", icon: Coins },
];

const acervoItems = [
  { title: "Master Redesign", url: "/redesign", icon: Palette },
  { title: "Referências",  url: "/referencias", icon: Library },
  { title: "Conteúdo",     url: "/rascunhos",   icon: Pencil },
  { title: "Docs / KB",    url: "/docs",        icon: FileText },
  { title: "Guia Claude",  url: "/claude-skills", icon: BookOpen },
];

const configurarItems = [
  { title: "Empresa", url: "/empresa",       icon: Building2 },
  { title: "Equipe",  url: "/equipe",        icon: UsersRound },
  { title: "Cofre",   url: "/cofre",         icon: KeyRound },
  { title: "Config",  url: "/configuracoes", icon: Settings },
  { title: "Guia",    url: "/guia",          icon: BookOpen },
];


type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: "imperius" | "inbox" | "leads" | "rag";
};

// â”€â”€ Badge pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BadgePill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// â”€â”€ Single nav item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NavItemRow({
  item,
  collapsed,
  badges,
  isFavorite,
  toggleFavorite,
}: {
  item: NavItem;
  collapsed: boolean;
  badges: Record<string, number>;
  isFavorite: boolean;
  toggleFavorite: (url: string) => void;
}) {
  const badgeCount = item.badge ? (badges[item.badge] ?? 0) : 0;

  return (
    <SidebarMenuItem key={item.url} className="group/navitem px-1">
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          className="nav-item flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] transition-colors"
          activeClassName="nav-item-active"
        >
          <item.icon className="nav-icon h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-[13px]">{item.title}</span>
              {badgeCount > 0 && (
                <span className="font-mono text-[10px] text-[#0A0B0D] bg-[#D6FF4B] rounded-full px-1.5 py-0.5 font-semibold">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {/* Pin button — shown on hover when expanded */}
              <button
                title={isFavorite ? "Remover favorito" : "Fixar no topo"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(item.url);
                }}
                className="ml-1 opacity-0 group-hover/navitem:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground"
              >
                {isFavorite ? (
                  <StarOff className="h-3 w-3 text-[#D6FF4B]" />
                ) : (
                  <Star className="h-3 w-3" />
                )}
              </button>
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── Nav group ──────────────────────────────────────────────────────────
function NavGroup({
  label,
  items,
  isLast,
  badges,
  favorites,
  toggleFavorite,
}: {
  label: string;
  items: NavItem[];
  isLast?: boolean;
  badges: Record<string, number>;
  favorites: string[];
  toggleFavorite: (url: string) => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup className={!isLast ? "pb-3 mb-2 border-b border-[#1B1E23]/60" : "pb-3"}>
      {!collapsed && (
        <SidebarGroupLabel className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] uppercase px-3 pb-1 pt-1 font-medium">
          · {label}
        </SidebarGroupLabel>
      )}

      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItemRow
              key={item.url}
              item={item}
              collapsed={collapsed}
              badges={badges}
              isFavorite={favorites.includes(item.url)}
              toggleFavorite={toggleFavorite}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { data: badgeData } = useSidebarBadges();
  const { favorites, toggleFavorite } = useSidebarFavorites();

  const badges: Record<string, number> = {
    imperius: badgeData?.imperius ?? 0,
    inbox: badgeData?.inbox ?? 0,
    leads: badgeData?.leads ?? 0,
    rag: badgeData?.rag ?? 0,
  };

  // All items pool for favourites lookup
  const allItems: NavItem[] = [
    ...hojeitems, ...venderItems, ...inteligenciaItems,
    ...capitalItems, ...acervoItems, ...configurarItems,
  ];

  const favItems = favorites
    .map((url) => allItems.find((i) => i.url === url))
    .filter(Boolean) as NavItem[];

  const sharedProps = { badges, favorites, toggleFavorite };

  return (
    <Sidebar collapsible="icon" className="border-r border-[#1B1E23] bg-[#0C0D10]">
      {/* Brand Header */}
      <div className={`relative ${collapsed ? "py-4 flex justify-center" : "px-4 py-4"} border-b border-[#1B1E23]`}>
        {collapsed ? (
          <div className="w-[22px] h-[22px] rounded-[3px] bg-[#D6FF4B] flex items-center justify-center font-mono text-[12px] font-bold text-[#0A0B0D]">
            i
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] rounded-[3px] bg-[#D6FF4B] flex items-center justify-center font-mono text-[12px] font-bold text-[#0A0B0D] shrink-0">
              i
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[14px] font-semibold tracking-[-0.01em] leading-tight text-[#E8EAED]">
                IMPERIO<span className="text-[#8A8F98]">HQ</span>
              </span>
              <span className="font-mono text-[9px] tracking-[0.14em] text-[#5F646D] leading-none">
                OPERAÇÃO ÚNICA
              </span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="mt-2">
        {/* ⭐ Favourites section — only shown when there are pinned items */}
        {!collapsed && favItems.length > 0 && (
          <SidebarGroup className="pb-2 mb-2 border-b border-[#1B1E23]">
            <SidebarGroupLabel className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] uppercase px-3 pb-1 pt-1 font-medium">
              · Favoritos
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favItems.map((item) => (
                  <NavItemRow
                    key={item.url}
                    item={item}
                    collapsed={false}
                    badges={badges}
                    isFavorite={true}
                    toggleFavorite={toggleFavorite}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <NavGroup label="Hoje"         items={hojeitems}         {...sharedProps} />
        <NavGroup label="Vender"       items={venderItems}       {...sharedProps} />
        <NavGroup label="Inteligência" items={inteligenciaItems} {...sharedProps} />
        <NavGroup label="Capital"      items={capitalItems}      {...sharedProps} />
        <NavGroup label="Acervo"       items={acervoItems}       {...sharedProps} />
        <NavGroup label="Setup"        items={configurarItems}   {...sharedProps} isLast />

      </SidebarContent>

      <SidebarFooter className="border-t border-[#1B1E23] p-3 bg-[#0C0D10]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#1B1E23] border border-[#2A2E35] flex items-center justify-center font-mono text-[10px] text-[#8A8F98] shrink-0">
            VS
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium leading-tight text-[#E8EAED] truncate">Vinicius</div>
              <div className="font-mono text-[9px] text-[#5F646D] leading-none">OWNER</div>
            </div>
          )}
          <button
            onClick={signOut}
            title="Sair"
            className="text-[#5F646D] hover:text-[#FB7185] hover:bg-[#FB7185]/10 p-1.5 rounded transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
