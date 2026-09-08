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
 borderColor: z.string().optional(), bgColor: z.string().optional(), fontSize: z.number().optional(),
 orientation: z.enum(["diag-down", "diag-up", "horizontal", "vertical"]).optional(), showHead: z.boolean().optional(),
 url: z.string().optional(), platform: z.enum(["instagram", "tiktok", "youtube", "other"]).optional(),
 thumb: z.string().optional(), thumb_proxy: z.string().optional(), author: z.string().optional(), title: z.string().optional(), description: z.string().optional(),
 heading: z.string().optional(), subheading: z.string().optional(), link: z.string().optional(), generating: z.boolean().optional(),
 recurrence: z.enum(["daily", "weekly"]).optional(), items: z.array(z.object({time: z.string(), kind: z.enum(["post", "story", "reel", "email", "wa", "other"]), label: z.string()}).passthrough()).optional(),
 accountId: z.string().optional(), viewMode: z.enum(["compact", "expanded"]).optional(),
}).passthrough();
export function parseAnnotationStyle(value: unknown): AnnotationData["style"] {
 const parsed = styleSchema.parse(value || {});
 return { ...parsed, items: parsed.items?.map(item => ({ ...item, time: item.time, kind: item.kind, label: item.label })) };
}
