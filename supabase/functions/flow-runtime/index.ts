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
  lead_id?: string | null;
  conversation_id?: string | null;
  payload?: Record<string, unknown> | null;
}

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false;
  if (!("blueprint_id" in value) || typeof value.blueprint_id !== "string" || !value.blueprint_id) return false;
  if (!("node_id" in value) || typeof value.node_id !== "string" || !value.node_id) return false;
  if (!("event_type" in value) || typeof value.event_type !== "string" || !["entered", "completed", "dropped", "replied"].includes(String(value.event_type))) return false;
  if ("lead_id" in value && value.lead_id != null && typeof value.lead_id !== "string") return false;
  if ("conversation_id" in value && value.conversation_id != null && typeof value.conversation_id !== "string") return false;
  if ("payload" in value && value.payload != null && (typeof value.payload !== "object" || Array.isArray(value.payload))) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body: unknown = await req.json();
    const events: unknown[] = body && typeof body === "object" && "events" in body && Array.isArray(body.events) ? body.events : [body];
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    for (const ev of events) {
      if (!isPayload(ev)) continue;
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
