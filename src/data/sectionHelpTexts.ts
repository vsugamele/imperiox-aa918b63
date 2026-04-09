export interface SectionHelp {
  title: string;
  description: string;
  usage?: string;
}

export const sectionHelpTexts: Record<string, SectionHelp> = {
  // Páginas principais
  dashboard: {
    title: "Dashboard",
    description: "Visão geral dos seus projetos, vendas recentes, leads e métricas de desempenho.",
    usage: "Acompanhe os KPIs mais importantes e identifique oportunidades rapidamente.",
  },
  kanban: {
    title: "Kanban",
    description: "Gerencie tarefas e processos em formato de quadro com colunas personalizáveis. Arraste cards entre colunas.",
    usage: "Crie boards por projeto ou por tipo de trabalho. Use filtros para ver apenas tarefas de um expert ou produto.",
  },
  leads: {
    title: "Leads",
    description: "Central de todos os leads capturados. Veja origem, score, histórico de interações e status de cada lead.",
    usage: "Use filtros por projeto e status. Importe leads via CSV ou capture automaticamente via formulários.",
  },
  financas: {
    title: "Finanças",
    description: "Acompanhe receitas, despesas e métricas financeiras de cada produto e projeto.",
    usage: "Conecte plataformas de pagamento para importar vendas automaticamente.",
  },
  mentes: {
    title: "Mentes IA",
    description: "Agentes de IA especializados que ajudam em tarefas de copywriting, pesquisa de mercado, criação de avatar e mais.",
    usage: "Selecione uma mente, forneça contexto do projeto e receba outputs estratégicos.",
  },
  skills: {
    title: "Skills",
    description: "Biblioteca de prompts e habilidades de IA prontas para uso. Cada skill é otimizada para uma tarefa específica.",
    usage: "Clique em uma skill para ver o prompt completo e copiar para usar em qualquer IA.",
  },
  openflow: {
    title: "OpenFlow",
    description: "Editor visual de fluxos de automação. Conecte ações, condições e integrações em um fluxograma interativo.",
    usage: "Arraste componentes para criar automações. Conecte com WhatsApp, email e outras integrações.",
  },
  docs: {
    title: "Documentação",
    description: "Base de conhecimento interna. Armazene SOPs, guias, templates e referências do seu negócio.",
    usage: "Organize por categorias e use a busca para encontrar rapidamente.",
  },
  whatsapp: {
    title: "WhatsApp",
    description: "Hub de comunicação via WhatsApp. Conecte seu número, envie mensagens e gerencie conversas.",
    usage: "Gere o QR Code, escaneie com seu celular e comece a gerenciar conversas pelo painel.",
  },
  tracker: {
    title: "Tracker",
    description: "Acompanhe tempo gasto em tarefas e projetos. Ideal para medir produtividade da equipe.",
    usage: "Inicie um timer ao começar uma tarefa e pare ao finalizar.",
  },
  equipe: {
    title: "Equipe",
    description: "Gerencie membros da equipe, funções e permissões de cada colaborador.",
    usage: "Adicione membros e atribua a projetos específicos.",
  },
  referencias: {
    title: "Referências",
    description: "Biblioteca de referências visuais, copies e materiais de inspiração organizados por categoria.",
    usage: "Salve links, screenshots e textos que servem de referência para seus projetos.",
  },
  cofre: {
    title: "Cofre",
    description: "Armazene informações sensíveis como credenciais, tokens e dados confidenciais de forma segura.",
    usage: "Use para guardar senhas de plataformas, tokens de API e dados que não devem ficar expostos.",
  },
  configuracoes: {
    title: "Configurações",
    description: "Gerencie APIs, notificações, segurança, cron jobs e chaves de acesso do sistema.",
    usage: "Configure integrações e preferências gerais do sistema aqui.",
  },

  // Dentro de Projeto
  projeto_briefing: {
    title: "Briefing",
    description: "Informações fundamentais do projeto: nome, nicho, público-alvo, proposta de valor e redes sociais ativas.",
    usage: "Preencha o briefing completo para que a IA gere conteúdo mais preciso.",
  },
  projeto_avatar: {
    title: "Avatar",
    description: "Perfil detalhado do cliente ideal: dores, desejos, objeções, voyeurismos e gatilhos emocionais.",
    usage: "Clique em 'Gerar com IA' para criar o avatar automaticamente ou importe de um documento.",
  },
  projeto_expert: {
    title: "Painel do Expert",
    description: "Plano de conteúdo mensal para o especialista. Inclui calendário, sugestão de posts por plataforma e guia de produção.",
    usage: "Defina os objetivos do mês, gere o plano com IA e compartilhe o link público com o expert.",
  },
  projeto_branding: {
    title: "Branding",
    description: "Kit de marca: cores, tipografia, tom de voz e diretrizes visuais do projeto.",
    usage: "Defina a identidade visual para manter consistência em todos os materiais.",
  },
  projeto_kpis: {
    title: "KPIs",
    description: "Indicadores-chave de desempenho do projeto. Defina metas e acompanhe o progresso.",
    usage: "Configure metas de vendas, leads e engajamento para acompanhar semanalmente.",
  },
  projeto_copy_arsenal: {
    title: "Arsenal de Copy",
    description: "Promessas, inimigos comuns, mecanismos únicos e elementos persuasivos para cada produto.",
    usage: "Clique em 'Gerar com IA' para criar baseado no briefing e site do produto.",
  },
  projeto_calendario: {
    title: "Calendário",
    description: "Visualização de eventos, lançamentos e datas importantes do projeto.",
    usage: "Sincronize com Google Calendar para ver todos os compromissos.",
  },
  projeto_conteudo: {
    title: "Conteúdo",
    description: "Gerenciamento de conteúdo por plataforma: roteiros, legendas, estrutura de posts e stories.",
    usage: "Use a IA para gerar roteiros e adapte para cada plataforma.",
  },
  projeto_pesquisa: {
    title: "Pesquisa",
    description: "Pesquisa de mercado e inteligência competitiva. Analise concorrentes, ofertas e tendências.",
    usage: "Use a IA para investigar concorrentes e gerar dossiês automáticos.",
  },
  projeto_pipeline: {
    title: "Pipeline",
    description: "Funil de vendas visual do projeto. Acompanhe leads em cada etapa do processo de venda.",
    usage: "Arraste leads entre etapas e acompanhe a conversão.",
  },
  projeto_financas: {
    title: "Finanças do Projeto",
    description: "Receitas, custos e ROI específicos deste projeto.",
    usage: "Configure webhooks de pagamento para importar vendas automaticamente.",
  },
  projeto_links: {
    title: "Links",
    description: "Links importantes do projeto: páginas de vendas, checkout, área de membros, redes sociais.",
    usage: "Centralize todos os links em um só lugar para acesso rápido.",
  },
  projeto_midia: {
    title: "Mídia",
    description: "Biblioteca de arquivos do projeto: imagens, vídeos, PDFs e materiais de apoio.",
    usage: "Faça upload de materiais para organizar e compartilhar com a equipe.",
  },
  projeto_emails: {
    title: "Emails",
    description: "Sequências de email e templates para comunicação com leads e clientes do projeto.",
    usage: "Crie sequências de email e use a IA para gerar copies persuasivas.",
  },
  projeto_docs: {
    title: "Docs do Projeto",
    description: "Documentação específica do projeto: SOPs, processos e guias internos.",
    usage: "Documente tudo que a equipe precisa saber sobre este projeto.",
  },

  // Usuarios
  usuarios: {
    title: "Usuários",
    description: "Gerencie colaboradores do sistema. Crie contas, defina senhas e atribua permissões (Admin, Editor, Viewer).",
    usage: "Apenas administradores podem criar e gerenciar usuários.",
  },
};
