import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface AiIgnoreSession {
  id?: string;
  ia_ativa?: boolean | null;
  ai_paused?: boolean | null;
  phone?: string | null;
  metadata?: unknown;
}

/**
 * Checks if a phone number matches any of the ignored phones list (digits-only comparison).
 */
export function isPhoneInIgnoredList(
  phone: string | null | undefined,
  ignoredPhones: string[] | null | undefined
): boolean {
  if (!phone || !ignoredPhones || !Array.isArray(ignoredPhones) || ignoredPhones.length === 0) {
    return false;
  }
  const clean = phone.replace(/\D/g, "");
  if (!clean) return false;
  return ignoredPhones.some((p) => typeof p === "string" && p.replace(/\D/g, "") === clean);
}

/**
 * Determines whether the conversation is completely ignored by AI (never replies, never analyzes).
 */
export function isChatAiIgnored(
  session: AiIgnoreSession | null | undefined,
  ignoredPhones?: string[] | null | undefined
): boolean {
  if (!session) return false;

  // 1. Direct conversation flag: ia_ativa === false
  if (session.ia_ativa === false) return true;

  // 2. Metadata flag: ai_ignored === true
  const meta =
    typeof session.metadata === "object" && session.metadata !== null
      ? (session.metadata as Record<string, unknown>)
      : null;
  if (meta?.ai_ignored === true) return true;

  // 3. Checked against active AI config ignored_phones list
  if (session.phone && ignoredPhones && isPhoneInIgnoredList(session.phone, ignoredPhones)) {
    return true;
  }

  return false;
}

export interface ToggleAiIgnoreOptions {
  conversationId: string;
  phone: string;
  projectId?: string | null;
  providerId?: string | null;
  ignore: boolean;
  currentMetadata?: unknown;
}

/**
 * Toggles AI ignore status for a conversation:
 * - Updates `imphq_wa_conversations` (ia_ativa: !ignore, metadata.ai_ignored: ignore, ai_paused: ignore)
 * - Updates `imphq_wa_ai_config` (adds/removes phone from ignored_phones - the exact setting in "Configurações da IA")
 * - Clears pending drafts/debounce if ignoring
 */
export async function toggleChatAiIgnore({
  conversationId,
  phone,
  projectId,
  providerId,
  ignore,
  currentMetadata,
}: ToggleAiIgnoreOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPhone = phone.trim();
    const cleanDigits = phone.replace(/\D/g, "");

    // 1. Update Conversation
    const meta =
      typeof currentMetadata === "object" && currentMetadata !== null
        ? { ...(currentMetadata as Record<string, unknown>) }
        : {};

    if (ignore) {
      meta.ai_ignored = true;
      meta.ai_ignored_at = new Date().toISOString();
    } else {
      delete meta.ai_ignored;
      delete meta.ai_ignored_at;
    }

    const { error: convErr } = await supabase
      .from("imphq_wa_conversations")
      .update({
        ia_ativa: !ignore,
        ai_paused: ignore,
        ai_paused_until: ignore ? "2099-01-01T00:00:00.000Z" : null,
        ai_debounce_until: null,
        metadata: meta as Json,
      })
      .eq("id", conversationId);

    if (convErr) {
      console.error("[toggleChatAiIgnore] Error updating conversation:", convErr);
      return { success: false, error: convErr.message };
    }

    // 2. Discard any pending drafts if ignoring
    if (ignore) {
      try {
        await supabase
          .from("imphq_wa_ai_drafts")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("status", "pending");
      } catch {
        /* ignore draft cleanup failure */
      }
    }

    // 3. Sync with imphq_wa_ai_config (Configurações da IA - Contatos Ignorados)
    if (projectId) {
      let query = supabase
        .from("imphq_wa_ai_config")
        .select("id, ignored_phones")
        .eq("project_id", projectId);

      if (providerId) {
        query = query.eq("provider_id", providerId);
      }

      let { data: configs } = await query;
      if ((!configs || configs.length === 0) && providerId) {
        const fallbackRes = await supabase
          .from("imphq_wa_ai_config")
          .select("id, ignored_phones")
          .eq("project_id", projectId);
        configs = fallbackRes.data;
      }

      if (configs && configs.length > 0) {
        for (const cfg of configs) {
          const currentList = Array.isArray(cfg.ignored_phones) ? [...cfg.ignored_phones] : [];
          const exists = currentList.some((p) => typeof p === "string" && p.replace(/\D/g, "") === cleanDigits);

          let updatedList = currentList;
          if (ignore && !exists) {
            updatedList = [...currentList, cleanPhone];
          } else if (!ignore && exists) {
            updatedList = currentList.filter((p) => typeof p === "string" && p.replace(/\D/g, "") !== cleanDigits);
          }

          if (updatedList.length !== currentList.length) {
            await supabase
              .from("imphq_wa_ai_config")
              .update({ ignored_phones: updatedList })
              .eq("id", cfg.id);
          }
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[toggleChatAiIgnore] Unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
