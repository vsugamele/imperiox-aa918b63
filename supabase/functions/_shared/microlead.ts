// Método H&W (MHW1.6): a microlead, a "segunda porta" — uma abertura de 1–2 min (300–400 palavras) encaixada antes da
// lead da VSL, que transforma uma VSL em várias. Sete etapas, teste contra o controle no split de página (FUN1.2).
// TS puro: brief para o redator, checagem do roteiro e pesos do split.

export const ETAPAS_MICROLEAD = [
  { n: 1, nome: "Formato viral", guia: "O formato que está prendendo o nicho agora (programa de TV, aula ao vivo, especialista ranqueando alimentos). Comece por formatos do próprio nicho." },
  { n: 2, nome: "Ângulo", guia: "Mecanismo do problema, da solução, descoberta, contrário ou medo — diferente das outras aberturas no ar." },
  { n: 3, nome: "Avatar", guia: "Quem aparece: o espelho do que ela quer ser, nunca alguém que contradiz a promessa (nada de personal dentro da academia dizendo que não precisa de academia)." },
  { n: 4, nome: "Pré-hook + hook", guia: "5–6 palavras de choque e, logo depois, segmentar: dizer com quem fala e acordar a dor ou a solução." },
  { n: 5, nome: "Campo minado de provas", guia: "Uma prova em cada take: estetoscópio, consultório, diploma, número, depoimento." },
  { n: 6, nome: "Prova demonstrativa", guia: "Mostrar funcionando, sem discussão (duas receitas lado a lado, só uma derrete)." },
  { n: 7, nome: "Transição", guia: "Sem a palavra \"vídeo\": um motivo para continuar (\"nos próximos 5 segundos, uma médica amiga vai te mostrar por que isso acontece\")." },
] as const;

export interface MicroleadBrief {
  produto: string;
  publico: string;
  promessa_vsl: string;
  mecanismo_vsl: string;
  formato_viral?: string | null;
  angulo?: string | null;
  avatar?: string | null;
  aberturas_no_ar?: string[];
}

/** Instrução para o redator (IA ou humano): 7 etapas, 300–400 palavras, roteiro de edição com minutagem. */
export function microleadPrompt(b: MicroleadBrief): string {
  return [
    "Escreva uma MICROLEAD: abertura de 1 a 2 minutos (300 a 400 palavras) que entra ANTES da lead da VSL abaixo.",
    `Produto: ${b.produto}. Público: ${b.publico}.`,
    `A VSL promete: ${b.promessa_vsl}. Mecanismo da VSL: ${b.mecanismo_vsl}.`,
    b.formato_viral ? `Formato viral escolhido: ${b.formato_viral}.` : "Escolha um formato viral do próprio nicho.",
    b.angulo ? `Ângulo: ${b.angulo}.` : "Escolha um ângulo diferente das aberturas que já estão no ar.",
    b.avatar ? `Avatar (quem aparece): ${b.avatar}.` : "Escolha um avatar coerente com a promessa.",
    b.aberturas_no_ar?.length ? `Aberturas já no ar (não repetir): ${b.aberturas_no_ar.join(" | ")}` : "",
    "Siga as 7 etapas, nesta ordem:",
    ...ETAPAS_MICROLEAD.map((e) => `${e.n}. ${e.nome}: ${e.guia}`),
    "Não resuma a VSL: puxe a pessoa para dentro dela. Pode entregar um conteúdo que o público já consome e guardar o último item para o final.",
    "Entregue em duas partes: (A) o texto falado; (B) o roteiro de edição, take por take, com minutagem e a prova que aparece em cada take.",
  ].filter(Boolean).join("\n");
}

export interface MicroleadCheck { palavras: number; ok: boolean; problemas: string[] }

export function checkMicrolead(texto: string): MicroleadCheck {
  const limpo = String(texto ?? "").trim();
  const palavras = limpo ? limpo.split(/\s+/).length : 0;
  const problemas: string[] = [];
  if (palavras < 300) problemas.push(`Curta demais: ${palavras} palavras (mínimo 300).`);
  if (palavras > 400) problemas.push(`Longa demais: ${palavras} palavras (máximo 400).`);
  const paragrafos = limpo.split(/\n\s*\n/).filter(Boolean);
  const ultimo = paragrafos[paragrafos.length - 1] ?? "";
  if (/\bv[ií]deo\b/i.test(ultimo)) problemas.push("A transição usa a palavra \"vídeo\": troque por um motivo para continuar.");
  if (!/\d/.test(limpo)) problemas.push("Nenhum número: prova e especificidade pedem pelo menos um número exato.");
  return { palavras, ok: problemas.length === 0, problemas };
}

export interface SplitWeight { key: string; peso: number; papel: "controle" | "reserva" | "teste" }

/**
 * Pesos do teste de abertura: reservas dividem 17,5%, a microlead nova 10% e o controle fica com o resto (~72%; o
 * material fala em 60–70% com mais reservas). Uma microlead nova por vez. Soma sempre 100.
 */
export function microleadSplit(controle: string, reservas: ReadonlyArray<string>, teste: string | null): { pesos: SplitWeight[]; avisos: string[] } {
  const avisos: string[] = [];
  const pesos: SplitWeight[] = [];
  const reservaTotal = reservas.length ? 17.5 : 0;
  const testeTotal = teste ? 10 : 0;
  for (const r of reservas) pesos.push({ key: r, papel: "reserva", peso: Math.round((reservaTotal / reservas.length) * 10) / 10 });
  if (teste) pesos.push({ key: teste, papel: "teste", peso: testeTotal });
  const resto = Math.round((100 - pesos.reduce((s, p) => s + p.peso, 0)) * 10) / 10;
  pesos.unshift({ key: controle, papel: "controle", peso: resto });
  if (!teste) avisos.push("Sem microlead nova em teste.");
  avisos.push("Deixe rodar 3 a 4 dias; não troque headline nem autoplay junto; decide pela venda (apoio: retenção no 1º minuto ≥ 58–60%).");
  return { pesos, avisos };
}
