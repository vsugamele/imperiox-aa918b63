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
  categoria: "classico" | "filemon" | "emocional" | "wander";
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

  // ──────── WANDER / 7 CAMADAS (10 novos) ────────
  {
    slug: "lista",
    nome: "Lista",
    descricao: "Hook → 2 opções fracas → 1 opção forte → CTA. Público comparador.",
    gatilho: "Comparação lógica + escolha guiada",
    exemploHook: "3 formas de ganhar R$ 300 por dia sem sair de casa — a 3ª é a que ninguém te contou.",
    visualPrompt: "Numeração grande na tela (1, 2, 3), cards ou split, ranking visual do fraco pro forte.",
    categoria: "wander",
  },
  {
    slug: "erro-comum",
    nome: "Erro Comum",
    descricao: "Aponta um erro que a maioria comete → consequência → solução.",
    gatilho: "Autoconsciência de falha + medo de continuar errando",
    exemploHook: "Se você faz isso todo café da manhã, tá sabotando sua glicose antes das 8h.",
    visualPrompt: "X vermelho ou 'ERRADO' sobreposto ao hábito, transição pra versão correta.",
    categoria: "wander",
  },
  {
    slug: "contrarian",
    nome: "Contrarian",
    descricao: "Posição contra o consenso do mercado. 'Não é X, é Y.'",
    gatilho: "Quebra de crença + revelação de causa raiz",
    exemploHook: "A neuropatia não é por açúcar alto. É porque seus nervos estão sendo privados de UMA vitamina.",
    visualPrompt: "Divisão 'todos dizem X / mas na verdade Y', tom investigativo.",
    categoria: "wander",
  },
  {
    slug: "mecanismo-oculto",
    nome: "Mecanismo Oculto",
    descricao: "Revela o 'porquê biológico/sistêmico' que explica o problema.",
    gatilho: "Curiosidade científica + validação lógica",
    exemploHook: "O motivo biológico pelo qual mulheres 40+ acumulam gordura não tem NADA a ver com o que comem.",
    visualPrompt: "Diagrama simples, animação de mecanismo (célula, órgão, sistema), tom educativo.",
    categoria: "wander",
  },
  {
    slug: "predicao",
    nome: "Predição",
    descricao: "Projeta consequência futura se nada mudar. Baseado em sintoma atual.",
    gatilho: "Medo do futuro previsível",
    exemploHook: "Esquecer nomes no meio da frase não é envelhecimento — é aviso de algo 20 anos antes de começar.",
    visualPrompt: "Timeline com marcos futuros escuros, contagem regressiva, tom de alerta.",
    categoria: "wander",
  },
  {
    slug: "quick-fast",
    nome: "Quick & Fast",
    descricao: "Resultado em prazo curto, esforço mínimo, sem cortar hábitos.",
    gatilho: "Urgência + baixa fricção",
    exemploHook: "5 frutas baratas que sugam açúcar do sangue em 24 horas.",
    visualPrompt: "Cronômetro, '24H', '7 DIAS' em destaque, ícone de rapidez.",
    categoria: "wander",
  },
  {
    slug: "superestrutura",
    nome: "Superestrutura",
    descricao: "Ancora a oferta numa marca/plataforma/hábito reconhecível (Wi-Fi, Spotify, café).",
    gatilho: "Familiaridade = segurança = abertura mental",
    exemploHook: "Se você tem Wi-Fi em casa, você já tem tudo pra ganhar R$ 200 a R$ 500 por dia.",
    visualPrompt: "Logo/símbolo da superestrutura em destaque + avatar comum interagindo.",
    categoria: "wander",
  },
  {
    slug: "medo-consequencia",
    nome: "Medo + Consequência",
    descricao: "Amplifica o custo real (pessoal, financeiro, corporal) de não agir.",
    gatilho: "Aversão à perda concreta",
    exemploHook: "Se você é tipo 2 e sente formigamento nos pés, o que acontece dentro do seu corpo é MUITO pior.",
    visualPrompt: "Imagem visceral da consequência (pé escurecendo, extrato zerado), tom sério.",
    categoria: "wander",
  },
  {
    slug: "fofoca-descoberta",
    nome: "Fofoca + Descoberta",
    descricao: "Celebridade/famoso + transformação inexplicada → método por trás.",
    gatilho: "Curiosidade social + prova aspiracional",
    exemploHook: "Jelly Roll apareceu magro no Grammy — as páginas de fofoca foram à loucura pra entender o que ele fez.",
    visualPrompt: "Foto de celebridade antes/depois, print de tabloide, tom cochicho.",
    categoria: "wander",
  },
  {
    slug: "trend",
    nome: "Trend Cultural",
    descricao: "Ancora na tendência do momento (moda praia 2026, verão, ano-novo).",
    gatilho: "FOMO cultural + timing",
    exemploHook: "Moda praia 2026: como mulheres reais estão usando UM truque caseiro pra chegar prontas pro verão.",
    visualPrompt: "Estética da trend do momento, hashtag em destaque, referência cultural clara.",
    categoria: "wander",
  },


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
