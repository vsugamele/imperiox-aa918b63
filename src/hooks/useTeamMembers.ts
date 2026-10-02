import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@shared/map-steps";

export interface TeamInfo {
  members: TeamMember[];
  /** Membro ligado ao login atual (por user_id, senão por e-mail). */
  me: TeamMember | null;
}

/** Time ativo (imphq_team_members): quem pode ser dono de etapa. */
export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<TeamInfo> => {
      const [{ data, error }, { data: auth }] = await Promise.all([
        supabase.from("imphq_team_members").select("id, name, email, user_id").or("is_active.eq.true,is_active.is.null").order("created_at"),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      const members = data ?? [];
      const user = auth.user;
      const me = user
        ? members.find((m) => m.user_id === user.id) ?? members.find((m) => !!user.email && m.email?.toLowerCase() === user.email.toLowerCase()) ?? null
        : null;
      return { members, me };
    },
  });
}
