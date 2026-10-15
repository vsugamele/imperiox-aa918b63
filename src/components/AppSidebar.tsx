import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, LogOut, Star, StarOff } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useSystemHealth } from "@/lib/system-health";
import { useSidebarFavorites } from "@/hooks/useSidebarFavorites";

const COLLAPSED_GROUPS_KEY = "imphq:sidebar:collapsed-groups";

function readCollapsedGroups(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// UX1.1: o menu por tarefa vem de src/lib/navigation.ts (MENU); o que saiu dele está no Laboratório (/laboratorio).
import { ALL_NAV_ITEMS, MENU, type NavItem } from "@/lib/navigation";

// ── Badge pill ──────────────────────────────────────────────────────────────
function BadgePill({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Single nav item ─────────────────────────────────────────────────────────
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
                <span className="font-mono text-[10px] text-primary-foreground bg-primary rounded-full px-1.5 py-0.5 font-semibold">
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
                  <StarOff className="h-3 w-3 text-primary" />
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
  isGroupCollapsed,
  onToggleGroup,
}: {
  label: string;
  items: NavItem[];
  isLast?: boolean;
  badges: Record<string, number>;
  favorites: string[];
  toggleFavorite: (url: string) => void;
  isGroupCollapsed?: boolean;
  onToggleGroup?: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const groupBadgeTotal = items.reduce((sum, i) => sum + (i.badge ? (badges[i.badge] ?? 0) : 0), 0);

  return (
    <SidebarGroup className={!isLast ? "pb-2 mb-1.5 border-b border-border/60" : "pb-3"}>
      {!collapsed && (
        <SidebarGroupLabel asChild>
          <button
            type="button"
            onClick={onToggleGroup}
            aria-expanded={!isGroupCollapsed}
            className="w-full flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-subtle hover:text-foreground uppercase px-3 pb-1 pt-1 font-medium transition-colors cursor-pointer"
          >
            <span>· {label}</span>
            <span className="flex items-center gap-1.5">
              {isGroupCollapsed && groupBadgeTotal > 0 && (
                <span className="font-mono text-[9px] text-primary-foreground bg-primary rounded-full px-1.5 py-px font-semibold tracking-normal">
                  {groupBadgeTotal > 99 ? "99+" : groupBadgeTotal}
                </span>
              )}
              {isGroupCollapsed ? (
                <ChevronRight className="h-3 w-3 opacity-60" />
              ) : (
                <ChevronDown className="h-3 w-3 opacity-60" />
              )}
            </span>
          </button>
        </SidebarGroupLabel>
      )}

      {(!isGroupCollapsed || collapsed) && (
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
      )}
    </SidebarGroup>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────
export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { data: badgeData } = useSidebarBadges();
  const { data: health } = useSystemHealth();
  const { favorites, toggleFavorite } = useSidebarFavorites();
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(readCollapsedGroups);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label];
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const isSectionCollapsed = (label: string, sectionItems: NavItem[]) => {
    const hasActiveRoute = sectionItems.some(
      (i) => location.pathname === i.url || location.pathname.startsWith(`${i.url}/`)
    );
    if (hasActiveRoute) return false;
    return collapsedGroups.includes(label);
  };

  const badges: Record<string, number> = {
    imperius: badgeData?.imperius ?? 0,
    inbox: badgeData?.inbox ?? 0,
    leads: badgeData?.leads ?? 0,
    rag: badgeData?.rag ?? 0,
    aprovar: badgeData?.aprovar ?? 0,
    saude: health?.checks.filter((c) => c.status === "fail").length ?? 0,
  };

  // Favoritos podem vir do menu ou do Laboratório.
  const allItems: NavItem[] = ALL_NAV_ITEMS;

  const favItems = favorites
    .map((url) => allItems.find((i) => i.url === url))
    .filter(Boolean) as NavItem[];

  const sharedProps = { badges, favorites, toggleFavorite };

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-[#0C0D10]">
      {/* Brand Header */}
      <div className={`relative ${collapsed ? "py-4 flex justify-center" : "px-4 py-4"} border-b border-border`}>
        {collapsed ? (
          <div className="w-[22px] h-[22px] rounded-[3px] bg-primary flex items-center justify-center font-mono text-[12px] font-bold text-primary-foreground">
            i
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] rounded-[3px] bg-primary flex items-center justify-center font-mono text-[12px] font-bold text-primary-foreground shrink-0">
              i
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[14px] font-semibold tracking-[-0.01em] leading-tight text-foreground">
                IMPERIO<span className="text-muted-foreground">HQ</span>
              </span>
              <span className="font-mono text-[9px] tracking-[0.14em] text-subtle leading-none">
                OPERAÇÃO ÚNICA
              </span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="mt-2">
        {/* ⭐ Favourites section — only shown when there are pinned items */}
        {!collapsed && favItems.length > 0 && (
          <SidebarGroup className="pb-2 mb-2 border-b border-border">
            <SidebarGroupLabel className="font-mono text-[9px] tracking-[0.2em] text-subtle uppercase px-3 pb-1 pt-1 font-medium">
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

        {MENU.map((g, i) => (
          <NavGroup key={g.label} label={g.label} items={g.items} {...sharedProps}
            isGroupCollapsed={isSectionCollapsed(g.label, g.items)} onToggleGroup={() => toggleGroup(g.label)} isLast={i === MENU.length - 1} />
        ))}

      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3 bg-[#0C0D10]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-border border border-[#2A2E35] flex items-center justify-center font-mono text-[10px] text-muted-foreground shrink-0">
            VS
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium leading-tight text-foreground truncate">Vinicius</div>
              <div className="font-mono text-[9px] text-subtle leading-none">OWNER</div>
            </div>
          )}
          <button
            onClick={signOut}
            title="Sair"
            className="text-subtle hover:text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
