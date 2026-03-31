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
];
