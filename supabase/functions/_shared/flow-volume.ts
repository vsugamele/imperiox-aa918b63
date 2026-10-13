// Volume real que passa por cada etapa do mapa (últimos 7 dias) e como isso vira movimento nas setas (UX1.4).
// TS puro. Cada etapa usa a métrica que faz sentido para ela; etapa sem métrica ou sem dado fica parada.

export type FlowMetric = "sessoes" | "conversas" | "vendas" | "leads";

export const FLOW_METRIC_LABEL: Record<FlowMetric, string> = {
  sessoes: "sessões",
  conversas: "conversas",
  vendas: "vendas",
  leads: "leads",
};

const PAGE_KINDS = new Set(["pagina_vendas", "advertorial", "quiz", "vsl", "captura", "webinar", "replay", "blog", "obrigado", "presell", "landing"]);
const SALE_KINDS = new Set(["checkout", "compra", "upsell", "downsell", "orderbump"]);
const CONVERSATION_KINDS = new Set(["whatsapp", "dm_instagram", "whatsapp_sequencia"]);
const LEAD_KINDS = new Set(["lead", "captura"]);

export interface FlowNode { id: string; kind: string; url?: string | null; linked_project_id?: string | null }

/** Métrica da etapa: página com URL → sessões; checkout/compra → vendas; conversa → conversas; captura sem URL → leads. */
export function flowMetricFor(node: FlowNode): FlowMetric | null {
  if (node.url && PAGE_KINDS.has(node.kind)) return "sessoes";
  if (SALE_KINDS.has(node.kind)) return "vendas";
  if (CONVERSATION_KINDS.has(node.kind)) return "conversas";
  if (LEAD_KINDS.has(node.kind)) return "leads";
  return null;
}

/** URL comparável: sem protocolo, www, query, hash, barra final e ".html" (Vercel serve com e sem). */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const noProto = text.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  const path = noProto.split(/[?#]/)[0].replace(/\/+$/, "").replace(/\.html$/, "").replace(/\/index$/, "");
  return path || null;
}

/** Sessões distintas por URL normalizada. */
export function sessionsByUrl(events: ReadonlyArray<{ page_url: string | null; session_id: string | null }>): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const e of events) {
    const url = normalizeUrl(e.page_url);
    if (!url || !e.session_id) continue;
    const set = sets.get(url) ?? new Set<string>();
    set.add(e.session_id);
    sets.set(url, set);
  }
  return new Map([...sets].map(([url, set]) => [url, set.size]));
}

export interface ProjectVolume { conversas: number; vendas: number; leads: number }
export interface NodeVolume { metric: FlowMetric; value: number }

/** Volume de cada etapa. O projeto da etapa é o dela ou o do mapa. */
export function nodeVolumes(
  nodes: ReadonlyArray<FlowNode>,
  data: { sessions: ReadonlyMap<string, number>; byProject: Readonly<Record<string, ProjectVolume>>; mapProjectId?: string | null; pageSessionsByProject?: Readonly<Record<string, ReadonlyMap<string, number>>> },
): Map<string, NodeVolume> {
  const result = new Map<string, NodeVolume>();
  for (const n of nodes) {
    const metric = flowMetricFor(n);
    if (!metric) continue;
    if (metric === "sessoes") {
      const url = normalizeUrl(n.url);
      const pid = n.linked_project_id || data.mapProjectId;
      const sessions = data.pageSessionsByProject ? (pid ? data.pageSessionsByProject[pid] : undefined) : data.sessions;
      // Ausência da fonte não vira uma etapa com zero medido.
      if (data.pageSessionsByProject && (!url || !sessions?.has(url))) continue;
      result.set(n.id, { metric, value: url ? sessions?.get(url) ?? 0 : 0 });
      continue;
    }
    const pid = n.linked_project_id || data.mapProjectId;
    const p = pid ? data.byProject[pid] : undefined;
    result.set(n.id, { metric, value: p ? p[metric] : 0 });
  }
  return result;
}

/** Volume da seta: o que chega ao destino; se o destino não mede nada, o que sai da origem. */
export function edgeVolume(volumes: ReadonlyMap<string, NodeVolume>, source: string, target: string): NodeVolume | null {
  return volumes.get(target) ?? volumes.get(source) ?? null;
}

/** Movimento da seta: mais volume = mais partículas e mais rápidas. Zero = parada. */
export function flowMotion(value: number): { particles: number; durationSec: number } {
  if (value <= 0) return { particles: 0, durationSec: 0 };
  const particles = value < 3 ? 1 : value < 10 ? 2 : value < 50 ? 3 : 4;
  const durationSec = Math.max(1.2, Math.min(3.2, 3.2 - Math.log10(value + 1) * 0.9));
  return { particles, durationSec: Math.round(durationSec * 10) / 10 };
}

export interface EdgeTransitionMetrics {
  conversionRate: number | null;
  referenceRate: number;
  status: "ok" | "atencao" | "gargalo" | "sem_dado";
  labelConversion: string;
  dropPct?: number;
}

/** Calcula a taxa de conversão entre dois nós e afere se há gargalo na transição (UX1.5 / Sinergia 2D). */
export function edgeTransitionMetrics(
  volumes: ReadonlyMap<string, NodeVolume>,
  sourceNode?: { id: string; kind?: string | null },
  targetNode?: { id: string; kind?: string | null }
): EdgeTransitionMetrics | null {
  if (!sourceNode || !targetNode) return null;
  const sVol = volumes.get(sourceNode.id)?.value ?? null;
  const tVol = volumes.get(targetNode.id)?.value ?? null;

  const sKind = (sourceNode.kind ?? "").toLowerCase();
  const tKind = (targetNode.kind ?? "").toLowerCase();

  let ref = 50;
  let label = "Conversão";

  if ((sKind.includes("ads") || sKind.includes("anuncio") || sKind.includes("reels") || sKind.includes("criativo")) &&
      (tKind.includes("pagina") || tKind.includes("vsl") || tKind.includes("advertorial") || tKind.includes("quiz"))) {
    ref = 70;
    label = "Chegada";
  } else if ((sKind.includes("pagina") || sKind.includes("vsl") || sKind.includes("advertorial") || sKind.includes("quiz")) &&
             (tKind.includes("checkout") || tKind.includes("oferta"))) {
    ref = 8;
    label = "Início Checkout";
  } else if (sKind.includes("checkout") && (tKind.includes("compra") || tKind.includes("venda") || tKind.includes("obrigado"))) {
    ref = 50;
    label = "Aprovação";
  } else if ((sKind.includes("compra") || sKind.includes("venda")) && (tKind.includes("bump") || tKind.includes("upsell") || tKind.includes("downsell"))) {
    ref = 15;
    label = "Aceite Bump";
  } else if ((sKind.includes("checkout") || sKind.includes("lead")) && tKind.includes("whatsapp")) {
    ref = 20;
    label = "Recuperação";
  }

  if (sVol === null || sVol <= 0 || tVol === null) {
    return { conversionRate: null, referenceRate: ref, status: "sem_dado", labelConversion: label };
  }

  const rate = Math.round((tVol / sVol) * 1000) / 10;
  let status: "ok" | "atencao" | "gargalo" = "ok";
  if (rate < ref * 0.5) {
    status = "gargalo";
  } else if (rate < ref) {
    status = "atencao";
  }

  const dropPct = rate < ref ? Math.round(((ref - rate) / ref) * 100) : undefined;

  return {
    conversionRate: rate,
    referenceRate: ref,
    status,
    labelConversion: label,
    dropPct,
  };
}
