import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Lead360Event {
  kind: "click" | "event" | "form_response" | "wa_message" | "venda" | "ai_action" | "prediction";
  at: string;
  data: Record<string, any>;
}

export interface Lead360 {
  lead: Record<string, any> | null;
  timeline: Lead360Event[];
  error?: string;
}

export function useLead360(leadId?: string) {
  return useQuery<Lead360>({
    queryKey: ["lead-360", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lead_360", { p_lead_id: leadId as string });
      if (error) throw error;
      return (data as unknown as Lead360) || { lead: null, timeline: [] };
    },
  });
}
