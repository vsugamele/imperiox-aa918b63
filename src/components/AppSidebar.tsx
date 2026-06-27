import {
  LayoutDashboard, FolderKanban, ListTodo, Users, DollarSign,
  Search, Brain, FileText, MessageSquare, Link2,
  Zap, UsersRound, Building2, Settings, LogOut, Crown,
  KeyRound, BookOpen, Sparkles, Mail, LifeBuoy, Clapperboard,
  Library, Bot, Compass, Radio, Target, Activity, Star, StarOff,
  Inbox, Pencil, Workflow, Globe,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useSidebarFavorites } from "@/hooks/useSidebarFavorites";

// ── Nav items ────────────────────────────────────────────────────────────────
const hojeitems = [
  { title: "Dashboard",        url: "/dashboard",  icon: LayoutDashboard, badge: "rag" as const },
  { title: "Imperius",         url: "/imperius",   icon: Bot,             badge: "imperius" as const },
  { title: "Caixa de Entrada", url: "/inbox",      icon: Inbox,           badge: "inbox" as const },
  { title: "Leads",            url: "/leads",      icon: Users,           badge: "leads" as const },
  { title: "Tarefas",          url: "/tarefas",    icon: ListTodo },
  { title: "Recuperação",      url: "/recuperacao",icon: LifeBuoy },
];

const venderItems = [
  { title: "Projetos",             url: "/projetos",   icon: FolderKanban },
  { title: "Campanhas",            url: "/campanhas",  icon: Target },
  { title: "Funis",                url: "/funis",      icon: Target },
  { title: "Sites",                url: "/sites",      icon: Globe },
  { title: "OpenFlow",             url: "/openflow",   icon: Workflow },
];

const adsFinancasItems = [
  { title: "Gerenciador Ads",      url: "/gerenciador",icon: Activity },
  { title: "Tracker",              url: "/tracker",    icon: Link2 },
  { title: "Finanças",             url: "/financas",   icon: DollarSign },
];

const planejarItems = [
  { title: "Docs / KB",    url: "/docs",        icon: FileText },
  { title: "Conteúdo",     url: "/rascunhos",   icon: Pencil },
  { title: "Referências",  url: "/referencias", icon: Library },
];

const inteligenciaItems = [
  { title: "Saúde da IA",          url: "/ai-saude",       icon: Brain },
  { title: "Memória Viva da IA",   url: "/ai-learning",    icon: Brain },
  { title: "Funil de Conversão",   url: "/funil-conversao",icon: Search },
  { title: "Assistente",           url: "/assistente",     icon: Compass },
  { title: "Skills",               url: "/skills",         icon: Zap },
  { title: "Guia Claude (Copy)",   url: "/claude-skills",  icon: BookOpen },
  { title: "Estúdio de Produto",   url: "/studio",         icon: Clapperboard },
  { title: "Copy Lab (Imperador)", url: "/copy-lab",       icon: Zap },
  { title: "Swipe File",           url: "/swipe",          icon: Library },
  { title: "Market Intel",         url: "/market-intel",   icon: Search },
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

// ── Badge pill ────────────────────────────────────────────────────────────────
function BadgePill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Single nav item ────────────────────────────────────────────────────────────
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
    <SidebarMenuItem key={item.url} className="group/navitem">
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          className="nav-item"
          activeClassName="nav-item-active"
        >
          <item.icon className="nav-icon mr-2 h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.title}</span>
              <BadgePill count={badgeCount} />
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
                  <StarOff className="h-3 w-3 text-gold" />
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

// ── Nav group ─────────────────────────────────────────────────────────────────
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
    <SidebarGroup className={!isLast ? "pb-2 mb-2 border-b border-sidebar-border/40" : ""}>
      {!collapsed && (
        <SidebarGroupLabel className="nav-kicker px-3">· {label}</SidebarGroupLabel>
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

// ── Main sidebar ──────────────────────────────────────────────────────────────
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
    ...planejarItems, ...adsFinancasItems, ...configurarItems,
  ];

  const favItems = favorites
    .map((url) => allItems.find((i) => i.url === url))
    .filter(Boolean) as NavItem[];

  const sharedProps = { badges, favorites, toggleFavorite };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Logo */}
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
        {/* ⭐ Favourites section — only shown when there are pinned items */}
        {!collapsed && favItems.length > 0 && (
          <SidebarGroup className="pb-2 mb-2 border-b border-sidebar-border/40">
            <SidebarGroupLabel className="nav-kicker px-3">
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

        <NavGroup label="Hoje"          items={hojeitems}         {...sharedProps} />
        <NavGroup label="Vender"        items={venderItems}       {...sharedProps} />
        <NavGroup label="Inteligência"  items={inteligenciaItems} {...sharedProps} />
        <NavGroup label="Planejar"      items={planejarItems}     {...sharedProps} />
        <NavGroup label="Ads / Finanças" items={adsFinancasItems} {...sharedProps} />
        <NavGroup label="Configurar"    items={configurarItems}   {...sharedProps} isLast />
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
