import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarBadges {
  imperius: number;   // AI actions pending
  inbox: number;      // unread WA + IG messages
  leads: number;      // hot leads (score > 80, last 2h)
  rag: number;        // knowledge gaps unanswered (AI couldn't answer leads)
  aprovar: number;    // fila única /aprovar (etapas para revisar, ações da IA, conteúdo pronto, respostas pendentes)
}

async function fetchBadges(): Promise<SidebarBadges> {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();

  const [{ count: imperiusCount }, { count: waUnreadCount }, { count: igUnreadCount }, { count: leadsCount }, { count: ragCount }, { count: contentCount }, { count: draftCount }] =
    await Promise.all([
      supabase
        .from("imphq_ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "proposed"),
      supabase
        .from("imphq_wa_conversations")
        .select("id", { count: "exact", head: true })
        .gt("unread_count", 0),
      supabase
        .from("imphq_ig_conversations")
        .select("id", { count: "exact", head: true })
        .gt("unread_count", 0),
      supabase
        .from("imphq_leads")
        .select("id", { count: "exact", head: true })
        .gt("score", 80)
        .gte("criado_em", twoHoursAgo),
      supabase
        .from("imphq_wa_knowledge")
        .select("id", { count: "exact", head: true })
        .eq("answered", false)
        .eq("aprovada", false),
      supabase.from("imphq_content_items").select("id", { count: "exact", head: true }).eq("status", "pronto"),
      supabase.from("imphq_wa_ai_drafts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  return {
    imperius: imperiusCount ?? 0,
    inbox: (waUnreadCount ?? 0) + (igUnreadCount ?? 0),
    leads: leadsCount ?? 0,
    rag: ragCount ?? 0,
    // Fila /aprovar focada apenas em decisões comerciais e financeiras reais (ações IA, conteúdo e respostas)
    aprovar: (imperiusCount ?? 0) + (contentCount ?? 0) + (draftCount ?? 0),
  };
}

export function useSidebarBadges() {
  return useQuery({
    queryKey: ["sidebar-badges"],
    queryFn: fetchBadges,
    refetchInterval: 30_000,
    staleTime: 25_000,
    // Silently fail — badges are non-critical
    retry: false,
  });
}
