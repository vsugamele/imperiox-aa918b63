import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ProactiveAlertsBell } from "@/components/ProactiveAlertsBell";

import { PushOptIn } from "@/components/PushOptIn";
import { CopilotFab } from "@/components/copilot/CopilotFab";
import { ActionInbox } from "@/components/imperius/ActionInbox";
import { ImperiusRail } from "@/components/imperius/ImperiusRail";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";


const SIDEBAR_LS_KEY = "imphq:sidebar:open";

const ROUTE_META: Record<string, { kicker: string; title: string }> = {
  dashboard: { kicker: "Overview", title: "Cockpit" },
  imperius: { kicker: "Autonomia", title: "Imperius" },
  "ai-saude": { kicker: "IA", title: "Saúde da IA" },
  "funil-conversao": { kicker: "Análise", title: "Funil" },
  inbox: { kicker: "Canais", title: "Caixa de Entrada" },
  leads: { kicker: "CRM", title: "Leads" },
  whatsapp: { kicker: "Canal", title: "WhatsApp" },
  "sdr-coach": { kicker: "Operar", title: "SDR Coach" },
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
  rascunhos: { kicker: "IA", title: "Rascunhos" },
  docs: { kicker: "KB", title: "Docs" },
  empresa: { kicker: "Setup", title: "Empresa" },
  equipe: { kicker: "Setup", title: "Equipe" },
  cofre: { kicker: "Setup", title: "Cofre" },
  configuracoes: { kicker: "Setup", title: "Configurações" },
  guia: { kicker: "Setup", title: "Guia" },
  chat: { kicker: "IA", title: "Chat" },
  assistente: { kicker: "IA", title: "Assistente" },
  "product-copilot": { kicker: "IA", title: "Copilot de Produtos" },
  webinar: { kicker: "Evento", title: "Webinar" },
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

// ⌘K hint — visible for first 5 sessions, then auto-hides
const CMDK_LS_KEY = "imphq.cmdkhint.seen";
function CmdKHint() {
  const [visible, setVisible] = useState(() => {
    try {
      const n = parseInt(localStorage.getItem(CMDK_LS_KEY) || "0", 10);
      return n < 5;
    } catch { return true; }
  });
  const counted = useRef(false);

  useEffect(() => {
    if (!visible || counted.current) return;
    counted.current = true;
    try {
      const n = parseInt(localStorage.getItem(CMDK_LS_KEY) || "0", 10);
      localStorage.setItem(CMDK_LS_KEY, String(n + 1));
      if (n + 1 >= 5) setTimeout(() => setVisible(false), 8000);
    } catch {}
  }, [visible]);

  if (!visible) return null;
  return (
    <span className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1.5 py-0.5 animate-pulse">
      <kbd className="font-mono">⌘K</kbd>
      <span>para tudo</span>
    </span>
  );
}

// Preferência de view persistente (compartilhada com ProtectedRoute e MobileCockpit)
const MOBILE_OVERRIDE_KEY = "imphq_force_desktop";

export function AppLayout() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_LS_KEY);
    return v === null ? true : v === "true";
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, String(open)); } catch {}
  }, [open]);

  // Mobile auto-redirect removido — app desktop agora responsivo no celular.
  // Cockpit continua acessível via /mobile-cockpit se o usuário quiser.


  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative h-14 flex items-center px-3 md:px-4 shrink-0 bg-background/70 backdrop-blur-xl sticky top-0 z-10 gap-2 md:gap-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <SidebarTrigger className="text-muted-foreground/60 hover:text-gold transition-colors h-10 w-10 md:h-8 md:w-8" />
            <div className="hidden md:block h-5 w-px bg-border/60" />
            <EditorialBreadcrumb />
            <div className="hidden md:flex flex-1 justify-center px-4 max-w-2xl mx-auto">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1 md:gap-2">
              <CmdKHint />
              <CommandPalette />
              <ActionInbox />
              <PushOptIn />
              <ProactiveAlertsBell />
              <NotificationBell />
            </div>

            <div className="header-hairline" />
          </header>
          <main
            className="flex-1 overflow-auto p-3 md:p-6"
            style={{ paddingBottom: isMobile ? "calc(72px + env(safe-area-inset-bottom))" : "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <Outlet />
          </main>
        </div>
        {!isMobile && <CopilotFab />}
        <ImperiusRail />
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
