// Flow Runtime: ingest events (lead entered/completed/dropped node) and update stats.
// Called by other edge functions (wa-ai-reply, wa-pitch-followup, webhook-pagamento) or directly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type EventType = "entered" | "completed" | "dropped" | "replied";

interface Payload {
  blueprint_id: string;
  node_id: string;
  event_type: EventType;
  lead_id?: string;
  conversation_id?: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload | { events: Payload[] };
    const events: Payload[] = Array.isArray((body as any).events) ? (body as any).events : [body as Payload];
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    for (const ev of events) {
      if (!ev?.blueprint_id || !ev?.node_id || !ev?.event_type) continue;
      // log
      await supa.from("imphq_flow_runtime_events").insert({
        blueprint_id: ev.blueprint_id,
        node_id: ev.node_id,
        event_type: ev.event_type,
        lead_id: ev.lead_id ?? null,
        conversation_id: ev.conversation_id ?? null,
        payload: ev.payload ?? {},
      });

      // counter increment
      const incs: Array<{ field: string; delta: number }> = [];
      if (ev.event_type === "entered") {
        incs.push({ field: "entered", delta: 1 });
        incs.push({ field: "active", delta: 1 });
      } else if (ev.event_type === "completed") {
        incs.push({ field: "completed", delta: 1 });
        incs.push({ field: "active", delta: -1 });
      } else if (ev.event_type === "dropped") {
        incs.push({ field: "dropped", delta: 1 });
        incs.push({ field: "active", delta: -1 });
      }
      for (const inc of incs) {
        await supa.rpc("increment_flow_node_stat", {
          p_blueprint_id: ev.blueprint_id,
          p_node_id: ev.node_id,
          p_field: inc.field,
          p_delta: inc.delta,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, count: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
