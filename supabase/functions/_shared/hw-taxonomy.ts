// Método H&W (MHW1.1): as cinco réguas que explicam por que um criativo vence ou morre — ponto da rota, carga do
// primeiro quadro, porta do hook, pouso da segunda frase e molde (família de um campeão). TS puro: vocabulário,
// pergunta ao Jev (TypeSafe) e leitura da resposta. Resumo do método em docs/architecture/metodo-hw-na-imperio.md.

export const PONTOS_ROTA = {
  1: "Não vê o problema",
  2: "Sente o problema",
  3: "Sabe que existe saída",
  4: "Conhece o produto",
  5: "Está pronta para comprar",
} as const;
export type PontoRota = 1 | 2 | 3 | 4 | 5;

export const CARGAS = {
  objeto_estranho: "Objeto estranho (curiosidade)",
  rosto_emocao: "Rosto com emoção",
  cena_vida: "Cena da vida dela",
  contradicao: "Contradição",
  bloco: "Bloco (produto, preço ou logo)",
} as const;
export type Carga = keyof typeof CARGAS;

export const PORTAS = {
  direta: "Direta",
  voz_dela: "Voz dela",
  quebra_crenca: "Quebra de crença",
  narrativa: "Narrativa",
  descoberta: "Descoberta",
} as const;
export type Porta = keyof typeof PORTAS;

export const POUSOS = {
  pousou: "Pousou",
  bateu: "Bateu (vendeu cedo)",
  tombou: "Tombou (promessa de outra pessoa)",
  apagou: "Apagou (mistério sem conteúdo)",
} as const;
export type Pouso = keyof typeof POUSOS;

/** Cada porta funciona melhor num ponto da rota (Missão 04). */
export const PORTA_PONTO: Record<Porta, PontoRota> = {
  narrativa: 1,
  descoberta: 1,
  direta: 2,
  voz_dela: 2,
  quebra_crenca: 2,
};

/** No tráfego frio só os pontos 1 e 2 abrem a rota (Missão 01). */
export const PONTOS_FRIO: ReadonlyArray<PontoRota> = [1, 2];

export const CONFIANCA_TAXONOMIA = 0.6;

export interface TaxonomySubject {
  texto: string;
  headline?: string | null;
  /** Descrição do primeiro quadro (imagem ou 1º segundo do vídeo); sem ela a carga não é perguntada. */
  primeiro_quadro?: string | null;
  produto?: string | null;
}

const clip = (s: string | null | undefined, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Duas frases ou mais: só aí faz sentido perguntar pelo pouso. */
export function hasLanding(texto: string): boolean {
  return String(texto ?? "").split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3).length >= 2;
}

export function taxonomyRequest(subject: TaxonomySubject, model = "jev-latest") {
  const questions: Record<string, unknown> = {
    ponto_rota: {
      type: "choice",
      instructions: "Where in the buyer's awareness journey does `anuncio` meet the reader? Texts may be in Portuguese or English.",
      criteria: {
        "1": "Reader does not see the problem yet: story, curiosity, a scene of their life, a strange discovery.",
        "2": "Reader already feels the problem: names the pain, the frustration, 'I've tried everything', 'it's not your fault'.",
        "3": "Reader knows a solution exists: explains a mechanism, a method, a doctor/expert explaining why.",
        "4": "Reader knows the product: shows the product, brand, ingredients, features.",
        "5": "Reader is ready to buy: price, discount, kit, countdown, 'order now'.",
      },
    },
    porta: {
      type: "choice",
      instructions: "Which role does the opening line (hook) of `anuncio` play?",
      criteria: {
        direta: "Direct: states the pain in the first sentence and calls the reader ('if your X..., watch this').",
        voz_dela: "Her voice: quotes a sentence the reader herself would say, in first person, then 'if you've ever said this'.",
        quebra_crenca: "Belief break: contests something the reader believes is right (e.g. 'cutting calories may be why...').",
        narrativa: "Narrative: a story about someone close (daughter, husband, neighbor) or the narrator, a scene.",
        descoberta: "Discovery: a new habit, ingredient, ritual or mechanism ('there's a 2-ingredient habit that...').",
      },
    },
  };
  if (hasLanding(subject.texto)) {
    questions.pouso = {
      type: "choice",
      instructions: "Look only at the sentence right after the hook in `anuncio` (the landing line). What does it do?",
      criteria: {
        pousou: "Promises something to the reader herself ('you', 'your'), with a detail or number, and says what comes next without selling.",
        bateu: "Sells too early: product name, price, kit or discount right after the hook.",
        tombou: "The promise stays with another person ('that's how my neighbor lost 19 pounds'), not the reader.",
        apagou: "Empty mystery: asks for patience with no content ('keep watching to see what changed').",
      },
    };
  }
  if (clip(subject.primeiro_quadro, 10)) {
    questions.carga = {
      type: "choice",
      instructions: "What does `primeiro_quadro` (the first frame of the ad, seen without sound) use to stop the thumb?",
      criteria: {
        objeto_estranho: "A strange object or action the viewer cannot immediately explain (curiosity).",
        rosto_emocao: "A human face showing emotion, looking at the camera.",
        cena_vida: "A scene from the target person's own life (trying on old jeans, standing on a scale).",
        contradicao: "Something that does not add up (untouched salad next to a growing tape measure).",
        bloco: "Just the product, logo, price, discount or a generic stock image: nothing unexpected.",
      },
    };
  }
  return {
    model,
    state: {
      anuncio: clip([subject.headline, subject.texto].filter(Boolean).join("\n"), 3000),
      primeiro_quadro: clip(subject.primeiro_quadro, 600) || undefined,
      produto: clip(subject.produto, 200) || undefined,
    },
    questions,
  };
}

interface ChoiceAnswer { choice?: string; confidence?: number; probabilities?: Record<string, number> }

export interface TaxonomyVerdict {
  ponto_rota: PontoRota | null;
  porta: Porta | null;
  pouso: Pouso | null;
  carga: Carga | null;
  confianca: Partial<Record<"ponto_rota" | "porta" | "pouso" | "carga", number>>;
  /** Só os campos com confiança ≥ limiar: são os que podem ser gravados sem revisão. */
  firmes: Partial<{ ponto_rota: PontoRota; porta: Porta; pouso: Pouso; carga: Carga }>;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function parseTaxonomyAnswer(resp: { answers?: Record<string, ChoiceAnswer> } | null, threshold = CONFIANCA_TAXONOMIA): TaxonomyVerdict {
  const a = resp?.answers ?? {};
  const pick = <T extends string>(k: string, allowed: readonly string[]): T | null => {
    const c = a[k]?.choice;
    return c && allowed.includes(c) ? (c as T) : null;
  };
  const pontoRaw = pick<string>("ponto_rota", ["1", "2", "3", "4", "5"]);
  const out: TaxonomyVerdict = {
    ponto_rota: pontoRaw ? (Number(pontoRaw) as PontoRota) : null,
    porta: pick<Porta>("porta", Object.keys(PORTAS)),
    pouso: pick<Pouso>("pouso", Object.keys(POUSOS)),
    carga: pick<Carga>("carga", Object.keys(CARGAS)),
    confianca: {},
    firmes: {},
  };
  for (const k of ["ponto_rota", "porta", "pouso", "carga"] as const) {
    if (!a[k]) continue;
    const c = r3(Number(a[k].confidence ?? 0));
    out.confianca[k] = c;
    if (out[k] !== null && c >= threshold) (out.firmes as Record<string, unknown>)[k] = out[k];
  }
  return out;
}

export interface LevaItem { id: string; porta: Porta | null; ponto_rota: PontoRota | null }

/**
 * Checa uma leva de teste (P1): portas repetidas ("cinco frases parecidas são uma porta só") e criativos fora dos
 * pontos 1/2 no frio. Devolve avisos legíveis; leva sem aviso está pronta para o Revisor.
 */
export function levaWarnings(itens: ReadonlyArray<LevaItem>, frio = true): string[] {
  const avisos: string[] = [];
  const porPorta = new Map<string, string[]>();
  for (const i of itens) if (i.porta) porPorta.set(i.porta, [...(porPorta.get(i.porta) ?? []), i.id]);
  for (const [porta, ids] of porPorta) if (ids.length > 1) avisos.push(`Porta "${PORTAS[porta as Porta]}" repetida em ${ids.length} criativos: troque por uma porta vazia.`);
  const vazias = (Object.keys(PORTAS) as Porta[]).filter((p) => !porPorta.has(p));
  if (itens.length >= 5 && vazias.length) avisos.push(`Portas sem nenhum criativo: ${vazias.map((p) => PORTAS[p]).join(", ")}.`);
  if (frio) for (const i of itens) if (i.ponto_rota && !PONTOS_FRIO.includes(i.ponto_rota)) avisos.push(`Criativo ${i.id} fala com o ponto ${i.ponto_rota} (${PONTOS_ROTA[i.ponto_rota]}): no frio, só os pontos 1 e 2 abrem a rota.`);
  return avisos;
}
