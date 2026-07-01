// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SKILLS DATA â€” Engines de Habilidade do ImpÃ©rio HQ
//  ExtraÃ­dos dos arquivos .md da pasta skills/ legada
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
import angulosFilemonPrompt from "./skills/angulos-filemon.md?raw";
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
  gatilho: string;   // o que o usuÃ¡rio fornece para ativar
  status: "Ativo" | "Beta" | "Planejado";
  icone: string;
  cor: string;
  system_prompt: string; // conteÃºdo completo do markdown
}

export const SKILLS_DATA: SkillData[] = [
  {
    id: "avatar-architect",
    nome: "Avatar Architect",
    versao: "V6.0", // Original had V6.0 name for prompt, using the full markdown text of V2
    categoria: "Pesquisa & Avatar",
    descricao: "God-Mode Engine de Engenharia de Avatar. Mapeia desejos, vergonhas, traumas e gatilhos do pÃºblico-alvo com densidade extrema. Gera o Tomo de OnisciÃªncia do Avatar.",
    gatilho: "[Nicho] e/ou [Avatar inicial]",
    status: "Ativo",
    icone: "ðŸ§ ",
    cor: "#9b5de5",
    system_prompt: avatarArchitectPrompt,
  },
  {
    id: "devastador",
    nome: "Devastador Copy",
    versao: "V4.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Apocalypse Engineâ„¢ â€” constrÃ³i Manifestos de RedenÃ§Ã£o com engenharia de persuasÃ£o em massa. Gera copy densa, emocional e logicamente implacÃ¡vel com headlines de choque, scripts de anÃºncios (5 Ã¢ngulos) e value stack.",
    gatilho: "[Briefing do Produto] e [DossiÃª do Avatar]",
    status: "Ativo",
    icone: "ðŸ’£",
    cor: "#e05c5c",
    system_prompt: devastadorPrompt,
  },
  {
    id: "funnel-hacker",
    nome: "Funnel Hacker Supremo",
    versao: "V2.0",
    categoria: "InteligÃªncia Competitiva",
    descricao: "Battlefield Engineâ„¢ â€” mapeia o campo de batalha competitivo. Espiona funis dos concorrentes, extrai ganchos de anÃºncios, mapeia escadas de valor e identifica as brechas fatais do mercado.",
    gatilho: "[Nicho] ou [URL do Concorrente]",
    status: "Ativo",
    icone: "ðŸ•µï¸",
    cor: "#4895ef",
    system_prompt: funnelHackerPrompt,
  },
  {
    id: "mecanismo-unico",
    nome: "Mecanismo Ãšnico Supremo",
    versao: "V2.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Cria mecanismos de oferta Ãºnicos e diferenciados que tornam a concorrÃªncia irrelevante. Usa os critÃ©rios N.E.S.M.E. (Novo, Exclusivo, Superior, Misterioso, Empolgante) e desenvolve narrativa de diferenciaÃ§Ã£o proprietÃ¡ria.",
    gatilho: "[Produto] e [Avatar com frustraÃ§Ãµes com mÃ©todos anteriores]",
    status: "Ativo",
    icone: "âš—ï¸",
    cor: "#00ffc8",
    system_prompt: mecanismoUnicoPrompt,
  },
  {
    id: "reposicionamento-estrategico",
    nome: "Reposicionamento EstratÃ©gico",
    versao: "V2.0",
    categoria: "EstratÃ©gia & Posicionamento",
    descricao: "Identifica em qual sub-mercado o avatar estÃ¡ gastando dinheiro atualmente (mesmo que insatisfeito) para criar a ponte de transiÃ§Ã£o para a Nova Oportunidade.",
    gatilho: "[Produto/Nicho] e [Perfil do Avatar]",
    status: "Ativo",
    icone: "ðŸŽ¯",
    cor: "#d4a843",
    system_prompt: reposicionamentoPrompt,
  },
  {
    id: "alquimia-escada-valor",
    nome: "Alquimia da Escada de Valor",
    versao: "V1.0",
    categoria: "EstratÃ©gia & Posicionamento",
    descricao: "CriaÃ§Ã£o de ecossistemas de produtos que transformam estranhos em clientes fiÃ©is. Usa os 12 Elementos Fundamentais para construir a jornada psicolÃ³gica de ascensÃ£o lÃ³gica com Frontend, Backend e High-Ticket.",
    gatilho: "[Produto principal] e [VisÃ£o do NegÃ³cio]",
    status: "Ativo",
    icone: "â™Ÿï¸",
    cor: "#f5c842",
    system_prompt: alquimiaPrompt,
  },
  {
    id: "tripwire-matador",
    nome: "Tripwire Matador",
    versao: "V2.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "CriaÃ§Ã£o de ofertas de baixo ticket ($7-$97) tÃ£o irresistÃ­veis que o pÃºblico nÃ£o consegue evitar a compra impulsiva. Usa princÃ­pios de Desejo Ardente Escondido, MaterializaÃ§Ã£o do IntangÃ­vel e Resultado Ãšnico Milagre.",
    gatilho: "[Nicho] e [Avatar com dores latentes identificadas]",
    status: "Ativo",
    icone: "ðŸª¤",
    cor: "#ff6b35",
    system_prompt: tripwirePrompt,
  },
  {
    id: "lp-persuasiva",
    nome: "Arquitetura de LP Persuasiva",
    versao: "V2.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Cria a estrutura completa de Landing Pages de alta conversÃ£o para infoprodutos. Desenvolve cada bloco narrativo com hook, histÃ³ria de transformaÃ§Ã£o, prova social, mecanismo Ãºnico e CTA irresistÃ­vel.",
    gatilho: "[Produto] e [Avatar com DossiÃª completo]",
    status: "Ativo",
    icone: "ðŸ“„",
    cor: "#52b788",
    system_prompt: lpPersuasivaPrompt,
  },
  {
    id: "sales-architect",
    nome: "Sales Architect",
    versao: "V1.0",
    categoria: "Vendas High-Ticket",
    descricao: "The Closer's Bibleâ„¢ â€” Transforma a IA em Comandante de Fechamento. Gera dossiÃª tÃ¡tico completo para calls de vendas High-Ticket (R$3k a R$100k+) usando psicologia de linha reta, equaÃ§Ã£o de valor e extraÃ§Ã£o de dor.",
    gatilho: "[Briefing do Produto] e [Contexto do Lead]",
    status: "Ativo",
    icone: "âš”ï¸",
    cor: "#5b8dee",
    system_prompt: salesArchitectPrompt,
  },
  {
    id: "sales-closer",
    nome: "Sales Closer",
    versao: "V1.0",
    categoria: "Vendas High-Ticket",
    descricao: "High-Ticket Strategistâ„¢ â€” Gera DossiÃª EstratÃ©gico de Vendas completo com scripts word-by-word, tratamento de objeÃ§Ãµes e tÃ¡ticas de negociaÃ§Ã£o para fechar ofertas premium de R$3k a R$50k+ usando frameworks D.E.E.P, S.T.E.P e C.A.G.E.",
    gatilho: "[Produto/ServiÃ§o] e [Dados do Lead]",
    status: "Ativo",
    icone: "ðŸŽ¯",
    cor: "#9b5de5",
    system_prompt: salesCloserPrompt,
  },
  {
    id: "mapeamento-desejos",
    nome: "Mapeamento de Desejos",
    versao: "V2.0",
    categoria: "Pesquisa & Avatar",
    descricao: "EscavaÃ§Ã£o profunda dos desejos declarados e ocultos do avatar. Gera uma matriz completa de desejos externos, internos e proibidos com intensidade, urgÃªncia e potencial de compra.",
    gatilho: "[Nicho] e [Avatar]",
    status: "Ativo",
    icone: "ðŸ”",
    cor: "#74aa9c",
    system_prompt: desejoPrompt,
  },
  {
    id: "dossie-problemas",
    nome: "DossiÃª de Problemas & Impacto",
    versao: "V2.0",
    categoria: "Pesquisa & Avatar",
    descricao: "Mapeia os problemas do avatar em 3 nÃ­veis de profundidade (superficial, oculto, raiz) com anÃ¡lise de impacto financeiro, emocional e social. Gera o arsenal de agitaÃ§Ã£o para o copy.",
    gatilho: "[Nicho] e [Problema Central do Avatar]",
    status: "Ativo",
    icone: "ðŸŽ­",
    cor: "#e05c5c",
    system_prompt: dossiePrompt,
  },
  {
    id: "anams-copywriter",
    nome: "Copywriter Anams",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Especializada no estilo e metodologia de copy da Anams â€” mistura de storytelling autÃªntico, conexÃ£o emocional profunda e vendas consultivas. Ideal para nichos femininos e de transformaÃ§Ã£o pessoal.",
    gatilho: "[Produto] e [Tom desejado]",
    status: "Ativo",
    icone: "âœï¸",
    cor: "#ff9ef5",
    system_prompt: anamsPrompt,
  },
  {
    id: "webinar-roteiro",
    nome: "Gerador de Roteiro de Webinar",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Gera roteiros completos de webinar de alta conversÃ£o narrados em primeira pessoa na voz do expert, aplicando automaticamente Epiphany Bridge e Novo VeÃ­culo (Brunson), urgÃªncia pelo custo do nÃ£o-agir (Cardone) e psicologia do avatar.",
    gatilho: "[Produto] e [Dados do Expert/Avatar]",
    status: "Ativo",
    icone: "ðŸŽ­",
    cor: "#e05c5c",
    system_prompt: webinarRoteiroPrompt,
  },
  {
    id: "market-intel",
    nome: "Market Intel",
    versao: "V2.0",
    categoria: "InteligÃªncia Competitiva",
    descricao: "Sistema completo de inteligÃªncia de mercado para infoprodutos. Pesquisa nichos, espiona concorrentes, mapeia produtos, define Ã¢ngulos de copy e gera relatÃ³rios com score objetivo.",
    gatilho: "[Nicho] ou [Temas do usuÃ¡rio]",
    status: "Ativo",
    icone: "ðŸ•µï¸",
    cor: "#4895ef",
    system_prompt: marketIntelPrompt,
  },
  {
    id: "yoshitani-traffic-scale",
    nome: "Yoshitani Traffic Scale",
    versao: "V1.0",
    categoria: "TrÃ¡fego & Escala",
    descricao: "Comandante de DivisÃ£o de TrÃ¡fego baseado no PadrÃ£o Yoshitani. Analisa CPA com tendÃªncia 7/5/3, localiza gargalos cirÃºrgicos, decide escala automÃ¡tica e gera briefing de criativos.",
    gatilho: "[Dados de Ads: CSV ou texto com CPA, taxas e budget]",
    status: "Ativo",
    icone: "âš”ï¸",
    cor: "#e85d3a",
    system_prompt: yoshitaniPrompt,
  },
  {
    id: "vsl-script-engine",
    nome: "VSL Script Engine",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "MÃ¡quina de ConversÃ£o em VÃ­deoâ„¢ â€” gera roteiros completos de VSL em 7 blocos obrigatÃ³rios (Pattern Interrupt â†’ Dor â†’ Epifania â†’ Prova â†’ Oferta â†’ UrgÃªncia â†’ CTA). Suporta VSL Curta (8-12min), VSL Longa (20-30min) e Carta de Vendas Escrita. Calibrado por temperatura de trÃ¡fego (Frio/Morno/Quente).",
    gatilho: "[Produto] + [Avatar] + [Mecanismo Ãšnico] + [Modo: curta | longa | escrita]",
    status: "Ativo",
    icone: "ðŸŽ¬",
    cor: "#7c3aed",
    system_prompt: vslScriptEnginePrompt,
  },
  {
    id: "headline-forge",
    nome: "Headline Forge",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Arsenal de Headlines de Alta ConversÃ£oâ„¢ â€” 64 fÃ³rmulas em 8 categorias (BenefÃ­cio Direto, Curiosidade, Prova Social, Identidade, ContradiÃ§Ã£o, UrgÃªncia, Pergunta Direta, Narrativa). Output: 5-15 headlines ranqueadas por forÃ§a + subtÃ­tulos, calibradas por tipo de pÃ¡gina e nÃ­vel de consciÃªncia de Schwartz.",
    gatilho: "[Tipo de pÃ¡gina] + [Avatar + promessa central] + [Tom: direto | curioso | empÃ¡tico | urgente]",
    status: "Ativo",
    icone: "ðŸŽ¯",
    cor: "#f59e0b",
    system_prompt: headlineForgePrompt,
  },
  {
    id: "email-sequence-architect",
    nome: "Email Sequence Architect",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "MÃ¡quina de Relacionamento e ConversÃ£o por Emailâ„¢ â€” 6 tipos de sequÃªncia completas (Boas-vindas, NutriÃ§Ã£o 7 emails, Carrinho Abandonado, PÃ³s-compra, Reengajamento, LanÃ§amento 10 emails). Framework SOAP por email + Arsenal de Linhas de Assunto + Regras de Timing e EspaÃ§amento.",
    gatilho: "[Tipo de sequÃªncia] + [Produto/Isca] + [Avatar] + [Tom]",
    status: "Ativo",
    icone: "ðŸ“§",
    cor: "#0ea5e9",
    system_prompt: emailSequencePrompt,
  },
  {
    id: "grand-slam-offer",
    nome: "Grand Slam Offer Engine",
    versao: "V1.0",
    categoria: "EstratÃ©gia & Posicionamento",
    descricao: "Engenharia de Oferta IrresistÃ­velâ„¢ â€” framework Hormozi completo em 5 fases: Sonho do Cliente â†’ Mapeamento de ObstÃ¡culos â†’ ConversÃ£o em SoluÃ§Ãµes â†’ Stack de Valor com precificaÃ§Ã£o crÃ­vel â†’ Nomenclatura ProprietÃ¡ria. Inclui 4 arquÃ©tipos de garantia e arsenal de bÃ´nus por psicologia de decisÃ£o.",
    gatilho: "[Produto] + [Resultado prometido] + [PreÃ§o alvo] + [Avatar com objeÃ§Ãµes]",
    status: "Ativo",
    icone: "ðŸ’Ž",
    cor: "#10b981",
    system_prompt: grandSlamOfferPrompt,
  },
  {
    id: "niveis-consciencia",
    nome: "NÃ­veis de ConsciÃªncia",
    versao: "V1.0",
    categoria: "Pesquisa & Avatar",
    descricao: "Calibrador de Mensagem por ConsciÃªnciaâ„¢ â€” framework Eugene Schwartz (5 nÃ­veis) aplicado ao funil moderno. Diagnostica o nÃ­vel exato do avatar por canal, define estratÃ©gia de mensagem (tom, abertura, CTA), detecta descompasso entre etapas do funil e previne o maior destruidor de conversÃ£o em trÃ¡fego frio: copy no nÃ­vel errado.",
    gatilho: "[Avatar com comportamentos mapeados] + [Canal de trÃ¡fego] + [Produto]",
    status: "Ativo",
    icone: "ðŸ§Š",
    cor: "#3b82f6",
    system_prompt: niveisCienciaPrompt,
  },
  {
    id: "hook-arsenal",
    nome: "Hook Arsenal",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Banco de 120+ Ganchos de Alta Performanceâ„¢ â€” 9 categorias psicolÃ³gicas (ContradiÃ§Ã£o, NÃºmero, Dor, Curiosidade, Identidade, HistÃ³ria, RevelaÃ§Ã£o, UrgÃªncia, Pergunta). Filtros por plataforma (Meta/TikTok/YouTube/Email/WhatsApp) e duraÃ§Ã£o (15s/30s/60s/longo). Inclui FÃ³rmula de ConstruÃ§Ã£o de Hook Customizado e Checklist de ValidaÃ§Ã£o em 5 critÃ©rios.",
    gatilho: "[Avatar + dor principal] + [Ã‚ngulo] + [Plataforma] + [DuraÃ§Ã£o]",
    status: "Ativo",
    icone: "ðŸŽ£",
    cor: "#f97316",
    system_prompt: hookArsenalPrompt,
  },
  {
    id: "prova-social-engine",
    nome: "Prova Social Engine",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Arquiteto de EvidÃªncias de TransformaÃ§Ã£oâ„¢ â€” 4 mÃ³dulos: Formatador de Depoimentos (transforma depoimentos genÃ©ricos em prova especÃ­fica com estrutura PASAR), Criador de Case Completo (narrativa HERO), Prova por Autoridade, e Prova LÃ³gica (para produtos sem histÃ³rico). Inclui posicionamento por etapa do funil e guia de coleta de depoimentos.",
    gatilho: "[Depoimentos brutos] OU [Dados do produto] OU [Sem provas ainda]",
    status: "Ativo",
    icone: "ðŸ†",
    cor: "#eab308",
    system_prompt: provaSocialPrompt,
  },
  {
    id: "urgencia-escassez",
    nome: "UrgÃªncia & Escassez Engineer",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Arquiteto de Fechamento Ã‰ticoâ„¢ â€” 4 tipos de urgÃªncia real (Prazo, Vagas, PreÃ§o, Custo da InaÃ§Ã£o) com copy completa por canal (pÃ¡gina, email, WhatsApp, ad). Inclui Calculadora de Custo da InaÃ§Ã£o, SequÃªncia de Escalada em 72h, Arsenal de Frases de Fechamento e Detector de UrgÃªncia Falsa para proteger a credibilidade da marca.",
    gatilho: "[Tipo de urgÃªncia disponÃ­vel] + [Produto] + [Avatar] + [Canal]",
    status: "Ativo",
    icone: "â°",
    cor: "#ef4444",
    system_prompt: urgenciaEscassezPrompt,
  },
  {
    id: "launch-sequence",
    nome: "Launch Sequence Engine",
    versao: "V1.0",
    categoria: "EstratÃ©gia & Posicionamento",
    descricao: "Orquestrador de LanÃ§amentos PLFâ„¢ â€” Product Launch Formula completa em 4 semanas: PrÃ©-aquecimento + 3 PLCs (A Oportunidade, A TransformaÃ§Ã£o, A ExperiÃªncia) + 10 emails de abertura e fechamento. Inclui segmentaÃ§Ã£o por engajamento, escalada de urgÃªncia em 72h, protocolo de pÃ³s-lanÃ§amento e reproveitamento de conteÃºdo.",
    gatilho: "[Produto] + [Data de abertura] + [Tamanho e temperatura da lista] + [Avatar]",
    status: "Ativo",
    icone: "ðŸš€",
    cor: "#8b5cf6",
    system_prompt: launchSequencePrompt,
  },
  {
    id: "retencao-onboarding",
    nome: "RetenÃ§Ã£o & Onboarding Engine",
    versao: "V1.0",
    categoria: "PÃ³s-venda & RetenÃ§Ã£o",
    descricao: "Jornada de Sucesso do Clienteâ„¢ â€” 3 sequÃªncias completas: Quick Win (dias 1-3 para criar comprometimento e eliminar buyer's remorse), AtivaÃ§Ã£o Profunda (dias 4-14 com marcos de progresso), e PrevenÃ§Ã£o de Chargeback (sistema de sinais de risco com resposta proativa). Inclui protocolo de transformaÃ§Ã£o em promotor e sistema de coleta de depoimentos.",
    gatilho: "[Produto] + [Resultado prometido] + [Prazo da garantia] + [Canal: email | WhatsApp | ambos]",
    status: "Ativo",
    icone: "ðŸ”„",
    cor: "#14b8a6",
    system_prompt: retencaoOnboardingPrompt,
  },
  {
    id: "roteiros-virais-reels",
    nome: "Roteiros Virais Reels",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Biblioteca de 60+ estruturas testadas de roteiros virais para Reels/TikTok/Shorts (Dica Direta, Esquema, Passo a Passo, React, Antes/Depois, ProvocaÃ§Ã£o). A IA preenche os colchetes [...] com contexto do nicho/avatar/produto.",
    gatilho: "[Estrutura escolhida] + [Contexto do projeto]",
    status: "Ativo",
    icone: "ðŸŽ¬",
    cor: "#ff3366",
    system_prompt: roteirosViraisPrompt,
  },
  {
    id: "angulos-filemon",
    nome: "Ã‚ngulos Filemon",
    versao: "V1.0",
    categoria: "Copy & PersuasÃ£o",
    descricao: "Arsenal de 11 Ã¢ngulos psicolÃ³gicos (7 clÃ¡ssicos + 4 Filemon: ConspiraÃ§Ã£o, ControvÃ©rsia, HistÃ³ria Emocional, Promessa). Gera 3 variaÃ§Ãµes contrastantes de copy para criativos, anÃºncios, scripts e WhatsApp com hook/body/CTA por Ã¢ngulo.",
    gatilho: "[Produto] + [Avatar] + [EstÃ¡gio do funil]",
    status: "Ativo",
    icone: "ðŸŽ¯",
    cor: "#ff6b35",
    system_prompt: angulosFilemonPrompt,
  },
];
