import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const question = z.object({ index: z.number().int(), question: z.string(), multiSelect: z.boolean().optional(),
  options: z.array(z.object({ index: z.number().int(), label: z.string(), description: z.string().optional() })) });
export const officeAgentSchema = z.object({
  id: z.string(), sessionId: z.string(), name: z.string(), provider: z.enum(['claude','codex']),
  roomId: z.string(), businessId: z.string(), title: z.string(), status: z.string(), activity: z.string(),
  waitingFor: z.string(), canMessage: z.boolean(), tasks: z.array(z.object({ title: z.string(), status: z.string() })),
  permission: z.object({ id: z.string(), title: z.string(), tool: z.string(), input: z.string(),
    questions: z.array(question), expiresAt: z.number() }).nullable(),
});
export const officeStateSchema = z.object({ serverTime: z.string(), devices: z.array(z.object({
  id: z.string().uuid(), name: z.string(), lastSeen: z.string().nullable(), online: z.boolean(),
  snapshot: z.object({ capturedAt: z.number().optional(), agents: z.array(officeAgentSchema), rooms: z.array(z.object({
    id: z.string(), name: z.string(), businessId: z.string(), businessName: z.string(), areaName: z.string(), permanent: z.boolean(),
  })) }), commands: z.array(z.object({ id: z.string(), agent_id: z.string(), kind: z.string(), status: z.string(),
    result: z.object({ message: z.string() }).nullable(), created_at: z.string(), expires_at: z.string() })),
})) });
export type OfficeAgent = z.infer<typeof officeAgentSchema>;
export type OfficeDevice = z.infer<typeof officeStateSchema>['devices'][number];
export interface OfficeAnswer { question: number; options?: number[]; other?: string }
export interface OfficeDecision { behavior: 'allow'|'deny'|'terminal'|'answer'; answers?: OfficeAnswer[] }

export async function officeRpc(name: 'imphq_office_read'|'imphq_office_enqueue', body: Record<string, unknown> = {}): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Entre novamente no Império');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(result);
    throw new Error(error.success ? error.data.message : 'Não foi possível acessar o escritório');
  }
  return result;
}
export async function readOffice() { return officeStateSchema.parse(await officeRpc('imphq_office_read')); }
export function sendOfficeCommand(device: OfficeDevice, agent: OfficeAgent, kind: 'message'|'decision', payload: { text: string }|{ permissionId: string; decision: OfficeDecision }, id = crypto.randomUUID()) {
  return officeRpc('imphq_office_enqueue', { p_id: id, p_device: device.id, p_agent: agent.id,
    p_session: agent.sessionId, p_business: agent.businessId, p_kind: kind, p_payload: payload });
}
