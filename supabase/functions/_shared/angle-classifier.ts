// Classificador de ângulo com o Jev (TypeSafe), CPY1.2: dado um texto de anúncio ou referência, escolhe o ângulo da
// biblioteca de copy e a camada (problema/solução/produto/oferta/genérico), com probabilidade e confiança.
// TS puro: monta a pergunta e lê a resposta; a chamada HTTP fica na função (a chave nunca sai do servidor).

export interface AngleLibraryItem { id: string; numero: number; nome: string; categoria: string; explicacao: string | null }

export interface AngleSubject { titulo?: string | null; texto: string; contexto?: string | null }

export const NENHUM = "nenhum";
/** Confiança mínima para a etiqueta valer sem revisão; abaixo disso vira "dúvida" e vai para alguém do time. */
export const CONFIANCA_FIRME = 0.6;

const CAMADAS: Record<string, string> = {
  problema: "Opens on the problem: pain, fear, hidden cause, enemy, myth, cost of the problem.",
  solucao: "Opens on the solution or its mechanism: novelty, unique mechanism, discovery, method comparison, transformation story.",
  produto: "Opens on the product or its creator: social proof, authority, specificity, case study, identity/status.",
  oferta: "Opens on the deal: price, guarantee, scarcity, urgency, bonus, payment, ROI.",
  generico: "A pattern that fits any stage: curiosity loop, pattern interrupt, direct question, call-out to the avatar, UGC, controversy, analogy.",
};

const clip = (s: string | null | undefined, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Corpo da requisição ao /v1/systemone: duas perguntas paralelas sobre o mesmo texto. */
export function angleRequest(subject: AngleSubject, library: ReadonlyArray<AngleLibraryItem>, model = "jev-latest") {
  const angulos = library.filter((l) => l.id.startsWith("angulo-"));
  const criteria: Record<string, string> = Object.fromEntries(angulos.map((a) => [a.id, `${a.nome} — ${clip(a.explicacao, 170)}`]));
  criteria[NENHUM] = "No angle from the list is clearly used (not an ad, or too short to tell).";
  return {
    model,
    state: { titulo: clip(subject.titulo, 200) || undefined, texto_do_anuncio: clip(subject.texto, 3500), contexto: clip(subject.contexto, 400) || undefined },
    questions: {
      angulo: {
        type: "choice",
        instructions: "Which persuasive angle does `texto_do_anuncio` lean on most in its opening and main argument? The text may be in Portuguese or English; the angle names are in Portuguese. Judge the strategy used, not the product's niche.",
        criteria,
      },
      camada: {
        type: "choice",
        instructions: "At which layer does `texto_do_anuncio` enter the conversation with the reader?",
        criteria: CAMADAS,
      },
    },
  };
}

export interface AngleVerdict {
  copy_lib_id: string | null;
  probabilidade: number;
  confianca: number;
  camada: string | null;
  camada_confianca: number;
  alternativas: Array<{ id: string; p: number }>;
  decisao: "firme" | "duvida" | "sem_angulo";
}

interface ChoiceAnswer { choice?: string; probabilities?: Record<string, number>; confidence?: number }

/** Lê a resposta: ângulo escolhido, as 3 alternativas seguintes e se a etiqueta é firme ou dúvida. */
export function parseAngleAnswer(resp: { answers?: Record<string, ChoiceAnswer> }, threshold = CONFIANCA_FIRME): AngleVerdict {
  const a = resp.answers?.angulo ?? {};
  const c = resp.answers?.camada ?? {};
  const probs = Object.entries(a.probabilities ?? {}).sort((x, y) => y[1] - x[1]);
  const choice = a.choice ?? probs[0]?.[0] ?? NENHUM;
  const confianca = Number(a.confidence ?? 0);
  const semAngulo = choice === NENHUM;
  return {
    copy_lib_id: semAngulo ? null : choice,
    probabilidade: Math.round(Number(a.probabilities?.[choice] ?? 0) * 1000) / 1000,
    confianca: Math.round(confianca * 1000) / 1000,
    camada: c.choice ?? null,
    camada_confianca: Math.round(Number(c.confidence ?? 0) * 1000) / 1000,
    alternativas: probs.filter(([id]) => id !== choice).slice(0, 3).map(([id, p]) => ({ id, p: Math.round(p * 1000) / 1000 })),
    decisao: semAngulo ? "sem_angulo" : confianca >= threshold ? "firme" : "duvida",
  };
}
