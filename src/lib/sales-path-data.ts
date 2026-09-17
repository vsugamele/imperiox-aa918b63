import { z } from "zod";

const action = z.object({ acao: z.string(), prioridade: z.string().optional(), resultado_esperado: z.string().optional(), responsavel_sugerido: z.string().optional(), semana: z.number().optional(), objetivo: z.string().optional() }).passthrough();
export const salesPathSchema = z.object({
  id: z.string().optional(),
  resumo_executivo: z.string().nullable(),
  health_score: z.number().nullable(),
  diagnostico: z.array(z.object({ severidade: z.string(), area: z.string(), problema: z.string(), evidencia: z.string() }).passthrough()).nullable().transform(v => v ?? []),
  oportunidades: z.array(z.object({ titulo: z.string(), esforco: z.string(), alavanca: z.string(), impacto_estimado_brl: z.number().optional() }).passthrough()).nullable().transform(v => v ?? []),
  acoes_72h: z.array(action).nullable().transform(v => v ?? []),
  acoes_30d: z.array(action).nullable().transform(v => v ?? []),
  sales_path: z.object({ trafego: z.string().optional(), captura: z.string().optional(), nutricao: z.string().optional(), oferta: z.string().optional(), upsell: z.string().optional() }).passthrough().nullable(),
  riscos: z.array(z.string()).nullable().transform(v => v ?? []),
  model_used: z.string().nullable().optional(),
  created_at: z.string().optional(),
  progress: z.record(z.enum(["todo", "doing", "done", "skip"])).nullable().optional().transform(v => v ?? {}),
}).passthrough();
export type SalesPath = z.infer<typeof salesPathSchema>;
