import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize BR phone (ensure 55 prefix)
function normalizeBRPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

// Generate all permutations of Brazilian phone formats (with/without DDI, with/without 9th digit)
function getBrazilianPhoneVariants(raw: string): string[] {
  const clean = (raw || "").replace(/\D/g, "");
  if (!clean) return [];
  const variants = new Set<string>([raw, clean]);
  
  let withCC = clean;
  if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    withCC = "55" + clean;
  }
  
  if (withCC.startsWith("55")) {
    variants.add(withCC);
    variants.add(withCC.substring(2)); // without country code
    const localNumber = withCC.substring(2);
    
    if (localNumber.length === 11 && localNumber.startsWith("9")) {
      const ddd = localNumber.substring(0, 2);
      const rest = localNumber.substring(3);
      variants.add("55" + ddd + rest);
      variants.add(ddd + rest);
    } else if (localNumber.length === 10) {
      const ddd = localNumber.substring(0, 2);
      const rest = localNumber.substring(2);
      variants.add("55" + ddd + "9" + rest);
      variants.add(ddd + "9" + rest);
    }
  }
  return Array.from(variants).filter(Boolean);
}

function replaceVariables(text: string, lead_data: any, leadDb: any): string {
  let result = text || "";
  
  if (leadDb?.lead_memory && typeof leadDb.lead_memory === "object") {
    const regex = /\{\{([^}]+)\}\}/g;
    result = result.replace(regex, (match, path) => {
      const parts = path.trim().split(".");
      let current = leadDb.lead_memory;
      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = current[part];
        } else {
          return match;
        }
      }
      return typeof current === "object" ? JSON.stringify(current) : String(current ?? "");
    });
  }
  
  const phone = lead_data?.phone || lead_data?.telefone || leadDb?.telefone || leadDb?.phone || "";
  const linkUrl = lead_data?.link || "";
  const nome = lead_data?.nome || leadDb?.name || "Lead";
  
  result = result
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{name\}\}/g, nome)
    .replace(/\{\{primeiro_nome\}\}/g, nome.split(" ")[0])
    .replace(/\{\{primeiro-nome\}\}/g, nome.split(" ")[0])
    .replace(/\{\{email\}\}/g, lead_data?.email || leadDb?.email || "")
    .replace(/\{\{produto\}\}/g, lead_data?.produto || leadDb?.produto || "")
    .replace(/\{\{telefone\}\}/g, phone)
    .replace(/\{\{link\}\}/g, linkUrl)
    .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")} ` : "")
    .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || leadDb?.plataforma || "")
    .replace(/\{\{fluxo\}\}/g, lead_data?.fluxo || "");
    
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch active flow executions
    const { data: executions, error: execErr } = await supabase
      .from("imphq_flow_executions")
      .select(`
        id,
        automacao_id,
        project_id,
        lead_id,
        trigger_tipo,
        status,
        current_step,
        step_results,
        updated_at,
        created_at
      `)
      .in("status", ["running", "waiting"]);

    if (execErr) {
      console.error("[wa-behavioral-triggers] Error fetching executions:", execErr);
      return new Response(JSON.stringify({ error: execErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!executions || executions.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active executions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch all automations to map them
    const neededAutoIds = Array.from(new Set(executions.map((e: any) => e.automacao_id).filter(Boolean)));
    const { data: automacoes, error: autoErr } = await supabase
      .from("imphq_automacoes")
      .select("id, nome, stalled_hours, stalled_operator, follow_up_hours, follow_up_template, provider_id")
      .in("id", neededAutoIds);

    if (autoErr) {
      console.error("[wa-behavioral-triggers] Error fetching automations:", autoErr);
      return new Response(JSON.stringify({ error: autoErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const autoMap = new Map(automacoes?.map(a => [a.id, a]) || []);
    let alertsTriggered = 0;
    let followUpsSent = 0;

    // 3. Process each execution
    for (const exec of executions) {
      const auto = autoMap.get(exec.automacao_id);
      if (!auto) continue;

      const currentStepResults = Array.isArray(exec.step_results) ? exec.step_results : [];
      const stepRes = currentStepResults.find((r: any) => r.step === exec.current_step);

      // Load lead details if needed
      let leadDb: any = null;
      if (exec.lead_id) {
        const { data: l } = await supabase
          .from("imphq_leads")
          .select("*")
          .eq("id", exec.lead_id)
          .maybeSingle();
        leadDb = l;
      }

      const stepStart = stepRes?.started_at || exec.updated_at || exec.created_at;

      // ── CHECK 1: Stalled Lead Alert (Notificar Atendente)
      if (auto.stalled_hours && (!stepRes || !stepRes.stalled_notified)) {
        const updatedAt = new Date(stepStart).getTime();
        const hoursDiff = (Date.now() - updatedAt) / (3600 * 1000);

        if (hoursDiff >= auto.stalled_hours) {
          const opName = auto.stalled_operator || "todos";
          const leadName = leadDb?.name || "Lead";
          const notificationMsg = `⚠️ ALERTA: O lead ${leadName} está parado na etapa ${exec.current_step} do fluxo "${auto.nome}" há mais de ${auto.stalled_hours} horas.`;

          let targetUserIds: string[] = [];

          if (opName.toLowerCase() !== "todos") {
            const { data: member } = await supabase
              .from("imphq_team_members")
              .select("user_id")
              .ilike("name", `%${opName}%`)
              .eq("is_active", true)
              .maybeSingle();
            if (member?.user_id) {
              targetUserIds.push(member.user_id);
            }
          }

          // Fallback: notify project owner + all active team members
          if (targetUserIds.length === 0) {
            const { data: proj } = await supabase
              .from("imphq_projects")
              .select("owner_id")
              .eq("id", exec.project_id)
              .maybeSingle();
            if (proj?.owner_id) {
              targetUserIds.push(proj.owner_id);
            }
            const { data: members } = await supabase
              .from("imphq_team_members")
              .select("user_id")
              .eq("is_active", true);
            if (members) {
              members.forEach((m: any) => {
                if (m.user_id && !targetUserIds.includes(m.user_id)) {
                  targetUserIds.push(m.user_id);
                }
              });
            }
          }

          let notifiedAny = false;
          for (const uid of targetUserIds) {
            const { error: notifErr } = await supabase.from("imphq_notifications").insert({
              user_id: uid,
              title: `🚨 Alerta de Travamento: ${leadName}`,
              message: notificationMsg,
              type: "lead",
              entity_type: "lead",
              entity_id: exec.lead_id,
            });

            if (!notifErr) {
              notifiedAny = true;
              // Call push notification
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-push`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    user_id: uid,
                    title: `🚨 Alerta de Travamento: ${leadName}`,
                    message: notificationMsg,
                  }),
                });
              } catch (pushErr) {
                console.error(`[wa-behavioral-triggers] Push notification error for user ${uid}:`, pushErr);
              }
            }
          }

          if (notifiedAny) {
            alertsTriggered++;
            // Update execution step_results to reflect notification sent
            let updatedResults = [...currentStepResults];
            let stepIndex = updatedResults.findIndex((r: any) => r.step === exec.current_step);
            if (stepIndex >= 0) {
              updatedResults[stepIndex] = { ...updatedResults[stepIndex], stalled_notified: true };
            } else {
              updatedResults.push({ step: exec.current_step, stalled_notified: true, started_at: new Date().toISOString() });
            }

            await supabase
              .from("imphq_flow_executions")
              .update({ step_results: updatedResults, updated_at: new Date().toISOString() })
              .eq("id", exec.id);
          }
        }
      }

      // ── CHECK 2: Automatic Follow-Up (Follow-Up Automático)
      if (auto.follow_up_hours && auto.follow_up_template && (!stepRes || !stepRes.follow_up_sent)) {
        const stepStartTime = new Date(stepStart).getTime();
        const hoursDiff = (Date.now() - stepStartTime) / (3600 * 1000);

        if (hoursDiff >= auto.follow_up_hours) {
          // Verify if lead sent any message since stepStartTime
          const phone = leadDb?.phone;
          let hasIncomingMessage = false;

          if (phone) {
            const searchPhones = getBrazilianPhoneVariants(phone);

            const { data: incomingMsgs } = await supabase
              .from("imphq_wa_messages")
              .select("id")
              .in("phone", searchPhones)
              .eq("direction", "incoming")
              .gt("created_at", stepStart)
              .limit(1);

            if (incomingMsgs && incomingMsgs.length > 0) {
              hasIncomingMessage = true;
            }
          }

          if (!hasIncomingMessage) {
            const msgText = replaceVariables(auto.follow_up_template, { lead_id: exec.lead_id }, leadDb);
            
            // Resolve provider
            let providerId = auto.provider_id;
            if (!providerId && exec.project_id) {
              const { data: projProviders } = await supabase
                .from("imphq_wa_providers")
                .select("id")
                .eq("is_active", true)
                .eq("project_id", exec.project_id)
                .order("created_at", { ascending: false })
                .limit(1);
              if (projProviders?.length) providerId = projProviders[0].id;
            }
            if (!providerId) {
              const { data: activeProviders } = await supabase
                .from("imphq_wa_providers")
                .select("id")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1);
              if (activeProviders?.length) providerId = activeProviders[0].id;
            }

            if (providerId && phone) {
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
                  project_id: exec.project_id,
                }),
              });

              if (waRes.ok) {
                const waData = await waRes.json();
                if (waData.success) {
                  followUpsSent++;
                }
              }
            }

            // Update execution step_results to reflect follow-up sent
            let updatedResults = [...currentStepResults];
            let stepIndex = updatedResults.findIndex((r: any) => r.step === exec.current_step);
            if (stepIndex >= 0) {
              updatedResults[stepIndex] = { ...updatedResults[stepIndex], follow_up_sent: true };
            } else {
              updatedResults.push({ step: exec.current_step, follow_up_sent: true, started_at: new Date().toISOString() });
            }

            await supabase
              .from("imphq_flow_executions")
              .update({ step_results: updatedResults, updated_at: new Date().toISOString() })
              .eq("id", exec.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, alerts_triggered: alertsTriggered, follow_ups_sent: followUpsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-behavioral-triggers] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
