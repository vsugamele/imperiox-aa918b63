import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarBadges {
  imperius: number;   // AI actions pending
  inbox: number;      // unread WA + IG messages
  leads: number;      // hot leads (score > 80, last 2h)
  rag: number;        // knowledge gaps unanswered (AI couldn't answer leads)
}

async function fetchBadges(): Promise<SidebarBadges> {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();

  const [{ count: imperiusCount }, { count: waUnreadCount }, { count: igUnreadCount }, { count: leadsCount }, { count: ragCount }] =
    await Promise.all([
      supabase
        .from("imphq_ai_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
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
    ]);

  return {
    imperius: imperiusCount ?? 0,
    inbox: (waUnreadCount ?? 0) + (igUnreadCount ?? 0),
    leads: leadsCount ?? 0,
    rag: ragCount ?? 0,
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
