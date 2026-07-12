import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Users, BookMarked, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";

const PRIMARY = [
  { to: "/dashboard", label: "Cockpit", icon: LayoutDashboard, key: "dashboard" as const },
  { to: "/inbox", label: "Inbox", icon: MessageSquare, key: "inbox" as const },
  { to: "/leads", label: "Leads", icon: Users, key: "leads" as const },
  { to: "/referencias", label: "Refs", icon: BookMarked, key: "refs" as const },
];

const MORE = [
  { to: "/financas", label: "Finanças" },
  { to: "/gerenciador", label: "Gerenciador" },
  { to: "/funis", label: "Funis" },
  { to: "/recuperacao", label: "Recuperação" },
  { to: "/imperius", label: "Imperius" },
  { to: "/projetos", label: "Projetos" },
  { to: "/metas", label: "Metas" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/swipe", label: "Swipe" },
  { to: "/skills", label: "Skills" },
  { to: "/studio", label: "Studio" },
  { to: "/criativos", label: "Criativos" },
  { to: "/conteudo-ia", label: "Conteúdo IA" },
  { to: "/vsl-lab", label: "VSL Lab" },
  { to: "/mentes", label: "Mentes" },
  { to: "/market-intel", label: "Market Intel" },
  { to: "/nutricao", label: "Nutrição" },
  { to: "/kanban", label: "Kanban" },
  { to: "/docs", label: "Docs" },
  { to: "/empresa", label: "Empresa" },
  { to: "/equipe", label: "Equipe" },
  { to: "/configuracoes", label: "Configurações" },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { data: badges } = useSidebarBadges();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl border-t border-border/60 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 h-[60px]">
        {PRIMARY.map(({ to, label, icon: Icon, key }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          const badge =
            key === "inbox" ? badges?.inbox ?? 0 :
            key === "leads" ? badges?.leads ?? 0 : 0;
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium transition-colors",
                  active ? "text-gold" : "text-muted-foreground/80 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_hsl(var(--gold)/0.5)]")} />
                <span className="leading-none tracking-wide">{label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 rounded-full bg-gold text-background text-[9px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-gold" />
                )}
              </NavLink>
            </li>
          );
        })}
        <li>
          <Sheet>
            <SheetTrigger className="flex flex-col items-center justify-center gap-0.5 h-full w-full text-[10px] font-medium text-muted-foreground/80 hover:text-foreground">
              <MoreHorizontal className="h-5 w-5" />
              <span className="leading-none tracking-wide">Mais</span>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto pb-8">
              <SheetHeader className="mb-3">
                <SheetTitle className="font-serif text-xl text-gold">Navegar</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-2">
                {MORE.map(item => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "px-3 py-3 rounded-lg border text-sm text-center transition-colors",
                        active
                          ? "bg-gold/10 border-gold/40 text-gold"
                          : "bg-secondary/40 border-border/50 text-foreground/80 hover:bg-secondary/60"
                      )}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
