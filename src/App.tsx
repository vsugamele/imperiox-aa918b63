import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for bundle size optimization and faster page load speeds
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardClassic = lazy(() => import("./pages/DashboardClassic"));
const AISaude = lazy(() => import("./pages/AISaude"));
const Funil = lazy(() => import("./pages/Funil"));
const Projetos = lazy(() => import("./pages/Projetos"));
const ProjetoDetalhe = lazy(() => import("./pages/ProjetoDetalhe"));
const AutopilotProgress = lazy(() => import("./pages/AutopilotProgress"));
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Chat = lazy(() => import("./pages/Chat"));
const Leads = lazy(() => import("./pages/Leads"));
const CampanhaTag = lazy(() => import("./pages/CampanhaTag"));
const Lead360 = lazy(() => import("./pages/Lead360"));
const Financas = lazy(() => import("./pages/Financas"));
const MarketIntel = lazy(() => import("./pages/MarketIntel"));
const Mentes = lazy(() => import("./pages/Mentes"));
const Funis = lazy(() => import("./pages/Funis"));
const OpenFlow = lazy(() => import("./pages/OpenFlow"));
const AgentesIA = lazy(() => import("./pages/AgentesIA"));
const AgenteEditor = lazy(() => import("./pages/AgenteEditor"));
const Docs = lazy(() => import("./pages/Docs"));
const WhatsAppPage = lazy(() => import("./pages/WhatsAppPage"));
const InstagramPage = lazy(() => import("./pages/InstagramPage"));
const Tracker = lazy(() => import("./pages/Tracker"));
const Referencias = lazy(() => import("./pages/Referencias"));
const Sites = lazy(() => import("./pages/Sites"));
const Skills = lazy(() => import("./pages/Skills"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Empresa = lazy(() => import("./pages/Empresa"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Cofre = lazy(() => import("./pages/Cofre"));
const Guia = lazy(() => import("./pages/Guia"));
const ConteudoIA = lazy(() => import("./pages/ConteudoIA"));
const Nutricao = lazy(() => import("./pages/Nutricao"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ExpertPortal = lazy(() => import("./pages/ExpertPortal"));
const Criativos = lazy(() => import("./pages/Criativos"));
const CriativoNovo = lazy(() => import("./pages/CriativoNovo"));
const CriativoDetalhe = lazy(() => import("./pages/CriativoDetalhe"));
const Metas = lazy(() => import("./pages/Metas"));
const Recuperacao = lazy(() => import("./pages/Recuperacao"));
const Cohort = lazy(() => import("./pages/Cohort"));
const Gerenciador = lazy(() => import("./pages/Gerenciador"));
const Studio = lazy(() => import("./pages/Studio"));
const StudioCanvas = lazy(() => import("./pages/StudioCanvas"));
const Swipe = lazy(() => import("./pages/Swipe"));
const HookLabs = lazy(() => import("./pages/HookLabs"));
const UgcAdFactory = lazy(() => import("./pages/UgcAdFactory"));
const Imperius = lazy(() => import("./pages/Imperius"));
const Campanhas = lazy(() => import("./pages/Campanhas"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const Assistente = lazy(() => import("./pages/Assistente"));
const Webinar = lazy(() => import("./pages/Webinar"));
const VslLab = lazy(() => import("./pages/VslLab"));
const Rascunhos = lazy(() => import("./pages/Rascunhos"));
const WebinarSessao = lazy(() => import("./pages/WebinarSessao"));
const WebinarPublic = lazy(() => import("./pages/WebinarPublic"));
const FormPublic = lazy(() => import("./pages/FormPublic"));
const ProductCopilot = lazy(() => import("./pages/ProductCopilot"));
const InfoprodutoCopilot = lazy(() => import("./pages/InfoprodutoCopilot"));
const MapaPublico = lazy(() => import("./pages/MapaPublico"));

const SDRCoach = lazy(() => import("./pages/SDRCoach"));
const ABTests = lazy(() => import("./pages/ABTests"));
const MobileCockpit = lazy(() => import("./pages/MobileCockpit"));
const Inbox = lazy(() => import("./pages/Inbox"));
const CopyEngine = lazy(() => import("./pages/CopyEngine"));
const CopyLab = lazy(() => import("./pages/CopyLab"));
const ClaudeSkillsGuide = lazy(() => import("./pages/ClaudeSkillsGuide"));
const AILearning = lazy(() => import("./pages/AILearning"));
const SaudeProdutos = lazy(() => import("./pages/SaudeProdutos"));
const InteligenciaIA = lazy(() => import("./pages/InteligenciaIA"));
const Atribuicao = lazy(() => import("./pages/Atribuicao"));
const FunilSimulador = lazy(() => import("./pages/FunilSimulador"));
const OpenRouterCustos = lazy(() => import("./pages/OpenRouterCustos"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Cache agressivo: dados de configuração raramente mudam.
// staleTime 5min evita refetches ao navegar entre páginas.
// gcTime 15min mantém cache em memória — retorno a página = instantâneo.
// refetchOnWindowFocus false: sem hammering ao voltar para a aba.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full bg-background/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-2.5">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <span className="text-xs text-muted-foreground font-medium animate-pulse">Carregando painel...</span>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/expert/:token" element={<ExpertPortal />} />
              <Route path="/f/:formId" element={<FormPublic />} />
              <Route path="/w/:sessionId" element={<WebinarPublic />} />
              <Route path="/mapa/:token" element={<MapaPublico />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                {/* Smart landing — goes straight to pending AI actions */}
                <Route index element={<Navigate to="/imperius" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="dashboard-classic" element={<DashboardClassic />} />
                <Route path="inteligencia-ia" element={<InteligenciaIA />} />
                <Route path="ai-saude" element={<Navigate to="/inteligencia-ia?tab=saude" replace />} />
                <Route path="ai-learning" element={<Navigate to="/inteligencia-ia?tab=memoria" replace />} />
                <Route path="saude-produtos" element={<Navigate to="/inteligencia-ia?tab=produtos" replace />} />
                <Route path="funil-conversao" element={<Funil />} />
                <Route path="projetos" element={<Projetos />} />
                <Route path="projetos/:id" element={<ProjetoDetalhe />} />
                <Route path="projetos/:id/autopilot/:runId" element={<AutopilotProgress />} />
                <Route path="kanban" element={<KanbanPage />} />
                <Route path="tarefas" element={<Tarefas />} />
                <Route path="chat" element={<Chat />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/:id" element={<Lead360 />} />
                <Route path="leads/campanha/:tag" element={<CampanhaTag />} />
                <Route path="copy-engine" element={<CopyEngine />} />
                <Route path="copy-lab" element={<CopyLab />} />
                <Route path="campanhas" element={<Campanhas />} />
                
                <Route path="financas" element={<Financas />} />
                <Route path="market-intel" element={<MarketIntel />} />
                <Route path="mentes" element={<Mentes />} />
                <Route path="funis" element={<Funis />} />
                <Route path="funis/simulador" element={<FunilSimulador />} />
                <Route path="openflow" element={<OpenFlow />} />
                <Route path="openflow/agentes" element={<AgentesIA />} />
                <Route path="openflow/agentes/:id" element={<AgenteEditor />} />
                <Route path="docs" element={<Docs />} />
                {/* Unified Inbox */}
                <Route path="inbox" element={<Inbox />} />
                {/* Backward-compat redirects — old URLs still work */}
                <Route path="whatsapp" element={<Navigate to="/inbox?tab=whatsapp" replace />} />
                <Route path="instagram" element={<Navigate to="/inbox?tab=instagram" replace />} />
                <Route path="lancamentos" element={<Navigate to="/campanhas?tab=lancamentos" replace />} />
                <Route path="kanban" element={<Navigate to="/tarefas?view=kanban" replace />} />
                <Route path="sdr-coach" element={<Navigate to="/inbox?tab=whatsapp" replace />} />
                <Route path="ab-tests" element={<Navigate to="/campanhas?tab=ab-tests" replace />} />
                <Route path="mobile-cockpit" element={<MobileCockpit />} />
                <Route path="tracker" element={<Tracker />} />
                <Route path="atribuicao" element={<Atribuicao />} />
                <Route path="openrouter-custos" element={<OpenRouterCustos />} />
                <Route path="referencias" element={<Referencias />} />
                <Route path="sites" element={<Sites />} />
                <Route path="skills" element={<Skills />} />
                <Route path="equipe" element={<Equipe />} />
                <Route path="empresa" element={<Empresa />} />
                <Route path="mapa-empresa" element={<Navigate to="/funis?view=mapa" replace />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="cofre" element={<Cofre />} />
                <Route path="conteudo-ia" element={<ConteudoIA />} />
                <Route path="nutricao" element={<Nutricao />} />
                <Route path="guia" element={<Guia />} />
                <Route path="claude-skills" element={<ClaudeSkillsGuide />} />
                <Route path="criativos" element={<Criativos />} />
                <Route path="criativos/novo" element={<CriativoNovo />} />
                <Route path="criativos/:batchId" element={<CriativoDetalhe />} />
                <Route path="metas" element={<Metas />} />
                <Route path="recuperacao" element={<Recuperacao />} />
                <Route path="cohort" element={<Cohort />} />
                <Route path="gerenciador" element={<Gerenciador />} />
                <Route path="studio" element={<StudioCanvas />} />
                <Route path="studio/legado" element={<Studio />} />
                <Route path="swipe" element={<Swipe />} />
                <Route path="hooks" element={<HookLabs />} />
                <Route path="ugc" element={<UgcAdFactory />} />
                <Route path="imperius" element={<Imperius />} />
                <Route path="assistente" element={<Assistente />} />
                <Route path="rascunhos" element={<Rascunhos />} />
                <Route path="vsl-lab" element={<VslLab />} />
                <Route path="product-copilot" element={<ProductCopilot />} />
                <Route path="infoproduto-copilot" element={<InfoprodutoCopilot />} />
                <Route path="webinar" element={<Webinar />} />
                <Route path="webinar/:sessionId" element={<WebinarSessao />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
