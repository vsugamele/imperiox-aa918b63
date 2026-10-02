import { jpServiceContext, type JPSupportAction } from "./jp-service-policy.ts";
import { record } from "./value.ts";
import { databaseTable, type DatabasePort } from "./database-port.ts";

export interface JPServicePort extends DatabasePort {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
export async function jpLoadServiceContext(client: DatabasePort, projectId: string, channel: string, conversationId: string, message: string): Promise<string> {
  if (projectId !== "jp_freitas") return "";
  return jpServiceContext(message, await jpLoadServiceState(client, channel, conversationId));
}
export async function jpLoadServiceState(client: DatabasePort, channel: string, conversationId: string): Promise<Record<string, unknown>> {
  const { data, error } = await databaseTable(client, "imphq_jp_conversation_state").select("facts,pending_commitments,support_kind,support_status,support_opened_at,decision")
    .eq("channel", channel).eq("conversation_id", conversationId).maybeSingle();
  if (error) throw new Error("JP_SERVICE_MEMORY_UNAVAILABLE");
  return record(data);
}
export async function jpRecordSupportAction(client: JPServicePort, channel: string, conversationId: string, messageId: string | null, action: JPSupportAction | null): Promise<void> {
  if (!action || !messageId) return;
  const { error } = await client.rpc("jp_record_conversation_event", { p_channel: channel, p_conversation_id: conversationId,
    p_message_id: messageId, p_kind: action, p_evidence: { action_confirmed: true } });
  if (error) throw new Error("JP_SUPPORT_RESULT_NOT_RECORDED");
}
export function jpSupportActionFromReply(reply: string, needsHandoff: boolean): JPSupportAction | null {
  if (needsHandoff) return "handoff_registered";
  if (/https:\/\/(?:www\.)?jphaireducation\.com\.br\/auth\/verify\?token=/i.test(reply)) return "access_link_sent";
  if (/Qual é o email que você usou na compra\?/i.test(reply)) return "awaiting_email";
  return null;
}
