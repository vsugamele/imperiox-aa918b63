// ══════════════════════════════════════════════════════════════
//  SKILLS DATA — Engines de Habilidade do Império HQ
//  Extraídos dos arquivos .md da pasta skills/ legada
// ══════════════════════════════════════════════════════════════

import avatarArchitectPrompt from "./skills/avatar-architect-v2.md?raw";
import devastadorPrompt from "./skills/devastador-v4.md?raw";
import funnelHackerPrompt from "./skills/funnel-hacker-v2.md?raw";
import mecanismoUnicoPrompt from "./skills/mecanismo-unico-v2.md?raw";
import reposicionamentoPrompt from "./skills/reposicionamento-v2.md?raw";
import alquimiaPrompt from "./skills/alquimia-escada-valor.md?raw";
import tripwirePrompt from "./skills/tripwire-matador-v2.md?raw";
import lpPersuasivaPrompt from "./skills/lp-persuasiva-v2.md?raw";
import salesArchitectPrompt from "./skills/sales-architect.md?raw";
import salesCloserPrompt from "./skills/sales-closer.md?raw";
import desejoPrompt from "./skills/mapeamento-desejos-v2.md?raw";
import dossiePrompt from "./skills/dossie-problemas-v2.md?raw";
import anamsPrompt from "./skills/anams-copywriter.md?raw";
import webinarRoteiroPrompt from "./skills/webinar-roteiro.md?raw";
import marketIntelPrompt from "./skills/market-intel-v2.md?raw";
import yoshitaniPrompt from "./skills/yoshitani-traffic-scale.md?raw";
import roteirosViraisPrompt from "./skills/roteiros-virais-reels.md?raw";
import vslScriptEnginePrompt from "./skills/vsl-script-engine-v1.md?raw";
import headlineForgePrompt from "./skills/headline-forge-v1.md?raw";
import emailSequencePrompt from "./skills/email-sequence-architect-v1.md?raw";
import grandSlamOfferPrompt from "./skills/grand-slam-offer-v1.md?raw";
import niveisCienciaPrompt from "./skills/niveis-consciencia-v1.md?raw";
import hookArsenalPrompt from "./skills/hook-arsenal-v1.md?raw";
import provaSocialPrompt from "./skills/prova-social-engine-v1.md?raw";
import urgenciaEscassezPrompt from "./skills/urgencia-escassez-v1.md?raw";
import launchSequencePrompt from "./skills/launch-sequence-v1.md?raw";
import retencaoOnboardingPrompt from "./skills/retencao-onboarding-v1.md?raw";

export interface SkillData {
  id: string;
  nome: string;
  versao: string;
  categoria: string;
  descricao: string;
  gatilho: string;   // o que o usuário fornece para ativar
  status: "Ativo" | "Beta" | "Planejado";
  icone: string;
  cor: string;
  system_prompt: string; // conteúdo completo do markdown
}

export const SKILLS_DATA: SkillData[] = [
  {
    id: "avatar-architect",
    nome: "Avatar Architect",
    versao: "V6.0", // Original had V6.0 name for prompt, using the full markdown text of V2
    categoria: "Pesquisa & Avatar",
    descricao: "God-Mode Engine de Engenharia de Avatar. Mapeia desejos, vergonhas, traumas e gatilhos do público-alvo com densidade extrema. Gera o Tomo de Onisciência do Avatar.",
    gatilho: "[Nicho] e/ou [Avatar inicial]",
    status: "Ativo",
    icone: "🧠",
    cor: "#9b5de5",
    system_prompt: avatarArchitectPrompt,
  },
  {
    id: "devastador",
    nome: "Devastador Copy",
    versao: "V4.0",
    categoria: "Copy & Persuasão",
    descricao: "Apocalypse Engine™ — constrói Manifestos de Redenção com engenharia de persuasão em massa. Gera copy densa, emocional e logicamente implacável com headlines de choque, scripts de anúncios (5 ângulos) e value stack.",
    gatilho: "[Briefing do Produto] e [Dossiê do Avatar]",
    status: "Ativo",
    icone: "💣",
    cor: "#e05c5c",
    system_prompt: devastadorPrompt,
  },
  {
    id: "funnel-hacker",
    nome: "Funnel Hacker Supremo",
    versao: "V2.0",
    categoria: "Inteligência Competitiva",
    descricao: "Battlefield Engine™ — mapeia o campo de batalha competitivo. Espiona funis dos concorrentes, extrai ganchos de anúncios, mapeia escadas de valor e identifica as brechas fatais do mercado.",
    gatilho: "[Nicho] ou [URL do Concorrente]",
    status: "Ativo",
    icone: "🕵️",
    cor: "#4895ef",
    system_prompt: funnelHackerPrompt,
  },
  {
    id: "mecanismo-unico",
    nome: "Mecanismo Único Supremo",
    versao: "V2.0",
    categoria: "Copy & Persuasão",
    descricao: "Cria mecanismos de oferta únicos e diferenciados que tornam a concorrência irrelevante. Usa os critérios N.E.S.M.E. (Novo, Exclusivo, Superior, Misterioso, Empolgante) e desenvolve narrativa de diferenciação proprietária.",
    gatilho: "[Produto] e [Avatar com frustrações com métodos anteriores]",
    status: "Ativo",
    icone: "⚗️",
    cor: "#00ffc8",
    system_prompt: mecanismoUnicoPrompt,
  },
  {
    id: "reposicionamento-estrategico",
    nome: "Reposicionamento Estratégico",
    versao: "V2.0",
    categoria: "Estratégia & Posicionamento",
    descricao: "Identifica em qual sub-mercado o avatar está gastando dinheiro atualmente (mesmo que insatisfeito) para criar a ponte de transição para a Nova Oportunidade.",
    gatilho: "[Produto/Nicho] e [Perfil do Avatar]",
    status: "Ativo",
    icone: "🎯",
    cor: "#d4a843",
    system_prompt: reposicionamentoPrompt,
  },
  {
    id: "alquimia-escada-valor",
    nome: "Alquimia da Escada de Valor",
    versao: "V1.0",
    categoria: "Estratégia & Posicionamento",
    descricao: "Criação de ecossistemas de produtos que transformam estranhos em clientes fiéis. Usa os 12 Elementos Fundamentais para construir a jornada psicológica de ascensão lógica com Frontend, Backend e High-Ticket.",
    gatilho: "[Produto principal] e [Visão do Negócio]",
    status: "Ativo",
    icone: "♟️",
    cor: "#f5c842",
    system_prompt: alquimiaPrompt,
  },
  {
    id: "tripwire-matador",
    nome: "Tripwire Matador",
    versao: "V2.0",
    categoria: "Copy & Persuasão",
    descricao: "Criação de ofertas de baixo ticket ($7-$97) tão irresistíveis que o público não consegue evitar a compra impulsiva. Usa princípios de Desejo Ardente Escondido, Materialização do Intangível e Resultado Único Milagre.",
    gatilho: "[Nicho] e [Avatar com dores latentes identificadas]",
    status: "Ativo",
    icone: "🪤",
    cor: "#ff6b35",
    system_prompt: tripwirePrompt,
  },
  {
    id: "lp-persuasiva",
    nome: "Arquitetura de LP Persuasiva",
    versao: "V2.0",
    categoria: "Copy & Persuasão",
    descricao: "Cria a estrutura completa de Landing Pages de alta conversão para infoprodutos. Desenvolve cada bloco narrativo com hook, história de transformação, prova social, mecanismo único e CTA irresistível.",
    gatilho: "[Produto] e [Avatar com Dossiê completo]",
    status: "Ativo",
    icone: "📄",
    cor: "#52b788",
    system_prompt: lpPersuasivaPrompt,
  },
  {
    id: "sales-architect",
    nome: "Sales Architect",
    versao: "V1.0",
    categoria: "Vendas High-Ticket",
    descricao: "The Closer's Bible™ — Transforma a IA em Comandante de Fechamento. Gera dossiê tático completo para calls de vendas High-Ticket (R$3k a R$100k+) usando psicologia de linha reta, equação de valor e extração de dor.",
    gatilho: "[Briefing do Produto] e [Contexto do Lead]",
    status: "Ativo",
    icone: "⚔️",
    cor: "#5b8dee",
    system_prompt: salesArchitectPrompt,
  },
  {
    id: "sales-closer",
    nome: "Sales Closer",
    versao: "V1.0",
    categoria: "Vendas High-Ticket",
    descricao: "High-Ticket Strategist™ — Gera Dossiê Estratégico de Vendas completo com scripts word-by-word, tratamento de objeções e táticas de negociação para fechar ofertas premium de R$3k a R$50k+ usando frameworks D.E.E.P, S.T.E.P e C.A.G.E.",
    gatilho: "[Produto/Serviço] e [Dados do Lead]",
    status: "Ativo",
    icone: "🎯",
    cor: "#9b5de5",
    system_prompt: salesCloserPrompt,
  },
  {
    id: "mapeamento-desejos",
    nome: "Mapeamento de Desejos",
    versao: "V2.0",
    categoria: "Pesquisa & Avatar",
    descricao: "Escavação profunda dos desejos declarados e ocultos do avatar. Gera uma matriz completa de desejos externos, internos e proibidos com intensidade, urgência e potencial de compra.",
    gatilho: "[Nicho] e [Avatar]",
    status: "Ativo",
    icone: "🔍",
    cor: "#74aa9c",
    system_prompt: desejoPrompt,
  },
  {
    id: "dossie-problemas",
    nome: "Dossiê de Problemas & Impacto",
    versao: "V2.0",
    categoria: "Pesquisa & Avatar",
    descricao: "Mapeia os problemas do avatar em 3 níveis de profundidade (superficial, oculto, raiz) com análise de impacto financeiro, emocional e social. Gera o arsenal de agitação para o copy.",
    gatilho: "[Nicho] e [Problema Central do Avatar]",
    status: "Ativo",
    icone: "🎭",
    cor: "#e05c5c",
    system_prompt: dossiePrompt,
  },
  {
    id: "anams-copywriter",
    nome: "Copywriter Anams",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Especializada no estilo e metodologia de copy da Anams — mistura de storytelling autêntico, conexão emocional profunda e vendas consultivas. Ideal para nichos femininos e de transformação pessoal.",
    gatilho: "[Produto] e [Tom desejado]",
    status: "Ativo",
    icone: "✍️",
    cor: "#ff9ef5",
    system_prompt: anamsPrompt,
  },
  {
    id: "webinar-roteiro",
    nome: "Gerador de Roteiro de Webinar",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Gera roteiros completos de webinar de alta conversão narrados em primeira pessoa na voz do expert, aplicando automaticamente Epiphany Bridge e Novo Veículo (Brunson), urgência pelo custo do não-agir (Cardone) e psicologia do avatar.",
    gatilho: "[Produto] e [Dados do Expert/Avatar]",
    status: "Ativo",
    icone: "🎭",
    cor: "#e05c5c",
    system_prompt: webinarRoteiroPrompt,
  },
  {
    id: "market-intel",
    nome: "Market Intel",
    versao: "V2.0",
    categoria: "Inteligência Competitiva",
    descricao: "Sistema completo de inteligência de mercado para infoprodutos. Pesquisa nichos, espiona concorrentes, mapeia produtos, define ângulos de copy e gera relatórios com score objetivo.",
    gatilho: "[Nicho] ou [Temas do usuário]",
    status: "Ativo",
    icone: "🕵️",
    cor: "#4895ef",
    system_prompt: marketIntelPrompt,
  },
  {
    id: "yoshitani-traffic-scale",
    nome: "Yoshitani Traffic Scale",
    versao: "V1.0",
    categoria: "Tráfego & Escala",
    descricao: "Comandante de Divisão de Tráfego baseado no Padrão Yoshitani. Analisa CPA com tendência 7/5/3, localiza gargalos cirúrgicos, decide escala automática e gera briefing de criativos.",
    gatilho: "[Dados de Ads: CSV ou texto com CPA, taxas e budget]",
    status: "Ativo",
    icone: "⚔️",
    cor: "#e85d3a",
    system_prompt: yoshitaniPrompt,
  },
  {
    id: "vsl-script-engine",
    nome: "VSL Script Engine",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Máquina de Conversão em Vídeo™ — gera roteiros completos de VSL em 7 blocos obrigatórios (Pattern Interrupt → Dor → Epifania → Prova → Oferta → Urgência → CTA). Suporta VSL Curta (8-12min), VSL Longa (20-30min) e Carta de Vendas Escrita. Calibrado por temperatura de tráfego (Frio/Morno/Quente).",
    gatilho: "[Produto] + [Avatar] + [Mecanismo Único] + [Modo: curta | longa | escrita]",
    status: "Ativo",
    icone: "🎬",
    cor: "#7c3aed",
    system_prompt: vslScriptEnginePrompt,
  },
  {
    id: "headline-forge",
    nome: "Headline Forge",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Arsenal de Headlines de Alta Conversão™ — 64 fórmulas em 8 categorias (Benefício Direto, Curiosidade, Prova Social, Identidade, Contradição, Urgência, Pergunta Direta, Narrativa). Output: 5-15 headlines ranqueadas por força + subtítulos, calibradas por tipo de página e nível de consciência de Schwartz.",
    gatilho: "[Tipo de página] + [Avatar + promessa central] + [Tom: direto | curioso | empático | urgente]",
    status: "Ativo",
    icone: "🎯",
    cor: "#f59e0b",
    system_prompt: headlineForgePrompt,
  },
  {
    id: "email-sequence-architect",
    nome: "Email Sequence Architect",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Máquina de Relacionamento e Conversão por Email™ — 6 tipos de sequência completas (Boas-vindas, Nutrição 7 emails, Carrinho Abandonado, Pós-compra, Reengajamento, Lançamento 10 emails). Framework SOAP por email + Arsenal de Linhas de Assunto + Regras de Timing e Espaçamento.",
    gatilho: "[Tipo de sequência] + [Produto/Isca] + [Avatar] + [Tom]",
    status: "Ativo",
    icone: "📧",
    cor: "#0ea5e9",
    system_prompt: emailSequencePrompt,
  },
  {
    id: "grand-slam-offer",
    nome: "Grand Slam Offer Engine",
    versao: "V1.0",
    categoria: "Estratégia & Posicionamento",
    descricao: "Engenharia de Oferta Irresistível™ — framework Hormozi completo em 5 fases: Sonho do Cliente → Mapeamento de Obstáculos → Conversão em Soluções → Stack de Valor com precificação crível → Nomenclatura Proprietária. Inclui 4 arquétipos de garantia e arsenal de bônus por psicologia de decisão.",
    gatilho: "[Produto] + [Resultado prometido] + [Preço alvo] + [Avatar com objeções]",
    status: "Ativo",
    icone: "💎",
    cor: "#10b981",
    system_prompt: grandSlamOfferPrompt,
  },
  {
    id: "niveis-consciencia",
    nome: "Níveis de Consciência",
    versao: "V1.0",
    categoria: "Pesquisa & Avatar",
    descricao: "Calibrador de Mensagem por Consciência™ — framework Eugene Schwartz (5 níveis) aplicado ao funil moderno. Diagnostica o nível exato do avatar por canal, define estratégia de mensagem (tom, abertura, CTA), detecta descompasso entre etapas do funil e previne o maior destruidor de conversão em tráfego frio: copy no nível errado.",
    gatilho: "[Avatar com comportamentos mapeados] + [Canal de tráfego] + [Produto]",
    status: "Ativo",
    icone: "🧊",
    cor: "#3b82f6",
    system_prompt: niveisCienciaPrompt,
  },
  {
    id: "hook-arsenal",
    nome: "Hook Arsenal",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Banco de 120+ Ganchos de Alta Performance™ — 9 categorias psicológicas (Contradição, Número, Dor, Curiosidade, Identidade, História, Revelação, Urgência, Pergunta). Filtros por plataforma (Meta/TikTok/YouTube/Email/WhatsApp) e duração (15s/30s/60s/longo). Inclui Fórmula de Construção de Hook Customizado e Checklist de Validação em 5 critérios.",
    gatilho: "[Avatar + dor principal] + [Ângulo] + [Plataforma] + [Duração]",
    status: "Ativo",
    icone: "🎣",
    cor: "#f97316",
    system_prompt: hookArsenalPrompt,
  },
  {
    id: "prova-social-engine",
    nome: "Prova Social Engine",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Arquiteto de Evidências de Transformação™ — 4 módulos: Formatador de Depoimentos (transforma depoimentos genéricos em prova específica com estrutura PASAR), Criador de Case Completo (narrativa HERO), Prova por Autoridade, e Prova Lógica (para produtos sem histórico). Inclui posicionamento por etapa do funil e guia de coleta de depoimentos.",
    gatilho: "[Depoimentos brutos] OU [Dados do produto] OU [Sem provas ainda]",
    status: "Ativo",
    icone: "🏆",
    cor: "#eab308",
    system_prompt: provaSocialPrompt,
  },
  {
    id: "urgencia-escassez",
    nome: "Urgência & Escassez Engineer",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Arquiteto de Fechamento Ético™ — 4 tipos de urgência real (Prazo, Vagas, Preço, Custo da Inação) com copy completa por canal (página, email, WhatsApp, ad). Inclui Calculadora de Custo da Inação, Sequência de Escalada em 72h, Arsenal de Frases de Fechamento e Detector de Urgência Falsa para proteger a credibilidade da marca.",
    gatilho: "[Tipo de urgência disponível] + [Produto] + [Avatar] + [Canal]",
    status: "Ativo",
    icone: "⏰",
    cor: "#ef4444",
    system_prompt: urgenciaEscassezPrompt,
  },
  {
    id: "launch-sequence",
    nome: "Launch Sequence Engine",
    versao: "V1.0",
    categoria: "Estratégia & Posicionamento",
    descricao: "Orquestrador de Lançamentos PLF™ — Product Launch Formula completa em 4 semanas: Pré-aquecimento + 3 PLCs (A Oportunidade, A Transformação, A Experiência) + 10 emails de abertura e fechamento. Inclui segmentação por engajamento, escalada de urgência em 72h, protocolo de pós-lançamento e reproveitamento de conteúdo.",
    gatilho: "[Produto] + [Data de abertura] + [Tamanho e temperatura da lista] + [Avatar]",
    status: "Ativo",
    icone: "🚀",
    cor: "#8b5cf6",
    system_prompt: launchSequencePrompt,
  },
  {
    id: "retencao-onboarding",
    nome: "Retenção & Onboarding Engine",
    versao: "V1.0",
    categoria: "Pós-venda & Retenção",
    descricao: "Jornada de Sucesso do Cliente™ — 3 sequências completas: Quick Win (dias 1-3 para criar comprometimento e eliminar buyer's remorse), Ativação Profunda (dias 4-14 com marcos de progresso), e Prevenção de Chargeback (sistema de sinais de risco com resposta proativa). Inclui protocolo de transformação em promotor e sistema de coleta de depoimentos.",
    gatilho: "[Produto] + [Resultado prometido] + [Prazo da garantia] + [Canal: email | WhatsApp | ambos]",
    status: "Ativo",
    icone: "🔄",
    cor: "#14b8a6",
    system_prompt: retencaoOnboardingPrompt,
  },
  {
    id: "roteiros-virais-reels",
    nome: "Roteiros Virais Reels",
    versao: "V1.0",
    categoria: "Copy & Persuasão",
    descricao: "Biblioteca de 60+ estruturas testadas de roteiros virais para Reels/TikTok/Shorts (Dica Direta, Esquema, Passo a Passo, React, Antes/Depois, Provocação). A IA preenche os colchetes [...] com contexto do nicho/avatar/produto.",
    gatilho: "[Estrutura escolhida] + [Contexto do projeto]",
    status: "Ativo",
    icone: "🎬",
    cor: "#ff3366",
    system_prompt: roteirosViraisPrompt,
  },
];
