import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
export type ContentItem = {
  [key: string]: Json | undefined;
  id: string;
  platform: string;
  type: string;
  description: string;
  copy?: string;
  hashtags?: string;
  cross_platforms?: string[];
  hook?: string;
  cta?: string;
  recording_tips?: string;
  roteiro?: string;
  sequencia?: number;
}

export interface WeekPlan {
  [day: string]: ContentItem[];
}

export type WeekSummary = {
  focus?: string;
  event?: string;
}

export type MonthlyPlan = {
  semana_1: WeekPlan;
  semana_2: WeekPlan;
  semana_3: WeekPlan;
  semana_4: WeekPlan;
  week_labels?: Record<string, string>;
  week_summaries?: Record<string, WeekSummary>;
}


function parseWeek(value: Json | undefined): WeekPlan {
  return Object.fromEntries(Object.entries(jsonFields(value)).flatMap(([day, items]) => {
    if (!Array.isArray(items)) return [];
    const decoded = items.flatMap(item => {
      const f = jsonFields(item);
      if (typeof f.id !== "string") return [];
      const row: ContentItem = { ...f, id: f.id, platform: jsonText(f.platform) || "", type: jsonText(f.type) || "", description: jsonText(f.description) || "" };
      for (const key of ["copy", "hashtags", "hook", "cta", "recording_tips", "roteiro"] as const) row[key] = jsonText(f[key]);
      row.sequencia = typeof f.sequencia === "number" ? f.sequencia : undefined;
      row.cross_platforms = Array.isArray(f.cross_platforms) ? f.cross_platforms.filter((item): item is string => typeof item === "string") : undefined;
      return [row];
    });
    return [[day, decoded]];
  }));
}
export function migrateToMonthly(value: Json | undefined): MonthlyPlan {
  const plan = jsonFields(value);
  const week_labels = Object.fromEntries(Object.entries(jsonFields(plan.week_labels)).flatMap(([key, label]) => typeof label === "string" ? [[key, label]] : []));
  const week_summaries = Object.fromEntries(Object.entries(jsonFields(plan.week_summaries)).map(([key, summary]) => [key, { focus: jsonText(jsonFields(summary).focus), event: jsonText(jsonFields(summary).event) }]));
  return { semana_1: parseWeek(plan.semana_1 || value), semana_2: parseWeek(plan.semana_2), semana_3: parseWeek(plan.semana_3), semana_4: parseWeek(plan.semana_4), week_labels, week_summaries };
}
