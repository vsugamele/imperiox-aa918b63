import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trigger_tipo, project_id, lead_data, automacao_id } = await req.json();
    if (!trigger_tipo || !project_id) {
      return new Response(JSON.stringify({ error: "trigger_tipo e project_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find matching automations
    let query = supabase
      .from("imphq_automacoes")
      .select("*")
      .eq("trigger_tipo", trigger_tipo)
      .eq("ativo", true);

    if (automacao_id) {
      query = query.eq("id", automacao_id);
    }

    const { data: automacoes, error: autoErr } = await query;
    if (autoErr) {
      return new Response(JSON.stringify({ error: autoErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by project and product
    const matched = (automacoes || []).filter((a: any) => {
      if (a.project_id && a.project_id !== project_id) return false;
      if (a.produto && lead_data?.produto) {
        if (a.produto.toLowerCase() !== lead_data.produto.toLowerCase()) return false;
      }
      return true;
    });

    if (matched.length === 0) {
      return new Response(JSON.stringify({ ok: true, executed: 0, message: "Nenhuma automação encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const auto of matched) {
      const steps = auto.etapas || [];
      const stepResults: any[] = [];
      let status = "completed";
      let errorMessage: string | null = null;

      // Create execution record
      const { data: execution, error: execErr } = await supabase
        .from("imphq_flow_executions")
        .insert({
          automacao_id: auto.id,
          project_id,
          lead_id: lead_data?.lead_id || null,
          trigger_tipo,
          status: "running",
          current_step: 0,
        })
        .select("id")
        .single();

      if (execErr) {
        console.error("[openflow-executor] Failed to create execution:", execErr);
        continue;
      }

      const executionId = execution.id;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult: any = { step: i, tipo: step.tipo, started_at: new Date().toISOString() };

        try {
          // Update current step
          await supabase.from("imphq_flow_executions")
            .update({ current_step: i })
            .eq("id", executionId);

          if (step.tipo === "delay" || step.tipo === "espera") {
            const delayMin = step.delay_min || step.minutos || 1;
            // For delays > 5 min, schedule for later and stop
            if (delayMin > 5) {
              const nextRun = new Date(Date.now() + delayMin * 60000);
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i + 1,
                  next_run_at: nextRun.toISOString(),
                  step_results: [...stepResults, { ...stepResult, status: "delayed", next_run: nextRun.toISOString() }],
                })
                .eq("id", executionId);
              status = "waiting";
              break;
            }
            // Short delays: wait inline
            await delay(Math.min(delayMin * 60000, 5 * 60000));
            stepResult.status = "completed";
          }

          else if (step.tipo === "whatsapp") {
            const phone = lead_data?.phone || lead_data?.telefone;
            if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else {
              const msgText = (step.mensagem || step.texto || "")
                .replace(/\{\{nome\}\}/g, lead_data?.nome || "")
                .replace(/\{\{email\}\}/g, lead_data?.email || "")
                .replace(/\{\{produto\}\}/g, lead_data?.produto || "");

              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              
              // Auto-detect: find first active provider if none specified
              if (!providerId) {
                const { data: activeProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (activeProviders?.length) {
                  providerId = activeProviders[0].id;
                  console.log("[openflow-executor] Auto-detected provider:", providerId);
                }
              }

              if (!providerId) {
                stepResult.status = "error";
                stepResult.reason = "Nenhum provider WhatsApp ativo encontrado";
              } else {
                const waRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    provider_id: providerId,
                    phone,
                    content: msgText,
                    project_id,
                  }),
                });
                const waData = await waRes.json();
                stepResult.status = waData.success ? "sent" : "error";
                stepResult.response = waData;
              }
            }
          }

          else if (step.tipo === "email") {
            const toEmail = lead_data?.email;
            if (!toEmail) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem email do lead";
            } else {
              const templateId = step.template_id;
              if (!templateId) {
                stepResult.status = "error";
                stepResult.reason = "template_id não configurado";
              } else {
                const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-project-email`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    project_id,
                    template_id: templateId,
                    to_email: toEmail,
                  }),
                });
                const emailData = await emailRes.json();
                stepResult.status = emailData.success ? "sent" : "error";
                stepResult.response = emailData;
              }
            }
          }

          else if (step.tipo === "condicao" || step.tipo === "condition") {
            // Simple condition: check a field value
            const field = step.campo || step.field;
            const operator = step.operador || step.operator || "equals";
            const value = step.valor || step.value;
            const leadValue = lead_data?.[field];

            let conditionMet = false;
            if (operator === "equals") conditionMet = leadValue == value;
            else if (operator === "not_equals") conditionMet = leadValue != value;
            else if (operator === "contains") conditionMet = String(leadValue || "").includes(String(value));
            else if (operator === "gt") conditionMet = Number(leadValue) > Number(value);
            else if (operator === "lt") conditionMet = Number(leadValue) < Number(value);
            else if (operator === "exists") conditionMet = leadValue != null && leadValue !== "";

            stepResult.status = "evaluated";
            stepResult.condition_met = conditionMet;

            // If condition not met and has else_skip, jump steps
            if (!conditionMet && step.else_skip) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
            }
          }

          else {
            stepResult.status = "unknown_type";
          }
        } catch (stepErr: any) {
          stepResult.status = "error";
          stepResult.error = stepErr.message;
          status = "failed";
          errorMessage = `Step ${i} (${step.tipo}): ${stepErr.message}`;
        }

        stepResult.finished_at = new Date().toISOString();
        stepResults.push(stepResult);

        if (status === "failed" || status === "waiting") break;

        // Small delay between steps to avoid overwhelming APIs
        if (i < steps.length - 1) await delay(500);
      }

      // Final update
      if (status !== "waiting") {
        await supabase.from("imphq_flow_executions")
          .update({
            status,
            current_step: steps.length,
            step_results: stepResults,
            error_message: errorMessage,
          })
          .eq("id", executionId);
      }

      // Insert execution log
      await supabase.from("imphq_automacao_logs").insert({
        automacao_id: auto.id,
        project_id,
        trigger_data: { trigger_tipo, lead_data: lead_data || null },
        acoes_executadas: stepResults,
        status: status === "failed" ? "error" : "success",
        error_message: errorMessage,
      });

      results.push({
        automacao_id: auto.id,
        automacao_nome: auto.nome,
        execution_id: executionId,
        status,
        steps_executed: stepResults.length,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      executed: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[openflow-executor] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
