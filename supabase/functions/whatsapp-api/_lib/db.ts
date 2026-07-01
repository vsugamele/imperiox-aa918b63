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

// Gera variantes de telefone BR (com e sem o 9º dígito após DDD) para evitar
// conversas duplicadas quando o WhatsApp entrega ora um, ora outro formato.
// Ex.: "5569992148875" (13 dígitos) ↔ "556992148875" (12 dígitos).
export function brPhoneVariants(raw: string): { canonical: string; variants: string[] } {
  const clean = (raw || "").replace(/\D/g, "");
  const out = new Set<string>([clean]);
  let canonical = clean;
  if (clean.startsWith("55")) {
    if (clean.length === 13 && clean[4] === "9") {
      // 55 + DDD + 9 + 8 dígitos → variante sem o 9
      out.add(clean.slice(0, 4) + clean.slice(5));
      canonical = clean;
    } else if (clean.length === 12) {
      // 55 + DDD + 8 dígitos → variante com 9 (canônico moderno)
      const withNine = clean.slice(0, 4) + "9" + clean.slice(4);
      out.add(withNine);
      canonical = withNine;
    }
  }
  return { canonical, variants: Array.from(out) };
}

export async function findOrCreateConversation(
  supabase: any,
  phone: string,
  projectId: string,
  providerId: string | null,
  contactName?: string,
  jidSuffix?: string,
) {
  const { canonical, variants } = brPhoneVariants(phone);
  const suffix = jidSuffix || "s.whatsapp.net";

  // Busca por QUALQUER variante (com ou sem o 9) — assim não duplica
  const baseQuery = supabase
    .from("imphq_wa_conversations")
    .select("*")
    .in("phone", variants)
    .eq("project_id", projectId);
  const { data: existingRows } = providerId
    ? await baseQuery.eq("provider_id", providerId)
    : await baseQuery.is("provider_id", null);

  // Prefere a com mais mensagens (mais "viva") se houver mais de uma
  const existing = (existingRows || []).sort(
    (a: any, b: any) => (b.message_count || 0) - (a.message_count || 0),
  )[0];

  if (existing) {
    const patch: any = {};
    if (existing.jid_suffix !== suffix) patch.jid_suffix = suffix;
    if (Object.keys(patch).length) {
      await supabase.from("imphq_wa_conversations").update(patch).eq("id", existing.id);
      Object.assign(existing, patch);
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from("imphq_wa_conversations")
    .insert({
      phone: canonical,
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
      .in("phone", variants)
      .eq("project_id", projectId);
    const { data: raced } = providerId
      ? await retryQuery.eq("provider_id", providerId)
      : await retryQuery.is("provider_id", null);
    if (raced && raced.length) return raced[0];
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
    // Pausa curta: se o lead voltar com pergunta nova, wa-ai-reply libera antes via heurística de auto-resume.
    patch.ai_paused_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }
  const { error } = await supabase
    .from("imphq_wa_conversations")
    .update(patch)
    .eq("id", conversationId);
  if (error) console.warn("[updateConversation] Error:", error.message);
}
