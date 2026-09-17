import { record } from "@/lib/funis-data";
import type { AnnotationData, AnnotationKind } from "@/components/funis/map-annotation-data";
import { z } from "zod";

export interface ChecklistItem { id: string; text: string; done: boolean }
export function parsePosition(value: unknown): { x: number; y: number } {
  const row = record(value);
  return { x: Number(row.x) || 0, y: Number(row.y) || 0 };
}
export function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.map(value => {
    const row = record(value);
    return { ...row, id: typeof row.id === "string" ? row.id : "", text: typeof row.text === "string" ? row.text : "", done: !!row.done };
  });
}
export function parseAnnotationKind(value: unknown): AnnotationKind {
  if (value === "frame" || value === "note" || value === "label" || value === "arrow" || value === "reel" || value === "script" || value === "copy" || value === "ad_asset" || value === "schedule" || value === "account") return value;
  throw new Error("Tipo de anotação desconhecido");
}
const styleSchema = z.object({
 borderColor: z.string().nullish(), bgColor: z.string().nullish(), fontSize: z.number().nullish(),
 orientation: z.enum(["diag-down", "diag-up", "horizontal", "vertical"]).nullish(), showHead: z.boolean().nullish(),
 url: z.string().nullish(), platform: z.enum(["instagram", "tiktok", "youtube", "other"]).nullish(),
 thumb: z.string().nullish(), thumb_proxy: z.string().nullish(), author: z.string().nullish(), title: z.string().nullish(), description: z.string().nullish(),
 heading: z.string().nullish(), subheading: z.string().nullish(), link: z.string().nullish(), generating: z.boolean().nullish(),
 recurrence: z.enum(["daily", "weekly"]).nullish(), items: z.array(z.object({time: z.string(), kind: z.enum(["post", "story", "reel", "email", "wa", "other"]), label: z.string()}).passthrough()).nullish(),
 accountId: z.string().nullish(), viewMode: z.enum(["compact", "expanded"]).nullish(),
}).passthrough();
export function parseAnnotationStyle(value: unknown): AnnotationData["style"] {
 const parsed = styleSchema.parse(value || {});
 // normaliza null -> undefined (dados legados podem gravar null em campos de texto)
 const clean: Record<string, unknown> = {};
 for (const [k, v] of Object.entries(parsed)) if (v !== null) clean[k] = v;
 const items = Array.isArray(parsed.items) ? parsed.items.map(item => ({ ...item, time: item.time, kind: item.kind, label: item.label })) : undefined;
 return { ...(clean as AnnotationData["style"]), ...(items ? { items } : {}) };
}
