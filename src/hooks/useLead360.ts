import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// The RPC returns a JSON envelope, rather than typed table rows. Validate the
// fields consumed by the screen and retain additional JSON fields from the RPC.
const optionalText = z.string().nullish();
const eventSchema = z.object({
  kind: z.enum(["click", "event", "form_response", "wa_message", "venda", "ai_action", "prediction"]),
  at: z.string(),
  data: z.object({
    utm_source: optionalText, utm_campaign: optionalText, page_url: optionalText,
    event_type: optionalText, form_id: optionalText, from_me: z.boolean().nullish(),
    body: optionalText, message_type: optionalText, produto: optionalText,
    valor: z.union([z.number(), z.string()]).nullish(), status: optionalText,
    plataforma: optionalText, action_type: optionalText, summary: optionalText,
    score: z.number().nullish(), next_action: optionalText,
  }).passthrough(),
});
const lead360Schema = z.object({
  lead: z.object({
    id: z.string(), nome: optionalText, email: optionalText, phone: optionalText,
    status: optionalText, score: z.number().nullish(), created_at: optionalText,
    projeto_id: optionalText, origem: optionalText, estagio: optionalText,
    plataforma: optionalText, ultimo_produto: optionalText,
    utm_source: optionalText, utm_campaign: optionalText,
  }).passthrough().nullable(),
  timeline: z.array(z.unknown()),
  error: z.string().optional(),
});

export type Lead360Event = z.infer<typeof eventSchema>;
export type Lead360 = Omit<z.infer<typeof lead360Schema>, "timeline"> & { timeline: Lead360Event[] };

export function useLead360(leadId?: string) {
  return useQuery<Lead360>({
    queryKey: ["lead-360", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      if (!leadId) return { lead: null, timeline: [] };
      const { data, error } = await supabase.rpc("get_lead_360", { p_lead_id: leadId });
      if (error) throw error;
      const envelope = lead360Schema.parse(data || { lead: null, timeline: [] });
      // A future or malformed event must not hide an otherwise valid lead.
      // Render only entries with the supported RPC shape; retain valid extras.
      const timeline = envelope.timeline.flatMap(entry => {
        const parsed = eventSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
      return { ...envelope, timeline };
    },
  });
}
