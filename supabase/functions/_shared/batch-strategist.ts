// Estrategista (OPS1.3): monta a próxima leva de criativos cruzando a biblioteca de ângulos (imphq_copy_library), os
// formatos e ângulos que o mercado roda (referências mineradas e classificadas), o que nós já testamos (placar) e as
// réguas do Método H&W (porta, ponto da rota, carga). Só planeja: quem gera arte é a fábrica, com aprovação.
//
// Composição (maquina-de-testes.md §3.4): com vencedor → 10 variações dos vencedores, 6 ângulos novos, 4 formatos novos;
// sem vencedor → 14 ângulos novos + 6 formatos novos. Tudo proporcional ao tamanho pedido.
import { PORTA_PONTO, PORTAS, type Carga, type Porta, type PontoRota } from "./hw-taxonomy.ts";

export const FORMATO_LABEL: Record<string, string> = {
  estatico: "Estático", carrossel: "Carrossel", print_conversa: "Print de conversa", antes_depois: "Antes e depois",
  depoimento: "Depoimento", ugc_fala: "UGC falando", demonstracao: "Demonstração", narrativa_broll: "Narrativa com b-roll",
  entrevista_podcast: "Entrevista/podcast", produto: "Produto", infografico: "Infográfico", meme: "Meme", outro: "Outro",
};

/** Formatos que viram arte direto na fábrica de imagem; os de vídeo ficam marcados para a fase de vídeo. */
export const FORMATOS_IMAGEM = new Set(["estatico", "carrossel", "print_conversa", "antes_depois", "infografico", "meme", "depoimento"]);

/** Carga sugerida para o primeiro quadro de cada formato (nunca "bloco" no frio). */
export const CARGA_POR_FORMATO: Record<string, Carga> = {
  estatico: "cena_vida", carrossel: "contradicao", print_conversa: "objeto_estranho", antes_depois: "contradicao",
  depoimento: "rosto_emocao", ugc_fala: "rosto_emocao", demonstracao: "objeto_estranho", narrativa_broll: "cena_vida",
  entrevista_podcast: "rosto_emocao", produto: "cena_vida", infografico: "contradicao", meme: "objeto_estranho", outro: "cena_vida",
};

export interface LibraryAngle { id: string; numero: number; nome: string; categoria: string }
export interface MarketRef { id: string; copy_lib_id: string | null; formato: string | null; titulo?: string | null }
export interface TestedAd { copy_lib_id: string | null; formato: string | null; porta: string | null; angulo: string; gasto: number; vendas: number; status: string; avatar_id?: string | null }

export interface LevaItem {
  bloco: "variacao" | "angulo_novo" | "formato_novo";
  copy_lib_id: string | null;
  angulo: string;
  categoria: string | null;
  formato: string;
  formato_label: string;
  porta: Porta;
  ponto_rota: PontoRota;
  carga: Carga;
  precisa_video: boolean;
  referencias: string[];
  hipotese: string;
  motivo: string;
  /** Avatar do elenco que aparece na arte (OPS1.5); null quando o formato não tem rosto ou não há elenco. */
  avatar_id?: string | null;
  avatar_nome?: string | null;
}

export interface LevaInput {
  library: ReadonlyArray<LibraryAngle>;
  market: ReadonlyArray<MarketRef>;
  tested: ReadonlyArray<TestedAd>;
  payout?: number | null;
  tamanho?: number;
  /** Só formatos de imagem (padrão true enquanto a fábrica de vídeo não existe). */
  soImagem?: boolean;
}

export interface LevaPlan { tamanho: number; composicao: Record<LevaItem["bloco"], number>; itens: LevaItem[]; avisos: string[] }

const PORTA_ORDEM: Porta[] = ["voz_dela", "direta", "narrativa", "quebra_crenca", "descoberta"];

/** Vencedor = 3 vendas com CPA dentro do payout (ou, sem payout, 3 vendas). */
export function winners(tested: ReadonlyArray<TestedAd>, payout?: number | null): TestedAd[] {
  return tested
    .filter((t) => t.vendas >= 3 && (!payout || t.gasto / t.vendas <= payout))
    .sort((a, b) => a.gasto / a.vendas - b.gasto / b.vendas);
}

/** Morto = gastou 2× o payout sem vender (ou status "morto"). Ângulo morto não volta como "novo". */
export function deadAngles(tested: ReadonlyArray<TestedAd>, payout?: number | null): Set<string> {
  const out = new Set<string>();
  for (const t of tested) {
    if (!t.copy_lib_id) continue;
    if (t.status === "morto" || (payout && t.vendas === 0 && t.gasto >= 2 * payout)) out.add(t.copy_lib_id);
  }
  // Um ângulo que vendeu em outro anúncio não está morto.
  for (const t of tested) if (t.copy_lib_id && t.vendas > 0) out.delete(t.copy_lib_id);
  return out;
}

function split(total: number, temVencedor: boolean): Record<LevaItem["bloco"], number> {
  if (!temVencedor) { const f = Math.round(total * 0.3); return { variacao: 0, angulo_novo: total - f, formato_novo: f }; }
  const v = Math.round(total * 0.5), f = Math.round(total * 0.2);
  return { variacao: v, angulo_novo: total - v - f, formato_novo: f };
}

export function planLeva(input: LevaInput): LevaPlan {
  const tamanho = Math.max(5, Math.min(40, input.tamanho ?? 20));
  const soImagem = input.soImagem !== false;
  const lib = new Map(input.library.map((l) => [l.id, l]));
  const okFormato = (f: string | null | undefined): f is string => !!f && f !== "outro" && f in FORMATO_LABEL && (!soImagem || FORMATOS_IMAGEM.has(f));
  const avisos: string[] = [];

  const testedAngles = new Set(input.tested.map((t) => t.copy_lib_id).filter(Boolean) as string[]);
  const testedFormats = new Set(input.tested.map((t) => t.formato).filter(Boolean) as string[]);
  const mortos = deadAngles(input.tested, input.payout);
  const top = winners(input.tested, input.payout).slice(0, 3);
  const comp = split(tamanho, top.length > 0);

  // Mercado: quantas referências por ângulo e por formato, e exemplos.
  const marketByAngle = new Map<string, MarketRef[]>();
  const marketByFormat = new Map<string, MarketRef[]>();
  for (const r of input.market) {
    if (r.copy_lib_id) marketByAngle.set(r.copy_lib_id, [...(marketByAngle.get(r.copy_lib_id) ?? []), r]);
    if (okFormato(r.formato)) marketByFormat.set(r.formato, [...(marketByFormat.get(r.formato) ?? []), r]);
  }
  const formatoMaisComum = [...marketByFormat.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? "estatico";
  const formatoDoAngulo = (id: string | null) => {
    const refs = (id && marketByAngle.get(id)) || [];
    const cont = new Map<string, number>();
    for (const r of refs) if (okFormato(r.formato)) cont.set(r.formato, (cont.get(r.formato) ?? 0) + 1);
    return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? formatoMaisComum;
  };

  let portaIdx = 0;
  const nextPorta = () => PORTA_ORDEM[portaIdx++ % PORTA_ORDEM.length];
  const itens: LevaItem[] = [];
  const make = (bloco: LevaItem["bloco"], copyLibId: string | null, anguloNome: string, formato: string, porta: Porta, hipotese: string, motivo: string): LevaItem => ({
    bloco, copy_lib_id: copyLibId, angulo: anguloNome, categoria: copyLibId ? lib.get(copyLibId)?.categoria ?? null : null,
    formato, formato_label: FORMATO_LABEL[formato] ?? formato, porta, ponto_rota: PORTA_PONTO[porta], carga: CARGA_POR_FORMATO[formato] ?? "cena_vida",
    precisa_video: !FORMATOS_IMAGEM.has(formato),
    referencias: [...(copyLibId ? marketByAngle.get(copyLibId) ?? [] : []), ...(marketByFormat.get(formato) ?? [])].map((r) => r.id).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
    hipotese, motivo,
  });

  // 1) Variações dos vencedores: mesmo ângulo, porta e formato diferentes (o gancho muda, o ângulo fica). Cada
  // vencedor percorre porta × formato sem repetir combinação: primeiro as 4 outras portas no formato dele, depois as
  // mesmas portas nos formatos do mercado.
  const formatosDe = (w: TestedAd) => [w.formato, formatoDoAngulo(w.copy_lib_id), ...marketByFormat.keys(), "carrossel", "print_conversa", "estatico"]
    .filter((f, i, a): f is string => okFormato(f) && a.indexOf(f) === i);
  for (let i = 0; i < comp.variacao && top.length; i++) {
    const w = top[i % top.length];
    const k = Math.floor(i / top.length);
    const nome = w.copy_lib_id ? lib.get(w.copy_lib_id)?.nome ?? w.angulo : w.angulo;
    const outras = PORTA_ORDEM.filter((p) => p !== w.porta);
    const porta = outras[k % outras.length];
    const fs = formatosDe(w);
    const formato = fs[Math.floor(k / outras.length) % fs.length] ?? "estatico";
    itens.push(make("variacao", w.copy_lib_id, nome, formato, porta,
      `O ângulo "${nome}" já vendeu ${w.vendas}×; com a porta ${PORTAS[porta]} e o formato ${FORMATO_LABEL[formato] ?? formato}, abre outro público.`,
      `Vencedor: ${w.vendas} vendas a CPA ${(w.gasto / w.vendas).toFixed(2)}`));
  }

  // 2) Ângulos novos: nunca testados e não mortos, priorizando os que o mercado mais roda; espalhados pelas camadas.
  const candidatos = input.library
    .filter((a) => !testedAngles.has(a.id) && !mortos.has(a.id))
    .map((a) => ({ a, mercado: marketByAngle.get(a.id)?.length ?? 0 }))
    .sort((x, y) => y.mercado - x.mercado || x.a.numero - y.a.numero);
  const porCamada = new Map<string, number>();
  const escolhidos: typeof candidatos = [];
  const limiteCamada = Math.max(2, Math.ceil(comp.angulo_novo / 3));
  for (const c of candidatos) {
    if (escolhidos.length >= comp.angulo_novo) break;
    const n = porCamada.get(c.a.categoria) ?? 0;
    if (n >= limiteCamada && candidatos.length - escolhidos.length > comp.angulo_novo) continue;
    porCamada.set(c.a.categoria, n + 1);
    escolhidos.push(c);
  }
  for (const { a, mercado } of escolhidos) {
    const formato = formatoDoAngulo(a.id);
    itens.push(make("angulo_novo", a.id, a.nome, formato, nextPorta(),
      `Ângulo ${a.numero} "${a.nome}" (${a.categoria}) nunca testado; ${mercado ? `${mercado} referência(s) do mercado usam` : "ainda sem referência no mercado"}.`,
      mercado ? `Mercado roda (${mercado})` : "Cobertura da biblioteca"));
  }
  if (escolhidos.length < comp.angulo_novo) avisos.push(`Só ${escolhidos.length} ângulos novos disponíveis (o resto já foi testado ou morreu).`);

  // 3) Formatos novos: primeiro o que o mercado roda e nós nunca testamos; depois formatos de imagem nunca testados
  // (sem prova de mercado, marcados assim). Pula o formato que as variações deste ângulo já cobriram nesta leva.
  const anguloBase = top[0]?.copy_lib_id ?? escolhidos[0]?.a.id ?? null;
  const nomeBase = anguloBase ? lib.get(anguloBase)?.nome ?? "ângulo base" : "ângulo base";
  const jaNaLeva = new Set(itens.filter((i) => i.copy_lib_id === anguloBase).map((i) => i.formato));
  const doMercado = [...marketByFormat.entries()].filter(([f]) => !testedFormats.has(f) && !jaNaLeva.has(f)).sort((a, b) => b[1].length - a[1].length).map(([f]) => f);
  const semProva = [...FORMATOS_IMAGEM].filter((f) => okFormato(f) && !testedFormats.has(f) && !jaNaLeva.has(f) && !doMercado.includes(f));
  const formatosNovos = [...doMercado, ...semProva];
  for (let i = 0; i < comp.formato_novo && formatosNovos.length; i++) {
    const formato = formatosNovos[i % formatosNovos.length];
    const noMercado = marketByFormat.get(formato)?.length ?? 0;
    itens.push(make("formato_novo", anguloBase, nomeBase, formato, nextPorta(),
      noMercado ? `O formato ${FORMATO_LABEL[formato] ?? formato} aparece ${noMercado}× no mercado e nunca foi testado aqui.` : `O formato ${FORMATO_LABEL[formato] ?? formato} nunca foi testado aqui (ainda sem referência no mercado).`,
      noMercado ? "Formato do mercado sem teste" : "Formato sem teste (sem prova de mercado)"));
  }
  if (!doMercado.length && comp.formato_novo) avisos.push("Nenhum formato novo no mercado minerado: os formatos novos desta leva não têm prova de mercado. Cadastre fontes de mineração.");
  if (!input.market.length) avisos.push("Projeto sem referências classificadas: a leva usa só a biblioteca. Cadastre fontes de mineração.");
  else if (input.market.length < 30) avisos.push(`Só ${input.market.length} referências do mercado neste projeto: os ângulos novos vêm mais da biblioteca do que do que o mercado prova. Cadastre fontes de mineração.`);
  if (!soImagem && itens.some((i) => i.precisa_video)) avisos.push("Há itens de vídeo: a fábrica atual gera só imagem.");

  return { tamanho: itens.length, composicao: { variacao: itens.filter((i) => i.bloco === "variacao").length, angulo_novo: itens.filter((i) => i.bloco === "angulo_novo").length, formato_novo: itens.filter((i) => i.bloco === "formato_novo").length }, itens, avisos };
}
