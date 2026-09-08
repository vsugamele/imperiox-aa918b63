import { z } from "zod";
export const diagnosisSchema = z.object({ score: z.number(), next_action: z.string().optional(), checklist: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number(), done: z.boolean() })).default([]), gargalos: z.array(z.object({ titulo: z.string(), desc: z.string(), impacto: z.enum(["alto", "medio", "baixo"]) })).default([]) });
