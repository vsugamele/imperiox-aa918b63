import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";
function isJson(value: unknown): value is Json {
 if(value === null || typeof value === "string" || typeof value === "boolean") return true;
 if(typeof value === "number") return Number.isFinite(value);
 if(Array.isArray(value)) return value.every(isJson);
 return typeof value === "object" && Object.values(value).every(isJson);
}
const text = z.string().nullish();
const avatarItem = z.union([z.string(), z.object({ dor:text, desejo:text, nome:text, titulo:text, gatilho:text, situacao:text, cena:text, problema:text }).passthrough()]);
export const expertDocumentSchema = z.object({ id:z.string(), title:text, content:text, created_at:text });
export const expertLogSchema = z.object({ id:z.string().optional(), content_id:text, action:z.string(), week:text, day:text, created_at:z.string(), metadata:z.object({ url:text, filename:text, path:text }).passthrough().nullish() });
export const expertChatSchema = z.object({ id:z.string().optional(), from:z.enum(["expert","manager"]), content:z.string(), content_id:text, created_at:z.string() });
export const expertPortalSchema = z.object({
 project_name:z.string(), content_plan:z.custom<Json>(isJson), content_objective:text, content_objectives:z.array(z.string()).nullish(), expert_notes:text, movement_context:text,
 avatar:z.object({ perfil_psicologico:z.record(z.string()).nullish(), desejo_externo:text, desejo_interno:text, inimigo:text, resultado_sonhado:text, camadas_psique:z.record(z.unknown()).nullish(), dores:z.array(avatarItem).nullish(), desejos:z.array(avatarItem).nullish(), gatilhos:z.array(avatarItem).nullish(), voyerismos:z.array(avatarItem).nullish(), problemas:z.array(avatarItem).nullish() }).nullish(),
 events:z.array(z.object({id:z.string(),title:z.string(),start_date:z.string(),end_date:text,type:text})).default([]),
 tasks:z.array(z.object({id:z.string(),title:z.string(),priority:text,due_date:text,column_id:text})).default([]),
 processes:z.array(z.object({id:z.string(),title:z.string(),steps:z.array(z.object({done:z.boolean().optional()}).passthrough())})).default([]),
 operational_status:z.object({ads_connected:z.boolean(),ads_active:z.number(),wa_campaigns_active:z.number()}).nullish(),
 expert_logs:z.array(expertLogSchema).default([]),chat_messages:z.array(expertChatSchema).default([]),shared_docs:z.array(expertDocumentSchema).default([]),
});
export type ExpertPortalData=z.infer<typeof expertPortalSchema>;
export type ExpertLog=z.infer<typeof expertLogSchema>;
export type ExpertDocument=z.infer<typeof expertDocumentSchema>;
export interface ExpertMessage { id?:string; from:"expert"|"manager";content:string;content_id?:string|null;created_at:string; }
export const expertActionSchema=z.object({error:z.string().optional(), signed_url:z.string().optional(),path:z.string().optional(),url:z.string().optional(),success:z.boolean().optional()}).passthrough();
