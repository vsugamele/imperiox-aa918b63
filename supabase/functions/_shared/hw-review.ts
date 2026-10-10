// Método H&W (MHW1.2): o Revisor. Antes de subir, cada peça passa por três blocos — teste do print (primeiro quadro),
// abertura (hook + aterrissagem) e cartão de bolso — mais compliance da Meta. Parte é regra fixa (regex, sem custo),
// parte é pergunta sim/não ao Jev (TypeSafe, tipo "noul"). TS puro: a chamada HTTP fica na função creative-review.

export type ReviewBlock = "print" | "abertura" | "cartao" | "compliance";

export interface ChecklistItem {
  id: string;
  bloco: ReviewBlock;
  pergunta: string;
  /** Pergunta ao Jev (em inglês, como as demais do projeto). `true` = passou; em compliance, `true` = violou. */
  instrucao: string;
  /** Reprova a peça quando falha. */
  obrigatoria: boolean;
  /** Precisa da descrição do primeiro quadro / da promessa da página; sem o dado, fica "sem_dado". */
  precisa?: "primeiro_quadro" | "pagina";
  /** O Revisor só pode sugerir correção destas (número, pronome, ponte com a imagem); o resto da copy não muda. */
  corrigivel?: boolean;
}

export const CHECKLIST: ReadonlyArray<ChecklistItem> = [
  { id: "print_carga", bloco: "print", obrigatoria: true, precisa: "primeiro_quadro", pergunta: "O primeiro quadro tem uma das quatro cargas (objeto estranho, rosto com emoção, cena da vida dela, contradição)?", instrucao: "Does `primeiro_quadro` show something unexpected that stops the thumb — a strange object or action, a face with emotion, a scene from the target person's life, or a contradiction — instead of just the product, logo, price or a generic image?" },
  { id: "print_sem_som", bloco: "print", obrigatoria: false, precisa: "primeiro_quadro", pergunta: "A imagem funciona sem som e sem legenda?", instrucao: "Would `primeiro_quadro` make sense and catch attention with the sound off and without reading any caption?" },
  { id: "print_reconhece", bloco: "print", obrigatoria: false, precisa: "primeiro_quadro", pergunta: "A pessoa do público se reconheceria ali?", instrucao: "Would the target audience described in `publico` recognise themselves or their situation in `primeiro_quadro`?" },
  { id: "print_endereco", bloco: "print", obrigatoria: true, precisa: "primeiro_quadro", pergunta: "O que aparece tem a ver com o que a página vai falar (carro com endereço)?", instrucao: "Is what appears in `primeiro_quadro` related to the subject of `anuncio` and of `pagina`, so that the people who stop are the right people (not a random shock image)?" },
  { id: "hook_qualifica", bloco: "abertura", obrigatoria: true, pergunta: "A primeira frase faz ela pensar \"isso é comigo\"?", instrucao: "Does the first sentence of `anuncio` qualify the reader — would someone from `publico` think 'this is about me' (age, situation, pain, her own words)?" },
  { id: "hook_divida", bloco: "abertura", obrigatoria: true, pergunta: "A pergunta que ficou aberta cabe numa linha?", instrucao: "Does the opening of `anuncio` leave one specific open question that could be written in a single line (not a vague 'you won't believe this')?" },
  { id: "hook_fundo", bloco: "abertura", obrigatoria: true, precisa: "pagina", pergunta: "A página/VSL responde essa pergunta logo no começo?", instrucao: "Is the open question created by the opening of `anuncio` answered by what `pagina` delivers early on?" },
  { id: "pouso_dela", bloco: "abertura", obrigatoria: false, corrigivel: true, pergunta: "A segunda frase promete algo para ela, e não para outra pessoa?", instrucao: "Does the sentence right after the hook in `anuncio` promise something to the reader herself ('you', 'your') instead of telling what happened to someone else, and without selling the product yet?" },
  { id: "pouso_detalhe", bloco: "abertura", obrigatoria: false, corrigivel: true, pergunta: "Tem número exato ou ligação com o que está na imagem?", instrucao: "Does the opening of `anuncio` use an exact, non-round number (73 seconds, 11 days) or refer to something visible in `primeiro_quadro` ('this glass')?" },
  { id: "regra_do_um", bloco: "cartao", obrigatoria: true, pergunta: "Uma ideia, uma emoção, uma promessa, uma ação?", instrucao: "Does `anuncio` focus on a single idea, a single main promise and a single call to action (not energy, sleep, weight and joints all at once)?" },
  { id: "corrente_vilao", bloco: "cartao", obrigatoria: false, pergunta: "Solta uma corrente e o vilão nunca é ela?", instrucao: "Does `anuncio` take the blame off the reader (the culprit is a method, an industry, a hidden cause, an old advice — never the reader's lack of willpower)?" },
  { id: "prova", bloco: "cartao", obrigatoria: false, pergunta: "Tem prova que ela conseguiria conferir?", instrucao: "Does `anuncio` contain a concrete, checkable proof element (a specific person with a role, a number, a demonstration, a study), not just generic claims?" },
  { id: "tres_segundos", bloco: "cartao", obrigatoria: true, pergunta: "Entende em 3 segundos, sem reler?", instrucao: "Can the main message of `anuncio` be understood in about three seconds, without rereading or decoding jargon?" },
  { id: "compliance_atributo", bloco: "compliance", obrigatoria: true, pergunta: "Afirma ou insinua uma condição de saúde de quem lê?", instrucao: "Does `anuncio` assert or imply a personal attribute or health condition of the reader (e.g. 'Are you diabetic?', 'your obesity'), which Meta forbids?" },
  { id: "compliance_claim", bloco: "compliance", obrigatoria: true, pergunta: "Promete cura, reversão ou resultado com prazo?", instrucao: "Does `anuncio` promise a cure, reversal or elimination of a condition, or a specific result in a fixed time ('lose 30 lbs in 30 days', 'guaranteed')?" },
];

export interface ReviewSubject {
  texto: string;
  headline?: string | null;
  primeiro_quadro?: string | null;
  /** O que a página/VSL entrega nos primeiros minutos (promessa e mecanismo). */
  pagina?: string | null;
  publico?: string | null;
}

const clip = (s: string | null | undefined, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const hasData = (item: ChecklistItem, s: ReviewSubject) =>
  !item.precisa || (item.precisa === "primeiro_quadro" ? !!clip(s.primeiro_quadro, 10) : !!clip(s.pagina, 10));

/** Itens que dá para perguntar com o que temos (sem descrição do quadro, o bloco "print" fica de fora). */
export function askableItems(s: ReviewSubject): ChecklistItem[] {
  return CHECKLIST.filter((i) => hasData(i, s));
}

export function reviewRequest(s: ReviewSubject, model = "jev-latest") {
  return {
    model,
    state: {
      anuncio: clip([s.headline, s.texto].filter(Boolean).join("\n"), 3000),
      primeiro_quadro: clip(s.primeiro_quadro, 600) || undefined,
      pagina: clip(s.pagina, 1200) || undefined,
      publico: clip(s.publico, 300) || undefined,
    },
    questions: Object.fromEntries(askableItems(s).map((i) => [i.id, { type: "noul", instructions: i.instrucao }])),
  };
}

/** Regras fixas, sem IA: o que nunca deveria subir ou o que dá para apontar de cara. */
export interface HardFinding { id: string; bloco: ReviewBlock; obrigatoria: boolean; achado: string; trecho: string }

const HARD_RULES: ReadonlyArray<{ id: string; bloco: ReviewBlock; obrigatoria: boolean; re: RegExp; achado: string }> = [
  { id: "compliance_atributo", bloco: "compliance", obrigatoria: true, re: /\b(voc[eê] (é|e|tem|sofre de) (diab[eé]tic|obes|hipertens|depressiv|ansios)|are you (diabetic|obese|depressed)|your (diabetes|obesity|depression))/i, achado: "Atributo pessoal de saúde (proibido pela Meta)." },
  { id: "compliance_claim", bloco: "compliance", obrigatoria: true, re: /\b(cura|curar|reverte|reverter|elimina de vez|cure[sd]?|reverses?)\b/i, achado: "Promessa de cura/reversão." },
  { id: "compliance_claim", bloco: "compliance", obrigatoria: true, re: /\b(perca|perder|emagre[cç]a|lose)\s+\d+\s*(kg|quilos|libras|lbs?|pounds)\s+(em|in)\s+\d+\s*(dias|days|semanas|weeks)/i, achado: "Resultado com prazo fixo." },
  { id: "compliance_claim", bloco: "compliance", obrigatoria: true, re: /\b(resultado garantido|garantido!|guaranteed (results?|weight))/i, achado: "Resultado \"garantido\"." },
  { id: "pouso_detalhe", bloco: "abertura", obrigatoria: false, re: /\b(1 minuto|um minuto|10 dias|dez dias|30 dias|100%|1 minute|one minute|10 days|30 days)\b/i, achado: "Número redondo: troque por um exato (73 segundos, 11 dias)." },
  { id: "transicao_video", bloco: "abertura", obrigatoria: false, re: /\b(assist[ae] (esse|este|o) v[ií]deo|watch (this|the) video)\b/i, achado: "Transição com a palavra \"vídeo\": dê um motivo em vez de pedir para assistir." },
];

export function hardFindings(s: ReviewSubject): HardFinding[] {
  const text = [s.headline, s.texto].filter(Boolean).join("\n");
  const out: HardFinding[] = [];
  for (const r of HARD_RULES) {
    const m = r.re.exec(text);
    if (m) out.push({ id: r.id, bloco: r.bloco, obrigatoria: r.obrigatoria, achado: r.achado, trecho: m[0] });
  }
  return out;
}

export type ItemResult = "sim" | "nao" | "duvida" | "sem_dado";
export interface ReviewItemVerdict { id: string; bloco: ReviewBlock; pergunta: string; resultado: ItemResult; p: number | null; obrigatoria: boolean }

export interface ReviewVerdict {
  aprovado: boolean;
  nota: number;
  itens: ReviewItemVerdict[];
  reprovacoes: string[];
  avisos: string[];
  /** Correções que o Revisor pode fazer sem mexer em ângulo, mecanismo ou promessa. */
  correcoes_permitidas: string[];
}

/** Limiar do "noul": acima de SIM passa, abaixo de NAO falha, no meio é dúvida (não reprova sozinha). */
export const NOUL_SIM = 0.65;
export const NOUL_NAO = 0.35;

export function reviewVerdict(s: ReviewSubject, resp: { answers?: Record<string, { noul?: number }> } | null): ReviewVerdict {
  const hard = hardFindings(s);
  const itens: ReviewItemVerdict[] = CHECKLIST.map((i) => {
    if (!hasData(i, s)) return { id: i.id, bloco: i.bloco, pergunta: i.pergunta, resultado: "sem_dado", p: null, obrigatoria: i.obrigatoria };
    const raw = resp?.answers?.[i.id]?.noul;
    const p = typeof raw === "number" ? Math.round(raw * 1000) / 1000 : null;
    // Em compliance a pergunta é "violou?": inverte para "passou?".
    const passou = p === null ? null : i.bloco === "compliance" ? 1 - p : p;
    let resultado: ItemResult = passou === null ? "duvida" : passou >= NOUL_SIM ? "sim" : passou <= NOUL_NAO ? "nao" : "duvida";
    if (hard.some((h) => h.id === i.id && h.bloco === "compliance")) resultado = "nao";
    return { id: i.id, bloco: i.bloco, pergunta: i.pergunta, resultado, p, obrigatoria: i.obrigatoria };
  });

  const reprovacoes = [
    ...itens.filter((i) => i.obrigatoria && i.resultado === "nao").map((i) => i.pergunta),
    ...hard.filter((h) => h.obrigatoria && !itens.some((i) => i.id === h.id && i.resultado === "nao")).map((h) => `${h.achado} ("${h.trecho}")`),
  ];
  const avisos = [
    ...itens.filter((i) => !i.obrigatoria && i.resultado === "nao").map((i) => i.pergunta),
    ...itens.filter((i) => i.resultado === "duvida").map((i) => `Dúvida: ${i.pergunta}`),
    ...hard.filter((h) => !h.obrigatoria).map((h) => `${h.achado} ("${h.trecho}")`),
  ];
  const correcoes_permitidas = [
    ...(itens.some((i) => i.id === "pouso_dela" && i.resultado === "nao") ? ["Trocar a promessa de terceiros por uma promessa para ela (\"ela\"/\"minha vizinha\" → \"você\")."] : []),
    ...(itens.some((i) => i.id === "pouso_detalhe" && i.resultado === "nao") || hard.some((h) => h.id === "pouso_detalhe") ? ["Trocar número redondo por exato, ou ligar a frase ao objeto da imagem (\"este copo\")."] : []),
  ];

  const avaliados = itens.filter((i) => i.resultado !== "sem_dado");
  const pontos = avaliados.reduce((s, i) => s + (i.resultado === "sim" ? 1 : i.resultado === "duvida" ? 0.5 : 0), 0);
  const nota = avaliados.length ? Math.round((pontos / avaliados.length) * 100) : 0;
  return { aprovado: reprovacoes.length === 0 && avaliados.length > 0, nota, itens, reprovacoes, avisos, correcoes_permitidas };
}
