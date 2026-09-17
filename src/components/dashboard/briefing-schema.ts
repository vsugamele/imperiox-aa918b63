import { z } from "zod";

export const briefingResponseSchema = z.object({
  briefing: z.object({
    briefing_text: z.string(),
    actions: z.array(z.object({ label: z.string(), route: z.string(), icon: z.string() })).nullish(),
  }).nullish(),
});
export type Briefing = z.infer<typeof briefingResponseSchema>["briefing"];
