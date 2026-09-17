// ══════════════════════════════════════════════════════════════
//  AD FRAMEWORK — 7 Camadas Macro + 5 Portas de Entrada (Wander)
//  Fonte única para: Studio, Criativos, Hook Labs, Copilot,
//  studio-suggest-graph, hook-generator, creative-factory.
// ══════════════════════════════════════════════════════════════

/* ─────────── CAMADA 1: ESTRUTURAS INVISÍVEIS ─────────── */
export interface EstruturaInvisivel {
  slug: string;
  nome: string;
  sequencia: string; // Hook → ... → CTA
  quandoUsar: string;
}

export const ESTRUTURAS_INVISIVEIS: EstruturaInvisivel[] = [
  { slug: "lista", nome: "Lista", sequencia: "Hook → Opção 1 fraca → Opção 2 fraca → Opção 3 forte → CTA", quandoUsar: "Público comparador, decisor lógico." },
  { slug: "erro-comum", nome: "Erro Comum", sequencia: "Hook → Erro → Consequência → Solução → CTA", quandoUsar: "Nível 2 de consciência, público que já tenta e falha." },
  { slug: "historia-pessoal", nome: "História Pessoal", sequencia: "Hook → Dor passada → Virada → Descoberta → Prova → CTA", quandoUsar: "Nichos emocionais, identificação profunda." },
  { slug: "the-one-thing", nome: "The One Thing", sequencia: "Hook → Problema → Única solução → Como funciona → CTA", quandoUsar: "Cansaço decisório, quer simplicidade." },
  { slug: "alerta-urgente", nome: "Alerta Urgente", sequencia: "Hook → Risco → Consequência → Solução → CTA", quandoUsar: "Saúde, segurança, medo de perda." },
  { slug: "conspiracao", nome: "Conspiração", sequencia: "Hook conspiratório → Dor → Autoridade oculta → Prova → Invalidação → Solução → CTA", quandoUsar: "Público desconfiado da indústria/gurus." },
  { slug: "invalidacao-progressiva", nome: "Invalidação Progressiva", sequencia: "Hook → Invalidar sol.1 → Invalidar sol.2 → Mecanismo único → Expert → Prova → CTA", quandoUsar: "Mercado saturado, precisa diferenciar." },
  { slug: "podcast-entrevista", nome: "Podcast/Entrevista", sequencia: "Empilhamento → Pergunta → Avatar conta história → Mecanismo → Prova → CTA indireto", quandoUsar: "Ambiente de autoridade + intimidade." },
];

/* ─────────── CAMADA 2: FORMATOS ─────────── */
export interface Formato {
  slug: string;
  nome: string;
  descricao: string;
  visualPrompt: string;
}

export const FORMATOS: Formato[] = [
  { slug: "andando-rua", nome: "Andando na Rua", descricao: "Pessoa filmando enquanto caminha, tom casual.", visualPrompt: "POV vertical, movimento suave, luz natural, prédios/rua ao fundo, expressão espontânea." },
  { slug: "talking-head", nome: "Ator/Atriz na Tela", descricao: "Talking head direto pra câmera.", visualPrompt: "Enquadramento frontal, olhar direto, fundo neutro, boa iluminação." },
  { slug: "caixinha-perguntas", nome: "Caixinha de Perguntas", descricao: "Simula resposta a pergunta do Instagram Stories.", visualPrompt: "Sticker de pergunta do IG no topo, avatar respondendo casualmente." },
  { slug: "cinematografico", nome: "Cinematográfico", descricao: "Produção alta, cortes cinematográficos, trilha.", visualPrompt: "Grading cinema, letterbox, foco raso, cortes rápidos." },
  { slug: "dentro-carro", nome: "Dentro do Carro", descricao: "Tom íntimo como segredo.", visualPrompt: "Câmera no colo/dashboard, luz difusa, expressão baixa." },
  { slug: "fofoca", nome: "Fofoca", descricao: "'Te conto um segredo', voz baixa.", visualPrompt: "Close-up, olhar cúmplice, ambiente íntimo." },
  { slug: "podcast", nome: "Podcast", descricao: "Entrevista em estúdio, microfones visíveis.", visualPrompt: "2 pessoas, microfones de podcast, fundo escuro com iluminação âmbar." },
  { slug: "react", nome: "React", descricao: "Reagindo a outro vídeo/conteúdo viral.", visualPrompt: "Split screen ou PiP com vídeo reagido, expressão de reação." },
  { slug: "receitinha", nome: "Receitinha", descricao: "Tutorial de preparo/mistura.", visualPrompt: "Top-down cozinha, mãos misturando ingredientes, corte na batida." },
  { slug: "se-maquiando", nome: "Se Maquiando", descricao: "Casual, arrumando-se enquanto fala.", visualPrompt: "Espelho ou selfie, pincel/base em mão, tom despretensioso." },
  { slug: "tela-dividida", nome: "Tela Dividida", descricao: "Antes/depois, avatar + receita.", visualPrompt: "Split vertical ou horizontal com contraste claro entre lados." },
  { slug: "ugc", nome: "UGC", descricao: "Parece vídeo caseiro de usuário real.", visualPrompt: "Câmera de celular, luz caseira, zero produção aparente." },
  { slug: "entrevista", nome: "Entrevista", descricao: "Pergunta e resposta com 2+ pessoas.", visualPrompt: "Câmera lateral, microfone de mão, ambiente real." },
  { slug: "noticia", nome: "Notícia / News", descricao: "Estilo jornalístico, breaking news.", visualPrompt: "Lower third vermelho, logo de emissora fictícia, âncora sério." },
  { slug: "reels-tiktok", nome: "Reels/TikTok", descricao: "Vertical, cortes rápidos, trends.", visualPrompt: "9:16, transições rápidas, texto grande sobreposto." },
  { slug: "wiki-how", nome: "Wiki-How / Tela Branca", descricao: "Fundo branco com texto e ilustrações.", visualPrompt: "Fundo branco, ícones simples, texto passo-a-passo." },
  { slug: "hack-corpo", nome: "Hack do Corpo", descricao: "Demonstra truque físico no próprio corpo.", visualPrompt: "Close no gesto corporal (mão, orelha, ponto de pressão), tom demonstrativo." },
];

/* ─────────── CAMADA 3: ÂNGULOS ─────────── */
// (catálogo estendido em creativeAngles.ts — aqui só os slugs canônicos)
export const ANGULOS_CANONICOS = [
  // Clássicos + Filemon já existentes
  "dor", "desejo", "prova", "autoridade", "curiosidade", "antes-depois", "objecao",
  "conspiracao", "controversia", "historia-emocional", "promessa",
  // Novos (7 Camadas)
  "lista", "erro-comum", "contrarian", "mecanismo-oculto", "predicao", "quick-fast",
  "superestrutura", "medo-consequencia", "fofoca-descoberta", "trend",
] as const;

/* ─────────── CAMADA 4: FATIAS DE PÚBLICO ─────────── */
export interface Fatia { nicho: string; segmento: string; dorDesejo: string; }
export const FATIAS: Fatia[] = [
  // Renda Extra / Biz Op
  { nicho: "renda", segmento: "Mãe solo", dorDesejo: "Sustentar filhos sem depender de ninguém" },
  { nicho: "renda", segmento: "Desempregado", dorDesejo: "Renda urgente sem CLT" },
  { nicho: "renda", segmento: "Endividado", dorDesejo: "Pagar contas, sair do vermelho" },
  { nicho: "renda", segmento: "Aposentado", dorDesejo: "Complementar aposentadoria" },
  { nicho: "renda", segmento: "Jovem sem experiência", dorDesejo: "Ganhar sem faculdade, de casa" },
  { nicho: "renda", segmento: "Tentou de tudo online", dorDesejo: "Cansada de promessas falsas" },
  { nicho: "renda", segmento: "Religioso classe C/D", dorDesejo: "Mudança financeira, Deus provê caminho" },
  // Emagrecimento
  { nicho: "emagrecimento", segmento: "Mãe pós-parto", dorDesejo: "Voltar ao corpo de antes" },
  { nicho: "emagrecimento", segmento: "40+ metabolismo", dorDesejo: "Perder gordura resistente" },
  { nicho: "emagrecimento", segmento: "Comprou roupa maior", dorDesejo: "Vergonha do espelho" },
  { nicho: "emagrecimento", segmento: "Não posta mais fotos", dorDesejo: "Perdi quem eu era" },
  // Saúde
  { nicho: "diabetes", segmento: "Tipo 2 com formigamento", dorDesejo: "Medo de amputação" },
  { nicho: "memoria", segmento: "60+ esquecendo nomes", dorDesejo: "Medo de Alzheimer" },
  { nicho: "disfuncao-eretil", segmento: "40+ vergonha na cama", dorDesejo: "Recuperar potência sem remédio" },
];

/* ─────────── CAMADA 5: AVATARES ─────────── */
export interface Avatar { slug: string; nome: string; fatiaAlvo: string; }
export const AVATARES: Avatar[] = [
  { slug: "mulher-comum", nome: "Mulher Comum", fatiaAlvo: "Mães, desempregadas, classe C/D" },
  { slug: "homem-jovem", nome: "Homem Jovem", fatiaAlvo: "Masculino 20-35 'virar o jogo'" },
  { slug: "pessoa-carro", nome: "Pessoa no Carro", fatiaAlvo: "Tom casual de segredo, qualquer nicho" },
  { slug: "entrevistado-rua", nome: "Entrevistado na Rua", fatiaAlvo: "Reportagem orgânica, prova social" },
  { slug: "expert-jaleco", nome: "Expert de Jaleco", fatiaAlvo: "Saúde, autoridade médica" },
  { slug: "vovo-vovô", nome: "Vovó/Vovô", fatiaAlvo: "60+, memória, dor, netos" },
  { slug: "influencer-blogueira", nome: "Blogueira/Influencer", fatiaAlvo: "Estética, moda, viagem (portas fantasmas)" },
];

/* ─────────── CAMADA 6: TIPOS DE TEMA ─────────── */
export interface TipoTema { slug: string; nome: string; exemplo: string; angulosAfins: string[]; }
export const TIPOS_TEMA: TipoTema[] = [
  { slug: "lista-alimentos", nome: "Lista de alimentos", exemplo: "5 frutas baratas que sugam açúcar do sangue", angulosAfins: ["lista", "quick-fast"] },
  { slug: "celebridade", nome: "Celebridade + transformação", exemplo: "Jelly Roll apareceu magro no Grammy", angulosAfins: ["fofoca-descoberta", "superestrutura"] },
  { slug: "medicacao-perigosa", nome: "Medicação perigosa", exemplo: "O que o fabricante da Metformina não quer que você saiba", angulosAfins: ["conspiracao", "medo-consequencia"] },
  { slug: "consequencia-grave", nome: "Consequência grave", exemplo: "Formigamento nos pés = algo muito pior por dentro", angulosAfins: ["medo-consequencia", "predicao"] },
  { slug: "tecnologia-moderna", nome: "Tecnologia moderna", exemplo: "Celular antes de dormir desliga função cerebral", angulosAfins: ["erro-comum", "medo-consequencia"] },
  { slug: "mecanismo-oculto", nome: "Mecanismo oculto", exemplo: "Motivo biológico pelo qual mulheres 40+ acumulam gordura", angulosAfins: ["contrarian", "mecanismo-oculto"] },
  { slug: "tendencia-cultural", nome: "Tendência cultural", exemplo: "Moda praia 2026 com truque caseiro", angulosAfins: ["trend", "quick-fast"] },
  { slug: "alimento-vilao", nome: "Alimento vilão", exemplo: "Este 'anti-idade' famoso está acelerando o envelhecimento", angulosAfins: ["erro-comum", "contrarian"] },
  { slug: "receita-estranha", nome: "Receita estranha", exemplo: "Ingrediente incomum em água morna renova a pele", angulosAfins: ["curiosidade", "quick-fast"] },
  { slug: "sintomas-alerta", nome: "Sintomas como alerta", exemplo: "Esquecer nomes não é envelhecimento — é aviso", angulosAfins: ["medo-consequencia", "predicao"] },
];

/* ─────────── CAMADA 7: NÍVEIS DE CONSCIÊNCIA (Schwartz) ─────────── */
export interface NivelConsciencia { nivel: 1|2|3|4|5; nome: string; abordagem: string; exemploHook: string; }
export const NIVEIS_CONSCIENCIA: NivelConsciencia[] = [
  { nivel: 1, nome: "Inconsciente", abordagem: "Dor implícita, história, curiosidade. Zero produto.", exemploHook: "Se você acorda cansada mesmo dormindo 8h, tem uma explicação que ninguém te contou." },
  { nivel: 2, nome: "Consciente do problema", abordagem: "Nomear a dor, agitar consequências.", exemploHook: "Aquele formigamento nos pés não é normal — e vai piorar." },
  { nivel: 3, nome: "Consciente da solução", abordagem: "Comparar soluções, invalidar as fracas.", exemploHook: "Metformina, insulina, dieta — nada disso ataca a raiz. Isso ataca:" },
  { nivel: 4, nome: "Consciente do produto", abordagem: "Diferenciar o produto, mecanismo único.", exemploHook: "Existem 3 versões desse suplemento no mercado. Só uma tem [X]." },
  { nivel: 5, nome: "Mais consciente", abordagem: "Oferta, preço, exclusividade, escassez.", exemploHook: "Dr. cobrava $97, mas hoje só aqui você leva 3 por $100." },
];

/* ═══════════════════════════════════════════════════════════
   5 PORTAS DE ENTRADA (Leilões Fantasmas — Wander)
   ═══════════════════════════════════════════════════════════ */
export interface PortaEntrada {
  slug: string;
  numero: 1|2|3|4|5;
  nome: string;
  gatilho: string;
  mecanica: string;
  exemploHook: string;
  visualPrompt: string;
  leilaoImpacto: string;
  camadasAfetadas: string[]; // slugs de camadas macro que ela move
}

export const PORTAS_ENTRADA: PortaEntrada[] = [
  {
    slug: "anti-nicho",
    numero: 1,
    nome: "Anti-Nicho",
    gatilho: "Entrar por assunto de OUTRO universo (viagem, moda, receita) e transicionar para a oferta.",
    mecanica: "Ad parece conteúdo de nicho A. Do meio pro fim revela conexão com oferta B. Andrômeda joga no leilão do nicho A (mais barato).",
    exemploHook: "Gastei R$ 12 mil numa viagem pra Europa esse ano — e o dinheiro veio de um lugar que ninguém acredita.",
    visualPrompt: "Estética 100% do nicho de entrada (viagem, moda, receita). Zero sinal visual do nicho real da oferta até a virada.",
    leilaoImpacto: "Sai do leilão saturado. CPM/CPC caem drasticamente.",
    camadasAfetadas: ["formato", "fatia", "avatar", "tema"],
  },
  {
    slug: "deeper-core",
    numero: 2,
    nome: "Deeper Core",
    gatilho: "Falar a dor SUBCONSCIENTE, não a superficial. Situações específicas do dia-a-dia que revelam a ferida.",
    mecanica: "Copy nunca menciona o benefício óbvio. Foca no momento vergonhoso/íntimo que ninguém verbaliza.",
    exemploHook: "Trocou a marca do leite por 2 reais de diferença — e sentiu vergonha no caixa.",
    visualPrompt: "Cena íntima e específica (carrinho no mercado, espelho evitado, foto que não posta). Zero ambiente aspiracional.",
    leilaoImpacto: "Identificação absurda. Comentários e saves altos → CPM cai.",
    camadasAfetadas: ["estrutura", "angulo", "fatia"],
  },
  {
    slug: "conteudo-organico-outro-universo",
    numero: 3,
    nome: "Conteúdo Orgânico de Outro Universo",
    gatilho: "Pegar um formato viral orgânico (unboxing, review, vlog de viagem) e plugar a oferta no meio.",
    mecanica: "Ad se disfarça de trend orgânica. Meta classifica como conteúdo, não como ad.",
    exemploHook: "Comprei 15 peças da Shein — e o que veio dentro da caixa 3 me fez cancelar minha assinatura da academia.",
    visualPrompt: "Estética idêntica ao trend orgânico do momento (unboxing, GRWM, room tour, receita rápida).",
    leilaoImpacto: "Cai no leilão de conteúdo, não de ad. CPM extremamente baixo.",
    camadasAfetadas: ["formato", "avatar", "tema"],
  },
  {
    slug: "habitos-universais",
    numero: 4,
    nome: "Hábitos Universais",
    gatilho: "Gancho é uma AÇÃO que a pessoa já faz todo dia. A solução se ACOPLA ao hábito.",
    mecanica: "Não pede pra cortar nada. Adiciona ao que já existe. Zero fricção mental.",
    exemploHook: "Se você toma café toda manhã, adicione isso na xícara e veja o que acontece com sua glicose em 7 dias.",
    visualPrompt: "Mostrar o hábito (café, TV, celular, chuveiro) + micro-adição do produto de forma natural.",
    leilaoImpacto: "Baixa objeção → alta conversão. Leilão de curiosidade, não de venda.",
    camadasAfetadas: ["estrutura", "angulo", "tema"],
  },
  {
    slug: "superestruturas",
    numero: 5,
    nome: "Superestruturas",
    gatilho: "Marca/lugar/plataforma reconhecível como âncora (Wi-Fi, Spotify, YouTube, Nubank, Dr. Oz).",
    mecanica: "Familiaridade = segurança. Cérebro relaxa, aceita a novidade que vem depois.",
    exemploHook: "Se você tem Wi-Fi em casa, você já tem tudo que precisa pra ganhar de R$ 200 a R$ 500 por dia.",
    visualPrompt: "Logo/símbolo da superestrutura em destaque + avatar comum interagindo com ela.",
    leilaoImpacto: "Reconhecimento visual = stop the scroll. Menos prova necessária.",
    camadasAfetadas: ["angulo", "tema", "consciencia"],
  },
];

/* ─────────── HELPERS ─────────── */
export const PORTA_BY_SLUG: Record<string, PortaEntrada> = Object.fromEntries(
  PORTAS_ENTRADA.map(p => [p.slug, p])
);

export const FORMATO_BY_SLUG: Record<string, Formato> = Object.fromEntries(
  FORMATOS.map(f => [f.slug, f])
);

/** Sugere combo coerente 7-camadas + porta para um brief. */
export function suggestCombo(input: {
  nicho?: string;
  nivelConsciencia?: 1|2|3|4|5;
  portaSlug?: string;
}) {
  const porta = input.portaSlug ? PORTA_BY_SLUG[input.portaSlug] : PORTAS_ENTRADA[0];
  const nivel = NIVEIS_CONSCIENCIA.find(n => n.nivel === (input.nivelConsciencia ?? 2))!;
  const fatia = FATIAS.find(f => f.nicho === input.nicho) ?? FATIAS[0];
  // heurística simples: porta → formato preferido
  const formatoMap: Record<string, string> = {
    "anti-nicho": "reels-tiktok",
    "deeper-core": "dentro-carro",
    "conteudo-organico-outro-universo": "ugc",
    "habitos-universais": "receitinha",
    "superestruturas": "talking-head",
  };
  const formato = FORMATO_BY_SLUG[formatoMap[porta.slug]] ?? FORMATOS[0];
  return { porta, nivel, fatia, formato };
}

/** Bloco de contexto para injetar em system prompts de edge functions. */
export function frameworkContextBlock(): string {
  return `
FRAMEWORK 7 CAMADAS MACRO (Wander):
1. Estrutura Invisível: ${ESTRUTURAS_INVISIVEIS.map(e => e.nome).join(", ")}
2. Formato: ${FORMATOS.slice(0, 8).map(f => f.nome).join(", ")}...
3. Ângulo: use catálogo canônico (creativeAngles.ts)
4. Fatia de Público (nicho + segmento específico)
5. Avatar (quem aparece no ad)
6. Tema (assunto ancora)
7. Nível de Consciência Schwartz (1-5)

5 PORTAS DE ENTRADA (Leilões Fantasmas):
${PORTAS_ENTRADA.map(p => `  ${p.numero}. ${p.nome} — ${p.gatilho}`).join("\n")}

REGRA: mudar múltiplas camadas = novo conceito para o Andrômeda = leilão diferente = CPM menor.
`.trim();
}
