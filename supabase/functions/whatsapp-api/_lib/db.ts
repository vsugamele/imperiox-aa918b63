// Helpers DB-aware: receivem supabase como param (não usam closure)
// Extraído de whatsapp-api/index.ts.

export async function getProvider(supabase: any, providerId: string) {
  const { data, error } = await supabase
    .from("imphq_wa_providers")
    .select("*")
    .eq("id", providerId)
    .single();
  if (error || !data) throw new Error("Provider não encontrado: " + (error?.message || ""));
  if (data.api_url) data.api_url = data.api_url.replace(/\/+$/, "");
  return data;
}

export async function findOrCreateConversation(
  supabase: any,
  phone: string,
  projectId: string,
  providerId: string | null,
  contactName?: string,
  jidSuffix?: string,
) {
  const cleanPhone = phone.replace(/\D/g, "");
  const suffix = jidSuffix || "s.whatsapp.net";

  const baseQuery = supabase
    .from("imphq_wa_conversations")
    .select("*")
    .eq("phone", cleanPhone)
    .eq("project_id", projectId);
  const { data: existing } = providerId
    ? await baseQuery.eq("provider_id", providerId).maybeSingle()
    : await baseQuery.is("provider_id", null).maybeSingle();

  if (existing) {
    if (existing.jid_suffix !== suffix) {
      await supabase.from("imphq_wa_conversations").update({ jid_suffix: suffix }).eq("id", existing.id);
      existing.jid_suffix = suffix;
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from("imphq_wa_conversations")
    .insert({
      phone: cleanPhone,
      contact_name: contactName || null,
      session: `session-${Date.now()}`,
      project_id: projectId,
      status: "active",
      provider_id: providerId,
      message_count: 0,
      jid_suffix: suffix,
    })
    .select()
    .single();

  if (error) {
    const retryQuery = supabase
      .from("imphq_wa_conversations")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("project_id", projectId);
    const { data: raced } = providerId
      ? await retryQuery.eq("provider_id", providerId).maybeSingle()
      : await retryQuery.is("provider_id", null).maybeSingle();
    if (raced) return raced;
    console.error("[findOrCreateConversation] Error creating:", error.message);
    throw new Error("Falha ao criar conversa: " + error.message);
  }
  return created;
}

export async function updateConversationAfterMessage(
  supabase: any,
  conversationId: string,
  content: string,
  currentCount: number,
  incrementUnread = false,
  pauseAI = false,
) {
  const patch: Record<string, any> = {
    last_message: content.substring(0, 200),
    last_message_at: new Date().toISOString(),
    message_count: (currentCount || 0) + 1,
    updated_at: new Date().toISOString(),
    last_message_direction: incrementUnread ? "incoming" : "outgoing",
  };
  if (incrementUnread) {
    const { data: cur } = await supabase
      .from("imphq_wa_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    patch.unread_count = ((cur?.unread_count as number) || 0) + 1;
  } else {
    patch.unread_count = 0;
  }
  if (pauseAI) {
    patch.ai_paused_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  }
  const { error } = await supabase
    .from("imphq_wa_conversations")
    .update(patch)
    .eq("id", conversationId);
  if (error) console.warn("[updateConversation] Error:", error.message);
}
