// Método H&W (MHW1.3): o painel vira diagnóstico. Calcula hook rate, hold rate, CTR, CPC, connect rate e IC por
// anúncio a partir de imphq_ads_spend e diz QUAL estágio falhou (carga, pouso, porta, página, checkout) e o que trocar,
// em vez de só "pausar". TS puro. Faixas ilustrativas: sempre comparar com os pares da mesma oferta.

export interface TelemetryRow {
  valor?: number | string | null;
  impressoes?: number | string | null;
  video_3s_views?: number | string | null;
  video_thruplay?: number | string | null;
  link_clicks?: number | string | null;
  cliques?: number | string | null;
  landing_page_views?: number | string | null;
  init_checkout?: number | string | null;
}

export interface Telemetry {
  gasto: number; impressoes: number; cliques: number; lpv: number; ic: number; vendas: number;
  hook_rate: number | null; hold_rate: number | null; ctr: number | null; cpc: number | null;
  connect_rate: number | null; ic_por_visita: number | null; cpa: number | null; video: boolean;
}

const n = (v: unknown) => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? x : 0; };
const ratio = (a: number, b: number, min = 1) => (b >= min ? Math.round((a / b) * 10000) / 10000 : null);

/** Soma as linhas de um anúncio e calcula as métricas. `vendas` = vendas reais do checkout (não o pixel). */
export function telemetryOf(rows: ReadonlyArray<TelemetryRow>, vendas = 0): Telemetry {
  const s = (k: keyof TelemetryRow) => rows.reduce((acc, r) => acc + n(r[k]), 0);
  const gasto = Math.round(s("valor") * 100) / 100;
  const impressoes = s("impressoes");
  const v3 = s("video_3s_views");
  const thru = s("video_thruplay");
  const cliques = s("link_clicks") || s("cliques");
  const lpv = s("landing_page_views");
  const ic = s("init_checkout");
  return {
    gasto, impressoes, cliques, lpv, ic, vendas,
    hook_rate: v3 > 0 ? ratio(v3, impressoes, 100) : null,
    hold_rate: v3 > 0 ? ratio(thru, v3, 20) : null,
    ctr: ratio(cliques, impressoes, 100),
    cpc: cliques > 0 ? Math.round((gasto / cliques) * 100) / 100 : null,
    connect_rate: ratio(lpv, cliques, 10),
    ic_por_visita: ratio(ic, lpv, 10),
    cpa: vendas > 0 ? Math.round((gasto / vendas) * 100) / 100 : null,
    video: v3 > 0,
  };
}

export type Estagio = "carga" | "pouso" | "porta" | "pagina" | "checkout" | "volume";
export interface Diagnostico { estagio: Estagio; sinal: string; leitura: string; correcao: string; gravidade: 1 | 2 | 3 }

export const HOOK_BLOCO = 0.2;
export const HOOK_CARRO = 0.3;
export const CONNECT_MIN = 0.6;
export const MIN_IMPRESSOES = 1000;

export function median(xs: ReadonlyArray<number | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface Peers { ctr: number | null; cpc: number | null; hold_rate: number | null }

export function peersOf(all: ReadonlyArray<Telemetry>): Peers {
  const ok = all.filter((t) => t.impressoes >= MIN_IMPRESSOES);
  return { ctr: median(ok.map((t) => t.ctr)), cpc: median(ok.map((t) => t.cpc)), hold_rate: median(ok.map((t) => t.hold_rate)) };
}

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

/**
 * Diagnóstico por estágio, na ordem do caminho (feed → clique → página → checkout). Só fala com volume mínimo
 * (1.000 impressões); antes disso devolve "volume". A comparação com os pares (mediana da oferta) evita julgar por faixa
 * de outro nicho.
 */
export function diagnose(t: Telemetry, peers: Peers): Diagnostico[] {
  if (t.impressoes < MIN_IMPRESSOES) {
    return [{ estagio: "volume", gravidade: 1, sinal: `${t.impressoes} impressões`, leitura: "Ainda sem volume para ler.", correcao: "Esperar 1.000 impressões (e 48h) antes de mexer." }];
  }
  const out: Diagnostico[] = [];
  if (t.video && t.hook_rate !== null) {
    if (t.hook_rate < HOOK_BLOCO) out.push({ estagio: "carga", gravidade: 3, sinal: `hook rate ${pct(t.hook_rate)}`, leitura: "Bloco de concreto: o dedo passa direto pelo primeiro segundo.", correcao: "Trocar a carga do primeiro quadro (objeto estranho, rosto com emoção, cena da vida dela ou contradição)." });
    else if (t.hook_rate < HOOK_CARRO) out.push({ estagio: "carga", gravidade: 2, sinal: `hook rate ${pct(t.hook_rate)}`, leitura: "Para alguns, mas não segura o feed.", correcao: "Testar outra das quatro cargas no primeiro quadro." });
    if (t.hook_rate >= HOOK_BLOCO && t.hold_rate !== null && peers.hold_rate !== null && t.hold_rate < 0.7 * peers.hold_rate) {
      out.push({ estagio: "pouso", gravidade: 2, sinal: `hold ${pct(t.hold_rate)} (pares ${pct(peers.hold_rate)})`, leitura: "Ela parou e caiu fora na segunda frase: a carga prometeu uma coisa e o anúncio entregou outra.", correcao: "Ajustar a aterrissagem: promessa para ela, número exato, ponte com a imagem." });
    }
  }
  if (t.ctr !== null && peers.ctr !== null && t.cpc !== null && peers.cpc !== null && t.ctr < 0.7 * peers.ctr && t.cpc > 1.3 * peers.cpc) {
    out.push({ estagio: "porta", gravidade: 2, sinal: `CTR ${pct(t.ctr)} e CPC ${t.cpc.toFixed(2)} (pares ${pct(peers.ctr)} / ${peers.cpc.toFixed(2)})`, leitura: "Criativo de ponto 5 (oferta/produto) no tráfego frio.", correcao: "Subir um criativo de ponto 1 ou 2: história, descoberta, dor ou a voz dela." });
  }
  if (t.connect_rate !== null && t.connect_rate < CONNECT_MIN) {
    out.push({ estagio: "pagina", gravidade: 2, sinal: `connect rate ${pct(t.connect_rate)}`, leitura: "A porta emperrou: muita gente clica e não vê a página carregar (página lenta, clique acidental ou pixel que carrega tarde).", correcao: "Conferir velocidade da página e se o pixel dispara logo na abertura." });
  }
  if (t.ctr !== null && peers.ctr !== null && t.ctr >= peers.ctr && t.lpv >= 50 && t.ic === 0 && t.vendas === 0) {
    out.push({ estagio: "pagina", gravidade: 2, sinal: `CTR ${pct(t.ctr)} e ${t.lpv} visitas sem IC`, leitura: "Desvio de rota: o anúncio promete algo que a primeira tela da página não continua.", correcao: "Fazer a primeira frase da página continuar a primeira frase do anúncio, ou alinhar o anúncio ao mecanismo." });
  }
  if (t.ic >= 3 && t.vendas === 0) {
    out.push({ estagio: "checkout", gravidade: 2, sinal: `${t.ic} checkouts iniciados, 0 vendas`, leitura: "A pessoa vai ao caixa e não paga.", correcao: "Olhar o checkout: preço, meios de pagamento, erros, oferta." });
  }
  return out.sort((a, b) => b.gravidade - a.gravidade);
}

/** Uma linha para relatório: o diagnóstico mais grave, ou nada. */
export function diagnosisLine(d: ReadonlyArray<Diagnostico>): string {
  const top = d.find((x) => x.estagio !== "volume");
  return top ? `${top.leitura} → ${top.correcao}` : "";
}
