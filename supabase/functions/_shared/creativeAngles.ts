// Catálogo de ângulos psicológicos — FONTE DA VERDADE.
// Consumido por: wa-ai-reply, creative-factory, nurture-generator,
// studio-batch-cron, openflow-ai (Fase 1), site-to-ecosystem, handleAvatarAngles.
// Mantém paridade visual com src/data/creativeAngles.ts (mirror do frontend).

export type Emocao =
  | "medo" | "raiva" | "esperanca" | "orgulho" | "culpa"
  | "curiosidade" | "indignacao" | "empatia" | "urgencia" | "alivio";

export interface CreativeAngle {
  slug: string;
  nome: string;
  descricao: string;
  gatilho: string;
  exemploHook: string;
  visualPrompt: string;
  categoria: "classico" | "filemon" | "emocional";
  emocaoDominante: Emocao;
  quandoUsar: string;    // regra consciência × sofisticação
  estrutura: string;     // template headline → corpo → CTA
  errosComuns: string[]; // 2-3 armadilhas
}

export const CREATIVE_ANGLES: CreativeAngle[] = [
  {
    slug: "dor", nome: "Dor",
    descricao: "Mostra a frustração e o problema sentido.",
    gatilho: "Agitação da dor presente",
    exemploHook: "Você abre o app do banco, encara o saldo por 2 segundos e fecha rápido pra fingir que não viu.",
    visualPrompt: "Foco na DOR: mostrar a frustração, o problema sentido pelo avatar. Expressão facial de cansaço/frustração. Atmosfera de problema a ser resolvido.",
    categoria: "classico",
    emocaoDominante: "culpa",
    quandoUsar: "Consciência 1-2 (inconsciente do problema ou consciente da dor). Sofisticação 1-2.",
    estrutura: "Headline: cena específica da dor · Corpo: agita 2-3 consequências · CTA: 'existe outro caminho'",
    errosComuns: ["Descrever dor genérica sem cena concreta", "Cair em tom de pena/lamento", "Esquecer a saída no CTA"],
  },
  {
    slug: "desejo", nome: "Desejo / Transformação",
    descricao: "Projeta a vida ideal e a transformação aspiracional.",
    gatilho: "Visualização do futuro desejado",
    exemploHook: "Imagina acordar numa terça-feira de sol e decidir trabalhar só 2 horas.",
    visualPrompt: "Foco no DESEJO: mostrar a transformação aspiracional, a vida ideal. Expressão de felicidade, conquista. Ambiente luxuoso/sonhado.",
    categoria: "classico",
    emocaoDominante: "esperanca",
    quandoUsar: "Consciência 3-4 (consciente da solução/produto). Sofisticação 2-3.",
    estrutura: "Headline: cena aspiracional · Corpo: 3 marcadores do novo cotidiano · CTA: 'veja como chegar lá'",
    errosComuns: ["Prometer sem mostrar mecanismo", "Cair em clichê de lifestyle", "Sem contraste com a vida atual"],
  },
  {
    slug: "prova", nome: "Prova Social",
    descricao: "Depoimentos, números e resultados concretos.",
    gatilho: "Validação pela maioria",
    exemploHook: "Mais de 1.847 pessoas já aplicaram isso nos últimos 90 dias.",
    visualPrompt: "Foco na PROVA SOCIAL: mostrar depoimentos, números, resultados concretos. Elementos visuais de credibilidade (checkmarks, estrelas, números grandes).",
    categoria: "classico",
    emocaoDominante: "alivio",
    quandoUsar: "Consciência 3-5 (consciente da solução em diante). Sofisticação 3-4-5.",
    estrutura: "Headline: número concreto · Corpo: 2-3 casos citados · CTA: 'entre pra próxima turma'",
    errosComuns: ["Números redondos suspeitos", "Depoimento sem nome/rosto", "Prova sem contexto de tempo"],
  },
  {
    slug: "autoridade", nome: "Autoridade",
    descricao: "Expert posicionado como referência absoluta.",
    gatilho: "Hierarquia e confiança",
    exemploHook: "Os top 1% do mercado usam isso há anos.",
    visualPrompt: "Foco na AUTORIDADE: expert posicionado como especialista. Fundo profissional, postura de liderança, confiança absoluta.",
    categoria: "classico",
    emocaoDominante: "orgulho",
    quandoUsar: "Consciência 2-4. Ideal quando avatar já foi enganado por 'gurus'. Sofisticação 3-4.",
    estrutura: "Headline: credencial + insight · Corpo: 2 achados exclusivos · CTA: 'veja o método'",
    errosComuns: ["Vaidade sem prova", "Credencial irrelevante ao avatar", "Tom arrogante que afasta"],
  },
  {
    slug: "curiosidade", nome: "Curiosidade",
    descricao: "Gancho intrigante que para o scroll.",
    gatilho: "Loop aberto / curiosity gap",
    exemploHook: "Tem uma coisa que ninguém te conta sobre [tema] — e é exatamente o que separa quem fatura de quem fica tentando.",
    visualPrompt: "Foco na CURIOSIDADE: criar gancho visual intrigante, pergunta no ar, elemento misterioso que faça a pessoa PARAR o scroll.",
    categoria: "classico",
    emocaoDominante: "curiosidade",
    quandoUsar: "Consciência 1-3. Excelente pra abrir topo de funil e para o scroll. Sofisticação 1-2.",
    estrutura: "Headline: loop aberto · Corpo: pista sem entregar o segredo · CTA: 'descubra no vídeo'",
    errosComuns: ["Clickbait sem payoff", "Curiosidade sobre tema irrelevante", "Fechar o loop cedo demais"],
  },
  {
    slug: "antes-depois", nome: "Antes vs Depois",
    descricao: "Contraste visual entre estado atual e resultado.",
    gatilho: "Transformação demonstrada",
    exemploHook: "Há 8 meses eu fazia X. Hoje faço Y. A virada aconteceu em UM dia específico.",
    visualPrompt: "Foco no ANTES vs DEPOIS: dividir a imagem com contraste visual claro entre o estado atual ruim e o resultado alcançado.",
    categoria: "classico",
    emocaoDominante: "empatia",
    quandoUsar: "Consciência 2-4. Sofisticação 2-3. Muito forte com prova visual real.",
    estrutura: "Headline: marco temporal + delta · Corpo: 3 mudanças concretas · CTA: 'faça o mesmo'",
    errosComuns: ["Antes/depois inverossímil", "Sem prazo específico", "Fingir transformação linear"],
  },
  {
    slug: "objecao", nome: "Objeção Destruída",
    descricao: "Responde de cara a maior objeção.",
    gatilho: "Quebra de crença limitante",
    exemploHook: "'Não tenho tempo' é o que todo mundo me dizia. Até eu mostrar que dá pra fazer em 17 minutos por dia.",
    visualPrompt: "Foco em DESTRUIR OBJEÇÃO: imagem que responde visualmente 'não tenho tempo', 'é caro', 'não funciona pra mim'.",
    categoria: "classico",
    emocaoDominante: "alivio",
    quandoUsar: "Consciência 3-5 (avatar já pensa em comprar mas trava). Sofisticação 3-4.",
    estrutura: "Headline: cita a objeção literal · Corpo: prova que dissolve · CTA: 'teste sem risco'",
    errosComuns: ["Atacar objeção que o avatar não tem", "Argumento fraco sem prova", "Não citar a objeção com as palavras dele"],
  },
  {
    slug: "conspiracao", nome: "Conspiração",
    descricao: "Revela o que o sistema/indústria esconde.",
    gatilho: "Inimigo comum + verdade proibida",
    exemploHook: "Tem um motivo pelo qual ninguém da indústria fala sobre isso. E não é o que você pensa.",
    visualPrompt: "Foco em CONSPIRAÇÃO: estética de denúncia, contraste forte, elementos que sugerem segredo/exposição. Tom investigativo.",
    categoria: "filemon",
    emocaoDominante: "indignacao",
    quandoUsar: "Consciência 2-3. Sofisticação 3-4 (mercado cético). Cuidado com nichos regulados.",
    estrutura: "Headline: 'o que X não quer que você saiba' · Corpo: revelação + prova · CTA: 'veja o real'",
    errosComuns: ["Conspiração absurda que perde credibilidade", "Sem prova documental", "Culpar sem alternativa concreta"],
  },
  {
    slug: "controversia", nome: "Controvérsia",
    descricao: "Posiciona-se contra o consenso do mercado.",
    gatilho: "Polarização + tomada de lado",
    exemploHook: "Vou falar uma coisa que vai irritar 90% dos gurus de [nicho]: o que eles ensinam destrói seu negócio.",
    visualPrompt: "Foco em CONTROVÉRSIA: imagem que confronta diretamente uma crença popular. Texto provocador grande, expressão desafiadora, divisão visual 'errado vs certo'.",
    categoria: "filemon",
    emocaoDominante: "raiva",
    quandoUsar: "Consciência 3-4. Sofisticação 4-5 (mercado saturado precisa de nova mecânica).",
    estrutura: "Headline: opinião polarizadora · Corpo: 3 razões contra o consenso · CTA: 'entenda o novo caminho'",
    errosComuns: ["Polêmica gratuita sem substância", "Ofender o próprio avatar", "Ser contra sem propor novo"],
  },
  {
    slug: "historia-emocional", nome: "História Emocional",
    descricao: "Narrativa pessoal com pico emocional + lição.",
    gatilho: "Identificação + catarse",
    exemploHook: "Era 2 da manhã. Minha filha dormindo no quarto. Eu olhando pro extrato negativo. Foi aí que decidi tudo.",
    visualPrompt: "Foco em HISTÓRIA EMOCIONAL: cena íntima e cinematográfica, luz quente, momento de vulnerabilidade ou virada.",
    categoria: "filemon",
    emocaoDominante: "empatia",
    quandoUsar: "Qualquer consciência. Ideal pra criativos longos (VSL, Reels 60s). Sofisticação 2-4.",
    estrutura: "Headline: momento específico · Corpo: virada emocional + lição · CTA: 'sua virada pode ser agora'",
    errosComuns: ["História genérica sem cena", "Vitimização sem transformação", "Lição forçada no final"],
  },
  {
    slug: "promessa", nome: "Promessa",
    descricao: "Resultado específico, mensurável e em prazo definido.",
    gatilho: "Clareza + urgência temporal",
    exemploHook: "Em 30 dias você vai ter [resultado específico] — ou eu devolvo cada centavo.",
    visualPrompt: "Foco em PROMESSA: número grande e específico em destaque (R$, dias, %), elemento de cronômetro/calendário, prova de garantia.",
    categoria: "filemon",
    emocaoDominante: "urgencia",
    quandoUsar: "Consciência 4-5 (perto de comprar). Sofisticação 3-4. Precisa de garantia forte.",
    estrutura: "Headline: resultado + prazo · Corpo: mecanismo + garantia · CTA: 'comece hoje'",
    errosComuns: ["Promessa vaga ('mudar de vida')", "Prazo irreal", "Sem garantia que sustente"],
  },
];

export const ANGLE_BY_SLUG: Record<string, CreativeAngle> = Object.fromEntries(
  CREATIVE_ANGLES.map((a) => [a.slug, a])
);
export const ALL_SLUGS = CREATIVE_ANGLES.map((a) => a.slug);

export function getAnglesForDay(n = 3, date = new Date()): CreativeAngle[] {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const out: CreativeAngle[] = [];
  for (let i = 0; i < n; i++) {
    out.push(CREATIVE_ANGLES[(dayOfYear + i * 3) % CREATIVE_ANGLES.length]);
  }
  return out;
}

/** Bloco pronto para injetar em system prompts de IA conversacional. */
export function anglesPromptBlock(): string {
  return `\n\nARSENAL DE ÂNGULOS PSICOLÓGICOS (escolha 1 conforme o momento do lead):
${CREATIVE_ANGLES.map((a) => `• ${a.nome} — ${a.gatilho}. Ex: "${a.exemploHook}"`).join("\n")}

Regra: identifique a OBJEÇÃO ou ESTADO emocional dominante e escolha o ângulo que dissolve esse bloqueio. Nunca use mais de 1 ângulo por mensagem.\n`;
}

/** Catálogo completo para geração de criativos (wizard, one-click). */
export function anglesCatalogBlock(): string {
  return `\n## CATÁLOGO CANÔNICO DE ÂNGULOS (fonte da verdade — NÃO invente ângulos novos)
${CREATIVE_ANGLES.map((a) => `
### ${a.nome}  \`slug: ${a.slug}\`
- Gatilho: ${a.gatilho}
- Emoção dominante: **${a.emocaoDominante}**
- Quando usar: ${a.quandoUsar}
- Estrutura: ${a.estrutura}
- Erros a evitar: ${a.errosComuns.join(" · ")}
- Exemplo hook: "${a.exemploHook}"`).join("\n")}\n`;
}

/** Checklist de qualidade injetado antes do modelo retornar os ângulos. */
export function qualityChecklistBlock(): string {
  return `\n## CHECKLIST DE QUALIDADE (aplique ANTES de retornar)
- [ ] Headline para o scroll nos primeiros 3 segundos / 60 caracteres
- [ ] Uma única emoção dominante por ângulo — NUNCA repita a mesma emoção em dois ângulos do mesmo lote
- [ ] Corpo respeita a "estrutura" documentada do ângulo escolhido
- [ ] CTA claro, específico, sem 'clique aqui' genérico
- [ ] Se claim arriscado (renda, saúde, prazo), sinalizar com 'resultados variam' ou reformular
- [ ] Nenhum erro da lista "Erros a evitar" do ângulo escolhido\n`;
}

/**
 * Seleciona N ângulos do catálogo diversificando emoção dominante.
 * Determinístico via seed (ex: project_id) para reprodutibilidade.
 */
export function selectAnglesForBrief(n = 4, seed = ""): CreativeAngle[] {
  const hash = [...seed].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = [...CREATIVE_ANGLES].sort((a, b) => {
    const ha = ((hash + a.slug.length * 17) ^ a.slug.charCodeAt(0)) >>> 0;
    const hb = ((hash + b.slug.length * 17) ^ b.slug.charCodeAt(0)) >>> 0;
    return ha - hb;
  });
  const chosen: CreativeAngle[] = [];
  const usedEmotions = new Set<Emocao>();
  for (const a of pool) {
    if (chosen.length >= n) break;
    if (usedEmotions.has(a.emocaoDominante)) continue;
    chosen.push(a);
    usedEmotions.add(a.emocaoDominante);
  }
  // se o catálogo tiver poucas emoções distintas pra o N pedido, completa com o restante
  for (const a of pool) {
    if (chosen.length >= n) break;
    if (!chosen.includes(a)) chosen.push(a);
  }
  return chosen;
}
