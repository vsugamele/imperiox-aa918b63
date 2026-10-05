// Variações de um criativo vencedor (TST1.2, fábrica de criativos): eixos da Esteira P2, prompt da copy,
// validação da copy devolvida pelo modelo e a instrução para recriar a arte a partir da peça base.
// TS puro: creative-factory (action "variations"), project-mcp e testes usam a mesma regra.

export type VariationAxis = "avatar" | "headline" | "gancho" | "publico";

/** Eixos de variação de uma hipótese confirmada (Esteira: avatar → headline → hook empilhado → fatia de público). */
export const VARIATION_AXES: Record<VariationAxis, { label: string; instrucao: string }> = {
  avatar: { label: "Avatar", instrucao: "Mesma promessa, falando com outro tipo de pessoa dentro do público (ex.: iniciante, profissional experiente, dona de salão, autônoma)." },
  headline: { label: "Headline", instrucao: "Mesmo ângulo e mesma pessoa, com outra headline: outra palavra de impacto, outra estrutura (pergunta, afirmação, número, contraste)." },
  gancho: { label: "Gancho empilhado", instrucao: "Empilhe dois ganchos: a dor do ângulo + uma consequência concreta ou um resultado (ex.: medo de errar + cliente que não volta)." },
  publico: { label: "Fatia de público", instrucao: "Recorte uma fatia específica do público e nomeie na headline (ex.: só crespos, quem atende em casa, quem cobra pouco)." },
};

export const AXIS_ORDER: VariationAxis[] = ["headline", "avatar", "gancho", "publico"];

export interface VariationRequest {
  angulo: string;
  hipotese?: string | null;
  oferta: string;
  publico?: string | null;
  marca_topo?: string | null;   // texto fixo no topo da arte (ex.: "O CÓDIGO DOS CORTES PERFEITOS")
  texto_base?: string | null;   // copy do anúncio vencedor
  quantidade: number;
  eixos?: VariationAxis[];
}

/** Eixo de cada variação: os pedidos, ou a ordem padrão repetindo até a quantidade. */
export function planAxes(req: Pick<VariationRequest, "quantidade" | "eixos">): VariationAxis[] {
  const n = Math.max(1, Math.min(6, Math.floor(req.quantidade || 1)));
  const pool = req.eixos?.length ? req.eixos.filter((e): e is VariationAxis => e in VARIATION_AXES) : AXIS_ORDER;
  const base = pool.length ? pool : AXIS_ORDER;
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

export interface VariationCopy {
  headline_arte: string;     // texto grande na arte (até 7 palavras)
  subtitulo_arte: string;    // linha de apoio na arte (até 22 palavras)
  cta_arte: string;          // texto do botão na arte (até 4 palavras)
  texto_anuncio: string;     // primary text
  headline_anuncio: string;  // headline do anúncio (abaixo da imagem)
}

export function copyPrompt(req: VariationRequest, axis: VariationAxis, jaUsadas: string[] = []): { system: string; user: string } {
  return {
    system: [
      "Você é copywriter de resposta direta no Brasil, escrevendo criativos de Meta Ads.",
      "Responda SÓ JSON: {\"headline_arte\":string,\"subtitulo_arte\":string,\"cta_arte\":string,\"texto_anuncio\":string,\"headline_anuncio\":string}.",
      "headline_arte: até 7 palavras, forte, sem ponto final. subtitulo_arte: até 22 palavras. cta_arte: até 4 palavras.",
      "texto_anuncio: 2 a 4 parágrafos curtos, português natural, sem promessa de resultado garantido, sem travessão longo, termina com a oferta.",
      "Nada de marca de terceiros, nada de promessa médica ou financeira garantida.",
    ].join(" "),
    user: [
      `Oferta: ${req.oferta}`,
      req.publico ? `Público: ${req.publico}` : null,
      `Ângulo vencedor: ${req.angulo}`,
      req.hipotese ? `Hipótese confirmada: ${req.hipotese}` : null,
      req.texto_base ? `Copy do anúncio vencedor (referência de tom):\n${req.texto_base}` : null,
      `Eixo desta variação: ${VARIATION_AXES[axis].label}. ${VARIATION_AXES[axis].instrucao}`,
      jaUsadas.length ? `Não repita estas headlines: ${jaUsadas.join(" | ")}` : null,
    ].filter(Boolean).join("\n"),
  };
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Valida a copy do modelo; devolve null se faltar campo ou passar dos limites. */
export function parseCopy(raw: unknown): VariationCopy | null {
  let o: Record<string, unknown>;
  try {
    o = typeof raw === "string" ? JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const copy: VariationCopy = {
    headline_arte: str(o.headline_arte).replace(/[.]+$/, ""),
    subtitulo_arte: str(o.subtitulo_arte),
    cta_arte: str(o.cta_arte),
    texto_anuncio: str(o.texto_anuncio),
    headline_anuncio: str(o.headline_anuncio),
  };
  if (Object.values(copy).some((v) => !v)) return null;
  if (words(copy.headline_arte) > 7 || words(copy.subtitulo_arte) > 22 || words(copy.cta_arte) > 4) return null;
  return copy;
}

/** Instrução para o modelo de imagem recriar a peça base com a copy nova. */
export function imageInstruction(req: Pick<VariationRequest, "marca_topo">, copy: VariationCopy, formato = "4:5"): string {
  return [
    `Recrie este anúncio no formato ${formato}, mantendo a MESMA pessoa (rosto, cabelo, roupa), a mesma paleta, iluminação, fundo e estilo tipográfico da peça de referência.`,
    "Mude a pose ou o enquadramento só levemente. Não deforme rosto nem mãos.",
    req.marca_topo ? `Mantenha no topo, pequeno: "${req.marca_topo}".` : null,
    `Headline grande (em destaque, mesma fonte condensada): "${copy.headline_arte.toUpperCase()}".`,
    `Texto de apoio menor: "${copy.subtitulo_arte}".`,
    `Botão: "${copy.cta_arte}".`,
    "Todo texto em português do Brasil, exatamente como escrito, sem letras trocadas e sem texto extra.",
  ].filter(Boolean).join("\n");
}
