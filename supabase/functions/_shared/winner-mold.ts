// Método H&W (MHW1.5): o Molde Vencedor. Um criativo que validou (3 vendas) vira molde: V00 desmonta (script palavra
// por palavra, quem fala, onde, tom visual) e a fila V01–V05 gera variações mudando UMA dimensão visual por vez, com o
// script travado. A produção anda em ondas (o V01 de todos os campeões, depois o V02 de todos). TS puro.

export type Dimensao = "quem_fala" | "onde" | "tom_visual" | "pessoa_cenario";
export type Variacao = "V00" | "V01" | "V02" | "V03" | "V04" | "V05";

export interface MoldV00 {
  script: string;
  quem_fala: string;
  onde: string;
  tom_visual: string;
  formato: "imagem" | "video";
  campeao_id: string;
  campeao_nome?: string | null;
}

export const FILA: ReadonlyArray<{ variacao: Exclude<Variacao, "V00">; dimensao: Dimensao; regra: string }> = [
  { variacao: "V01", dimensao: "quem_fala", regra: "Outra pessoa do MESMO tipo (outra médica de jaleco, outra vizinha na cozinha): rosto novo, mesma credibilidade." },
  { variacao: "V02", dimensao: "quem_fala", regra: "Pessoa do tipo OPOSTO (médica ↔ vizinha, nutricionista jovem ↔ apresentadora): mesma frase, outra relação com quem assiste." },
  { variacao: "V03", dimensao: "onde", regra: "Mesma pessoa do original em OUTRO cenário (cozinha, consultório, carro, sala)." },
  { variacao: "V04", dimensao: "pessoa_cenario", regra: "Pessoa E cenário opostos juntos — só depois de ler V01 a V03." },
  { variacao: "V05", dimensao: "tom_visual", regra: "Só luz e cor (mais quente, outro contraste) — segundo ciclo, quando o campeão volta a cansar." },
];

export type VariationStatus = "no_ar" | "vendeu" | "morreu";

export interface ChampionState {
  campeao_id: string;
  /** Variações já produzidas e o que aconteceu com cada uma. */
  feitas: Partial<Record<Exclude<Variacao, "V00">, VariationStatus>>;
  tem_v00: boolean;
}

/** Próxima variação permitida para um campeão, respeitando a ordem e as travas (V04 depois de ler V01–V03). */
export function nextVariation(c: ChampionState): Exclude<Variacao, "V00"> | "V00" | null {
  if (!c.tem_v00) return "V00";
  for (const f of FILA) {
    if (c.feitas[f.variacao]) continue;
    if (f.variacao === "V04" && (["V01", "V02", "V03"] as const).some((v) => !c.feitas[v] || c.feitas[v] === "no_ar")) return null;
    if (f.variacao === "V05" && (!c.feitas.V04 || c.feitas.V04 === "no_ar")) return null;
    return f.variacao;
  }
  return null;
}

export interface WavePlan { onda: Variacao | null; itens: Array<{ campeao_id: string; variacao: Variacao }>; aguardando: string[] }

/**
 * Produção em ondas: a onda é a MENOR variação que algum campeão ainda pode fazer; entram todos os campeões que podem
 * fazer exatamente essa. Quem está travado (esperando leitura) aparece em `aguardando`.
 */
export function nextWave(champions: ReadonlyArray<ChampionState>): WavePlan {
  const order: Variacao[] = ["V00", "V01", "V02", "V03", "V04", "V05"];
  const next = champions.map((c) => ({ id: c.campeao_id, v: nextVariation(c) }));
  const possible = next.filter((x) => x.v !== null).map((x) => x.v as Variacao);
  if (!possible.length) return { onda: null, itens: [], aguardando: next.map((x) => x.id) };
  const onda = order.find((v) => possible.includes(v)) ?? null;
  return {
    onda,
    itens: next.filter((x) => x.v === onda).map((x) => ({ campeao_id: x.id, variacao: onda as Variacao })),
    aguardando: next.filter((x) => x.v === null).map((x) => x.id),
  };
}

/** Brief da variação para a Fábrica: script travado, uma dimensão solta. */
export function variationBrief(m: MoldV00, variacao: Exclude<Variacao, "V00">): { variacao: Variacao; dimensao: Dimensao; manter: Record<string, string>; mudar: string; prompt: string } {
  const f = FILA.find((x) => x.variacao === variacao)!;
  const manter: Record<string, string> = { script: m.script };
  if (f.dimensao !== "quem_fala" && f.dimensao !== "pessoa_cenario") manter.quem_fala = m.quem_fala;
  if (f.dimensao !== "onde" && f.dimensao !== "pessoa_cenario") manter.onde = m.onde;
  if (f.dimensao !== "tom_visual") manter.tom_visual = m.tom_visual;
  const prompt = [
    `Variação ${variacao} do campeão ${m.campeao_nome ?? m.campeao_id} (${m.formato}).`,
    `MUDAR só isto: ${f.regra}`,
    `Original — quem fala: ${m.quem_fala}; onde: ${m.onde}; tom visual: ${m.tom_visual}.`,
    `MANTER idêntico: ${Object.keys(manter).filter((k) => k !== "script").join(", ") || "—"}.`,
    "COPY TRAVADA: usar o script abaixo palavra por palavra (hook, aterrissagem, história e CTA). Não reescrever nada.",
    "Os primeiros segundos precisam parecer outra peça (rosto/cenário novos); música, legenda ou corte no fim NÃO contam como variação.",
    `SCRIPT:\n${m.script}`,
  ].join("\n");
  return { variacao, dimensao: f.dimensao, manter, mudar: f.regra, prompt };
}

/** Mudanças que o Meta enxerga como o mesmo anúncio (não são variação de verdade). */
export function isCosmeticOnly(mudancas: ReadonlyArray<string>): boolean {
  const cosmeticas = /^(m[uú]sica|legenda|corte|trilha|fonte|cta final|music|caption|trim)/i;
  return mudancas.length > 0 && mudancas.every((m) => cosmeticas.test(m.trim()));
}
