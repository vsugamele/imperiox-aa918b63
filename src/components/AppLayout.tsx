import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ProactiveAlertsBell } from "@/components/ProactiveAlertsBell";
import { supabase } from "@/integrations/supabase/client";

import { PushOptIn } from "@/components/PushOptIn";
import { ActionInbox } from "@/components/imperius/ActionInbox";
import { SaleWatcher } from "@/components/SaleWatcher";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobilePushNudge } from "@/components/mobile/MobilePushNudge";
import { useIsMobile } from "@/hooks/use-mobile";
import { FunnelArchitectCopilot } from "@/components/funis/FunnelArchitectCopilot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGlobalProject, useGlobalProjectList } from "@/hooks/useGlobalProject";
import { Check, ChevronDown, ExternalLink, FolderKanban, Sparkles, X } from "lucide-react";


function useLiveLeadCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {

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
    const intervalId = setInterval(fetchCount, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  return count;
}

const SIDEBAR_LS_KEY = "imphq:sidebar:open";

const ROUTE_META: Record<string, { kicker: string; title: string }> = {
  hoje: { kicker: "Operação", title: "Hoje" },
  aprovar: { kicker: "Decisões", title: "Aprovar" },
  estrategias: { kicker: "Vender", title: "Estratégias & Playbooks" },
  testes: { kicker: "Vender", title: "Testes de Criativos" },
  mapa: { kicker: "Clareza", title: "Mapa da Empresa" },
  dashboard: { kicker: "Overview", title: "Cockpit" },
  "dashboard-classic": { kicker: "Overview", title: "Dashboard Clássico" },
  imperius: { kicker: "Autonomia", title: "Imperius" },
  "inteligencia-ia": { kicker: "IA", title: "Inteligência IA" },
  "ai-saude": { kicker: "IA", title: "Saúde da IA" },
  "ai-learning": { kicker: "IA", title: "Memória da IA" },
  "saude-produtos": { kicker: "IA", title: "Saúde dos Produtos" },
  saude: { kicker: "Clareza", title: "Saúde do sistema" },
  "funil-conversao": { kicker: "Análise", title: "Funil" },
  inbox: { kicker: "Canais", title: "Caixa de Entrada" },
  leads: { kicker: "CRM", title: "Leads" },
  whatsapp: { kicker: "Canal", title: "WhatsApp" },
  "sdr-coach": { kicker: "Operar", title: "SDR Coach" },
  instagram: { kicker: "Canal", title: "Instagram" },
  openflow: { kicker: "Fluxos", title: "OpenFlow" },
  "openflow/cinna-shield": { kicker: "Fluxos", title: "CinnaShield X1" },
  "openflow/slimsoda": { kicker: "Fluxos", title: "SlimSoda X1" },
  "openflow/agentes": { kicker: "Fluxos", title: "Agentes IA" },
  recuperacao: { kicker: "Resgate", title: "Recuperação" },
  projetos: { kicker: "Portfólio", title: "Projetos" },
  campanhas: { kicker: "Vender", title: "Campanhas" },
  lancamentos: { kicker: "Vender", title: "Lançamentos" },
  sites: { kicker: "Vender", title: "Sites & Páginas" },
  financas: { kicker: "Capital", title: "Finanças" },
  gerenciador: { kicker: "Mídia paga", title: "Gerenciador Ads" },
  atribuicao: { kicker: "Capital", title: "Atribuição" },
  "custos-ia": { kicker: "Capital", title: "Custos IA" },
  "openrouter-custos": { kicker: "Capital", title: "Custos OpenRouter" },
  funis: { kicker: "Estrutura", title: "Funis" },
  "funis/simulador": { kicker: "Estrutura", title: "Simulador de Funil" },
  "funis/linfaflow-x1": { kicker: "Conversão", title: "LinfaFlow X1" },
  "funis/linfaflow-x1-ready": { kicker: "Conversão", title: "LinfaFlow X1 Ready" },
  "funis/linfaflow-care": { kicker: "Conversão", title: "LinfaFlow Care Room" },
  "funis/linfaflow-care-dashboard": { kicker: "Conversão", title: "LinfaFlow Care Dashboard" },
  "funis/slimsoda-x1": { kicker: "Conversão", title: "SlimSoda X1" },
  metas: { kicker: "Norte", title: "Metas" },
  cohort: { kicker: "Análise", title: "Cohort & LTV" },
  nutricao: { kicker: "E-mail", title: "Nutrição" },
  tracker: { kicker: "UTM", title: "Tracker" },
  mentes: { kicker: "IA", title: "Mentes" },
  "market-intel": { kicker: "IA", title: "Market Intel" },
  "conteudo-ia": { kicker: "IA", title: "Conteúdo" },
  "copy-lab": { kicker: "IA", title: "Copy Lab" },
  "copy-engine": { kicker: "IA", title: "Copy Engine" },
  hooks: { kicker: "IA", title: "Hook Labs" },
  ugc: { kicker: "IA", title: "UGC Ad Factory" },
  "vsl-lab": { kicker: "IA", title: "VSL Lab" },
  criativos: { kicker: "IA", title: "Criativos" },
  studio: { kicker: "IA", title: "Estúdio" },
  acervo: { kicker: "Acervo", title: "Base de Conhecimento RAG" },
  swipe: { kicker: "Acervo", title: "Swipe File" },
  referencias: { kicker: "Acervo", title: "Referências" },
  "claude-skills": { kicker: "Acervo", title: "Guia Claude" },
  skills: { kicker: "IA", title: "Skills" },
  kanban: { kicker: "Planejar", title: "Kanban" },
  tarefas: { kicker: "Planejar", title: "Tarefas" },
  rascunhos: { kicker: "Acervo", title: "Conteúdo & Rascunhos" },
  docs: { kicker: "KB", title: "Docs" },
  empresa: { kicker: "Setup", title: "Empresa" },
  equipe: { kicker: "Setup", title: "Equipe" },
  cofre: { kicker: "Setup", title: "Cofre" },
  configuracoes: { kicker: "Setup", title: "Configurações" },
  "sala-de-maquinas": { kicker: "Setup", title: "Sala de máquinas" },
  plataformas: { kicker: "Setup", title: "Plataformas" },
  guia: { kicker: "Setup", title: "Guia" },
  chat: { kicker: "IA", title: "Chat" },
  assistente: { kicker: "IA", title: "Assistente" },
  "product-copilot": { kicker: "IA", title: "Copilot de Produtos" },
  "infoproduto-copilot": { kicker: "IA", title: "Copilot de Infoproduto" },
  webinar: { kicker: "Evento", title: "Webinar" },
};

function EditorialBreadcrumb() {
  const { pathname } = useLocation();
  const { projects } = useGlobalProject();
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] || "hoje";
  const compound = parts.slice(0, 2).join("/");

  if (first === "projetos" && parts[1]) {
    const proj = projects.find((p) => p.id === parts[1]);
    return (
      <div className="hidden md:flex items-baseline gap-2 min-w-0">
        <Link to="/projetos" className="font-mono text-[9px] uppercase tracking-[0.2em] text-subtle hover:text-foreground transition-colors shrink-0">
          Projetos
        </Link>
        <span className="text-[#33373F]">/</span>
        <span className="font-sans font-semibold text-[14px] tracking-[-0.01em] text-foreground truncate max-w-[200px]">
          {proj ? `${proj.icon ? `${proj.icon} ` : ""}${proj.name}` : parts[1]}
        </span>
      </div>
    );
  }

  const meta = ROUTE_META[compound] || ROUTE_META[first] || { kicker: "Imperio HQ", title: first };
  return (
    <div className="hidden md:flex items-baseline gap-2 min-w-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-subtle shrink-0">
        {meta.kicker}
      </span>
      <span className="text-[#33373F]">/</span>
      <span className="font-sans font-semibold text-[14px] tracking-[-0.01em] text-foreground truncate">
        {meta.title}
      </span>
    </div>
  );
}

function GlobalProjectSwitcher() {
  const { projectId, setProjectId } = useGlobalProject();
  const { data: projects = [] } = useGlobalProjectList();
  const activeProject = !projectId || projectId === "all" ? null : projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="hidden sm:flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Filtrar operação por projeto globalmente"
            className={`flex items-center gap-1.5 h-[30px] px-2.5 rounded-full border text-xs transition-colors max-w-[200px] ${
              activeProject
                ? "border-primary/40 bg-primary/10 text-primary font-medium"
                : "border-border bg-[#101215] text-muted-foreground hover:text-foreground hover:border-[#2A2E35]"
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {activeProject ? `${activeProject.icon ? `${activeProject.icon} ` : ""}${activeProject.name}` : "Todos os projetos"}
            </span>
            <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-[380px] overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Contexto da Operação
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setProjectId(null)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <span>Todos os projetos</span>
            {(!projectId || projectId === "all") && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => setProjectId(p.id)}
              className="flex items-center justify-between gap-2 text-xs cursor-pointer"
            >
              <span className="truncate">
                {p.icon ? `${p.icon} ` : "📁 "}
                {p.name}
              </span>
              {projectId === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {activeProject && (
        <>
          <Link
            to={`/projetos/${activeProject.id}`}
            title={`Abrir ficha de ${activeProject.name}`}
            className="flex items-center justify-center h-[26px] w-[26px] rounded-full border border-border bg-[#101215] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => setProjectId("all")}
            title="Limpar filtro de projeto"
            className="flex items-center justify-center h-[26px] w-[26px] rounded-full border border-border bg-[#101215] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

// Preferência de view persistente (compartilhada com ProtectedRoute e MobileCockpit)
const MOBILE_OVERRIDE_KEY = "imphq_force_desktop";

export function AppLayout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const liveLeadCount = useLiveLeadCount();
  const [architectOpen, setArchitectOpen] = useState(false);
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_LS_KEY);
    return v === null ? true : v === "true";
  });

  const isChatRoute = location.pathname.startsWith("/inbox") || location.pathname.startsWith("/whatsapp") || location.pathname.startsWith("/instagram");

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_LS_KEY, String(open)); } catch { /* Optional browser storage can be unavailable; keep the current in-memory preference/default. */ }
  }, [open]);

  // Listener global para abrir o Arquiteto de Funis de qualquer tela
  useEffect(() => {
    const handleOpen = () => setArchitectOpen(true);
    window.addEventListener("imphq:open-funnel-architect", handleOpen);
    return () => window.removeEventListener("imphq:open-funnel-architect", handleOpen);
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} className={isChatRoute ? "h-screen max-h-screen overflow-hidden" : ""}>
      <div className={`flex w-full bg-background text-foreground ${isChatRoute ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"}`}>
        <AppSidebar />
        <div className={`flex-1 flex flex-col min-w-0 ${isChatRoute ? "h-screen max-h-screen overflow-hidden" : ""}`}>
          <header className={`relative h-14 flex items-center px-3 md:px-5 shrink-0 bg-background/85 backdrop-blur-md border-b border-border ${isChatRoute ? "" : "sticky top-0"} z-20 gap-2 md:gap-3`} style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <SidebarTrigger className="text-muted-foreground hover:text-primary hover:bg-[#14161A] transition-colors h-8 w-8 rounded" />
            <div className="shrink-0">
              <EditorialBreadcrumb />
            </div>
            <GlobalProjectSwitcher />
            <div className="hidden md:flex items-center ml-1">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              {/* Botão Global Arquiteto de Funis IA */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArchitectOpen(true)}
                className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors shadow-xs"
                title="Arquiteto de Funis IA (Russell Brunson & Alex Hormozi)"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Arquiteto Funil</span>
              </Button>

              {/* Live indicator */}
              <div className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 border border-border rounded bg-[#101215] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">
                  {liveLeadCount === null ? "AO VIVO" : `AO VIVO · ${liveLeadCount} LEADS/H`}
                </span>
              </div>

              <CommandPalette />
              <ActionInbox />
              <SaleWatcher />
              <PushOptIn />
              <ProactiveAlertsBell />
              <NotificationBell />
            </div>
          </header>
          {isMobile && <MobilePushNudge />}
          <main
            className={`flex-1 min-h-0 ${isChatRoute ? "h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] overflow-hidden p-0" : "overflow-auto p-3 md:p-6"}`}
            style={{
              paddingBottom: isChatRoute
                ? 0
                : isMobile
                ? "calc(72px + env(safe-area-inset-bottom))"
                : "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <Outlet />
          </main>
        </div>
        {isMobile && <MobileBottomNav />}
      </div>

      {/* Global Arquiteto de Funis Copilot Sheet */}
      <FunnelArchitectCopilot
        open={architectOpen}
        onOpenChange={setArchitectOpen}
      />
    </SidebarProvider>
  );
}
