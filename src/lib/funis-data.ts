import type { Json } from "@/integrations/supabase/types";

export interface Etapa {
  [key: string]: unknown;
  nome: string; tipo?: string; visitantes: number; conversoes: number;
  url?: string; image_url?: string; pos_x?: number; pos_y?: number;
  descricao?: string; connects_to?: number[]; width?: number; height?: number;
}
export interface FunnelData { [key: string]: unknown; etapas?: Etapa[]; pipeline_assets?: Record<string, unknown> }
export interface Product { [key: string]: unknown; nome?: string; name?: string; tipo_oferta?: string; tipo?: string; preco_por?: string; preco?: string; price?: string; link?: string; url?: string; descricao?: string; ofertas?: Product[] }
export interface ProjectData { [key: string]: unknown; nicho?: string; niche?: string; produtos?: Product[]; products?: Product[]; links?: Record<string, string>; webhooks?: Array<{ nome?: string; plataforma?: string }> }
export function record(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try { return record(JSON.parse(value)); } catch { return {}; }
}
export function parseEtapa(value: unknown): Etapa {
  const row = record(value);
  const result: Etapa = { ...row, nome: typeof row.nome === "string" ? row.nome : "Etapa", visitantes: Number(row.visitantes) || 0, conversoes: Number(row.conversoes) || 0 };
  for (const key of ["tipo", "url", "image_url", "descricao"] as const) { if (typeof row[key] === "string") result[key] = row[key]; else delete result[key]; }
  for (const key of ["pos_x", "pos_y", "width", "height"] as const) { if (typeof row[key] === "number") result[key] = row[key]; else delete result[key]; }
  if (Array.isArray(row.connects_to)) result.connects_to = row.connects_to.filter((v): v is number => typeof v === "number");
  else delete result.connects_to;
  return result;
}
export function parseFunnelData(value: unknown): FunnelData {
  const row = readRecord(value);
  const result: FunnelData = { ...row };
  if (Array.isArray(row.etapas)) result.etapas = row.etapas.map(parseEtapa); else delete result.etapas;
  if (row.pipeline_assets) result.pipeline_assets = record(row.pipeline_assets); else delete result.pipeline_assets;
  return result;
}
export function parseProduct(value: unknown): Product {
  const row = typeof value === "string" ? { nome: value } : record(value);
  const product: Product = { ...row };
  for (const key of ["nome", "name", "tipo_oferta", "tipo", "preco_por", "preco", "price", "link", "url", "descricao"] as const) {
    if (typeof row[key] === "string" || typeof row[key] === "number") product[key] = String(row[key]); else delete product[key];
  }
  if (Array.isArray(row.ofertas)) product.ofertas = row.ofertas.map(parseProduct); else delete product.ofertas;
  return product;
}
export function parseProjectData(value: unknown): ProjectData {
  const row = readRecord(value);
  const result: ProjectData = { ...row };
  for (const key of ["nicho", "niche"] as const) { if (typeof row[key] === "string") result[key] = row[key]; else delete result[key]; }
  for (const key of ["produtos", "products"] as const) { if (Array.isArray(row[key])) result[key] = row[key].map(parseProduct); else delete result[key]; }
  result.links = Object.fromEntries(Object.entries(record(row.links)).flatMap(([k,v]) => typeof v === "string" ? [[k,v]] : []));
  result.webhooks = Array.isArray(row.webhooks) ? row.webhooks.map(value => { const item = record(value); return { ...item, nome: typeof item.nome === "string" ? item.nome : undefined, plataforma: typeof item.plataforma === "string" ? item.plataforma : undefined }; }) : [];
  return result;
}
export function toJson(value: unknown): Json {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : toJson(item));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k, toJson(v)]));
  throw new Error("Dado do funil não pode ser serializado como JSON");
}

export function serializeFunnelStages(data: FunnelData, etapas: Etapa[]): Json {
  return toJson({ ...data, etapas });
}
