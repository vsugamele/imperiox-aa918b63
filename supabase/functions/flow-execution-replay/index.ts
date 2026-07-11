// Replay: resets an execution to a given step and marks it running so executor picks it up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { execution_id, from_step } = await req.json();
    if (!execution_id || typeof from_step !== "number") throw new Error("execution_id and from_step required");
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: exec, error: getErr } = await supa
      .from("imphq_flow_executions")
      .select("id, step_results, automacao_id")
      .eq("id", execution_id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!exec) throw new Error("execution not found");

    const truncated = Array.isArray(exec.step_results)
      ? exec.step_results.filter((s: any) => (typeof s?.step === "number" ? s.step : 0) < from_step)
      : [];

    const { error } = await supa
      .from("imphq_flow_executions")
      .update({
        status: "running",
        current_step: from_step,
        error_message: null,
        next_run_at: new Date().toISOString(),
        step_results: truncated,
      })
      .eq("id", execution_id);
    if (error) throw error;

    // Trigger executor immediately (fire and forget)
    fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ execution_id }),
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, from_step }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
