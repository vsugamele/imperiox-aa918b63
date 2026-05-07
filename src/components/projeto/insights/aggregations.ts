// Pure aggregation helpers for Insights (audience + ads).
// Keep ZERO React deps so they can be reused inside hooks/components.

const NAMES_M = new Set([
  "joao","jose","carlos","paulo","pedro","lucas","luiz","marcos","luis","gabriel","rafael","daniel",
  "marcelo","bruno","eduardo","felipe","raimundo","rodrigo","manoel","thiago","tiago","francisco",
  "andre","leonardo","mateus","matheus","guilherme","caio","vitor","victor","diego","fabio","gustavo",
  "renato","ricardo","anderson","alex","alexandre","alessandro","sergio","wesley","wellington","leandro",
  "antonio","roberto","robson","ronaldo","douglas","henrique","igor","ivan","jorge","julio",
  "miguel","murilo","nicolas","otavio","raul","samuel","yuri","arthur","artur","benjamin","bernardo",
  "davi","davidson","emanuel","enzo","heitor","ian","kaique","kaio","levi","noah","ravi","theo","valentim",
  "vinicius","wagner","wallace","william","willian","yan","yago",
]);
const NAMES_F = new Set([
  "maria","ana","francisca","antonia","adriana","juliana","marcia","fernanda","patricia","aline",
  "sandra","camila","amanda","bruna","jessica","leticia","julia","luciana","marcela","marina",
  "natalia","priscila","raquel","renata","sabrina","sara","sarah","simone","tatiana","valeria","vanessa",
  "vera","viviane","alessandra","alice","aliny","alicia","amelia","andrea","angela","beatriz","bianca",
  "carla","carolina","cibele","clara","claudia","cristiane","cristina","daniela","debora","elaine",
  "eliana","elis","elisa","elisangela","emanuela","erika","erica","esther","eva","fabiana","flavia",
  "gabriela","helena","heloisa","iara","ingrid","isabela","isabella","isadora","jaqueline","joana",
  "katia","larissa","laura","lavinia","lais","lara","liliane","livia","luana","lucia","luiza","manuela",
  "margarida","mariana","marta","mayara","melissa","milena","miriam","monica","nadia","nayara","nicole",
  "olivia","paloma","pamela","pietra","poliana","rafaela","regina","roberta","rosana","rose","silvana",
  "silvia","sofia","sonia","stella","suelen","susana","tainara","talita","tamara","tania","thais","valentina",
  "vitoria","yasmin","yara","zilda",
]);

// Sufixos típicos do português brasileiro — heurística secundária quando o nome
// não está nas listas curadas. Ordem importa: testar os mais específicos antes.
const SUFFIX_F = ["ana","ina","ena","una","lia","cia","sia","nia","ria","tha","sha","elle","ette","ize","yse","aly","elly","essa","issa","ussa","ynne","yara","aira","eira"];
const SUFFIX_M = ["son","ton","sson","aldo","ardo","erto","esto","aldo","ilton","ilson","ovan","evin","oan","luiz","luis"];

export function inferGender(nome?: string | null): "M" | "F" | null {
  if (!nome) return null;
  const first = nome.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!first || first.length < 2) return null;
  if (NAMES_M.has(first)) return "M";
  if (NAMES_F.has(first)) return "F";
  // Sufixos compostos (mais específicos primeiro)
  for (const s of SUFFIX_F) if (first.endsWith(s)) return "F";
  for (const s of SUFFIX_M) if (first.endsWith(s)) return "M";
  // Terminações simples — PT-BR
  const last = first.slice(-1);
  const last2 = first.slice(-2);
  if (last === "a" && last2 !== "ca" /* ex: Luca */) return "F";
  if (last === "e" && (last2 === "te" || last2 === "ne" || last2 === "le")) return "F";
  if (["o","r","l","z","m","n","i","u","y"].includes(last)) return "M";
  return null;
}

export function calcAge(birth?: string): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

export const DDD_UF: Record<string, string> = {
  "11":"SP","12":"SP","13":"SP","14":"SP","15":"SP","16":"SP","17":"SP","18":"SP","19":"SP",
  "21":"RJ","22":"RJ","24":"RJ","27":"ES","28":"ES",
  "31":"MG","32":"MG","33":"MG","34":"MG","35":"MG","37":"MG","38":"MG",
  "41":"PR","42":"PR","43":"PR","44":"PR","45":"PR","46":"PR",
  "47":"SC","48":"SC","49":"SC","51":"RS","53":"RS","54":"RS","55":"RS",
  "61":"DF","62":"GO","64":"GO","63":"TO","65":"MT","66":"MT","67":"MS",
  "68":"AC","69":"RO","71":"BA","73":"BA","74":"BA","75":"BA","77":"BA","79":"SE",
  "81":"PE","87":"PE","82":"AL","83":"PB","84":"RN","85":"CE","88":"CE","86":"PI","89":"PI",
  "91":"PA","93":"PA","94":"PA","92":"AM","97":"AM","95":"RR","96":"AP","98":"MA","99":"MA",
};

export const UF_REGION_EMOJI: Record<string, string> = {
  SP:"🏙️", RJ:"🏖️", MG:"⛰️", ES:"🌊", PR:"🌲", SC:"❄️", RS:"🐎",
  BA:"🌴", PE:"🥥", CE:"☀️", RN:"🦞", PB:"🌅", AL:"🦀", SE:"🐚", PI:"🌵", MA:"🦜",
  GO:"🌾", DF:"🏛️", MT:"🐂", MS:"🌿", TO:"🌅",
  AM:"🌳", PA:"🐟", AC:"🌴", RO:"🦋", RR:"🌄", AP:"🛶",
};

export const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface AudienceRow {
  ts: string;
  valor?: number;
  lead?: any;
  produto?: string | null;
}

export interface AdsRow {
  data_ref: string; campanha: string | null; valor: number;
  impressoes: number; alcance: number; link_clicks: number; cliques: number;
  landing_page_views: number; add_to_cart: number; init_checkout: number;
  checkouts_iniciados: number; compras: number; resultados: number;
  hook_rate: number | null; hold_rate: number | null; ctr: number | null;
  cpm: number | null; frequencia: number | null;
}

export function aggregateAudience(rows: AudienceRow[]) {
  const hourly = new Array(24).fill(0);
  const hourlyValor = new Array(24).fill(0);
  const weekday = new Array(7).fill(0);
  const weekdayValor = new Array(7).fill(0);
  const gender = { M: 0, F: 0, U: 0 };
  const ufCount: Record<string, number> = {};
  const ageBuckets: Record<string, number> = { "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "?": 0 };
  let totalValor = 0;
  const productCount: Record<string, { count: number; valor: number }> = {};

  rows.forEach(r => {
    const d = new Date(r.ts);
    const local = new Date(d.getTime() - 3 * 3600000);
    const h = local.getUTCHours();
    const w = local.getUTCDay();
    hourly[h]++;
    weekday[w]++;
    if (r.valor) {
      hourlyValor[h] += r.valor;
      weekdayValor[w] += r.valor;
      totalValor += r.valor;
    }
    if (r.produto) {
      const p = productCount[r.produto] || { count: 0, valor: 0 };
      p.count++;
      p.valor += r.valor || 0;
      productCount[r.produto] = p;
    }
    const lead = r.lead;
    const g = lead?.genero || inferGender(lead?.nome);
    if (g === "M") gender.M++;
    else if (g === "F") gender.F++;
    else gender.U++;

    const phone = (lead?.phone || "").replace(/\D/g, "");
    const ddd = phone.startsWith("55") ? phone.slice(2, 4) : phone.slice(0, 2);
    const uf = DDD_UF[ddd];
    if (uf) ufCount[uf] = (ufCount[uf] || 0) + 1;

    const idade = lead?.data?.idade || calcAge(lead?.data?.aniversario || lead?.data?.nascimento);
    if (idade) {
      if (idade < 25) ageBuckets["18-24"]++;
      else if (idade < 35) ageBuckets["25-34"]++;
      else if (idade < 45) ageBuckets["35-44"]++;
      else if (idade < 55) ageBuckets["45-54"]++;
      else ageBuckets["55+"]++;
    } else {
      ageBuckets["?"]++;
    }
  });

  const hourRanking = hourly.map((v, h) => ({ h, v })).sort((a, b) => b.v - a.v).slice(0, 5).filter(x => x.v > 0);
  const peakHour = hourRanking[0]?.h ?? 0;
  const peakDay = weekday.indexOf(Math.max(...weekday));
  const totalGender = Math.max(1, gender.M + gender.F + gender.U);
  const topUFs = Object.entries(ufCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const totalRecords = rows.length;
  const valoredCount = rows.filter(r => r.valor).length;
  const ticketMedio = valoredCount > 0 ? totalValor / valoredCount : 0;
  const topProducts = Object.entries(productCount)
    .map(([nome, v]) => ({ nome, count: v.count, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor || b.count - a.count)
    .slice(0, 8);

  return {
    hourly, hourlyValor, weekday, weekdayValor, gender, ufCount, ageBuckets,
    peakHour, peakDay, totalGender, topUFs, totalValor, ticketMedio,
    hourRanking, totalRecords, topProducts,
  };
}

export function aggregateAds(adsRows: AdsRow[]) {
  const init = {
    spend: 0, impressoes: 0, alcance: 0, link_clicks: 0, cliques: 0,
    lp_views: 0, atc: 0, ic: 0, compras: 0,
    hook_sum: 0, hook_n: 0, hold_sum: 0, hold_n: 0,
    ctr_sum: 0, ctr_n: 0, cpm_sum: 0, cpm_n: 0,
    freq_sum: 0, freq_n: 0,
  };
  adsRows.forEach(r => {
    init.spend += r.valor;
    init.impressoes += r.impressoes;
    init.alcance += r.alcance;
    init.link_clicks += r.link_clicks;
    init.cliques += r.cliques;
    init.lp_views += r.landing_page_views;
    init.atc += r.add_to_cart;
    init.ic += (r.init_checkout || r.checkouts_iniciados || 0);
    init.compras += r.compras;
    if (r.hook_rate != null) { init.hook_sum += Number(r.hook_rate); init.hook_n++; }
    if (r.hold_rate != null) { init.hold_sum += Number(r.hold_rate); init.hold_n++; }
    if (r.ctr != null) { init.ctr_sum += Number(r.ctr); init.ctr_n++; }
    if (r.cpm != null) { init.cpm_sum += Number(r.cpm); init.cpm_n++; }
    if (r.frequencia != null) { init.freq_sum += Number(r.frequencia); init.freq_n++; }
  });
  const linkClicks = init.link_clicks || init.cliques;
  const hook = init.hook_n ? init.hook_sum / init.hook_n : 0;
  const hold = init.hold_n ? init.hold_sum / init.hold_n : 0;
  const ctr = init.ctr_n ? init.ctr_sum / init.ctr_n : 0;
  const cpm = init.cpm_n ? init.cpm_sum / init.cpm_n : 0;
  const freq = init.freq_n ? init.freq_sum / init.freq_n : 0;
  const clickToLpRatio = init.lp_views > 0 ? linkClicks / init.lp_views : 0;
  const lpDropPct = linkClicks > 0 ? Math.max(0, ((linkClicks - init.lp_views) / linkClicks) * 100) : 0;

  return { ...init, linkClicks, hook, hold, ctr, cpm, freq, clickToLpRatio, lpDropPct };
}

export function buildFunnel(agg: ReturnType<typeof aggregateAds>) {
  const steps = [
    { key: "imp", label: "Impressões", icon: "👁️", value: agg.impressoes },
    { key: "clk", label: "Cliques", icon: "🖱️", value: agg.linkClicks },
    { key: "lp",  label: "Visitas LP", icon: "🌐", value: agg.lp_views },
    { key: "atc", label: "Add to Cart", icon: "🛒", value: agg.atc },
    { key: "ic",  label: "Checkout", icon: "💳", value: agg.ic },
    { key: "buy", label: "Compras", icon: "✅", value: agg.compras },
  ];
  return steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1].value : null;
    const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
    const drop = conv != null ? 100 - conv : null;
    const fromImpressions = agg.impressoes > 0 ? (s.value / agg.impressoes) * 100 : null;
    const costPerEvent = s.value > 0 ? agg.spend / s.value : null;
    return { ...s, conv, drop, fromImpressions, costPerEvent };
  });
}

export type Diagnostic = { severity: "danger" | "warn" | "ok"; title: string; detail: string };

export function buildDiagnostics(agg: ReturnType<typeof aggregateAds>, hasRows: boolean): Diagnostic[] {
  const items: Diagnostic[] = [];
  if (!hasRows) return items;
  if (agg.hook && agg.hook < 25) {
    items.push({ severity: "warn", title: "Hook fraco", detail: `Hook rate em ${agg.hook.toFixed(1)}% — criativo não prende atenção nos primeiros 3s.` });
  }
  if (agg.linkClicks > 0 && agg.lp_views > 0 && agg.lp_views < agg.linkClicks * 0.7) {
    items.push({
      severity: "danger",
      title: "⚠️ Possível lentidão na LP",
      detail: `${agg.lpDropPct.toFixed(0)}% dos cliques nunca chegam à LP (${agg.linkClicks.toLocaleString()} cliques → ${agg.lp_views.toLocaleString()} views). Audite velocidade/redirects.`,
    });
  }
  if (agg.lp_views > 50 && agg.ic > 0 && (agg.ic / agg.lp_views) < 0.05) {
    items.push({ severity: "warn", title: "LP não converte", detail: `Apenas ${((agg.ic / agg.lp_views) * 100).toFixed(1)}% das visitas iniciam checkout. Copy/oferta da LP precisa de revisão.` });
  }
  if (agg.compras > 0 && agg.ic > agg.compras * 3) {
    items.push({ severity: "warn", title: "Checkout abandonado", detail: `${agg.ic.toLocaleString()} checkouts iniciados vs ${agg.compras.toLocaleString()} compras — fricção no checkout.` });
  }
  if (agg.freq && agg.freq > 4) {
    items.push({ severity: "warn", title: "Audiência saturada", detail: `Frequência média ${agg.freq.toFixed(2)} — público está vendo o mesmo anúncio várias vezes.` });
  }
  if (!items.length && agg.impressoes > 0) {
    items.push({ severity: "ok", title: "Sem gargalos críticos", detail: "Funil dentro de parâmetros saudáveis no período." });
  }
  return items;
}

export function semaforo(metric: "hook" | "hold" | "ctr" | "freq", v: number): "ok" | "warn" | "bad" {
  if (metric === "hook") return v >= 35 ? "ok" : v >= 25 ? "warn" : "bad";
  if (metric === "hold") return v >= 20 ? "ok" : v >= 12 ? "warn" : "bad";
  if (metric === "ctr") return v >= 1.5 ? "ok" : v >= 0.8 ? "warn" : "bad";
  if (metric === "freq") return v <= 2 ? "ok" : v <= 4 ? "warn" : "bad";
  return "ok";
}

export const semaforoBenchmark = {
  hook: "Bom ≥35% · Atenção 25–35% · Ruim <25%",
  hold: "Bom ≥20% · Atenção 12–20% · Ruim <12%",
  ctr: "Bom ≥1.5% · Atenção 0.8–1.5% · Ruim <0.8%",
  freq: "Bom ≤2 · Atenção 2–4 · Ruim >4",
};

export const semColor = (s: "ok" | "warn" | "bad") =>
  s === "ok" ? "text-emerald-400" : s === "warn" ? "text-amber-400" : "text-red-400";

export const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtNum = (v: number) => v.toLocaleString("pt-BR");
