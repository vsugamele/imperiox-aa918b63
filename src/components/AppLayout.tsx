import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { PushOptIn } from "@/components/PushOptIn";
import { CopilotFab } from "@/components/copilot/CopilotFab";
import { ActionInbox } from "@/components/imperius/ActionInbox";
import { CommandPalette } from "@/components/CommandPalette";

const SIDEBAR_LS_KEY = "imphq:sidebar:open";

const ROUTE_META: Record<string, { kicker: string; title: string }> = {
  dashboard: { kicker: "Overview", title: "Cockpit" },
  imperius: { kicker: "Autonomia", title: "Imperius" },
  leads: { kicker: "CRM", title: "Leads" },
  whatsapp: { kicker: "Canal", title: "WhatsApp" },
  instagram: { kicker: "Canal", title: "Instagram" },
  openflow: { kicker: "Fluxos", title: "OpenFlow" },
  recuperacao: { kicker: "Resgate", title: "Recuperação" },
  projetos: { kicker: "Portfólio", title: "Projetos" },
  campanhas: { kicker: "Vender", title: "Campanhas" },
  lancamentos: { kicker: "Vender", title: "Lançamentos" },
  financas: { kicker: "Capital", title: "Finanças" },
  gerenciador: { kicker: "Mídia paga", title: "Gerenciador" },
  funis: { kicker: "Estrutura", title: "Funis" },
  metas: { kicker: "Norte", title: "Metas" },
  cohort: { kicker: "Análise", title: "Cohort & LTV" },
  nutricao: { kicker: "E-mail", title: "Nutrição" },
  tracker: { kicker: "UTM", title: "Tracker" },
  mentes: { kicker: "IA", title: "Mentes" },
  "market-intel": { kicker: "IA", title: "Market Intel" },
  "conteudo-ia": { kicker: "IA", title: "Conteúdo" },
  "vsl-lab": { kicker: "IA", title: "VSL Lab" },
  criativos: { kicker: "IA", title: "Criativos" },
  studio: { kicker: "IA", title: "Studio" },
  swipe: { kicker: "Acervo", title: "Swipe File" },
  referencias: { kicker: "Acervo", title: "Referências" },
  skills: { kicker: "IA", title: "Skills" },
  kanban: { kicker: "Planejar", title: "Kanban" },
  tarefas: { kicker: "Planejar", title: "Tarefas" },
  docs: { kicker: "KB", title: "Docs" },
  empresa: { kicker: "Setup", title: "Empresa" },
  equipe: { kicker: "Setup", title: "Equipe" },
  cofre: { kicker: "Setup", title: "Cofre" },
  configuracoes: { kicker: "Setup", title: "Configurações" },
  guia: { kicker: "Setup", title: "Guia" },
  chat: { kicker: "IA", title: "Chat" },
};

function EditorialBreadcrumb() {
  const { pathname } = useLocation();
  const first = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const meta = ROUTE_META[first] || { kicker: "Imperio HQ", title: first };
  return (
    <div className="hidden md:flex items-baseline gap-2 min-w-0">
      <span className="text-[9px] uppercase tracking-[0.28em] text-gold/70 shrink-0">
        {meta.kicker}
      </span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-serif italic text-base text-foreground truncate">
        {meta.title}
      </span>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_LS_KEY);
    return v === null ? true : v === "true";
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, String(open)); } catch {}
  }, [open]);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative h-14 flex items-center px-4 shrink-0 bg-background/70 backdrop-blur-xl sticky top-0 z-10 gap-3">
            <SidebarTrigger className="text-muted-foreground/60 hover:text-gold transition-colors" />
            <div className="h-5 w-px bg-border/60" />
            <EditorialBreadcrumb />
            <div className="flex-1 flex justify-center px-4 max-w-2xl mx-auto">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette />
              <ActionInbox />
              <PushOptIn />
              <NotificationBell />
            </div>
            <div className="header-hairline" />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <CopilotFab />
      </div>
    </SidebarProvider>
  );
}
