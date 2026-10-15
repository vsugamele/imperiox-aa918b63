// Navegação (UX1.1): o menu por tarefa do dia a dia, e o Laboratório com tudo que saiu do menu (as rotas continuam no
// ar; nada foi apagado). Critério: o que tem uso real fica no menu; o que está vazio ou parado vai para o Laboratório
// até a medição de uso (imphq_page_views) dizer o que volta e o que pode ser arquivado de vez.
import {
  Activity, Bot, Boxes, BookOpen, Brain, Building2, CalendarCheck, CheckCheck, Clapperboard, Coins, Compass, DollarSign,
  FileText, FlaskConical, FolderKanban, FlaskRound, Gauge, Globe, HeartPulse, Inbox, KeyRound, LayoutDashboard, Layers,
  Library, LifeBuoy, Lightbulb, Link2, Map as MapIcon, Pencil, Radio, Search, Settings, Sparkles, Target, Users,
  UsersRound, Workflow, Zap,
} from "lucide-react";
import type { ElementType } from "react";

export type BadgeKey = "imperius" | "inbox" | "leads" | "rag" | "aprovar" | "saude";

export interface NavItem { title: string; url: string; icon: ElementType; badge?: BadgeKey }
export interface NavGroupDef { label: string; items: NavItem[] }

export const MENU: NavGroupDef[] = [
  {
    label: "Dia a dia",
    items: [
      { title: "Hoje", url: "/hoje", icon: CalendarCheck },
      { title: "Aprovar", url: "/aprovar", icon: CheckCheck, badge: "aprovar" },
      { title: "Caixa de Entrada", url: "/inbox", icon: Inbox, badge: "inbox" },
      { title: "Leads", url: "/leads", icon: Users, badge: "leads" },
      { title: "Recuperação", url: "/recuperacao", icon: LifeBuoy },
    ],
  },
  {
    label: "Projetos",
    items: [
      { title: "Projetos", url: "/projetos", icon: FolderKanban },
      { title: "Funis", url: "/funis", icon: Layers },
      { title: "Mapas", url: "/mapa", icon: MapIcon },
      { title: "OpenFlow", url: "/openflow", icon: Workflow },
      { title: "Sites", url: "/sites", icon: Globe },
    ],
  },
  {
    label: "Criativos",
    items: [
      { title: "Testes e levas", url: "/testes", icon: FlaskConical },
      { title: "Estratégias", url: "/estrategias", icon: Lightbulb },
      { title: "Studio (Elenco)", url: "/studio", icon: Clapperboard },
      { title: "Referências", url: "/referencias", icon: Library },
    ],
  },
  {
    label: "Dinheiro",
    items: [
      { title: "Gerenciador Ads", url: "/gerenciador", icon: Activity },
      { title: "Tracker", url: "/tracker", icon: Link2 },
      { title: "Atribuição", url: "/atribuicao", icon: Radio },
      { title: "Finanças", url: "/financas", icon: DollarSign },
      { title: "Custos IA", url: "/custos-ia", icon: Coins },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Saúde do sistema", url: "/saude", icon: HeartPulse, badge: "saude" },
      { title: "Imperius", url: "/imperius", icon: Bot, badge: "imperius" },
      { title: "Config", url: "/configuracoes", icon: Settings },
      { title: "Equipe", url: "/equipe", icon: UsersRound },
      { title: "Cofre", url: "/cofre", icon: KeyRound },
      { title: "Laboratório", url: "/laboratorio", icon: FlaskRound },
    ],
  },
];

export interface LabItem extends NavItem { motivo: string }

/** Saíram do menu em 15/10/2026 (UX1.1). Continuam abrindo pelo link, pelas ações rápidas (⌘J, "Ir para") e daqui; dá para fixar nos favoritos. */
export const LABORATORIO: LabItem[] = [
  { title: "Escritório", url: "/escritorio", icon: Building2, motivo: "Repete o Hoje" },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: "rag", motivo: "Repete o Hoje" },
  { title: "Campanhas", url: "/campanhas", icon: Target, motivo: "Sem dado novo há mais de 30 dias" },
  { title: "Inteligência IA", url: "/inteligencia-ia", icon: Brain, motivo: "Visão antiga da IA; a ação está em Aprovar e Imperius" },
  { title: "Assistente", url: "/assistente", icon: Compass, motivo: "Uso a medir" },
  { title: "Copy Lab", url: "/copy-lab", icon: Zap, motivo: "A copy agora sai da fábrica de criativos" },
  { title: "Hook Labs", url: "/hooks", icon: Sparkles, motivo: "Ganchos agora vêm do Método H&W (portas) na leva" },
  { title: "Swipe File", url: "/swipe", icon: Library, motivo: "Junto com Referências" },
  { title: "Market Intel", url: "/market-intel", icon: Search, motivo: "Tabelas vazias; a mineração diária substitui" },
  { title: "Skills", url: "/skills", icon: Zap, motivo: "Usadas pelos agentes; consulta rara" },
  { title: "Acervo RAG", url: "/acervo", icon: Brain, motivo: "Consulta rara" },
  { title: "Conteúdo", url: "/rascunhos", icon: Pencil, motivo: "Uso a medir" },
  { title: "Docs / KB", url: "/docs", icon: FileText, motivo: "Consulta rara" },
  { title: "Guia Claude", url: "/claude-skills", icon: BookOpen, motivo: "Consulta rara" },
  { title: "Empresa", url: "/empresa", icon: Building2, motivo: "Configuração feita uma vez" },
  { title: "Sala de máquinas", url: "/sala-de-maquinas", icon: Gauge, motivo: "Técnico; a Saúde do sistema resume" },
  { title: "Plataformas", url: "/plataformas", icon: Boxes, motivo: "Configuração feita uma vez" },
  { title: "Guia", url: "/guia", icon: BookOpen, motivo: "Consulta rara" },
];

export const ALL_NAV_ITEMS: NavItem[] = [...MENU.flatMap((g) => g.items), ...LABORATORIO];

/** Rota normalizada para a medição de uso: ids e uuids viram ":id" ("/projetos/abc-123" → "/projetos/:id"). */
export function routeKey(pathname: string): string {
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean)
    .map((p) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(p) || /^\d+$/.test(p) || (p.length > 20 && /\d/.test(p)) ? ":id" : p));
  return `/${parts.join("/")}`;
}
