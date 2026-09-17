import { z } from "zod";

// Execution logs are JSON; validate display fields without discarding raw payloads.
const stepSchema = z.object({
  step: z.union([z.number(), z.string()]).optional(),
  tipo: z.string().optional(), status: z.string().optional(),
  started_at: z.string().optional(), finished_at: z.string().optional(),
  timestamp: z.string().optional(), notes: z.string().optional(),
  ab_variant: z.string().optional(), phone: z.string().optional(),
  provider_id: z.string().optional(), message_preview: z.string().optional(),
  reason: z.string().optional(), resend_id: z.string().optional(),
  condition_met: z.boolean().optional(), skipped_steps: z.number().optional(),
  response: z.object({ success: z.boolean().optional(), error: z.string().optional(), message_id: z.string().optional() }).passthrough().optional(),
}).passthrough();

export function readExecutionSteps(value: unknown): z.infer<typeof stepSchema>[] {
  if (!Array.isArray(value)) return [];
  return value.map(step => {
    const parsed = stepSchema.safeParse(step);
    return parsed.success ? parsed.data : { status: "invalid_log", reason: "Registro de etapa inválido", raw: step };
  });
}
