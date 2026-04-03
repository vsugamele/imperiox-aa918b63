import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Kanban, ListTodo, MessageCircle,
  Users, DollarSign, Search, Target, Brain, Workflow, FileText,
  MessageSquare, Link2, Image, Zap, KeyRound, UsersRound, Building2,
  Settings, ArrowRight, BookOpen, Terminal
} from "lucide-react";

const WORKFLOW_STEPS = [
  { step: 1, title: "Criar Projeto", desc: "Defina nome, categoria e status do projeto", route: "/projetos" },
  { step: 2, title: "Preencher Briefing", desc: "Dados do projeto, produtos, pipeline e integrações", route: "/projetos" },
  { step: 3, title: "Definir Avatar", desc: "Perfil, dores, desejos, problemas e gatilhos do público", route: "/projetos" },
  { step: 4, title: "Arsenal de Copy", desc: "Promessa, inimigo comum, oportunidade e variações persuasivas", route: "/projetos" },
  { step: 5, title: "Pesquisa de Mercado", desc: "Concorrentes, dossiês, ofertas e copywriting do mercado", route: "/market-intel" },
  { step: 6, title: "Montar Funil", desc: "Estrutura de páginas e sequências de conversão", route: "/funis" },
  { step: 7, title: "Ativar Tráfego", desc: "Ads, UTMs, tracking e integração de pixels", route: "/tracker" },
  { step: 8, title: "Acompanhar Resultados", desc: "Dashboard, leads, finanças e ROI", route: "/dashboard" },
];

const MODULES = [
  { icon: LayoutDashboard, title: "Dashboard", desc: "Visão geral com métricas, atividade recente e KPIs financeiros", route: "/dashboard", color: "text-primary" },
  { icon: FolderKanban, title: "Projetos", desc: "Central de projetos com Briefing, Avatar, Pipeline, Copy e Pesquisa", route: "/projetos", color: "text-primary" },
  { icon: Kanban, title: "Kanban", desc: "Boards visuais para gestão de tarefas por projeto", route: "/kanban", color: "text-primary" },
  { icon: ListTodo, title: "Tarefas", desc: "Lista de tarefas com status, prioridade e filtros", route: "/tarefas", color: "text-primary" },
  { icon: MessageCircle, title: "Chat", desc: "Comunicação interna com canais e comandos rápidos (/tarefa, /lead, /evento)", route: "/chat", color: "text-primary" },
  { icon: Users, title: "Leads", desc: "CRM com captura, scoring, timeline e importação de leads", route: "/leads", color: "text-emerald-400" },
  { icon: DollarSign, title: "Finanças", desc: "Receitas, custos, ROI e importação de dados de ads", route: "/financas", color: "text-emerald-400" },
  { icon: Search, title: "Market Intel", desc: "Inteligência de mercado com dados e tendências", route: "/market-intel", color: "text-emerald-400" },
  { icon: Target, title: "Funis", desc: "Visualização e gestão de funis de vendas", route: "/funis", color: "text-emerald-400" },
  { icon: Brain, title: "Mentes IA", desc: "Agentes de IA especializados com contexto do projeto", route: "/mentes", color: "text-violet-400" },
  { icon: Workflow, title: "OpenFlow", desc: "Editor visual de fluxos de automação multicanal", route: "/openflow", color: "text-violet-400" },
  { icon: FileText, title: "Docs / KB", desc: "Base de conhecimento com templates e documentação", route: "/docs", color: "text-cyan-400" },
  { icon: MessageSquare, title: "WhatsApp", desc: "Integração com WhatsApp para atendimento e envios em massa", route: "/whatsapp", color: "text-cyan-400" },
  { icon: Link2, title: "Tracker UTM", desc: "Rastreamento de links e parâmetros UTM", route: "/tracker", color: "text-cyan-400" },
  { icon: Image, title: "Referências", desc: "Banco de referências visuais e inspirações", route: "/referencias", color: "text-cyan-400" },
  { icon: Zap, title: "Skills", desc: "Inventário de skills e prompts especializados dos agentes IA", route: "/skills", color: "text-cyan-400" },
  { icon: KeyRound, title: "Cofre", desc: "Armazenamento seguro de senhas e credenciais", route: "/cofre", color: "text-cyan-400" },
];

const COMMANDS = [
  { cmd: "/tarefa", desc: "Cria uma tarefa rápida", example: '/tarefa Revisar copy da LP' },
  { cmd: "/lead", desc: "Registra um lead manual", example: '/lead João Silva joao@email.com' },
  { cmd: "/evento", desc: "Cria um evento no calendário", example: '/evento Reunião de kick-off amanhã 14h' },
];

export default function Guia() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Guia da Plataforma</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Referência rápida de todos os módulos, fluxo de trabalho e comandos disponíveis no Imperio HQ.
        </p>
      </div>

      {/* Fluxo de Trabalho */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🚀 Fluxo de Trabalho Recomendado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {WORKFLOW_STEPS.map((s) => (
              <button
                key={s.step}
                onClick={() => navigate(s.route)}
                className="group p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">
                    {s.step}
                  </Badge>
                  <span className="text-xs font-medium group-hover:text-primary transition-colors">{s.title}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📦 Módulos da Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map((m) => (
              <button
                key={m.title}
                onClick={() => navigate(m.route)}
                className="group flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
              >
                <m.icon className={`h-5 w-5 mt-0.5 shrink-0 ${m.color}`} />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium group-hover:text-primary transition-colors">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Facebook CAPI */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📘 Facebook CAPI — Configuração por Projeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Flow Visual */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {["LP com imptrack.js", "→", "Captura Lead", "→", "Webhook de Venda", "→", "CAPI Purchase"].map((item, i) => (
              item === "→" ? <ArrowRight key={i} className="h-3 w-3 text-primary shrink-0" /> :
              <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">{item}</Badge>
            ))}
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">✅ Checklist de Configuração</p>
            {[
              { label: "Pixel ID preenchido no projeto", desc: "Projeto → Analytics → Facebook Pixel & CAPI → Pixel ID" },
              { label: "Access Token CAPI preenchido", desc: "Gerado no Events Manager → Configurações → Gerar Token de Acesso" },
              { label: "Webhook configurado na plataforma de pagamento", desc: "Copie a URL do webhook em Projeto → Analytics → Webhooks de Pagamento" },
              { label: "Meta tag imp-pixel-id na LP", desc: '<meta name=\"imp-pixel-id\" content=\"SEU_PIXEL_ID\"> no <head> da página' },
              { label: "Script imptrack.js instalado na LP", desc: "Copie em Tracker → Script e cole no <head> da landing page" },
            ].map((item, i) => (
              <div key={i} className="p-2 rounded bg-secondary/50 border border-border">
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">❓ FAQ Rápido</p>
            {[
              { q: "Como gerar o Access Token CAPI?", a: "No Events Manager do Facebook → Configurações do Pixel → Conversions API → Gerar Token de Acesso. O token começa com EAA..." },
              { q: "Como testar se está funcionando?", a: "Preencha o campo 'Test Event Code' no projeto (formato TEST12345). Eventos aparecerão na aba 'Test Events' do Events Manager." },
              { q: "Preciso do Pixel E do CAPI?", a: "Sim, ambos. O Pixel captura eventos no navegador, o CAPI envia pelo servidor. Juntos garantem cobertura máxima mesmo com bloqueadores de anúncios." },
              { q: "É por projeto ou global?", a: "Por projeto. Cada projeto tem seu próprio Pixel ID, Access Token e URLs de webhook isolados." },
            ].map((item, i) => (
              <div key={i} className="p-2 rounded bg-secondary/50 border border-border">
                <p className="text-xs font-medium text-primary">{item.q}</p>
                <p className="text-[10px] text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comandos do Chat */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">Comandos do Chat</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COMMANDS.map((c) => (
              <div key={c.cmd} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
                <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30 shrink-0">
                  {c.cmd}
                </Badge>
                <div className="space-y-0.5">
                  <p className="text-xs text-foreground">{c.desc}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.example}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guia de Captura de Leads */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📝 Captura de Leads — Como Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Passo a Passo</p>
            {[
              { step: "1", title: "Criar formulário", desc: "Vá em Leads → aba Formulários → Novo Formulário. Defina nome, etapa do funil e campos customizados (texto, select, radio, etc)." },
              { step: "2", title: "Configurar campos", desc: "Adicione perguntas como faturamento, maior dor, nível de consciência. Defina tags automáticas para segmentação." },
              { step: "3", title: "Copiar snippet", desc: "Clique em 'Embed HTML' ou 'Embed JS'. Cole na sua landing page externa." },
              { step: "4", title: "Testar captura", desc: "Preencha o formulário na LP. O lead aparecerá em Leads com todas as respostas na timeline." },
              { step: "5", title: "Analisar respostas", desc: "Vá em Leads → aba Insights para ver correlações entre respostas e conversão." },
            ].map((item) => (
              <div key={item.step} className="p-2 rounded bg-secondary/50 border border-border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">{item.step}</Badge>
                  <p className="text-xs font-medium">{item.title}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Opções de Integração</p>
            <div className="p-2 rounded bg-secondary/50 border border-border">
              <p className="text-xs font-medium text-primary">HTML Puro (qualquer LP)</p>
              <pre className="text-[10px] text-muted-foreground font-mono mt-1 overflow-auto">{`<form action="https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/capture-lead?project=ID&form=FORM_ID" method="POST">
  <input name="email" required />
  <input name="nome" />
  <button type="submit">Enviar</button>
</form>`}</pre>
            </div>
            <div className="p-2 rounded bg-secondary/50 border border-border">
              <p className="text-xs font-medium text-primary">JS Embed (sem redirect)</p>
              <pre className="text-[10px] text-muted-foreground font-mono mt-1 overflow-auto">{`<div id="imp-form" data-form="FORM_ID" data-project="PROJECT_ID"></div>
<script src="https://imperiox.lovable.app/embed/capture.js"></script>`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">💡 Dicas Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Use o <strong className="text-foreground">Arsenal de Copy</strong> para criar múltiplas variações de cada bloco persuasivo e testar qual converte melhor.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>A <strong className="text-foreground">Mentes IA</strong> fica mais inteligente quando o briefing e avatar do projeto estão preenchidos.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Use a <strong className="text-foreground">Central de Conteúdo IA</strong> no projeto para gerar scripts de ads, roteiros VSL/webinar e LPs de vendas em HTML.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>A <strong className="text-foreground">Pesquisa Inteligente</strong> analisa concorrentes, produtos e experts usando IA + scraping para embasar suas criações.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Configure o <strong className="text-foreground">Setup de Integração</strong> no briefing para garantir tracking completo antes de ativar tráfego.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
