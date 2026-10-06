// Triagem do acervo do bot com o Jev (KB1.1): decide sozinho o que é resposta reutilizável (aprova), o que é lixo ou
// dado pessoal (descarta) e só manda para o time o que ficou no meio. TS puro: a chamada HTTP fica na função.

export interface KnowledgeItem { pergunta: string | null; resposta: string | null }

export type TriageDecision = "aprovar" | "descartar" | "revisar";

/** Dado pessoal ou segredo que nunca pode ir para o acervo, independente do que o modelo achar. */
const HARD_BLOCK: ReadonlyArray<RegExp> = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // e-mail
  /(token|verify|access_token|magic|otp)=/i, // link com token de acesso
  /\b(?:\+?55)?\s?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/, // telefone
];

export function hasHardBlock(item: KnowledgeItem): boolean {
  const text = `${item.pergunta ?? ""}\n${item.resposta ?? ""}`;
  return HARD_BLOCK.some((re) => re.test(text));
}

export function triageRequest(item: KnowledgeItem, produto: string, model = "jev-latest") {
  return {
    model,
    state: { produto, pergunta_do_cliente: String(item.pergunta ?? "").slice(0, 1500), resposta_da_equipe: String(item.resposta ?? "").slice(0, 2500) },
    questions: {
      reutilizavel: {
        type: "noul",
        instructions: "Would `resposta_da_equipe` be a correct, reusable answer for OTHER customers who ask something like `pergunta_do_cliente` about `produto`? The texts are in Portuguese.",
        criteria: {
          true: "A real customer question (access, price, payment, content, guarantee, how to use) and an answer that generalises to other customers.",
          false: "Small talk, thanks, emoji, audio/image placeholder, off-topic or personal message, a one-off fix for one person, or an answer that does not answer the question.",
        },
      },
      dado_pessoal: {
        type: "noul",
        instructions: "Do `pergunta_do_cliente` or `resposta_da_equipe` contain personal data or a private link (customer name tied to their case, e-mail, document number, phone, login link, address)?",
      },
    },
  };
}

export interface TriageVerdict { decisao: TriageDecision; reutilizavel: number; dado_pessoal: number; motivo: string }

/** Política explícita: aprova só com alta probabilidade de reutilizável e baixa de dado pessoal; o meio vai para o time. */
export function triageVerdict(item: KnowledgeItem, resp: { answers?: Record<string, { noul?: number }> } | null): TriageVerdict {
  const curta = String(item.pergunta ?? "").trim().length < 6 || String(item.resposta ?? "").trim().length < 8;
  if (hasHardBlock(item)) return { decisao: "descartar", reutilizavel: 0, dado_pessoal: 1, motivo: "Tem dado pessoal ou link de acesso." };
  if (curta) return { decisao: "descartar", reutilizavel: 0, dado_pessoal: 0, motivo: "Pergunta ou resposta curta demais." };
  const r = Number(resp?.answers?.reutilizavel?.noul ?? 0.5);
  const p = Number(resp?.answers?.dado_pessoal?.noul ?? 0.5);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  if (r >= 0.75 && p < 0.3) return { decisao: "aprovar", reutilizavel: round(r), dado_pessoal: round(p), motivo: "Resposta reutilizável sem dado pessoal." };
  if (r <= 0.25 || p >= 0.7) return { decisao: "descartar", reutilizavel: round(r), dado_pessoal: round(p), motivo: p >= 0.7 ? "Provável dado pessoal." : "Não serve para outros clientes." };
  return { decisao: "revisar", reutilizavel: round(r), dado_pessoal: round(p), motivo: "O Jev ficou em dúvida." };
}
