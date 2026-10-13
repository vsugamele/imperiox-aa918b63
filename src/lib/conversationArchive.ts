import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";

export type ArchiveReason = "spam" | "amigo" | "fora_projeto" | "geral";

export interface ArchiveReasonConfig {
  key: ArchiveReason;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  badgeCls: string;
  color: string;
}

export const ARCHIVE_REASONS: Record<ArchiveReason, ArchiveReasonConfig> = {
  spam: {
    key: "spam",
    label: "Spam / Indesejado",
    shortLabel: "Spam",
    icon: "🚫",
    description: "Mensagens automáticas, propagandas e contatos invasivos",
    badgeCls: "bg-red-500/15 text-red-400 border-red-500/30",
    color: "#ef4444",
  },
  amigo: {
    key: "amigo",
    label: "Amigo / Pessoal",
    shortLabel: "Amigo",
    icon: "👤",
    description: "Contato pessoal ou familiar que não pertence ao projeto",
    badgeCls: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    color: "#3b82f6",
  },
  fora_projeto: {
    key: "fora_projeto",
    label: "Fora do Projeto",
    shortLabel: "Outro",
    icon: "📦",
    description: "Lead ou contato de outro assunto/projeto para manter a esteira limpa",
    badgeCls: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    color: "#a855f7",
  },
  geral: {
    key: "geral",
    label: "Arquivado",
    shortLabel: "Arquivo",
    icon: "📁",
    description: "Arquivado para manter a lista principal focada no atendimento",
    badgeCls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    color: "#71717a",
  },
};

export function isArchivedSession(s: { status?: string | null; metadata?: unknown } | null | undefined): boolean {
  if (!s) return false;
  if (s.status === "archived" || s.status === "ignored" || s.status === "spam") return true;
  if (s.metadata && typeof s.metadata === "object") {
    const meta = s.metadata as Record<string, unknown>;
    if (meta.archived === true || meta.ignored === true || meta.is_spam === true) return true;
  }
  return false;
}

export function getArchiveReason(s: ArchiveReason | { status?: string | null; metadata?: unknown } | null | undefined): ArchiveReason {
  if (!s) return "geral";
  if (typeof s === "string" && s in ARCHIVE_REASONS) {
    return s as ArchiveReason;
  }
  if (typeof s === "object") {
    if (s.metadata && typeof s.metadata === "object") {
      const meta = s.metadata as Record<string, unknown>;
      if (typeof meta.archive_reason === "string" && meta.archive_reason in ARCHIVE_REASONS) {
        return meta.archive_reason as ArchiveReason;
      }
    }
    if (s.status === "spam") return "spam";
    if (s.status === "ignored") return "fora_projeto";
  }
  return "geral";
}

export function getArchiveReasonConfig(s: ArchiveReason | { status?: string | null; metadata?: unknown } | null | undefined): ArchiveReasonConfig {
  const reason = getArchiveReason(s);
  return ARCHIVE_REASONS[reason] || ARCHIVE_REASONS.geral;
}

export async function archiveConversation(
  id: string,
  reason: ArchiveReason = "geral",
  currentMetadata?: unknown
): Promise<boolean> {
  try {
    const meta = (currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {}) as Record<string, unknown>;
    const updatedMeta = {
      ...meta,
      archived: true,
      archive_reason: reason,
      archived_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("imphq_wa_conversations")
      .update({
        status: "archived",
        metadata: updatedMeta,
      })
      .eq("id", id);

    if (error) throw error;
    toast.success(`Conversa arquivada (${ARCHIVE_REASONS[reason].label})`);
    return true;
  } catch (e) {
    toast.error("Erro ao arquivar conversa: " + errorMessage(e));
    return false;
  }
}

export async function unarchiveConversation(
  id: string,
  currentMetadata?: unknown
): Promise<boolean> {
  try {
    const meta = (currentMetadata && typeof currentMetadata === "object" ? currentMetadata : {}) as Record<string, unknown>;
    const updatedMeta = {
      ...meta,
      archived: false,
      unarchived_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("imphq_wa_conversations")
      .update({
        status: "active",
        metadata: updatedMeta,
      })
      .eq("id", id);

    if (error) throw error;
    toast.success("Conversa restaurada para a lista ativa!");
    return true;
  } catch (e) {
    toast.error("Erro ao desarquivar conversa: " + errorMessage(e));
    return false;
  }
}
