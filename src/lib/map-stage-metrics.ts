import { normalizeUrl } from "@shared/flow-volume";
import { metricKey } from "@shared/metric-keys";
import type { ScaleRefs } from "@shared/map-path";

export type MetricValues = Record<string, number | null>;
export interface PageMetricSnapshot {
  url: string;
  sources: string[];
  lastEventAt: string | null;
  values: MetricValues;
  incomplete?: boolean;
}
export interface ProjectMetricSnapshot {
  values: MetricValues;
  refs: ScaleRefs | null;
  pages: PageMetricSnapshot[];
  updatedAt: string;
  error?: string;
}
export interface NodeMetricSnapshot {
  values: MetricValues;
  refs: ScaleRefs | null;
  status: "ready" | "missing" | "error";
  scope: "etapa" | "projeto";
  projectId: string | null;
  source: string;
  updatedAt: string | null;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function metricValues(value: unknown): MetricValues {
  return Object.fromEntries(Object.entries(object(value)).map(([key, v]) => [key,
    typeof v === "number" && Number.isFinite(v) ? v : null]));
}
export function pageSnapshots(value: unknown): PageMetricSnapshot[] {
  const pages = object(value).pages;
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((raw): PageMetricSnapshot[] => {
    const p = object(raw);
    const url = typeof p.url === "string" ? normalizeUrl(p.url) : null;
    return url ? [{ url, sources: Array.isArray(p.sources) ? p.sources.filter((s): s is string => typeof s === "string") : [],
      lastEventAt: typeof p.last_event_at === "string" ? p.last_event_at : null, values: metricValues(p.values), incomplete: p.missing_session_ids === true }] : [];
  });
}

/** Métrica de etapa nunca usa o total do projeto, nem o projeto de uma etapa vizinha. */
export function nodeMetricSnapshot(
  node: { linked_project_id?: string | null; url?: string | null; metrics_target?: unknown },
  projects: Readonly<Record<string, ProjectMetricSnapshot>>,
): NodeMetricSnapshot {
  const target = object(node.metrics_target);
  const info = metricKey(typeof target.key === "string" ? target.key : null);
  const projectId = node.linked_project_id || null;
  const scope = info?.escopo ?? "etapa";
  const base: NodeMetricSnapshot = { values: {}, refs: null, status: "missing", scope, projectId,
    source: !projectId ? "Vincule um projeto" : "Sem dados registrados", updatedAt: null };
  if (!projectId) return base;
  const project = projects[projectId];
  if (!project) return { ...base, source: "Carregando métricas" };
  if (project.error) return { ...base, status: "error", source: "Falha ao carregar métricas" };
  if (!info?.disponivel) return { ...base, source: "Fonte indisponível", updatedAt: project.updatedAt };
  if (scope === "projeto") {
    const values = Object.fromEntries(Object.entries(project.values).filter(([key]) => metricKey(key)?.escopo === "projeto"));
    return { ...base, values, refs: project.refs, status: "ready", source: info.fonte, updatedAt: project.updatedAt };
  }
  const url = normalizeUrl(node.url);
  if (!url) return { ...base, source: "Vincule a URL desta etapa", updatedAt: project.updatedAt };
  const page = project.pages.find((p) => p.url === url);
  if (!page) return { ...base, source: "Sem eventos nesta URL", updatedAt: project.updatedAt };
  return { ...base, values: page.values, refs: project.refs, status: "ready",
    source: page.sources.map((s) => s === "funnel" ? "Tracker do funil" : s === "legacy" ? "Tracker anterior" : s).join(" + ") + (page.incomplete ? " · sessões sem identificação" : ""),
    updatedAt: project.updatedAt };
}
