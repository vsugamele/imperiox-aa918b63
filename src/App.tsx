import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhe from "./pages/ProjetoDetalhe";
import KanbanPage from "./pages/KanbanPage";
import Tarefas from "./pages/Tarefas";
import Chat from "./pages/Chat";
import Leads from "./pages/Leads";
import Financas from "./pages/Financas";
import MarketIntel from "./pages/MarketIntel";
import Mentes from "./pages/Mentes";
import Funis from "./pages/Funis";
import OpenFlow from "./pages/OpenFlow";
import Docs from "./pages/Docs";
import WhatsAppPage from "./pages/WhatsAppPage";
import Tracker from "./pages/Tracker";
import Referencias from "./pages/Referencias";
import Skills from "./pages/Skills";
import Equipe from "./pages/Equipe";
import Empresa from "./pages/Empresa";
import Configuracoes from "./pages/Configuracoes";
import Cofre from "./pages/Cofre";
import Guia from "./pages/Guia";
import ConteudoIA from "./pages/ConteudoIA";
import Nutricao from "./pages/Nutricao";
import Privacy from "./pages/Privacy";
import ExpertPortal from "./pages/ExpertPortal";
import Criativos from "./pages/Criativos";
import CriativoNovo from "./pages/CriativoNovo";
import CriativoDetalhe from "./pages/CriativoDetalhe";
import Metas from "./pages/Metas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/expert/:token" element={<ExpertPortal />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="projetos" element={<Projetos />} />
              <Route path="projetos/:id" element={<ProjetoDetalhe />} />
              <Route path="kanban" element={<KanbanPage />} />
              <Route path="tarefas" element={<Tarefas />} />
              <Route path="chat" element={<Chat />} />
              <Route path="leads" element={<Leads />} />
              <Route path="financas" element={<Financas />} />
              <Route path="market-intel" element={<MarketIntel />} />
              <Route path="mentes" element={<Mentes />} />
              <Route path="funis" element={<Funis />} />
              <Route path="openflow" element={<OpenFlow />} />
              <Route path="docs" element={<Docs />} />
              <Route path="whatsapp" element={<WhatsAppPage />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="referencias" element={<Referencias />} />
              <Route path="skills" element={<Skills />} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="empresa" element={<Empresa />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="cofre" element={<Cofre />} />
              <Route path="conteudo-ia" element={<ConteudoIA />} />
              <Route path="nutricao" element={<Nutricao />} />
              <Route path="guia" element={<Guia />} />
              <Route path="criativos" element={<Criativos />} />
              <Route path="criativos/novo" element={<CriativoNovo />} />
              <Route path="criativos/:batchId" element={<CriativoDetalhe />} />
              <Route path="metas" element={<Metas />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
