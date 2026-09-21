import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ProactiveAlertsBell } from "@/components/ProactiveAlertsBell";
import { supabase } from "@/integrations/supabase/client";

import { PushOptIn } from "@/components/PushOptIn";
import { CopilotFab } from "@/components/copilot/CopilotFab";
import { ActionInbox } from "@/components/imperius/ActionInbox";
import { ImperiusRail } from "@/components/imperius/ImperiusRail";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobilePushNudge } from "@/components/mobile/MobilePushNudge";
import { useIsMobile } from "@/hooks/use-mobile";


function useLiveLeadCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    async function fetchCount() {
      if (document.visibilityState === "hidden") return;
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: c, error } = await supabase
        .from("imphq_leads")
        .select("*", { count: "exact", head: true })
        .gte("criado_em", since);
      if (!error && c !== null) setCount(c);
    }

    fetchCount();
    intervalId = setInterval(fetchCount, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  return count;
}

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
  "funis/linfaflow-x1": { kicker: "Conversão", title: "LinfaFlow X1" },
  "funis/linfaflow-x1-ready": { kicker: "Conversão", title: "LinfaFlow X1 Ready" },
  "funis/linfaflow-care": { kicker: "Conversão", title: "LinfaFlow Care Room" },
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
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] || "dashboard";
  const compound = parts.slice(0, 2).join("/");
  const meta = ROUTE_META[compound] || ROUTE_META[first] || { kicker: "Imperio HQ", title: first };
  return (
    <div className="hidden md:flex items-baseline gap-2 min-w-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5F646D] shrink-0">
        {meta.kicker}
      </span>
      <span className="text-[#33373F]">/</span>
      <span className="font-sans font-semibold text-[14px] tracking-[-0.01em] text-[#E8EAED] truncate">
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
    } catch { /* Optional browser storage can be unavailable; keep the current in-memory preference/default. */ }
  }, [visible]);

  if (!visible) return null;
  return (
    <span className="hidden lg:flex items-center gap-1 text-[10px] text-[#5F646D] border border-[#1B1E23] rounded px-1.5 py-0.5">
      <kbd className="font-mono">⌘K</kbd>
      <span>buscar</span>
    </span>
  );
}

// Preferência de view persistente (compartilhada com ProtectedRoute e MobileCockpit)
const MOBILE_OVERRIDE_KEY = "imphq_force_desktop";

export function AppLayout() {
  const isMobile = useIsMobile();
  const liveLeadCount = useLiveLeadCount();
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_LS_KEY);
    return v === null ? true : v === "true";
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, String(open)); } catch { /* Optional browser storage can be unavailable; keep the current in-memory preference/default. */ }
  }, [open]);

  // Mobile auto-redirect removido — app desktop agora responsivo no celular.
  // Cockpit continua acessível via /mobile-cockpit se o usuário quiser.

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full bg-[#0A0B0D] text-[#E8EAED]">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative h-14 flex items-center px-3 md:px-5 shrink-0 bg-[#0A0B0D]/85 backdrop-blur-md border-b border-[#1B1E23] sticky top-0 z-20 gap-2 md:gap-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <SidebarTrigger className="text-[#8A8F98] hover:text-[#D6FF4B] hover:bg-[#14161A] transition-colors h-8 w-8 rounded" />
            <div className="shrink-0">
              <EditorialBreadcrumb />
            </div>
            <div className="hidden md:flex items-center ml-2">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              {/* Live indicator */}
              <div className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 border border-[#1B1E23] rounded bg-[#101215] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                <span className="font-mono text-[9px] text-[#8A8F98] tracking-wider uppercase">
                  {liveLeadCount === null ? "AO VIVO" : `AO VIVO · ${liveLeadCount} LEADS/H`}
                </span>
              </div>

              <CommandPalette />
              <ActionInbox />
              <PushOptIn />
              <ProactiveAlertsBell />
              <NotificationBell />
            </div>
          </header>
          {isMobile && <MobilePushNudge />}
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
