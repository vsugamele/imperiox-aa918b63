import { z } from "zod";

const product = z.object({ nome:z.string().optional(), score:z.number().optional(), nicho:z.string().optional(), ticket:z.union([z.string(),z.number()]).optional(), plataforma:z.string().optional(), sem_rosto:z.boolean().optional(), mecanismo_unico:z.string().optional(), angulo_copy:z.string().optional(), url:z.string().optional() }).passthrough();
const opportunity = z.object({ nome_sugerido:z.string().optional(), score:z.number().optional(), nicho:z.string().optional(), dor_central:z.string().optional(), ticket_sugerido:z.union([z.string(),z.number()]).optional(), formato:z.string().optional(), sem_rosto:z.boolean().optional(), mecanismo_unico:z.string().optional(), justificativa:z.string().optional() }).passthrough();
export const intelSchema = z.object({ resumo:z.string().nullish(), produtos:z.array(product).nullish(), oportunidades:z.array(opportunity).nullish(), gaps:z.array(z.string()).nullish(), tendencias:z.array(z.string()).nullish() }).passthrough();
export const variationSchema = z.object({ title:z.string(), gancho:z.string(), narrativa:z.string(), cta:z.string() });
export const hackSchema = z.object({ analyzedCopy:z.string(), psychologicalTriggers:z.array(z.string()), targetAvatar:z.string(), uniqueMechanism:z.string(), variations:z.array(variationSchema).min(1) });
export type Intel = z.infer<typeof intelSchema>;
export type Hack = z.infer<typeof hackSchema>;
export type Variation = z.infer<typeof variationSchema>;
export function parseIntel(value: unknown): Intel | null { const parsed=intelSchema.safeParse(value); return parsed.success ? parsed.data : null; }
export function parseHack(value: unknown): Hack { return hackSchema.parse(value); }
