import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find waiting or retrying executions (up to 100 to avoid memory overflow)
    const { data: waitingExecs, error: fetchErr } = await supabase
      .from("imphq_flow_executions")
      .select("id, automacao_id, project_id, lead_id, trigger_tipo, current_step, step_results, next_run_at, created_at, status, retry_count")
      .in("status", ["waiting", "retrying"])
      .order("next_run_at", { ascending: true })
      .limit(100);


    if (fetchErr) {
      console.error("[openflow-resume] Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowStr = new Date().toISOString();
    const pending: any[] = [];

    if (waitingExecs && waitingExecs.length > 0) {
      for (const exec of waitingExecs) {
        let shouldResume = false;
        
        if (exec.next_run_at && exec.next_run_at <= nowStr) {
          shouldResume = true;
        } else {
          // Check if waiting on a wait_event / wait_until_event step and the event occurred
          try {
            const { data: auto } = await supabase
              .from("imphq_automacoes")
              .select("acoes, etapas")
              .eq("id", exec.automacao_id)
              .maybeSingle();
              
            const rawSteps = auto?.acoes || auto?.etapas || [];
            const currentStepIdx = exec.current_step || 0;
            const step = rawSteps[currentStepIdx];
            
            if (step && (step.tipo === "wait_event" || step.tipo === "wait_until_event")) {
              const eventName = step.event_name;
              if (exec.lead_id && eventName) {
                const { data: evts } = await supabase
                  .from("imphq_events")
                  .select("id")
                  .eq("lead_id", exec.lead_id)
                  .eq("event_name", eventName)
                  .gt("created_at", exec.created_at) // since execution started
                  .limit(1);
                if (evts && evts.length > 0) {
                  shouldResume = true;
                  console.log(`[openflow-resume] Event "${eventName}" detected for lead ${exec.lead_id}. Resuming execution ${exec.id} early.`);
                }
              }
            }
          } catch (err) {
            console.error(`[openflow-resume] Error checking wait_event for execution ${exec.id}:`, err);
          }
        }
        
        if (shouldResume) {
          pending.push(exec);
        }
      }
    }

    if (pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, resumed: 0, message: "Nenhuma execução pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[openflow-resume] Found ${pending.length} waiting executions to resume`);

    const results: any[] = [];

    for (const exec of pending) {
      try {
        // Mark as running to prevent double-processing (CAS: only if still waiting/retrying)
        const prevStatus = exec.status;
        await supabase.from("imphq_flow_executions")
          .update({ status: "running" })
          .eq("id", exec.id)
          .eq("status", prevStatus);


        // Get trigger_data from the matching automacao_log
        const { data: logData } = await supabase
          .from("imphq_automacao_logs")
          .select("trigger_data")
          .eq("automacao_id", exec.automacao_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const triggerData = (logData?.[0] as any)?.trigger_data || {};
        const leadData = triggerData.lead_data || {};

        // Re-invoke the executor with the original context
        const execRes = await fetch(`${supabaseUrl}/functions/v1/openflow-executor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_tipo: exec.trigger_tipo || triggerData.trigger_tipo || "manual",
            project_id: exec.project_id,
            automacao_id: exec.automacao_id,
            lead_data: {
              ...leadData,
              lead_id: exec.lead_id || leadData.lead_id,
            },
            // Signal that this is a resume from a specific step
            resume_from_step: exec.current_step || 0,
          }),
        });

        const execResult = await execRes.json();
        console.log(`[openflow-resume] Execution ${exec.id} resumed:`, JSON.stringify(execResult).slice(0, 200));

        // If the executor created a new execution, mark the old one as completed
        if (execResult.ok) {
          await supabase.from("imphq_flow_executions")
            .update({ 
              status: "completed", 
              error_message: `Retomada via openflow-resume. Nova execução criada.`,
            })
            .eq("id", exec.id);
        } else {
          await supabase.from("imphq_flow_executions")
            .update({ 
              status: "failed", 
              error_message: `Falha na retomada: ${execResult.error || "Erro desconhecido"}`,
            })
            .eq("id", exec.id);
        }

        results.push({ id: exec.id, ok: execResult.ok, automacao_id: exec.automacao_id });
      } catch (e: any) {
        console.error(`[openflow-resume] Error resuming ${exec.id}:`, e);
        await supabase.from("imphq_flow_executions")
          .update({ status: "failed", error_message: `Erro na retomada: ${e.message}` })
          .eq("id", exec.id);
        results.push({ id: exec.id, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, resumed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[openflow-resume] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
