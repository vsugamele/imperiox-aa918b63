import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { record, text } from "./value.ts";
type Client = SupabaseClient;

export async function acquireIgReply(supa: Client, conversationId: string, messageId: string | null): Promise<string | null> {
  // Wait for the prior worker, then process the remaining inbound message with refreshed history.
  for (let attempt = 0; attempt < 55; attempt++) {
    const { data, error } = await supa.rpc("imphq_claim_ig_reply", { p_conversation_id: conversationId, p_message_id: messageId });
    if (error) throw new Error("IG_REPLY_LOCK_FAILED");
    if (typeof data === "string") return data;
    const { data: c } = await supa.from("imphq_ig_conversations")
      .select("ai_reply_lock_until,ai_paused,ia_ativa,ai_active,ai_paused_until").eq("id", conversationId).single();
    if (!c || !record(c).ai_reply_lock_until || c.ai_paused || c.ia_ativa === false || c.ai_active === false ||
      (c.ai_paused_until && Date.parse(c.ai_paused_until) > Date.now())) return null;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.warn("[ig-reply] Busy conversation retained for pending reprocessing");
  return null;
}
export async function validIgLease(supa: Client, conversationId: string, token: string): Promise<boolean> {
  const { data, error } = await supa.from("imphq_ig_conversations")
    .select("ai_reply_lock_token,ai_reply_lock_until,ai_paused,ia_ativa,ai_active,ai_paused_until")
    .eq("id", conversationId).single();
  return !error && text(record(data).ai_reply_lock_token) === token && Date.parse(text(record(data).ai_reply_lock_until)) > Date.now()
    && !data?.ai_paused && data?.ia_ativa !== false && data?.ai_active !== false
    && !(data?.ai_paused_until && Date.parse(data.ai_paused_until) > Date.now());
}
export async function releaseIgReply(supa: Client, conversationId: string, token: string, handledId: string | null): Promise<void> {
  const { error } = await supa.rpc("imphq_release_ig_reply", { p_conversation_id: conversationId, p_token: token, p_handled_id: handledId });
  if (error) console.error("[ig-reply] Release failed; lease expires automatically");
}
