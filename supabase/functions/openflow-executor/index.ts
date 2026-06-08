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

// Helper to get fuso horário offset by Brazilian DDD
function getLeadTimezoneOffset(phone: string): number {
  const digits = (phone || "").replace(/\D/g, "");
  // Brazilian numbers: starting with 55 (country code), then 2-digit DDD
  if (!digits.startsWith("55") || digits.length < 4) {
    return -3; // Default to Brasília (UTC-3)
  }
  const ddd = parseInt(digits.substring(2, 4));
  
  // Acre (AC) - UTC-5
  if (ddd === 68) return -5;
  
  // UTC-4: Amazonas (92, 97), Rondônia (69), Roraima (95), Mato Grosso do Sul (67), Mato Grosso (65, 66)
  const utc4DDDs = [92, 97, 69, 95, 67, 65, 66];
  if (utc4DDDs.includes(ddd)) return -4;
  
  // UTC-3: Rest of Brazil (DF, GO, TO, and all South/Southeast/Northeast states)
  return -3;
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
    const { trigger_tipo, project_id, lead_data, automacao_id, resume_from_step } = await req.json();
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
      boleto_gerado: ["boleto_gerado", "aguardando_pagamento"],
      pagamento_recusado: ["pagamento_recusado"],
      pagamento_expirado: ["pagamento_expirado"],
      chargeback: ["chargeback"],
      compra_cancelada: ["compra_cancelada"],
      assinatura_cancelada: ["assinatura_cancelada"],
      assinatura_renovada: ["assinatura_renovada"],
      upsell_aprovado: ["upsell_aprovado"],
      orderbump_aprovado: ["orderbump_aprovado"],
      primeiro_acesso: ["primeiro_acesso"],
      trial_iniciado: ["trial_iniciado"],
      tag_adicionada: ["tag_adicionada"],
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

    // Fetch lead details if lead_id is present to get accurate, latest tags
    let leadTags: string[] = [];
    if (lead_data?.lead_id) {
      const { data: dbLead } = await supabase
        .from("imphq_leads")
        .select("tags, campanha_id")
        .eq("id", lead_data.lead_id)
        .maybeSingle();
      if (dbLead) {
        leadTags = dbLead.tags || [];
        if (!lead_data.campanha_id && dbLead.campanha_id) {
          lead_data.campanha_id = dbLead.campanha_id;
        }
      }
    } else if (lead_data?.tags) {
      leadTags = Array.isArray(lead_data.tags) ? lead_data.tags : [lead_data.tags];
    }

    // Filter by project, product, campanha and tag_filtro
    const leadCampanha = lead_data?.campanha_id;
    const matched = (automacoes || []).filter((a: any) => {
      if (a.project_id && a.project_id !== project_id) return false;
      if (a.produto && lead_data?.produto) {
        if (a.produto.toLowerCase() !== lead_data.produto.toLowerCase()) return false;
      }
      // Se a automação tem campanha definida, só dispara para leads da mesma campanha
      if (a.campanha_id) {
        if (!leadCampanha || a.campanha_id !== leadCampanha) return false;
      }
      // Se a automação tem tag_filtro definida, só dispara se o lead tiver essa tag
      if (a.tag_filtro) {
        const hasTag = leadTags.some((t: string) => t.toLowerCase() === a.tag_filtro.toLowerCase());
        if (!hasTag) return false;
      }
      return true;
    });

    if (matched.length === 0) {
      return new Response(JSON.stringify({ ok: true, executed: 0, message: "Nenhuma automação encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ── Cross-flow lock: check if lead is already inside a DIFFERENT active flow
    // Prevent a lead in Flow A from being pulled into conflicting Flow B simultaneously.
    // Exception: resume_from_step (re-entry from wa-ai-reply) and explicit automacao_id bypass.
    let activeFlowId: string | null = null;
    let activeFlowName: string | null = null;
    if (lead_data?.lead_id && !resume_from_step && !automacao_id) {
      const { data: activeExecs } = await supabase
        .from("imphq_flow_executions")
        .select("id, automacao_id")
        .eq("lead_id", lead_data.lead_id)
        .in("status", ["running", "waiting"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (activeExecs && activeExecs.length > 0) {
        activeFlowId = activeExecs[0].automacao_id;
        // Look up automation name for logging
        const { data: activeAuto } = await supabase
          .from("imphq_automacoes")
          .select("nome")
          .eq("id", activeFlowId)
          .maybeSingle();
        activeFlowName = activeAuto?.nome || activeFlowId;
        console.log(`[openflow-executor] Lead ${lead_data.lead_id} already in flow "${activeFlowName}" (${activeFlowId})`);
      }
    }

    for (const auto of matched) {
      // ── Cross-flow lock: skip if lead is in a different active flow
      if (activeFlowId && activeFlowId !== auto.id) {
        console.log(`[openflow-executor] Skipping ${auto.id} (${auto.nome}): lead already in flow "${activeFlowName}"`);
        results.push({ automacao_id: auto.id, automacao_nome: auto.nome, status: "skipped", reason: "cross_flow_lock", active_flow: activeFlowName });
        continue;
      }

      // ── Dedupe: skip if same automation ran for same lead within N hours
      const dedupeH = Number(auto.dedupe_hours || 0);
      if (dedupeH > 0 && lead_data?.lead_id) {
        const cutoff = new Date(Date.now() - dedupeH * 3600_000).toISOString();
        const { data: recent } = await supabase
          .from("imphq_flow_executions")
          .select("id")
          .eq("automacao_id", auto.id)
          .eq("lead_id", lead_data.lead_id)
          .in("status", ["running", "completed", "partial", "waiting"])
          .gte("created_at", cutoff)
          .limit(1);
        if (recent && recent.length > 0) {
          console.log(`[openflow-executor] Skipping ${auto.id}: dedupe ${dedupeH}h ativo para lead ${lead_data.lead_id}`);
          results.push({ automacao_id: auto.id, automacao_nome: auto.nome, status: "skipped", reason: "dedupe" });
          continue;
        }
      }

      // CRITICAL FIX: Read from 'acoes' (editor field) with fallback to 'etapas' (legacy)
      const rawSteps = auto.acoes || auto.etapas || [];
      const steps = rawSteps.map(normalizeStep);

      const startStep = resume_from_step ? Number(resume_from_step) : 0;
      let prevStepResults: any[] = [];
      if (startStep > 0 && lead_data?.lead_id) {
        const { data: lastExec } = await supabase
          .from("imphq_flow_executions")
          .select("step_results")
          .eq("automacao_id", auto.id)
          .eq("lead_id", lead_data.lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastExec && Array.isArray(lastExec.step_results)) {
          prevStepResults = lastExec.step_results;
        }
      }

      const stepResults: any[] = [...prevStepResults];
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

      // ── Quiet hours: reschedule if current time falls inside the configured window (local timezone by DDD)
      const qs = auto.quiet_start, qe = auto.quiet_end;
      if (qs != null && qe != null && qs !== qe) {
        const phone = lead_data?.phone || lead_data?.telefone || "";
        const offset = phone ? getLeadTimezoneOffset(phone) : -3;
        const utcHour = new Date().getUTCHours();
        const hourLead = (utcHour + offset + 24) % 24;
        
        const inWindow = qs < qe ? (hourLead >= qs && hourLead < qe) : (hourLead >= qs || hourLead < qe);
        if (inWindow) {
          const hoursToWait = (qe - hourLead + 24) % 24;
          const minutesToWait = hoursToWait * 60 + 5; // Add 5 min buffer
          const nextRun = new Date(Date.now() + minutesToWait * 60 * 1000);
          
          console.log(`[openflow-executor] Lead phone ${phone} inside quiet hours window. Local hour: ${hourLead}h (limits: ${qs}-${qe}h). Rescheduling in ${hoursToWait}h (${minutesToWait}m) to ${nextRun.toISOString()}`);
          
          const delayResults = [
            ...stepResults,
            {
              step: startStep,
              status: "delayed_due_to_quiet_hours",
              started_at: new Date().toISOString(),
              notes: `Aguardando fim da janela de silêncio local (hora local do lead: ${hourLead}h, limites: ${qs}h a ${qe}h)`,
            }
          ];

          // Create execution record in waiting status
          const { data: execution, error: execErr } = await supabase
            .from("imphq_flow_executions")
            .insert({
              automacao_id: auto.id,
              project_id,
              lead_id: lead_data?.lead_id || null,
              trigger_tipo,
              status: "waiting",
              current_step: startStep,
              next_run_at: nextRun.toISOString(),
              step_results: delayResults,
            })
            .select("id")
            .single();

          if (execErr) {
            console.error("[openflow-executor] Failed to create quiet hours execution:", execErr);
          } else {
            await supabase.from("imphq_automacao_logs").insert({
              automacao_id: auto.id,
              project_id,
              trigger_data: { trigger_tipo, lead_data: lead_data || null },
              acoes_executadas: [],
              status: "waiting",
              error_message: `Aguardando fim da janela de silêncio local do lead (${hourLead}h, limites: ${qs}-${qe}h). Reagendado para ${nextRun.toLocaleString("pt-BR")}.`,
            });
          }

          results.push({ 
            automacao_id: auto.id, 
            automacao_nome: auto.nome, 
            execution_id: execution?.id || null,
            status: "waiting", 
            reason: "quiet_hours_rescheduled" 
          });
          continue;
        }
      }

      // Create execution record
      const { data: execution, error: execErr } = await supabase
        .from("imphq_flow_executions")
        .insert({
          automacao_id: auto.id,
          project_id,
          lead_id: lead_data?.lead_id || null,
          trigger_tipo,
          status: "running",
          current_step: startStep,
          step_results: stepResults,
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

      for (let i = startStep; i < steps.length; i++) {
        const step = steps[i];
        const stepResult: any = { step: i, tipo: step.tipo, started_at: new Date().toISOString() };

        // Check if lead replied or purchased since the beginning of this execution
        let hasRepliedOrPurchased = false;
        let abortReason = "";
        
        const phone = lead_data?.phone || lead_data?.telefone;
        const leadId = lead_data?.lead_id;
        
        if (phone || leadId) {
          let originalStart = new Date().toISOString();
          if (resume_from_step && Number(resume_from_step) > 0) {
            try {
              const { data: originalExec } = await supabase
                .from("imphq_flow_executions")
                .select("created_at")
                .eq("automacao_id", auto.id)
                .eq("lead_id", leadId)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (originalExec) {
                originalStart = originalExec.created_at;
              }
            } catch (err) {
              console.error("[openflow-executor] Error fetching original execution start time:", err);
            }
          }

          // Check if there is any approved purchase since originalStart
          if (leadId) {
            try {
              const { data: purchases } = await supabase
                .from("imphq_vendas")
                .select("id")
                .eq("lead_id", leadId)
                .eq("status", "aprovado")
                .gt("created_at", originalStart)
                .limit(1);
              if (purchases && purchases.length > 0) {
                hasRepliedOrPurchased = true;
                abortReason = "Lead realizou a compra";
              }
            } catch (err) {
              console.error("[openflow-executor] Error checking recent purchases:", err);
            }
          }

          // Check if there is any incoming WhatsApp message since originalStart
          if (!hasRepliedOrPurchased && phone) {
            try {
              const cleanPhone = phone.replace(/\D/g, "");
              const searchPhones = [phone, cleanPhone];
              if (cleanPhone.startsWith("55")) {
                searchPhones.push(cleanPhone.substring(2));
              } else {
                searchPhones.push("55" + cleanPhone);
              }
              const { data: incomingMsgs } = await supabase
                .from("imphq_wa_messages")
                .select("id")
                .in("phone", searchPhones)
                .eq("direction", "incoming")
                .gt("created_at", originalStart)
                .limit(1);
              if (incomingMsgs && incomingMsgs.length > 0) {
                hasRepliedOrPurchased = true;
                abortReason = "Lead respondeu à automação";
              }
            } catch (err) {
              console.error("[openflow-executor] Error checking incoming WhatsApp messages:", err);
            }
          }
        }

        if (hasRepliedOrPurchased) {
          console.log(`[openflow-executor] Aborting execution ${executionId}: ${abortReason}`);
          status = "completed";
          stepResult.status = "skipped";
          stepResult.reason = abortReason;
          stepResult.finished_at = new Date().toISOString();
          stepResults.push(stepResult);
          break; // Stop flow
        }

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

              // ── A/B Testing Copy override
              let selectedVariantId = null;
              let selectedTestId = null;
              let selectedMsgTemplate = step.mensagem || step.template || "";
              let abVariant = null;

              if (step.ab_test_enabled) {
                const cleanPhone = phone.replace(/\D/g, "");
                const lastDigit = parseInt(cleanPhone.slice(-1)) || 0;
                abVariant = lastDigit % 2 === 0 ? "A" : "B";
                if (abVariant === "B") {
                  selectedMsgTemplate = step.template_b || step.mensagem_b || selectedMsgTemplate;
                }
                console.log(`[openflow-executor] Native block A/B test enabled. Lead phone ${phone} assigned to Variant: ${abVariant}`);
                stepResult.ab_variant = abVariant;
              } else {
                try {
                  // Check for active A/B test for this trigger stage
                  const { data: activeTest } = await supabase
                    .from("imphq_wa_ab_tests")
                    .select("id, winner_variant_id")
                    .eq("project_id", project_id)
                    .eq("trigger_stage", trigger_tipo)
                    .eq("active", true)
                    .maybeSingle();

                  if (activeTest) {
                    selectedTestId = activeTest.id;
                    if (activeTest.winner_variant_id) {
                      // Winner already promoted
                      const { data: winnerVar } = await supabase
                        .from("imphq_wa_ab_test_variants")
                        .select("id, message_template")
                        .eq("id", activeTest.winner_variant_id)
                        .maybeSingle();
                      if (winnerVar) {
                        selectedVariantId = winnerVar.id;
                        selectedMsgTemplate = winnerVar.message_template;
                        console.log(`[openflow-executor] Using A/B test promoted winner variant: ${winnerVar.id}`);
                      }
                    } else {
                      // Test running: select variant by traffic percentage
                      const { data: variants } = await supabase
                        .from("imphq_wa_ab_test_variants")
                        .select("id, message_template, traffic_percentage")
                        .eq("test_id", activeTest.id)
                        .eq("active", true);

                      if (variants && variants.length > 0) {
                        const rand = Math.floor(Math.random() * 100);
                        let cumulative = 0;
                        let chosen = variants[0];
                        for (const v of variants) {
                          cumulative += v.traffic_percentage || 0;
                          if (rand < cumulative) {
                            chosen = v;
                            break;
                          }
                        }
                        selectedVariantId = chosen.id;
                        selectedMsgTemplate = chosen.message_template;
                        console.log(`[openflow-executor] Enrolled lead ${lead_data?.lead_id} in A/B test variant: ${chosen.id}`);

                        // Log enrollment
                        if (lead_data?.lead_id) {
                          await supabase.from("imphq_wa_ab_test_logs").insert({
                            test_id: activeTest.id,
                            variant_id: chosen.id,
                            lead_id: lead_data.lead_id,
                          });
                          // Increment sent count
                          await supabase.rpc("increment_ab_variant_sent", { p_variant_id: chosen.id });
                        }
                      }
                    }
                  }
                } catch (abErr: any) {
                  console.error("[openflow-executor] Error in A/B test resolution:", abErr.message);
                }
              }

              const msgText = selectedMsgTemplate
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

          else if (step.tipo === "audio") {
            const phone = lead_data?.phone || lead_data?.telefone;
            if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else {
              const linkUrl = lead_data?.link || (auto as any).link_checkout || "";
              const msgText = (step.mensagem || step.template || "")
                .replace(/\{\{nome\}\}/g, lead_data?.nome || "")
                .replace(/\{\{email\}\}/g, lead_data?.email || "")
                .replace(/\{\{produto\}\}/g, lead_data?.produto || "")
                .replace(/\{\{telefone\}\}/g, phone || "")
                .replace(/\{\{link\}\}/g, linkUrl)
                .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")}` : "")
                .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || "");

              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (projProviders?.length) providerId = projProviders[0].id;
              }

              if (!providerId) {
                const { data: activeProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (activeProviders?.length) providerId = activeProviders[0].id;
              }

              stepResult.provider_id = providerId || null;
              stepResult.phone = phone;
              stepResult.voice_provider = step.voice_provider || "elevenlabs";
              stepResult.voice_id = step.voice_id || "fernanda_hq";

              if (!providerId) {
                stepResult.status = "error";
                stepResult.reason = "Nenhum provider WhatsApp ativo encontrado";
                stepsFailed++;
                failureMessages.push(`Step ${i} (audio): Nenhum provider ativo`);
              } else {
                // Call whatsapp-api with voice action, generating ElevenLabs audio converted to OGG Opus in real time, mimicking recordings!
                const waRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_voice_synthesis`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    provider_id: providerId,
                    phone: normalizeBRPhone(phone),
                    text: msgText,
                    voice_provider: step.voice_provider || "elevenlabs",
                    voice_id: step.voice_id || "fernanda_hq",
                    voice_stability: step.voice_stability || 75,
                    voice_clarity: step.voice_clarity || 85,
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
                  failureMessages.push(`Step ${i} (audio): ${waData.error || "Falha no envio do áudio"}`);
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
                  stepsFailed++;
                  failureMessages.push(`Step ${i} (email): ${emailData.error || "Erro desconhecido"}`);
                  console.error(`[openflow-executor] Step ${i} email: ERRO (continuando) - ${emailData.error || JSON.stringify(emailData)}`);
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
                  stepsFailed++;
                  failureMessages.push(`Step ${i} (email): Resend API Key não configurada`);
                  console.error(`[openflow-executor] Step ${i} email: Resend API Key não configurada (continuando)`);
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
                    stepsFailed++;
                    failureMessages.push(`Step ${i} (email): ${resendData.message || "Erro no Resend"}`);
                    console.error(`[openflow-executor] Step ${i} email inline: ERRO (continuando) - ${resendData.message || JSON.stringify(resendData)}`);
                  }
                }
              } else {
                stepResult.status = "error";
                stepResult.reason = "Nenhum conteúdo de email configurado (nem template_id, nem mensagem inline)";
                stepsFailed++;
                failureMessages.push(`Step ${i} (email): Sem conteúdo configurado`);
                console.error(`[openflow-executor] Step ${i} email: sem conteúdo - automação ${auto.id}`);
              }
            }
          }

          else if (step.tipo === "condicao" || step.tipo === "condition") {
            const condDelay = Number(step.condicao_tempo_min || step.delay_min || 0);
            if (condDelay > 5 && resume_from_step !== i) {
              const nextRun = new Date(Date.now() + condDelay * 60000);
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i, // Resume at THIS step to evaluate the condition!
                  next_run_at: nextRun.toISOString(),
                  step_results: [...stepResults, { ...stepResult, status: "delayed_for_condition", next_run: nextRun.toISOString() }],
                })
                .eq("id", executionId);
              status = "waiting";
              break;
            }
            
            // Short delay wait inline if condDelay is > 0 but <= 5
            if (condDelay > 0 && condDelay <= 5 && resume_from_step !== i) {
              await delay(condDelay * 60000);
            }

            // Mapeia data de início da execução
            let flowStartTime = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
            const { data: firstExec } = await supabase
              .from("imphq_flow_executions")
              .select("created_at")
              .eq("id", executionId)
              .maybeSingle();
            if (firstExec) {
              flowStartTime = firstExec.created_at;
            }

            // 1. Checa WhatsApp replies
            let hasReplied = false;
            const phone = lead_data?.phone || lead_data?.telefone;
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, "");
              const searchPhones = [phone, cleanPhone];
              if (cleanPhone.startsWith("55")) {
                searchPhones.push(cleanPhone.substring(2));
              } else {
                searchPhones.push("55" + cleanPhone);
              }
              const { data: incomingMsgs } = await supabase
                .from("imphq_wa_messages")
                .select("id")
                .in("phone", searchPhones)
                .eq("direction", "incoming")
                .gt("created_at", flowStartTime)
                .limit(1);
              if (incomingMsgs && incomingMsgs.length > 0) {
                hasReplied = true;
              }
            }

            // 2. Checa Link clicks
            let hasClicked = false;
            const toEmail = lead_data?.email;
            if (toEmail || lead_data?.lead_id) {
              let query = supabase
                .from("imphq_events")
                .select("id")
                .gt("created_at", flowStartTime)
                .or(`event_name.eq.email_clicked,event_name.eq.link_clicked,event_name.eq.checkout_clicked`);
              if (toEmail) {
                query = query.filter("data->>to_email", "eq", toEmail);
              } else {
                query = query.filter("data->>lead_id", "eq", lead_data.lead_id);
              }
              const { data: clickEvents } = await query.limit(1);
              if (clickEvents && clickEvents.length > 0) {
                hasClicked = true;
              }
            }

            // 3. Checa Email opens
            let hasOpened = false;
            if (toEmail) {
              const { data: openEvents } = await supabase
                .from("imphq_events")
                .select("id")
                .eq("event_name", "email_opened")
                .filter("data->>to_email", "eq", toEmail)
                .gt("created_at", flowStartTime)
                .limit(1);
              if (openEvents && openEvents.length > 0) {
                hasOpened = true;
              }
            }

            let conditionMet = false;
            const condTipo = step.condicao_tipo;

            if (condTipo) {
              if (condTipo === "respondeu_whatsapp") {
                conditionMet = hasReplied;
              } else if (condTipo === "nao_respondeu_whatsapp") {
                conditionMet = !hasReplied;
              } else if (condTipo === "clicou_link") {
                conditionMet = hasClicked;
              } else if (condTipo === "nao_clicou_link") {
                conditionMet = !hasClicked;
              } else if (condTipo === "abreu_email") {
                conditionMet = hasOpened;
              } else if (condTipo === "nao_abreu_email") {
                conditionMet = !hasOpened;
              }
            } else {
              const field = step.campo || step.field;
              const operator = step.operador || step.operator || "equals";
              const value = step.valor || step.value;
              const leadValue = lead_data?.[field];

              if (operator === "equals") conditionMet = leadValue == value;
              else if (operator === "not_equals") conditionMet = leadValue != value;
              else if (operator === "contains") conditionMet = String(leadValue || "").includes(String(value));
              else if (operator === "gt") conditionMet = Number(leadValue) > Number(value);
              else if (operator === "lt") conditionMet = Number(leadValue) < Number(value);
              else if (operator === "exists") conditionMet = leadValue != null && leadValue !== "";
            }

            stepResult.status = "evaluated";
            stepResult.condition_met = conditionMet;

            if (!conditionMet) {
              if (step.else_action === "abortar") {
                status = "completed";
                stepResult.notes = "Fluxo abortado por condição não atendida";
                stepResult.finished_at = new Date().toISOString();
                stepResults.push(stepResult);
                break;
              } else {
                const skipCount = parseInt(step.else_skip || step.else_skip_steps) || 1;
                i += skipCount;
                stepResult.skipped_steps = skipCount;
              }
            }
          }

          else if (step.tipo === "adicionar_tag") {
            const tag = step.tag;
            if (lead_data?.lead_id && tag) {
              const { data: dbLead } = await supabase
                .from("imphq_leads")
                .select("tags")
                .eq("id", lead_data.lead_id)
                .maybeSingle();
              const currentTags = dbLead?.tags || [];
              if (!currentTags.includes(tag)) {
                const newTags = [...currentTags, tag];
                await supabase
                  .from("imphq_leads")
                  .update({ tags: newTags })
                  .eq("id", lead_data.lead_id);
                leadTags = newTags;
                stepResult.status = "tag_added";
                stepResult.tag = tag;
              } else {
                stepResult.status = "tag_already_exists";
                stepResult.tag = tag;
              }
            } else {
              stepResult.status = "skipped";
              stepResult.reason = "Sem lead_id ou tag não configurada";
            }
          }

          else if (step.tipo === "remover_tag") {
            const tag = step.tag;
            if (lead_data?.lead_id && tag) {
              const { data: dbLead } = await supabase
                .from("imphq_leads")
                .select("tags")
                .eq("id", lead_data.lead_id)
                .maybeSingle();
              const currentTags = dbLead?.tags || [];
              if (currentTags.includes(tag)) {
                const newTags = currentTags.filter((t: string) => t !== tag);
                await supabase
                  .from("imphq_leads")
                  .update({ tags: newTags })
                  .eq("id", lead_data.lead_id);
                leadTags = newTags;
                stepResult.status = "tag_removed";
                stepResult.tag = tag;
              } else {
                stepResult.status = "tag_not_found";
                stepResult.tag = tag;
              }
            } else {
              stepResult.status = "skipped";
              stepResult.reason = "Sem lead_id ou tag não configurada";
            }
          }

          else if (step.tipo === "ia_message") {
            const phone = lead_data?.phone || lead_data?.telefone;
            if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else if (resume_from_step === i) {
              // We are resuming this step after the conversation has finished.
              // Just complete it and let the loop proceed to the next step!
              stepResult.status = "completed";
              stepResult.notes = "Conversa finalizada pelo assistente de IA";
            } else {
              // First time running this step: send initial message and pause!
              const cleanPhone = phone.replace(/\D/g, "");
              const searchPhones = [phone, cleanPhone];
              if (cleanPhone.startsWith("55")) {
                searchPhones.push(cleanPhone.substring(2));
              } else {
                searchPhones.push("55" + cleanPhone);
              }

              // Load lead details for personalization
              let leadDb = null;
              if (lead_data?.lead_id) {
                const { data: l } = await supabase
                  .from("imphq_leads")
                  .select("*")
                  .eq("id", lead_data.lead_id)
                  .maybeSingle();
                leadDb = l;
              } else {
                const { data: l } = await supabase
                  .from("imphq_leads")
                  .select("*")
                  .eq("project_id", project_id)
                  .in("phone", searchPhones)
                  .maybeSingle();
                leadDb = l;
              }

              const linkUrl = lead_data?.link || (auto as any).link_checkout || "";
              // ── A/B Testing Copy override for IA Message
              let abVariant = null;
              let selectedMsgTemplate = step.mensagem || step.template || "";

              if (step.ab_test_enabled) {
                const cleanPhone = phone.replace(/\D/g, "");
                const lastDigit = parseInt(cleanPhone.slice(-1)) || 0;
                abVariant = lastDigit % 2 === 0 ? "A" : "B";
                if (abVariant === "B") {
                  selectedMsgTemplate = step.template_b || step.mensagem_b || selectedMsgTemplate;
                }
                console.log(`[openflow-executor] Native block A/B test enabled for IA Message. Lead phone ${phone} assigned to Variant: ${abVariant}`);
                stepResult.ab_variant = abVariant;
              }

              let finalMsg = selectedMsgTemplate.trim();

              if (!finalMsg) {
                // Generate initial message using LLM
                const { data: project } = await supabase
                  .from("imphq_projects")
                  .select("name, data, avatar, brand_kit")
                  .eq("id", project_id)
                  .maybeSingle();

                const pData = typeof project?.data === "string" ? JSON.parse(project.data) : (project?.data || {});
                const expert = pData.expert || pData.especialista || {};
                const aiProfile = leadDb?.data?.ai_profile || {};
                const pains = Array.isArray(aiProfile.pains) ? aiProfile.pains : [];
                const desires = Array.isArray(aiProfile.desires) ? aiProfile.desires : [];
                const moments = Array.isArray(aiProfile.moments) ? aiProfile.moments : [];
                const seekings = Array.isArray(aiProfile.seekings) ? aiProfile.seekings : [];
                const schwartz = leadDb?.data?.desejo_schwartz || "";

                const { data: aiConfig } = await supabase
                  .from("imphq_wa_ai_config")
                  .select("*")
                  .eq("project_id", project_id)
                  .eq("enabled", true)
                  .maybeSingle();

                const systemPrompt = `Você é um assessor/vendedor de alta performance especializado em reativação de leads via WhatsApp.
Você representa o projeto/marca: "${project?.name || ''}".
Expert/Persona: ${aiConfig?.expert_persona || JSON.stringify(expert)}
Instruções gerais da marca: ${aiConfig?.custom_instructions || ''}

Contexto do Lead:
- Nome: ${lead_data?.nome || leadDb?.name || "lead"}
- Momento atual: ${moments.join(", ") || "Não mapeado"}
- Dores principais: ${pains.join(", ") || "Não mapeada"}
- Desejos/Metas: ${desires.join(", ") || "Não mapeado"}
- O que busca: ${seekings.join(", ") || "Não mapeado"}
- Desejo de Schwartz: ${schwartz || "Não mapeado"}

Objetivo do passo:
Você deve enviar uma mensagem curta de reativação para iniciar a conversa com o lead.
Tom: Curto, amigável, direto, focado em WhatsApp (máximo 3 linhas ou 2-3 frases). Sem aspas, sem anotações.`.trim();

                const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
                if (!OPENROUTER_API_KEY) {
                  throw new Error("OPENROUTER_API_KEY não configurado");
                }

                const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://imperiox.lovable.app",
                    "X-Title": "Imperio HQ",
                  },
                  body: JSON.stringify({
                    model: aiConfig?.ai_model || "openai/gpt-4o-mini",
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: "Gere a mensagem curta inicial de reativação." }
                    ],
                    max_tokens: 150,
                    temperature: 0.7,
                  }),
                });

                if (orRes.ok) {
                  const orData = await orRes.json();
                  finalMsg = (orData?.choices?.[0]?.message?.content || "").trim().replace(/^"|"$/g, "");
                } else {
                  finalMsg = "Oi, tudo bem? Gostaria de saber se você ainda tem interesse no nosso projeto!";
                }
              }

              finalMsg = finalMsg
                .replace(/\{\{nome\}\}/g, lead_data?.nome || leadDb?.name || "")
                .replace(/\{\{email\}\}/g, lead_data?.email || "")
                .replace(/\{\{produto\}\}/g, lead_data?.produto || "")
                .replace(/\{\{telefone\}\}/g, phone || "")
                .replace(/\{\{link\}\}/g, linkUrl)
                .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")}` : "")
                .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || "");

              // Choose provider
              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (projProviders?.length) providerId = projProviders[0].id;
              }
              if (!providerId) {
                const { data: activeProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .order("created_at", { ascending: true })
                  .limit(1);
                if (activeProviders?.length) providerId = activeProviders[0].id;
              }

              stepResult.provider_id = providerId || null;
              stepResult.phone = phone;
              stepResult.message_preview = finalMsg.substring(0, 100);

              if (!providerId) {
                stepResult.status = "error";
                stepResult.reason = "Nenhum provider WhatsApp ativo encontrado";
                stepsFailed++;
                failureMessages.push(`Step ${i} (ia_message): Nenhum provider ativo`);
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
                    content: finalMsg,
                    project_id,
                  }),
                });
                const waData = await waRes.json();
                stepResult.status = waData.success ? "sent" : "error";
                stepResult.response = waData;

                if (waData.success) {
                  messagesSent++;
                  await supabase.from("imphq_ai_actions").insert({
                    kind: "openflow_ia_intervention",
                    risk_level: "low",
                    confidence: 0.95,
                    title: `Intervenção de IA no OpenFlow: ${auto.nome}`,
                    reason: `Etapa ${i} (${step.tipo}): conversa inicializada para ${phone}.`,
                    payload: {
                      lead_id: lead_data?.lead_id || leadDb?.id || null,
                      phone,
                      automation_id: auto.id,
                      automation_name: auto.nome,
                      step_index: i,
                      message_content: finalMsg,
                    },
                    projeto_id: project_id,
                    source: "openflow-executor",
                    status: "executed",
                    auto_executed: true,
                    executed_at: new Date().toISOString(),
                  });
                } else {
                  stepsFailed++;
                  failureMessages.push(`Step ${i} (ia_message): ${waData.error || "Falha no envio"}`);
                }
              }

              // Update execution: set status = "waiting" at the CURRENT step i,
              // so subsequent lead responses are routed through wa-ai-reply
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i,
                  step_results: [...stepResults, { ...stepResult, status: "waiting_for_lead_response", message_sent: finalMsg.substring(0, 100) }]
                })
                .eq("id", executionId);

              status = "waiting";
              break;
            }
          }

          else if (step.tipo === "branch_by_awareness") {
            let awarenessLevel = 0;
            if (lead_data?.awareness_level) {
              awarenessLevel = Number(lead_data.awareness_level);
            } else if (lead_data?.lead_id) {
              const { data: ld } = await supabase.from("imphq_leads").select("awareness_level").eq("id", lead_data.lead_id).maybeSingle();
              awarenessLevel = Number((ld as any)?.awareness_level || 0);
            }
            const min = Number(step.awareness_min ?? 1);
            const max = Number(step.awareness_max ?? 5);
            const conditionMet = awarenessLevel >= min && awarenessLevel <= max;
            stepResult.status = "evaluated";
            stepResult.awareness_level = awarenessLevel;
            stepResult.condition_met = conditionMet;
            if (!conditionMet) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
              console.log(`[openflow-executor] branch_by_awareness: level=${awarenessLevel} fora de [${min},${max}], pulando ${skipCount} step(s)`);
            }
          }

          else if (step.tipo === "branch_by_intent") {
            const allowedIntents = (step.intents || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            let lastIntent: string | null = null;
            if (lead_data?.lead_id) {
              const { data: tr } = await supabase.from("imphq_wa_triage")
                .select("intent").eq("lead_id", lead_data.lead_id)
                .order("created_at", { ascending: false }).limit(1).maybeSingle();
              lastIntent = (tr as any)?.intent || null;
            }
            const conditionMet = allowedIntents.length === 0 || (lastIntent != null && allowedIntents.includes(lastIntent));
            stepResult.status = "evaluated";
            stepResult.last_intent = lastIntent;
            stepResult.condition_met = conditionMet;
            if (!conditionMet) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
            }
          }

          else if (step.tipo === "update_memory") {
            const key = step.memory_key;
            const rawValue = (step.memory_value || "")
              .replace(/\{\{nome\}\}/g, lead_data?.nome || "")
              .replace(/\{\{produto\}\}/g, lead_data?.produto || "")
              .replace(/\{\{valor\}\}/g, lead_data?.valor || "")
              .replace(/\{\{email\}\}/g, lead_data?.email || "");
            if (!key || !lead_data?.lead_id) {
              stepResult.status = "skipped";
              stepResult.reason = !key ? "memory_key não definida" : "lead_id ausente";
            } else {
              const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
              const current = (ld as any)?.lead_memory || {};
              const { error: memErr } = await supabase.from("imphq_leads")
                .update({ lead_memory: { ...current, [key]: rawValue }, updated_at: new Date().toISOString() })
                .eq("id", lead_data.lead_id);
              stepResult.status = memErr ? "error" : "completed";
              stepResult.memory_key = key;
              if (memErr) { stepsFailed++; failureMessages.push(`Step ${i} (update_memory): ${memErr.message}`); }
            }
          }

          else if (step.tipo === "qualify_lead") {
            if (!lead_data?.lead_id) {
              stepResult.status = "skipped";
              stepResult.reason = "lead_id ausente";
            } else {
              const updates: Record<string, any> = { updated_at: new Date().toISOString() };
              if (step.lead_score != null) updates.score = Number(step.lead_score);
              if (step.lead_stage) updates.stage = step.lead_stage;
              if (step.lead_tags) {
                const newTags = step.lead_tags.split(",").map((t: string) => t.trim()).filter(Boolean);
                const { data: ld } = await supabase.from("imphq_leads").select("tags").eq("id", lead_data.lead_id).maybeSingle();
                updates.tags = [...new Set([...((ld as any)?.tags || []), ...newTags])];
              }
              const { error: qErr } = await supabase.from("imphq_leads").update(updates).eq("id", lead_data.lead_id);
              stepResult.status = qErr ? "error" : "completed";
              if (qErr) { stepsFailed++; failureMessages.push(`Step ${i} (qualify_lead): ${qErr.message}`); }
            }
          }

          else {
            stepResult.status = "unknown_type";
            stepResult.reason = `Tipo "${step.tipo}" não reconhecido`;
          }
        } catch (stepErr: any) {
          stepResult.status = "error";
          stepResult.error = stepErr.message;
          stepsFailed++;
          failureMessages.push(`Step ${i} (${step.tipo}): ${stepErr.message}`);
          // Só interrompe o fluxo se o step for crítico
          if (isCriticalStep(step.tipo)) {
            status = "failed";
            errorMessage = `Step crítico ${i} (${step.tipo}) falhou: ${stepErr.message}`;
          }
        }

        stepResult.finished_at = new Date().toISOString();
        stepResults.push(stepResult);

        // Só interrompe em waiting (delay longo) ou em falha de step crítico
        if (status === "failed" || status === "waiting") break;

        // Small delay between steps
        if (i < steps.length - 1) await delay(500);
      }

      // Status agregado: se rodou tudo mas alguns steps falharam → "partial"
      if (status === "completed" && stepsFailed > 0) {
        status = "partial";
        errorMessage = failureMessages.join(" | ");
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
        status: status === "failed" ? "error" : (status === "partial" ? "partial" : "success"),
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
