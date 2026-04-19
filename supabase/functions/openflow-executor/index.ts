import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Normalize BR phone (ensure 55 prefix)
function normalizeBRPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

// Normalize step fields from editor format to executor format
function normalizeStep(step: any): any {
  const tipo = step.tipo === "aguardar" ? "delay" : step.tipo;
  return {
    ...step,
    tipo,
    // Message: editor uses 'template', executor expects 'mensagem'
    mensagem: step.mensagem || step.texto || step.template || "",
    // Delay: editor uses 'delay_min', executor expects 'delay_min'
    delay_min: step.delay_min || step.minutos || step.delay || 1,
  };
}

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

    // Normalize trigger: map UI names to webhook names and vice-versa
    const triggerAliases: Record<string, string[]> = {
      lead_novo: ["lead_novo", "lead_capturado"],
      lead_capturado: ["lead_capturado", "lead_novo"],
      aguardando_pagamento: ["aguardando_pagamento", "pix_gerado"],
      pix_gerado: ["pix_gerado", "aguardando_pagamento"],
    };
    const triggerVariants = triggerAliases[trigger_tipo] || [trigger_tipo];

    // Find matching automations
    let query = supabase
      .from("imphq_automacoes")
      .select("*")
      .in("trigger_tipo", triggerVariants)
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
      // CRITICAL FIX: Read from 'acoes' (editor field) with fallback to 'etapas' (legacy)
      const rawSteps = auto.acoes || auto.etapas || [];
      const steps = rawSteps.map(normalizeStep);
      const stepResults: any[] = [];
      let status = "completed";
      let errorMessage: string | null = null;
      let messagesSent = 0;
      let stepsFailed = 0;
      const failureMessages: string[] = [];

      // Steps that should HALT the flow on failure (critical). All comm channels continue.
      const isCriticalStep = (tipo: string) => {
        const critical = ["criar_venda", "create_sale", "stop", "abortar"];
        return critical.includes(tipo);
      };

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

      if (steps.length === 0) {
        // No steps configured — mark as failed, not success
        status = "failed";
        errorMessage = "Automação sem ações/etapas configuradas";
        await supabase.from("imphq_flow_executions")
          .update({ status, error_message: errorMessage, step_results: [] })
          .eq("id", executionId);

        await supabase.from("imphq_automacao_logs").insert({
          automacao_id: auto.id,
          project_id,
          trigger_data: { trigger_tipo, lead_data: lead_data || null },
          acoes_executadas: [],
          status: "error",
          error_message: errorMessage,
        });

        results.push({
          automacao_id: auto.id,
          automacao_nome: auto.nome,
          execution_id: executionId,
          status,
          steps_executed: 0,
          error: errorMessage,
        });
        continue;
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult: any = { step: i, tipo: step.tipo, started_at: new Date().toISOString() };

        try {
          // Update current step
          await supabase.from("imphq_flow_executions")
            .update({ current_step: i })
            .eq("id", executionId);

          if (step.tipo === "delay" || step.tipo === "espera") {
            const delayMin = step.delay_min || 1;
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
              // Resolve link: lead_data.link > auto.link_checkout > ""
              const linkUrl = lead_data?.link || (auto as any).link_checkout || "";

              const msgText = (step.mensagem || "")
                .replace(/\{\{nome\}\}/g, lead_data?.nome || "")
                .replace(/\{\{email\}\}/g, lead_data?.email || "")
                .replace(/\{\{produto\}\}/g, lead_data?.produto || "")
                .replace(/\{\{telefone\}\}/g, phone || "")
                .replace(/\{\{link\}\}/g, linkUrl)
                .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")}` : "")
                .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || "");

              // Provider hierarchy: step > auto > lead > project-active > global
              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              
              // Try project-specific provider first
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (projProviders?.length) {
                  providerId = projProviders[0].id;
                  console.log("[openflow-executor] Project provider:", providerId);
                }
              }

              // Global fallback
              if (!providerId) {
                const { data: activeProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (activeProviders?.length) {
                  providerId = activeProviders[0].id;
                  console.log("[openflow-executor] Global provider fallback:", providerId);
                }
              }

              stepResult.provider_id = providerId || null;
              stepResult.phone = phone;
              stepResult.message_preview = msgText.substring(0, 100);

              if (!providerId) {
                stepResult.status = "error";
                stepResult.reason = "Nenhum provider WhatsApp ativo encontrado";
                stepsFailed++;
                failureMessages.push(`Step ${i} (whatsapp): Nenhum provider ativo`);
              } else {
                const waRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    provider_id: providerId,
                    phone: normalizeBRPhone(phone),
                    content: msgText,
                    project_id,
                  }),
                });
                const waData = await waRes.json();
                stepResult.status = waData.success ? "sent" : "error";
                stepResult.response = waData;
                if (waData.success) {
                  messagesSent++;
                } else {
                  stepsFailed++;
                  failureMessages.push(`Step ${i} (whatsapp): ${waData.error || "Falha no envio"}`);
                  console.warn(`[openflow-executor] WhatsApp falhou no step ${i}, continuando para próximos steps (e-mails etc.)`);
                }
              }
            }
          }

          else if (step.tipo === "email") {
            const toEmail = lead_data?.email;
            if (!toEmail) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem email do lead";
              console.log(`[openflow-executor] Step ${i} email: skipped - sem email do lead`);
            } else {
              const linkUrl = lead_data?.link || (auto as any).link_checkout || "";
              const templateId = step.template_id;

              // Inline message from the editor (field "template" or "mensagem")
              const inlineMsg = step.mensagem || step.template || step.texto || "";

              // Parse subject from inline message: "Assunto: SUBJECT\n\nBODY"
              let emailSubject = step.assunto || "";
              let emailBody = inlineMsg;
              if (!emailSubject && inlineMsg) {
                const assuntoMatch = inlineMsg.match(/^Assunto:\s*(.+?)(?:\n|$)/i);
                if (assuntoMatch) {
                  emailSubject = assuntoMatch[1].trim();
                  emailBody = inlineMsg.replace(/^Assunto:\s*.+?\n+/i, "").trim();
                }
              }

              // Replace variables in subject and body
              const replaceVars = (text: string) =>
                text
                  .replace(/\{\{nome\}\}/g, lead_data?.nome || "")
                  .replace(/\{\{email\}\}/g, lead_data?.email || "")
                  .replace(/\{\{produto\}\}/g, lead_data?.produto || "")
                  .replace(/\{\{telefone\}\}/g, lead_data?.phone || lead_data?.telefone || "")
                  .replace(/\{\{link\}\}/g, linkUrl)
                  .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")}` : "")
                  .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || "");

              if (templateId) {
                // Mode 1: Use saved project template by ID
                console.log(`[openflow-executor] Step ${i} email: enviando via template_id=${templateId} para ${toEmail}`);
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
                if (emailData.success) {
                  messagesSent++;
                  console.log(`[openflow-executor] Step ${i} email: enviado com sucesso para ${toEmail}`);
                } else {
                  status = "failed";
                  errorMessage = `Step ${i} (email): ${emailData.error || "Erro desconhecido no envio"}`;
                  console.error(`[openflow-executor] Step ${i} email: ERRO - ${emailData.error || JSON.stringify(emailData)}`);
                }
              } else if (emailBody) {
                // Mode 2: Inline message — send directly via Resend using project config
                console.log(`[openflow-executor] Step ${i} email: enviando inline para ${toEmail}, assunto: "${emailSubject}"`);

                // Fetch project Resend config
                let resendApiKey = "";
                let fromEmail = "";
                let fromName = "";
                let replyTo = "";

                const { data: creds } = await supabase
                  .from("imphq_integration_credentials")
                  .select("credentials")
                  .eq("project_id", project_id)
                  .eq("provider", "resend")
                  .maybeSingle();

                if (creds?.credentials) {
                  resendApiKey = (creds.credentials as any).api_key || "";
                  fromEmail = (creds.credentials as any).from_email || "";
                  fromName = (creds.credentials as any).from_name || "";
                  replyTo = (creds.credentials as any).reply_to || "";
                }

                // Fallback to legacy JSONB
                if (!resendApiKey) {
                  const { data: proj } = await supabase
                    .from("imphq_projects")
                    .select("data")
                    .eq("id", project_id)
                    .single();
                  const emailConfig = (proj?.data as any)?.email_config || {};
                  const briefing = (proj?.data as any)?.checklist?.resend || {};
                  resendApiKey = emailConfig.resend_api_key || briefing.resend_api_key || "";
                  fromEmail = fromEmail || emailConfig.from_email || briefing.from_email || "";
                  fromName = fromName || emailConfig.from_name || briefing.from_name || "";
                  replyTo = replyTo || emailConfig.reply_to || briefing.reply_to || "";
                }

                if (!resendApiKey) {
                  stepResult.status = "error";
                  stepResult.reason = "Resend API Key não configurada neste projeto";
                  status = "failed";
                  errorMessage = `Step ${i} (email): Resend API Key não configurada`;
                  console.error(`[openflow-executor] Step ${i} email: Resend API Key não configurada`);
                } else {
                  const finalSubject = replaceVars(emailSubject || "Mensagem automática");
                  const finalBody = replaceVars(emailBody);
                  // Convert plain text body to simple HTML
                  const htmlBody = finalBody.includes("<") ? finalBody : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">${finalBody.replace(/\n/g, "<br>")}</div>`;

                  const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${resendApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
                      to: [toEmail],
                      subject: finalSubject,
                      html: htmlBody,
                      reply_to: replyTo || undefined,
                    }),
                  });
                  const resendData = await resendRes.json();

                  // Log
                  await supabase.from("imphq_events").insert({
                    project_id,
                    event_name: "email_sent",
                    page_url: "",
                    data: {
                      to_email: toEmail,
                      template_name: `inline: ${finalSubject.substring(0, 50)}`,
                      status: resendRes.ok ? "sent" : "error",
                      error: resendRes.ok ? null : (resendData.message || "Erro"),
                      resend_id: resendData.id || null,
                      source: "openflow",
                    },
                  });

                  if (resendRes.ok) {
                    stepResult.status = "sent";
                    stepResult.resend_id = resendData.id;
                    messagesSent++;
                    console.log(`[openflow-executor] Step ${i} email inline: enviado para ${toEmail}, id: ${resendData.id}`);
                  } else {
                    stepResult.status = "error";
                    stepResult.reason = resendData.message || "Erro no Resend";
                    status = "failed";
                    errorMessage = `Step ${i} (email): ${resendData.message || "Erro no Resend"}`;
                    console.error(`[openflow-executor] Step ${i} email inline: ERRO - ${resendData.message || JSON.stringify(resendData)}`);
                  }
                }
              } else {
                stepResult.status = "error";
                stepResult.reason = "Nenhum conteúdo de email configurado (nem template_id, nem mensagem inline)";
                status = "failed";
                errorMessage = `Step ${i} (email): Sem conteúdo configurado`;
                console.error(`[openflow-executor] Step ${i} email: sem conteúdo - automação ${auto.id}`);
              }
            }
          }

          else if (step.tipo === "condicao" || step.tipo === "condition") {
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

            if (!conditionMet && step.else_skip) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
            }
          }

          else {
            stepResult.status = "unknown_type";
            stepResult.reason = `Tipo "${step.tipo}" não reconhecido`;
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

        // Small delay between steps
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

      // Insert execution log with enriched data
      await supabase.from("imphq_automacao_logs").insert({
        automacao_id: auto.id,
        project_id,
        trigger_data: {
          trigger_tipo,
          lead_data: lead_data || null,
          phone: lead_data?.phone || lead_data?.telefone || null,
          provider_id: auto.provider_id || null,
        },
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
        messages_sent: messagesSent,
        step_results: stepResults,
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
