// ══════════════════════════════════════════════════════════════
//  CREATIVE ANGLES — Fonte única dos ângulos psicológicos
//  Usado em: CriativoNovo, DashboardCreativeHub, ContentGenerator,
//  studio-batch-cron, creative-factory, wa-ai-reply, nurture-generator,
//  swipe-engineer, copilot. Skill "angulos-filemon" expõe no chat.
// ══════════════════════════════════════════════════════════════

export interface CreativeAngle {
  slug: string;
  nome: string;
  descricao: string;
  gatilho: string;          // emoção/mecanismo psicológico dominante
  exemploHook: string;      // hook curto pronto pra adaptar
  visualPrompt: string;     // diretriz para creative-factory (imagem)
  categoria: "classico" | "filemon" | "emocional";
}

export const CREATIVE_ANGLES: CreativeAngle[] = [
  // ──────── CLÁSSICOS (7 originais) ────────
  {
    slug: "dor",
    nome: "Dor",
    descricao: "Mostra a frustração e o problema sentido pelo avatar.",
    gatilho: "Agitação da dor presente",
    exemploHook: "Você abre o app do banco, encara o saldo por 2 segundos e fecha rápido pra fingir que não viu.",
    visualPrompt: "Foco na DOR: mostrar a frustração, o problema sentido pelo avatar. Expressão facial de cansaço/frustração. Atmosfera de problema a ser resolvido.",
    categoria: "classico",
  },
  {
    slug: "desejo",
    nome: "Desejo / Transformação",
    descricao: "Projeta a vida ideal e a transformação aspiracional.",
    gatilho: "Visualização do futuro desejado",
    exemploHook: "Imagina acordar numa terça-feira de sol e decidir trabalhar só 2 horas — porque o sistema roda sozinho.",
    visualPrompt: "Foco no DESEJO: mostrar a transformação aspiracional, a vida ideal. Expressão de felicidade, conquista. Ambiente luxuoso/sonhado.",
    categoria: "classico",
  },
  {
    slug: "prova",
    nome: "Prova Social",
    descricao: "Depoimentos, números e resultados concretos.",
    gatilho: "Validação pela maioria",
    exemploHook: "Mais de 1.847 pessoas já aplicaram isso nos últimos 90 dias. E os prints estão aqui.",
    visualPrompt: "Foco na PROVA SOCIAL: mostrar depoimentos, números, resultados concretos. Elementos visuais de credibilidade (checkmarks, estrelas, números grandes).",
    categoria: "classico",
  },
  {
    slug: "autoridade",
    nome: "Autoridade",
    descricao: "Expert posicionado como referência absoluta.",
    gatilho: "Hierarquia e confiança",
    exemploHook: "Os top 1% do mercado usam isso há anos. A diferença é que ninguém te contou ainda.",
    visualPrompt: "Foco na AUTORIDADE: expert posicionado como especialista. Fundo profissional, postura de liderança, confiança absoluta.",
    categoria: "classico",
  },
  {
    slug: "curiosidade",
    nome: "Curiosidade",
    descricao: "Gancho intrigante que para o scroll.",
    gatilho: "Loop aberto / curiosity gap",
    exemploHook: "Tem uma coisa que ninguém te conta sobre [tema] — e é exatamente o que separa quem fatura de quem fica tentando.",
    visualPrompt: "Foco na CURIOSIDADE: criar gancho visual intrigante, pergunta no ar, elemento misterioso que faça a pessoa PARAR o scroll.",
    categoria: "classico",
  },
  {
    slug: "antes-depois",
    nome: "Antes vs Depois",
    descricao: "Contraste visual entre o estado atual e o resultado.",
    gatilho: "Transformação demonstrada",
    exemploHook: "Há 8 meses eu fazia X. Hoje faço Y. A virada aconteceu em UM dia específico.",
    visualPrompt: "Foco no ANTES vs DEPOIS: dividir a imagem com contraste visual claro entre o estado atual ruim e o resultado alcançado.",
    categoria: "classico",
  },
  {
    slug: "objecao",
    nome: "Objeção Destruída",
    descricao: "Responde de cara a maior objeção do mercado.",
    gatilho: "Quebra de crença limitante",
    exemploHook: "'Não tenho tempo' é o que todo mundo me dizia. Até eu mostrar que dá pra fazer em 17 minutos por dia.",
    visualPrompt: "Foco em DESTRUIR OBJEÇÃO: imagem que responde visualmente 'não tenho tempo', 'é caro', 'não funciona pra mim'.",
    categoria: "classico",
  },

  // ──────── FILEMON (4 novos — carrossel referência) ────────
  {
    slug: "conspiracao",
    nome: "Conspiração",
    descricao: "Revela o que o sistema/indústria/elite esconde do avatar.",
    gatilho: "Inimigo comum + verdade proibida",
    exemploHook: "Tem um motivo pelo qual ninguém da indústria fala sobre isso. E não é o que você pensa.",
    visualPrompt: "Foco em CONSPIRAÇÃO: estética de denúncia, contraste forte, elementos que sugerem segredo/exposição (lupa, documento riscado, manchete vazada). Tom investigativo.",
    categoria: "filemon",
  },
  {
    slug: "controversia",
    nome: "Controvérsia",
    descricao: "Posiciona-se contra o consenso do mercado.",
    gatilho: "Polarização + tomada de lado",
    exemploHook: "Vou falar uma coisa que vai irritar 90% dos gurus de [nicho]: o que eles ensinam destrói seu negócio.",
    visualPrompt: "Foco em CONTROVÉRSIA: imagem que confronta diretamente uma crença popular. Texto provocador grande, expressão desafiadora, divisão visual 'errado vs certo'.",
    categoria: "filemon",
  },
  {
    slug: "historia-emocional",
    nome: "História Emocional",
    descricao: "Narrativa pessoal real com pico emocional + lição.",
    gatilho: "Identificação + catarse",
    exemploHook: "Era 2 da manhã. Minha filha dormindo no quarto. Eu olhando pro extrato negativo. Foi aí que decidi tudo.",
    visualPrompt: "Foco em HISTÓRIA EMOCIONAL: cena íntima e cinematográfica, luz quente, momento de vulnerabilidade ou virada. Sem texto grande — a imagem conta a história.",
    categoria: "filemon",
  },
  {
    slug: "promessa",
    nome: "Promessa",
    descricao: "Resultado específico, mensurável e em prazo definido.",
    gatilho: "Clareza + urgência temporal",
    exemploHook: "Em 30 dias você vai ter [resultado específico] — ou eu devolvo cada centavo e ainda pago um café.",
    visualPrompt: "Foco em PROMESSA: número grande e específico em destaque (R$, dias, %), elemento visual de cronômetro/calendário, prova de garantia.",
    categoria: "filemon",
  },
];

export const ANGLE_BY_SLUG: Record<string, CreativeAngle> = Object.fromEntries(
  CREATIVE_ANGLES.map((a) => [a.slug, a])
);

export const ALL_SLUGS = CREATIVE_ANGLES.map((a) => a.slug);

/** Rotação determinística por dia do ano — escolhe N ângulos diferentes a cada dia. */
export function getAnglesForDay(n = 3, date = new Date()): CreativeAngle[] {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const out: CreativeAngle[] = [];
  for (let i = 0; i < n; i++) {
    out.push(CREATIVE_ANGLES[(dayOfYear + i * 3) % CREATIVE_ANGLES.length]);
  }
  return out;
}
