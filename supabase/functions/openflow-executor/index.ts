import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendToChannel } from "../_shared/channel-out.ts";


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
    // Quando o passo define ritmo em segundos (delay_sec), NÃO forçamos 1 minuto.
    delay_min: Number(step.delay_sec || 0) > 0
      ? Number(step.delay_min || 0)
      : (step.delay_min || step.minutos || step.delay || 1),
    delay_sec: Number(step.delay_sec || 0),
  };
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
          return match; // return original match if not found in memory
        }
      }
      return typeof current === "object" ? JSON.stringify(current) : String(current ?? "");
    });
  }
  
  const phone = lead_data?.phone || lead_data?.telefone || leadDb?.telefone || leadDb?.phone || "";
  const linkUrl = lead_data?.link || lead_data?.link_checkout || "";
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
    .replace(/\{\{link_checkout\}\}/g, linkUrl)
    .replace(/\{\{valor\}\}/g, lead_data?.valor ? `R$ ${Number(lead_data.valor).toFixed(2).replace(".", ",")}` : "")
    .replace(/\{\{plataforma\}\}/g, lead_data?.plataforma || leadDb?.plataforma || "")
    .replace(/\{\{fluxo\}\}/g, lead_data?.fluxo || "");
    
  return result;
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
      upsell_recusado: ["upsell_recusado"],
      orderbump_aprovado: ["orderbump_aprovado"],
      orderbump_recusado: ["orderbump_recusado"],
      downsell_aprovado: ["downsell_aprovado"],
      downsell_recusado: ["downsell_recusado"],
      venda_principal_aprovada: ["venda_principal_aprovada"],
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

    // ── Exit Conditions: cancel running/waiting executions when the incoming
    // trigger matches an automation's exit_trigger_tipo. If exit_cascade=true,
    // cancel ALL active flows for this lead in the project.
    if (lead_data?.lead_id) {
      const { data: exitMatches } = await supabase
        .from("imphq_automacoes")
        .select("id, nome, exit_trigger_tipo, exit_cascade")
        .eq("project_id", project_id)
        .in("exit_trigger_tipo", triggerVariants);

      if (exitMatches && exitMatches.length > 0) {
        const cascade = exitMatches.some((a: any) => a.exit_cascade);
        let killQuery = supabase
          .from("imphq_flow_executions")
          .update({
            status: "exited",
            error_message: `Exit condition: ${trigger_tipo}`,
            updated_at: new Date().toISOString(),
          })
          .eq("project_id", project_id)
          .eq("lead_id", lead_data.lead_id)
          .in("status", ["running", "waiting"]);

        if (!cascade) {
          killQuery = killQuery.in("automacao_id", exitMatches.map((a: any) => a.id));
        }

        const { data: killed } = await killQuery.select("id, automacao_id, current_step");
        if (killed && killed.length > 0) {
          for (const k of killed) {
            await supabase.from("imphq_automacao_logs").insert({
              automacao_id: k.automacao_id,
              project_id,
              status: "exited",
              trigger_data: { trigger_tipo, lead_id: lead_data.lead_id, exit_step: k.current_step ?? 0, cascade },
              error_message: `Flow encerrado por exit condition (${trigger_tipo}) em Passo ${k.current_step ?? 0}`,
            }).then(() => {}, () => {});
          }
        }
      }
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
    const leadCanal = lead_data?.canal || "whatsapp";
    const matched = (automacoes || []).filter((a: any) => {
      // Canal do fluxo precisa bater com o canal de origem (whatsapp | messenger | webchat)
      if ((a.canal || "whatsapp") !== leadCanal) return false;
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
      // WhatsApp trigger: filter by keywords / regex configured in trigger_config
      if (String(trigger_tipo || "").startsWith("whatsapp_")) {
        const cfg = a.trigger_config || {};
        const msg = String(lead_data?.message_content || lead_data?.mensagem_recebida || "").toLowerCase().trim();
        const keywords: string[] = Array.isArray(cfg.keywords) ? cfg.keywords : [];
        const matchMode = cfg.match_mode || "any"; // any | all | exact | regex
        if (keywords.length > 0) {
          if (!msg) return false;
          const kws = keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean);
          let ok = false;
          if (matchMode === "regex") {
            ok = kws.some((k) => { try { return new RegExp(k, "i").test(msg); } catch { return false; } });
          } else if (matchMode === "exact") {
            ok = kws.includes(msg);
          } else if (matchMode === "all") {
            ok = kws.every((k) => msg.includes(k));
          } else {
            ok = kws.some((k) => msg.includes(k));
          }
          if (!ok) return false;
        }
      }
      return true;
    }).sort((a: any, b: any) => Number(b.prioridade ?? 5) - Number(a.prioridade ?? 5));

    if (matched.length === 0) {
      return new Response(JSON.stringify({ ok: true, executed: 0, message: "Nenhuma automação encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ── Cross-flow lock: check if lead (or phone) is already inside a DIFFERENT active flow
    // Prevent a lead in Flow A from being pulled into conflicting Flow B simultaneously.
    // Exception: resume_from_step (re-entry from wa-ai-reply) and explicit automacao_id bypass.
    let activeFlowId: string | null = null;
    let activeFlowName: string | null = null;
    let activeFlowExclusivo = false;
    let activeFlowPrioridade = 5;
    if (!resume_from_step && !automacao_id) {
      // Resolve a set of lead_ids that share the same phone as the incoming lead (when available)
      let relatedLeadIds: string[] = lead_data?.lead_id ? [lead_data.lead_id] : [];
      const phoneRaw = lead_data?.telefone || lead_data?.phone || lead_data?.whatsapp;
      if (phoneRaw) {
        const phoneDigits = String(phoneRaw).replace(/\D/g, "");
        if (phoneDigits.length >= 8) {
          const { data: sameLeads } = await supabase
            .from("imphq_leads")
            .select("id")
            .ilike("telefone", `%${phoneDigits.slice(-8)}%`)
            .limit(50);
          for (const l of sameLeads || []) {
            if (l.id && !relatedLeadIds.includes(l.id)) relatedLeadIds.push(l.id);
          }
        }
      }

      if (relatedLeadIds.length > 0) {
        const { data: activeExecs } = await supabase
          .from("imphq_flow_executions")
          .select("id, automacao_id, lead_id")
          .in("lead_id", relatedLeadIds)
          .in("status", ["running", "waiting"])
          .order("created_at", { ascending: false })
          .limit(5);
        if (activeExecs && activeExecs.length > 0) {
          activeFlowId = activeExecs[0].automacao_id;
          const { data: activeAuto } = await supabase
            .from("imphq_automacoes")
            .select("nome, prioridade, exclusivo")
            .eq("id", activeFlowId)
            .maybeSingle();
          activeFlowName = activeAuto?.nome || activeFlowId;
          activeFlowExclusivo = !!activeAuto?.exclusivo;
          activeFlowPrioridade = Number(activeAuto?.prioridade ?? 5);
          console.log(`[openflow-executor] Lead/phone já em fluxo "${activeFlowName}" (${activeFlowId}) — exclusivo=${activeFlowExclusivo} prioridade=${activeFlowPrioridade}`);
        }
      }
    }

    for (const auto of matched) {
      // ── Cross-flow lock: skip / preempt based on prioridade + exclusivo
      if (activeFlowId && activeFlowId !== auto.id) {
        const myPrioridade = Number(auto.prioridade ?? 5);
        const canPreempt = !activeFlowExclusivo && myPrioridade > activeFlowPrioridade;
        if (canPreempt) {
          // Cancel the previous active flow execution(s) for this lead
          await supabase
            .from("imphq_flow_executions")
            .update({ status: "cancelled", error_message: `Preempted by higher-priority flow "${auto.nome}"`, updated_at: new Date().toISOString() })
            .eq("automacao_id", activeFlowId)
            .in("status", ["running", "waiting"]);
          console.log(`[openflow-executor] Preempt: "${auto.nome}" (p=${myPrioridade}) > "${activeFlowName}" (p=${activeFlowPrioridade})`);
          activeFlowId = null;
          activeFlowName = null;
          activeFlowExclusivo = false;
        } else {
          console.log(`[openflow-executor] Skip ${auto.id} (${auto.nome}): lead em "${activeFlowName}" (exclusivo=${activeFlowExclusivo}, p_other=${activeFlowPrioridade}, p_self=${myPrioridade})`);
          results.push({ automacao_id: auto.id, automacao_nome: auto.nome, status: "skipped", reason: activeFlowExclusivo ? "cross_flow_lock_exclusive" : "cross_flow_lock_priority", active_flow: activeFlowName });
          continue;
        }
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
      if (auto.link_checkout) {
        lead_data.link = lead_data?.link || auto.link_checkout;
        lead_data.link_checkout = lead_data?.link_checkout || auto.link_checkout;
      }
      const rawSteps = auto.acoes || auto.etapas || [];
      const steps = rawSteps.map(normalizeStep);

      const startStep = resume_from_step !== undefined ? Number(resume_from_step) : 0;
      let prevStepResults: any[] = [];
      if (resume_from_step !== undefined && lead_data?.lead_id) {
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
          channel_session_id: lead_data?.channel_session_id || null,
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
      if (lead_data) {
        lead_data.fluxo = auto.nome || "";
      }

      // ── Sessão de canal (Messenger / Chat do site). Quando presente, os blocos de
      // mensagem são entregues pelo canal em vez do WhatsApp.
      let channelSession: any = null;
      if (lead_data?.channel_session_id) {
        const { data: cs } = await supabase
          .from("imphq_channel_sessions")
          .select("*")
          .eq("id", lead_data.channel_session_id)
          .maybeSingle();
        channelSession = cs || null;
      }

      // Load lead details once for the execution of this automation
      let leadDb: any = null;

      if (lead_data?.lead_id) {
        const { data: l } = await supabase
          .from("imphq_leads")
          .select("*")
          .eq("id", lead_data.lead_id)
          .maybeSingle();
        leadDb = l;
      } else {
        const phone = lead_data?.phone || lead_data?.telefone;
        if (phone) {
          const cleanPhone = phone.replace(/\D/g, "");
          const searchPhones = [phone, cleanPhone];
          if (cleanPhone.startsWith("55")) {
            searchPhones.push(cleanPhone.substring(2));
          } else {
            searchPhones.push("55" + cleanPhone);
          }
          const { data: l } = await supabase
            .from("imphq_leads")
            .select("*")
            .eq("project_id", project_id)
            .in("phone", searchPhones)
            .maybeSingle();
          leadDb = l;
        }
      }

      if (leadDb && leadDb.tags) {
        leadTags = leadDb.tags;
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
              const searchPhones = getBrazilianPhoneVariants(phone);
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

          // Record flow attribution when the lead converts while inside this flow
          if (abortReason === "Lead realizou a compra") {
            await supabase.from("imphq_events").insert({
              project_id,
              event_name: "flow_attribution",
              page_url: "",
              visitor_id: lead_data?.phone || lead_data?.telefone || "unknown",
              event_data: {
                automacao_id: auto.id,
                automacao_nome: auto.nome,
                execution_id: executionId,
                lead_id: lead_data?.lead_id || null,
                phone: lead_data?.phone || lead_data?.telefone || null,
                trigger_tipo,
                messages_sent_before_conversion: messagesSent,
                step_at_conversion: i,
              },
            }).catch((err: any) => console.error("[openflow-executor] flow_attribution insert error:", err.message));
          }

          break; // Stop flow
        }

        // Pre-delay logic for actions that define delay_min in the action block itself
        const actionTypesToDelay = [
          "whatsapp",
          "audio",
          "email",
          "ia_message",
          "adicionar_tag",
          "remover_tag",
          "update_memory",
          "ia_scheduling",
          "webhook_call",
          "qualify_lead",
          "notify_operator",
          "abrir_conversa",
          "gpt_prompt",
          "stop_on_event"
        ];

        if (actionTypesToDelay.includes(step.tipo)) {
          const delayMin = Number(step.delay_min || 0);
          if (delayMin > 0) {
            const alreadyDelayed = prevStepResults.some((r: any) => r.step === i && r.status === "waiting_delay");
            if (!alreadyDelayed) {
              if (delayMin > 5) {
                const nextRun = new Date(Date.now() + delayMin * 60000);
                stepResult.status = "waiting_delay";
                stepResult.next_run = nextRun.toISOString();
                stepResult.finished_at = new Date().toISOString();
                stepResults.push(stepResult);

                await supabase.from("imphq_flow_executions")
                  .update({
                    status: "waiting",
                    current_step: i, // We stay on this step to run it when we resume
                    next_run_at: nextRun.toISOString(),
                    step_results: stepResults,
                  })
                  .eq("id", executionId);
                
                status = "waiting";
                break; // Exit step loop (pauses flow execution)
              } else {
                // Short delays: wait inline
                await delay(delayMin * 60000);
              }
            }
          }

          // Ritmo de conversa: espera curta em segundos (máx 20s), sempre inline
          const delaySec = Math.min(Number(step.delay_sec || 0), 20);
          if (delaySec > 0) {
            const alreadyPaced = prevStepResults.some((r: any) => r.step === i && r.status === "waiting_delay");
            if (!alreadyPaced) await delay(delaySec * 1000);
          }
        }


        try {
          // Update current step
          await supabase.from("imphq_flow_executions")
            .update({ current_step: i })
            .eq("id", executionId);

          if (step.tipo === "delay" || step.tipo === "espera") {
            // Modo "data absoluta": wait_until (ISO). Ignora delay_min.
            if (step.wait_until) {
              const targetMs = new Date(step.wait_until).getTime();
              if (!isNaN(targetMs) && targetMs - Date.now() > 0) {
                const nextRun = new Date(targetMs);
                await supabase.from("imphq_flow_executions")
                  .update({
                    status: "waiting",
                    current_step: i + 1,
                    next_run_at: nextRun.toISOString(),
                    step_results: [...stepResults, { ...stepResult, status: "delayed", next_run: nextRun.toISOString(), mode: "absolute" }],
                  })
                  .eq("id", executionId);
                status = "waiting";
                break;
              }
              // data já passou: avança imediatamente
              stepResult.status = "completed";
            } else {
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
          }

          else if (step.tipo === "wait_event" || step.tipo === "wait_until_event") {
            // Supports single event_name OR multiple events via event_names (comma-separated, OR logic)
            const eventNames: string[] = (step.event_names
              ? String(step.event_names).split(",").map((s: string) => s.trim()).filter(Boolean)
              : (step.event_name ? [String(step.event_name).trim()] : []));
            const timeoutMin = Number(step.timeout_min || 60);

            let detectedEvent: string | null = null;
            if (lead_data?.lead_id && eventNames.length > 0) {
              const { data: evts } = await supabase
                .from("imphq_events")
                .select("event_name")
                .eq("lead_id", lead_data.lead_id)
                .in("event_name", eventNames)
                .gt("created_at", originalStart)
                .limit(1);
              if (evts && evts.length > 0) detectedEvent = (evts[0] as any).event_name;
            }

            if (detectedEvent) {
              stepResult.status = "completed";
              stepResult.matched_event = detectedEvent;
              stepResult.reason = `Evento "${detectedEvent}" detectado. Prosseguindo.`;
            } else {
              const isTimeout = resume_from_step !== undefined && Number(resume_from_step) === i;
              if (isTimeout) {
                stepResult.status = "completed";
                stepResult.reason = `Timeout de ${timeoutMin} min atingido sem evento(s) [${eventNames.join(", ")}]. Prosseguindo.`;
              } else {
                const nextRun = new Date(Date.now() + timeoutMin * 60000);
                await supabase.from("imphq_flow_executions")
                  .update({
                    status: "waiting",
                    current_step: i,
                    next_run_at: nextRun.toISOString(),
                    step_results: [...stepResults, { ...stepResult, status: "waiting", next_run: nextRun.toISOString(), notes: `Aguardando evento(s) [${eventNames.join(", ")}] ou timeout em ${nextRun.toISOString()}` }],
                  })
                  .eq("id", executionId);
                status = "waiting";
                break;
              }
            }
          }

          // ── wait_reply: pausa o fluxo até o lead enviar qualquer mensagem ──
          else if (step.tipo === "wait_reply") {
            const timeoutMin = Number(step.timeout_min || 1440); // default: 24h
            const convId = lead_data?.conversation_id || lead_data?.conversationId;

            // Se estamos sendo retomados por uma resposta do lead, marcar como completo
            const isResumedByReply = resume_from_step !== undefined && Number(resume_from_step) === i
              && (lead_data?.resumed_by === "reply" || lead_data?.reply_content);

            if (isResumedByReply) {
              stepResult.status = "completed";
              stepResult.reason = `Lead respondeu: "${String(lead_data?.reply_content || "").slice(0, 100)}"`;
              stepResult.reply_content = lead_data?.reply_content || "";
            } else {
              // Primeira vez neste nó: coloca em espera aguardando resposta
              const timeoutAt = new Date(Date.now() + timeoutMin * 60000);
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i,
                  next_run_at: timeoutAt.toISOString(), // timeout fallback via openflow-resume
                  step_results: [...stepResults, {
                    ...stepResult,
                    status: "waiting_reply",
                    waiting_for: "reply",
                    conversation_id: convId || null,
                    timeout_at: timeoutAt.toISOString(),
                    notes: `Aguardando resposta do lead. Timeout em ${timeoutAt.toISOString()}.`,
                  }],
                })
                .eq("id", executionId);
              console.log(`[openflow-executor] wait_reply: execução ${executionId} pausada aguardando resposta (conv=${convId}, timeout=${timeoutMin}min)`);
              status = "waiting";
              break;
            }
          }

          // ── input_capture: aguarda resposta do lead e salva em variável (opcional extração via IA) ──
          else if (step.tipo === "input_capture") {
            const timeoutMin = Number(step.timeout_min || 1440);
            const convId = lead_data?.conversation_id || lead_data?.conversationId;
            const varName = String(step.capture_variable || "").trim();

            const isResumedByReply = resume_from_step !== undefined && Number(resume_from_step) === i
              && (lead_data?.resumed_by === "reply" || lead_data?.reply_content);

            if (isResumedByReply) {
              let rawReply = String(lead_data?.reply_content || "").trim();
              let finalValue = rawReply;

              // Opcional: passa pela IA para extrair essência
              if (step.ai_extract_prompt && rawReply) {
                try {
                  const extractRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}` },
                    body: JSON.stringify({
                      model: "google/gemini-3-flash-preview",
                      messages: [
                        { role: "system", content: String(step.ai_extract_prompt) },
                        { role: "user", content: rawReply },
                      ],
                      max_tokens: 200,
                    }),
                  });
                  if (extractRes.ok) {
                    const j = await extractRes.json();
                    const ext = j?.choices?.[0]?.message?.content?.trim();
                    if (ext) finalValue = ext;
                  }
                } catch (e) {
                  console.warn("[input_capture] extração IA falhou, salvando resposta bruta:", (e as any)?.message);
                }
              }

              // Salva em lead_memory (aparece em {{VAR}} de forma nativa)
              if (varName && lead_data?.lead_id) {
                const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
                const current = (ld as any)?.lead_memory || {};
                const updated = { ...current, [varName]: finalValue };
                await supabase.from("imphq_leads")
                  .update({ lead_memory: updated, updated_at: new Date().toISOString() })
                  .eq("id", lead_data.lead_id);
                if (leadDb) leadDb.lead_memory = updated;
              }
              // Espelha em conversation.variables para consulta rápida
              if (varName && convId) {
                const { data: conv } = await supabase.from("imphq_wa_conversations").select("variables").eq("id", convId).maybeSingle();
                const cur = (conv as any)?.variables || {};
                await supabase.from("imphq_wa_conversations")
                  .update({ variables: { ...cur, [varName]: finalValue } })
                  .eq("id", convId);
              }

              stepResult.status = "completed";
              stepResult.capture_variable = varName;
              stepResult.captured_value = finalValue.slice(0, 200);
              stepResult.reason = `Capturado {{${varName}}}: "${finalValue.slice(0, 80)}"`;
            } else {
              const timeoutAt = new Date(Date.now() + timeoutMin * 60000);
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i,
                  next_run_at: timeoutAt.toISOString(),
                  step_results: [...stepResults, {
                    ...stepResult,
                    status: "waiting_reply",
                    waiting_for: "reply",
                    capture_variable: varName,
                    conversation_id: convId || null,
                    timeout_at: timeoutAt.toISOString(),
                    notes: `Aguardando resposta para salvar em {{${varName}}}.`,
                  }],
                })
                .eq("id", executionId);
              console.log(`[openflow-executor] input_capture aguardando resposta em {{${varName}}} (exec=${executionId})`);
              status = "waiting";
              break;
            }
          }

          // ── quick_reply: envia pergunta + opções numeradas, aguarda resposta e salva escolha ──
          else if (step.tipo === "quick_reply") {
            const timeoutMin = Number(step.timeout_min || 1440);
            const convId = lead_data?.conversation_id || lead_data?.conversationId;
            const varName = String(step.capture_variable || "QUICK_CHOICE").trim();
            const rawOptions: any[] = Array.isArray(step.options) ? step.options : [];
            const options = rawOptions
              .map((o: any) => (typeof o === "string" ? { label: o } : o))
              .filter((o: any) => o && String(o.label || "").trim())
              .slice(0, 9);

            const isResumedByReply = resume_from_step !== undefined && Number(resume_from_step) === i
              && (lead_data?.resumed_by === "reply" || lead_data?.reply_content);

            if (isResumedByReply) {
              const rawReply = String(lead_data?.reply_content || "").trim();
              const norm = rawReply.toLowerCase();
              // Match por número (1, 2, 3…) ou por texto (contém label)
              let chosenIdx = -1;
              const numMatch = norm.match(/^\s*(\d+)/);
              if (numMatch) {
                const n = parseInt(numMatch[1], 10) - 1;
                if (n >= 0 && n < options.length) chosenIdx = n;
              }
              if (chosenIdx < 0) {
                chosenIdx = options.findIndex((o: any) =>
                  norm.includes(String(o.label || "").toLowerCase().trim())
                );
              }
              const chosen = chosenIdx >= 0 ? options[chosenIdx] : null;
              const finalValue = chosen ? String(chosen.value ?? chosen.label) : rawReply;

              // Salva na memória do lead
              if (varName && lead_data?.lead_id) {
                const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
                const current = (ld as any)?.lead_memory || {};
                const updated = { ...current, [varName]: finalValue, [`${varName}_INDEX`]: chosenIdx + 1 };
                await supabase.from("imphq_leads")
                  .update({ lead_memory: updated, updated_at: new Date().toISOString() })
                  .eq("id", lead_data.lead_id);
                if (leadDb) leadDb.lead_memory = updated;
              }
              if (varName && convId) {
                const { data: conv } = await supabase.from("imphq_wa_conversations").select("variables").eq("id", convId).maybeSingle();
                const cur = (conv as any)?.variables || {};
                await supabase.from("imphq_wa_conversations")
                  .update({ variables: { ...cur, [varName]: finalValue, [`${varName}_INDEX`]: chosenIdx + 1 } })
                  .eq("id", convId);
              }

              // Skip opcional: cada opção pode definir skip_n para pular X ações se escolhida
              if (chosen && typeof chosen.skip_n === "number" && chosen.skip_n > 0) {
                i += chosen.skip_n;
              }

              stepResult.status = "completed";
              stepResult.capture_variable = varName;
              stepResult.captured_value = finalValue.slice(0, 200);
              stepResult.chosen_index = chosenIdx + 1;
              stepResult.reason = chosen
                ? `Escolha: ${chosenIdx + 1}) ${chosen.label}`
                : `Resposta não bateu com nenhuma opção: "${rawReply.slice(0, 60)}"`;
            } else {
              // Primeira passagem: envia a pergunta + opções e pausa
              const phone = lead_data?.phone || lead_data?.telefone;
              const question = replaceVariables(String(step.question || step.template || "Escolha uma opção:"), lead_data, leadDb);
              const listTxt = options.map((o: any, idx: number) => `${idx + 1}) ${o.label}`).join("\n");
              const fullMsg = `${question}\n\n${listTxt}`.trim();

              if (phone && options.length > 0) {
                let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
                if (!providerId && project_id) {
                  const { data: pp } = await supabase.from("imphq_wa_providers")
                    .select("id").eq("is_active", true).eq("project_id", project_id).limit(1);
                  if (pp?.length) providerId = pp[0].id;
                }
                await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                  body: JSON.stringify({
                    provider_id: providerId,
                    phone: normalizeBRPhone(phone),
                    content: fullMsg,
                    project_id,
                  }),
                }).catch(e => console.warn("[quick_reply] envio falhou:", e?.message));
                messagesSent++;
              }

              const timeoutAt = new Date(Date.now() + timeoutMin * 60000);
              await supabase.from("imphq_flow_executions")
                .update({
                  status: "waiting",
                  current_step: i,
                  next_run_at: timeoutAt.toISOString(),
                  step_results: [...stepResults, {
                    ...stepResult,
                    status: "waiting_reply",
                    waiting_for: "reply",
                    capture_variable: varName,
                    options_sent: options.map((o: any) => o.label),
                    conversation_id: convId || null,
                    timeout_at: timeoutAt.toISOString(),
                    notes: `Aguardando escolha entre ${options.length} opções em {{${varName}}}.`,
                  }],
                })
                .eq("id", executionId);
              console.log(`[openflow-executor] quick_reply aguardando escolha em {{${varName}}} (exec=${executionId}, ${options.length} opções)`);
              status = "waiting";
              break;
            }
          }

          // ── generate_image: gera imagem inline via flow-image-worker, opcionalmente envia no WhatsApp ──
          else if (step.tipo === "generate_image") {
            const promptTpl = String(step.image_prompt || step.template || "").trim();
            if (!promptTpl) {
              stepResult.status = "skipped";
              stepResult.reason = "image_prompt vazio";
            } else {
              const finalPrompt = replaceVariables(promptTpl, lead_data, leadDb);
              const styleHint = step.image_style ? ` Estilo: ${step.image_style}.` : "";
              const size = step.image_ratio === "9:16" ? "1024x1792" : step.image_ratio === "16:9" ? "1792x1024" : "1024x1024";
              const blockId = String(step.id || `step-${i}`);

              // Reusa job pré-existente concluído (retomada)
              const { data: existing } = await supabase.from("imphq_flow_image_jobs")
                .select("id, status, url")
                .eq("execution_id", executionId)
                .eq("block_id", blockId)
                .maybeSingle();

              let imageUrl: string | null = existing?.status === "done" ? existing.url : null;

              if (!imageUrl) {
                let jobId = existing?.id as string | undefined;
                if (!jobId) {
                  const { data: job, error: jobErr } = await supabase.from("imphq_flow_image_jobs").insert({
                    execution_id: executionId,
                    automacao_id: String(automacao_id || auto?.id || ""),
                    block_id: blockId,
                    prompt: finalPrompt + styleHint,
                    style: step.image_style || null,
                    size,
                    send_after: step.send_after ?? true,
                    status: "pending",
                    context: { lead_id: lead_data?.lead_id || null, step: i },
                  }).select("id").single();
                  if (jobErr) throw jobErr;
                  jobId = job.id;
                }

                // Dispara worker fire-and-forget
                fetch(`${supabaseUrl}/functions/v1/flow-image-worker`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                  body: JSON.stringify({ job_id: jobId }),
                }).catch(() => {});

                // Poll curto: até ~55s
                for (let t = 0; t < 11; t++) {
                  await new Promise(r => setTimeout(r, 5000));
                  const { data: j } = await supabase.from("imphq_flow_image_jobs").select("status, url, error").eq("id", jobId).maybeSingle();
                  if (j?.status === "done" && j.url) { imageUrl = j.url; break; }
                  if (j?.status === "error") { stepResult.reason = j.error || "erro na geração"; break; }
                }
              }

              if (!imageUrl) {
                // Ainda pending → coloca fluxo em espera para retomar via cron
                await supabase.from("imphq_flow_executions")
                  .update({
                    status: "waiting",
                    current_step: i,
                    next_run_at: new Date(Date.now() + 60_000).toISOString(),
                    step_results: [...stepResults, { ...stepResult, status: "waiting_image", notes: "Aguardando geração de imagem." }],
                  })
                  .eq("id", executionId);
                status = "waiting";
                break;
              }

              // Envia no WhatsApp se pedido
              const phone = lead_data?.phone || lead_data?.telefone;
              if ((step.send_after ?? true) && phone) {
                let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
                if (!providerId && project_id) {
                  const { data: pp } = await supabase.from("imphq_wa_providers")
                    .select("id").eq("is_active", true).eq("project_id", project_id).limit(1);
                  if (pp?.length) providerId = pp[0].id;
                }
                const caption = step.template ? replaceVariables(step.template, lead_data, leadDb) : "";
                await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                  body: JSON.stringify({
                    provider_id: providerId,
                    phone: normalizeBRPhone(phone),
                    content: caption,
                    media_url: imageUrl,
                    media_type: "image",
                    project_id,
                  }),
                }).catch(e => console.warn("[generate_image] envio falhou:", e?.message));
                messagesSent++;
              }

              // Injeta na memória para uso downstream: {{IMG_<blockId>}}
              if (lead_data?.lead_id) {
                const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
                const current = (ld as any)?.lead_memory || {};
                const updated = { ...current, [`IMG_${blockId}`]: imageUrl };
                await supabase.from("imphq_leads").update({ lead_memory: updated }).eq("id", lead_data.lead_id);
                if (leadDb) leadDb.lead_memory = updated;
              }

              stepResult.status = "completed";
              stepResult.image_url = imageUrl;
              stepResult.reason = "Imagem gerada" + ((step.send_after ?? true) && phone ? " e enviada." : ".");
            }
          }

          else if (step.tipo === "ab_split") {
            const pctA = Number(step.rota_a_porcentagem ?? 50);
            const jumpSteps = Number(step.jump_steps ?? 1);
            
            let chosenPath = "A";
            const phone = lead_data?.phone || lead_data?.telefone || "";
            const cleanPhone = phone.replace(/\D/g, "");
            
            if (cleanPhone) {
              const lastTwoDigits = parseInt(cleanPhone.slice(-2)) || 0;
              chosenPath = lastTwoDigits < pctA ? "A" : "B";
            } else {
              chosenPath = (Math.random() * 100) < pctA ? "A" : "B";
            }
            
            stepResult.status = "completed";
            stepResult.chosen_path = chosenPath;
            
            if (chosenPath === "B") {
              stepResult.reason = `Direcionado para Rota B. Pulando ${jumpSteps} etapas.`;
              i += jumpSteps;
            } else {
              stepResult.reason = `Direcionado para Rota A. Prosseguindo normalmente.`;
            }
          }

          // ── Canais alternativos (Messenger via Zernio / Chat do site): reaproveita os blocos
          // de mensagem/IA do fluxo, mas entrega pela sessão de canal em vez do WhatsApp.
          else if (
            (step.tipo === "whatsapp" || step.tipo === "audio") &&
            (channelSession || (auto as any).canal === "messenger" || (auto as any).canal === "webchat")
          ) {
            if (!channelSession) {
              stepResult.status = "skipped";
              stepResult.reason = "Fluxo de canal sem sessão (channel_session_id ausente)";
            } else {
              const msgText = replaceVariables(step.mensagem || step.template || "", lead_data, leadDb);
              const stepMedia = (step as any).media;
              const chRes = await sendToChannel(
                supabase,
                channelSession as any,
                msgText,
                stepMedia?.url || null,
              );
              stepResult.canal = channelSession.canal;
              stepResult.message_preview = msgText.substring(0, 100);
              stepResult.status = chRes.success ? "sent" : "error";
              stepResult.response = chRes;
              if (chRes.success) messagesSent++;
              else {
                stepsFailed++;
                failureMessages.push(`Step ${i} (${channelSession.canal}): ${chRes.error || "Falha no envio"}`);
              }
            }
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

              const msgText = replaceVariables(selectedMsgTemplate, lead_data, leadDb);

              // Provider hierarchy: step > auto > lead > project-active > global
              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              
              // Try project-specific provider first
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
                  .order("created_at", { ascending: false })
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
                  .order("created_at", { ascending: false })
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
                const mediaKindMap: Record<string, string> = { image: "image", video: "video", audio: "audio", doc: "document" };
                const stepMedia = (step as any).media;
                const mediaPayload = stepMedia?.url
                  ? { media_url: stepMedia.url, media_type: mediaKindMap[stepMedia.kind] || "image" }
                  : {};
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
                    ...mediaPayload,
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
              const msgText = replaceVariables(step.mensagem || step.template || "", lead_data, leadDb);

              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
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

              const replaceVars = (text: string) => replaceVariables(text, lead_data, leadDb);

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
              const searchPhones = getBrazilianPhoneVariants(phone);
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
                await supabase.from("imphq_lead_tag_history").insert({
                  lead_id: lead_data.lead_id,
                  project_id: project_id || null,
                  tag,
                  action: "added",
                  source: "openflow",

                });
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
                await supabase.from("imphq_lead_tag_history").insert({
                  lead_id: lead_data.lead_id,
                  project_id: project_id || null,
                  tag,
                  action: "removed",
                  source: "openflow",

                });
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

          else if (step.tipo === "update_lead") {
            const field = step.lead_field;
            const op = step.lead_op || "set";
            const value = step.lead_value;
            const ALLOWED = new Set(["status", "score", "awareness_level", "nome", "email"]);
            if (!lead_data?.lead_id || !field || !ALLOWED.has(field)) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem lead_id ou campo inválido";
            } else {
              let updatePayload: any = {};
              if (op === "inc" && field === "score") {
                const { data: cur } = await supabase.from("imphq_leads").select("score").eq("id", lead_data.lead_id).maybeSingle();
                const base = Number(cur?.score || 0);
                const inc = Number(value || 0);
                updatePayload.score = base + inc;
              } else if (field === "score") {
                updatePayload.score = Number(value || 0);
              } else {
                updatePayload[field] = value;
              }
              const { error: upErr } = await supabase.from("imphq_leads").update(updatePayload).eq("id", lead_data.lead_id);
              if (upErr) {
                stepResult.status = "error";
                stepResult.reason = upErr.message;
              } else {
                stepResult.status = "lead_updated";
                stepResult.field = field;
                stepResult.op = op;
                stepResult.value = updatePayload[field];
              }
            }
          }

          else if (step.tipo === "move_stage") {
            const target = step.target_stage;
            if (!lead_data?.lead_id || !target) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem lead_id ou target_stage";
            } else {
              const { error: upErr } = await supabase.from("imphq_leads").update({ funil_id: target }).eq("id", lead_data.lead_id);
              if (upErr) {
                stepResult.status = "error";
                stepResult.reason = upErr.message;
              } else {
                stepResult.status = "stage_moved";
                stepResult.target_stage = target;
              }
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
              const searchPhones = getBrazilianPhoneVariants(phone);

              // leadDb is already preloaded in the outer scope

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
                    model: step.ia_search_web ? "google/gemini-2.5-flash" : (step.ia_model === "gpt-4o" ? "openai/gpt-4o" : (aiConfig?.ai_model || "google/gemini-2.5-flash")),
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

              finalMsg = replaceVariables(finalMsg, lead_data, leadDb);

              // Choose provider
              let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
              if (!providerId && project_id) {
                const { data: projProviders } = await supabase
                  .from("imphq_wa_providers")
                  .select("id")
                  .eq("is_active", true)
                  .eq("project_id", project_id)
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

              stepResult.provider_id = providerId || null;
              stepResult.phone = phone;
              stepResult.message_preview = finalMsg.substring(0, 100);

              if (!providerId) {
                stepResult.status = "error";
                stepResult.reason = "Nenhum provider WhatsApp ativo encontrado";
                stepsFailed++;
                failureMessages.push(`Step ${i} (ia_message): Nenhum provider ativo`);
              } else {
                const isVoice = step.ia_voice_response === true || aiConfig?.voice_reply_enabled === true;
                const actionUrl = isVoice 
                  ? `${supabaseUrl}/functions/v1/whatsapp-api?action=send_voice_synthesis`
                  : `${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`;
                
                const payload: any = {
                  provider_id: providerId,
                  phone: normalizeBRPhone(phone),
                  project_id,
                };
                if (isVoice) {
                  payload.text = finalMsg;
                  payload.voice_provider = step.voice_provider || aiConfig?.voice_provider || "elevenlabs";
                  payload.voice_id = step.voice_id || aiConfig?.voice_name || "fernanda_hq";
                  payload.voice_stability = step.voice_stability || aiConfig?.voice_stability || 75;
                  payload.voice_clarity = step.voice_clarity || aiConfig?.voice_clarity || 85;
                } else {
                  payload.content = finalMsg;
                }

                const waRes = await fetch(actionUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify(payload),
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

          else if (step.tipo === "branch_by_score") {
            let score = 0;
            if (lead_data?.score != null) {
              score = Number(lead_data.score);
            } else if (lead_data?.lead_id) {
              const { data: ld } = await supabase.from("imphq_leads").select("score").eq("id", lead_data.lead_id).maybeSingle();
              score = Number((ld as any)?.score || 0);
            }
            const min = Number(step.score_min ?? 0);
            const max = Number(step.score_max ?? 100);
            const conditionMet = score >= min && score <= max;
            stepResult.status = "evaluated";
            stepResult.score = score;
            stepResult.condition_met = conditionMet;
            if (!conditionMet) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
              console.log(`[openflow-executor] branch_by_score: score=${score} fora de [${min},${max}], pulando ${skipCount} step(s)`);
            }
          }

          else if (step.tipo === "slack_notify") {
            const webhookUrl = String(step.webhook_url || "").trim();
            const text = replaceVariables(step.text || "", lead_data, leadDb) || "Notificação OpenFlow";
            if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
              stepResult.status = "error";
              stepResult.response = { success: false, error: "webhook_url inválido (deve começar com https://hooks.slack.com/)" };
              stepsFailed++;
              failureMessages.push(`Step ${i} (slack_notify): webhook_url inválido`);
            } else {
              try {
                const resp = await fetch(webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text }),
                });
                if (!resp.ok) {
                  const errTxt = await resp.text().catch(() => "");
                  stepResult.status = "error";
                  stepResult.response = { success: false, error: `Slack ${resp.status}: ${errTxt.slice(0, 200)}` };
                  stepsFailed++;
                  failureMessages.push(`Step ${i} (slack_notify): HTTP ${resp.status}`);
                } else {
                  stepResult.status = "completed";
                  stepResult.message_preview = text.slice(0, 120);
                  stepResult.response = { success: true };
                }
              } catch (e: any) {
                stepResult.status = "error";
                stepResult.response = { success: false, error: e?.message || "fetch falhou" };
                stepsFailed++;
                failureMessages.push(`Step ${i} (slack_notify): ${e?.message || "erro"}`);
              }
            }
          }

          else if (step.tipo === "update_memory") {
            const key = step.memory_key;
            const rawValue = replaceVariables(step.memory_value || "", lead_data, leadDb);
            if (!key || !lead_data?.lead_id) {
              stepResult.status = "skipped";
              stepResult.reason = !key ? "memory_key não definida" : "lead_id ausente";
            } else {
              const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
              const current = (ld as any)?.lead_memory || {};
              const updatedMemory = { ...current, [key]: rawValue };
              const { error: memErr } = await supabase.from("imphq_leads")
                .update({ lead_memory: updatedMemory, updated_at: new Date().toISOString() })
                .eq("id", lead_data.lead_id);
              
              if (!memErr && leadDb) {
                leadDb.lead_memory = updatedMemory;
              }
              
              stepResult.status = memErr ? "error" : "completed";
              stepResult.memory_key = key;
              if (memErr) { stepsFailed++; failureMessages.push(`Step ${i} (update_memory): ${memErr.message}`); }
            }
          }

          else if (step.tipo === "business_hours_split") {
            const startStr = step.work_hours_start || "08:00";
            const endStr = step.work_hours_end || "18:00";
            
            const d = new Date();
            const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
            const brTime = new Date(utc + (3600000 * -3)); // BR (GMT-3)
            const hour = brTime.getHours();
            const min = brTime.getMinutes();
            const day = brTime.getDay();
            
            const [startH, startM] = startStr.split(":").map(Number);
            const [endH, endM] = endStr.split(":").map(Number);
            
            const currentVal = hour * 60 + min;
            const startVal = startH * 60 + startM;
            const endVal = endH * 60 + endM;
            
            const isWorkDay = day >= 1 && day <= 5;
            const isWorkHour = currentVal >= startVal && currentVal <= endVal;
            
            const conditionMet = isWorkDay && isWorkHour;
            stepResult.status = "evaluated";
            stepResult.is_business_hours = conditionMet;
            stepResult.current_br_time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")} (Day ${day})`;
            
            if (!conditionMet) {
              const skipCount = parseInt(step.else_skip) || 1;
              i += skipCount;
              stepResult.skipped_steps = skipCount;
              console.log(`[openflow-executor] business_hours_split: Out of business hours. Skipping ${skipCount} step(s).`);
            } else {
              console.log(`[openflow-executor] business_hours_split: Within business hours. Continuing.`);
            }
          }

          else if (step.tipo === "semantic_router") {
            const ruleA = step.router_definition_a || "cliente quer comprar ou tirando dúvidas";
            const ruleB = step.router_definition_b || "cliente quer falar com atendente ou irritado";
            const elseSkip = parseInt(step.else_skip) || 1;

            let lastUserMessage = "";
            if (lead_data?.lead_id) {
              const { data: lastMsg } = await supabase
                .from("imphq_wa_messages")
                .select("content")
                .eq("project_id", project_id)
                .eq("direction", "incoming")
                .order("created_at", { descending: true })
                .limit(1)
                .maybeSingle();
              if (lastMsg) {
                lastUserMessage = lastMsg.content || "";
              }
            }

            if (!lastUserMessage) {
              stepResult.status = "evaluated";
              stepResult.route_chosen = "A";
              console.log("[openflow-executor] semantic_router: No incoming message found. Defaulting to Route A.");
            } else {
              let routeChosen = "A";
              try {
                const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
                if (openRouterKey) {
                  const prompt = `Você é um roteador semântico de mensagens de vendas.
Sua tarefa é analisar a mensagem do lead abaixo e classificá-la entre duas opções (A ou B).

OPÇÃO A:
Definição: ${ruleA}

OPÇÃO B:
Definição: ${ruleB}

Mensagem do lead: "${lastUserMessage}"

Responda APENAS com a letra "A" ou "B" (sem mais nada na resposta, sem explicações).`;

                  const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${openRouterKey}`,
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [
                        { role: "system", content: "Você é um classificador preciso de intenções." },
                        { role: "user", content: prompt }
                      ],
                      temperature: 0,
                      max_tokens: 2
                    })
                  });

                  if (llmRes.ok) {
                    const resJson = await llmRes.json();
                    const choice = resJson.choices?.[0]?.message?.content?.trim().toUpperCase();
                    if (choice === "A" || choice === "B") {
                      routeChosen = choice;
                    }
                  }
                }
              } catch (llmErr) {
                console.error("[openflow-executor] semantic_router classification error:", llmErr.message);
              }

              stepResult.status = "evaluated";
              stepResult.route_chosen = routeChosen;
              stepResult.last_message = lastUserMessage;
              
              if (routeChosen === "B") {
                i += elseSkip;
                stepResult.skipped_steps = elseSkip;
                console.log(`[openflow-executor] semantic_router: Route B chosen. Skipping ${elseSkip} step(s).`);
              } else {
                console.log(`[openflow-executor] semantic_router: Route A chosen. Continuing.`);
              }
            }
          }

          else if (step.tipo === "ia_scheduling") {
            if (lead_data?.lead_id) {
              const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
              const current = (ld as any)?.lead_memory || {};
              const updatedMemory = { ...current, conversation_phase: "scheduling", calendar_url: step.calendar_url || "" };
              await supabase.from("imphq_leads").update({ lead_memory: updatedMemory }).eq("id", lead_data.lead_id);
              if (leadDb) {
                leadDb.lead_memory = updatedMemory;
              }
            }
            stepResult.status = "waiting_for_lead_response";
            stepResult.reason = "IA de Agendamento ativa. Aguardando interação do lead.";
            status = "waiting";
          }

          else if (step.tipo === "condicao_lead") {
            const field = step.condition_field;
            const operator = step.condition_operator || "equals";
            const valToCompare = replaceVariables(step.condition_value || "", lead_data, leadDb);
            const jumpSteps = Number(step.condition_jump_steps ?? 1);
            const elseJumpSteps = Number(step.condition_else_jump_steps ?? 0);

            // Fetch actual value
            let leadValue: any = null;
            if (field === "nome") {
              leadValue = lead_data?.nome || leadDb?.name || "";
            } else if (field === "email") {
              leadValue = lead_data?.email || leadDb?.email || "";
            } else if (field === "phone") {
              leadValue = lead_data?.phone || lead_data?.telefone || leadDb?.telefone || leadDb?.phone || "";
            } else if (field === "score") {
              leadValue = lead_data?.score !== undefined ? lead_data.score : (leadDb?.score ?? 0);
            } else if (field === "tags") {
              leadValue = leadTags || leadDb?.tags || [];
            } else if (field === "lead_memory") {
              const memKey = step.memory_key;
              if (memKey && leadDb?.lead_memory) {
                leadValue = leadDb.lead_memory[memKey];
              }
            } else {
              leadValue = lead_data?.[field] !== undefined ? lead_data[field] : leadDb?.[field];
            }

            let conditionMet = false;

            if (operator === "equals") {
              conditionMet = String(leadValue || "").toLowerCase() === String(valToCompare || "").toLowerCase();
            } else if (operator === "not_equals") {
              conditionMet = String(leadValue || "").toLowerCase() !== String(valToCompare || "").toLowerCase();
            } else if (operator === "contains") {
              conditionMet = String(leadValue || "").toLowerCase().includes(String(valToCompare || "").toLowerCase());
            } else if (operator === "greater_than") {
              conditionMet = Number(leadValue || 0) > Number(valToCompare || 0);
            } else if (operator === "less_than") {
              conditionMet = Number(leadValue || 0) < Number(valToCompare || 0);
            } else if (operator === "includes_tag") {
              const tagsList = Array.isArray(leadValue) ? leadValue : String(leadValue || "").split(",").map(t => t.trim());
              conditionMet = tagsList.some((t: string) => t.toLowerCase() === String(valToCompare || "").toLowerCase());
            } else if (operator === "not_includes_tag") {
              const tagsList = Array.isArray(leadValue) ? leadValue : String(leadValue || "").split(",").map(t => t.trim());
              conditionMet = !tagsList.some((t: string) => t.toLowerCase() === String(valToCompare || "").toLowerCase());
            }

            stepResult.status = "evaluated";
            stepResult.condition_met = conditionMet;
            stepResult.field = field;
            stepResult.operator = operator;
            stepResult.lead_value = leadValue;
            stepResult.value_to_compare = valToCompare;

            if (conditionMet) {
              stepResult.notes = `Condição atendida. Pulando ${jumpSteps} passos.`;
              stepResult.branch_taken = "if";
              i += jumpSteps;
            } else {
              stepResult.notes = `Condição não atendida. Pulando ${elseJumpSteps} passos.`;
              stepResult.branch_taken = "else";
              i += elseJumpSteps;
            }

          }

          else if (step.tipo === "webhook_call") {
            const url = replaceVariables(step.webhook_url || "", lead_data, leadDb);
            const method = step.webhook_method || "POST";
            const saveKey = step.webhook_save_variable;

            if (!url) {
              stepResult.status = "skipped";
              stepResult.reason = "URL do webhook não configurada";
            } else {
              let headersObj: Record<string, string> = {
                "Content-Type": "application/json",
              };

              if (step.webhook_headers) {
                try {
                  const replacedHeaders = replaceVariables(step.webhook_headers, lead_data, leadDb);
                  const parsedHeaders = JSON.parse(replacedHeaders);
                  headersObj = { ...headersObj, ...parsedHeaders };
                } catch (err: any) {
                  console.error("[openflow-executor] Error parsing webhook headers:", err);
                  stepResult.headers_error = err.message;
                }
              }

              let fetchBody: any = undefined;
              if (method !== "GET" && step.webhook_body) {
                const replacedBody = replaceVariables(step.webhook_body, lead_data, leadDb);
                fetchBody = replacedBody;
              }

              console.log(`[openflow-executor] Calling webhook: ${method} ${url}`);
              try {
                const response = await fetch(url, {
                  method,
                  headers: headersObj,
                  body: fetchBody,
                });

                const statusCode = response.status;
                let responseBody = "";
                try {
                  responseBody = await response.text();
                } catch (err) {
                  console.error("[openflow-executor] Error reading webhook response body:", err);
                }

                stepResult.status = response.ok ? "completed" : "error";
                stepResult.status_code = statusCode;
                stepResult.response_body = responseBody.substring(0, 1000);

                if (response.ok) {
                  if (saveKey && lead_data?.lead_id) {
                    let parsedJson: any = null;
                    try {
                      parsedJson = JSON.parse(responseBody);
                    } catch (err) {
                      parsedJson = responseBody;
                    }

                    const { data: ld } = await supabase
                      .from("imphq_leads")
                      .select("lead_memory")
                      .eq("id", lead_data.lead_id)
                      .maybeSingle();
                    const currentMemory = ld?.lead_memory || {};
                    const updatedMemory = { ...currentMemory, [saveKey]: parsedJson };

                    await supabase
                      .from("imphq_leads")
                      .update({
                        lead_memory: updatedMemory,
                        updated_at: new Date().toISOString()
                      })
                      .eq("id", lead_data.lead_id);

                    if (leadDb) {
                      leadDb.lead_memory = updatedMemory;
                    }
                    stepResult.saved_variable = saveKey;
                  }
                } else {
                  stepsFailed++;
                  failureMessages.push(`Webhook ${url} retornou status ${statusCode}`);
                }
              } catch (fetchErr: any) {
                console.error("[openflow-executor] Webhook fetch error:", fetchErr);
                stepResult.status = "error";
                stepResult.reason = fetchErr.message;
                stepsFailed++;
                failureMessages.push(`Erro de conexão ao webhook ${url}: ${fetchErr.message}`);
              }
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

          else if (step.tipo === "notify_operator") {
            const opName = step.operator_name || "todos";
            const notificationMsg = replaceVariables(step.template || step.mensagem || "", lead_data, leadDb);
            const leadName = lead_data?.nome || leadDb?.name || "Lead";

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
                .eq("id", project_id)
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

            stepResult.notified_users = targetUserIds;
            stepResult.status = "completed";

            for (const uid of targetUserIds) {
              const { error: notifErr } = await supabase.from("imphq_notifications").insert({
                user_id: uid,
                title: `🔔 Alerta: ${leadName}`,
                message: notificationMsg || `O lead ${leadName} solicitou atendimento humano ou atenção do atendente.`,
                type: "lead",
                entity_type: "lead",
                entity_id: lead_data?.lead_id || null,
              });

              if (notifErr) {
                console.error(`[openflow-executor] Error inserting notification for user ${uid}:`, notifErr.message);
                stepResult.status = "error";
                stepResult.reason = notifErr.message;
              } else {
                // Call push notification function
                try {
                  const pushUrl = `${supabaseUrl}/functions/v1/send-push`;
                  await fetch(pushUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${supabaseKey}`,
                    },
                    body: JSON.stringify({
                      user_id: uid,
                      title: `🔔 Alerta: ${leadName}`,
                      message: notificationMsg || `O lead ${leadName} solicitou atenção do atendente.`,
                    }),
                  });
                } catch (pushErr: any) {
                  console.error(`[openflow-executor] Push send error for user ${uid}:`, pushErr.message);
                }
              }
            }

            if (stepResult.status === "error") {
              stepsFailed++;
              failureMessages.push(`Step ${i} (notify_operator) falhou ao salvar notificação`);
            }
          }

          else if (step.tipo === "abrir_conversa") {
            const phone = lead_data?.phone || lead_data?.telefone;
            if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else {
               const searchPhones = getBrazilianPhoneVariants(phone);

              const aiPausedUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
              const { error: updateConvErr } = await supabase
                .from("imphq_wa_conversations")
                .update({
                  status: "open",
                  unread_count: 1, // Visual alert in inbox
                  ai_paused_until: aiPausedUntil,
                  updated_at: new Date().toISOString()
                })
                .eq("project_id", project_id)
                .in("phone", searchPhones);

              stepResult.status = updateConvErr ? "error" : "completed";
              stepResult.ai_paused_until = aiPausedUntil;

              if (updateConvErr) {
                console.error(`[openflow-executor] Error opening conversation:`, updateConvErr.message);
                stepsFailed++;
                failureMessages.push(`Step ${i} (abrir_conversa): ${updateConvErr.message}`);
              } else {
                console.log(`[openflow-executor] Conversation opened for phone ${phone}. AI paused until ${aiPausedUntil}`);
              }
            }
          }

          else if (step.tipo === "gpt_prompt") {
            const phone = lead_data?.phone || lead_data?.telefone;
            const customPrompt = replaceVariables(step.template || step.mensagem || "", lead_data, leadDb);

            if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else {
               const searchPhones = getBrazilianPhoneVariants(phone);

              let chatHistoryContext = "";
              const keepContext = step.gpt_keep_context ?? true;

              if (keepContext) {
                const { data: history } = await supabase
                  .from("imphq_wa_messages")
                  .select("direction, content, created_at")
                  .in("phone", searchPhones)
                  .order("created_at", { ascending: false })
                  .limit(15);

                if (history && history.length > 0) {
                  const sortedHistory = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  chatHistoryContext = sortedHistory.map(m => {
                    const speaker = m.direction === "incoming" ? "Lead" : "Atendente/IA";
                    return `${speaker}: ${m.content}`;
                  }).join("\n");
                } else {
                  chatHistoryContext = "(Nenhuma mensagem anterior no histórico)";
                }
              } else {
                chatHistoryContext = "(Sem contexto do histórico por configuração do nó)";
              }

              const systemPrompt = `Você é uma inteligência artificial assistente integrada a um sistema de automação.
Sua tarefa é executar um prompt analítico usando como contexto o histórico de conversas de WhatsApp com o lead abaixo.

Histórico de Conversas de WhatsApp:
=========================================
${chatHistoryContext}
=========================================

Instruções Adicionais:
- Responda apenas com o resultado do prompt solicitado.
- Não inclua explicações extras, tags HTML ou introduções como "Aqui está o resumo".
- Seja direto e preciso.`;

              const userContent = `Execute o seguinte prompt sobre o histórico acima:
"${customPrompt}"`;

              const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
              if (!OPENROUTER_API_KEY) {
                throw new Error("OPENROUTER_API_KEY não configurado");
              }

              const modelMap: Record<string, string> = {
                "gpt-4o": "openai/gpt-4o",
                "gpt-4o-mini": "google/gemini-2.5-flash"
              };
              const selectedModel = modelMap[step.gpt_model] || "google/gemini-2.5-flash";

              const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://imperiox.lovable.app",
                  "X-Title": "Imperio HQ",
                },
                body: JSON.stringify({
                  model: selectedModel,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                  ],
                  max_tokens: step.gpt_max_tokens !== undefined ? Number(step.gpt_max_tokens) : 256,
                  temperature: step.gpt_temperature !== undefined ? Number(step.gpt_temperature) : 0.2,
                }),
              });

              if (orRes.ok) {
                const orData = await orRes.json();
                const gptOutput = (orData?.choices?.[0]?.message?.content || "").trim();
                
                stepResult.gpt_output = gptOutput;
                stepResult.status = "completed";

                // Save to lead memory variable
                const saveKey = step.gpt_save_variable || "resumo_cliente";
                if (lead_data?.lead_id) {
                  const { data: ld } = await supabase
                    .from("imphq_leads")
                    .select("lead_memory")
                    .eq("id", lead_data.lead_id)
                    .maybeSingle();
                  const currentMemory = ld?.lead_memory || {};
                  
                  await supabase
                    .from("imphq_leads")
                    .update({
                      lead_memory: { ...currentMemory, [saveKey]: gptOutput },
                      updated_at: new Date().toISOString()
                    })
                    .eq("id", lead_data.lead_id);
                    
                  // Update local leadDb state for subsequent variables replacements in this run
                  if (leadDb) {
                    leadDb.lead_memory = { ...currentMemory, [saveKey]: gptOutput };
                  }
                }

                // If "Enviar resultado como texto?" is true, send it on WhatsApp
                const sendAsText = step.gpt_send_message ?? false;
                if (sendAsText && gptOutput) {
                  let providerId = step.provider_id || auto.provider_id || lead_data?.provider_id;
                  if (!providerId && project_id) {
                    const { data: projProviders } = await supabase
                      .from("imphq_wa_providers")
                      .select("id")
                      .eq("is_active", true)
                      .eq("project_id", project_id)
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

                  if (providerId) {
                    const waRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${supabaseKey}`,
                      },
                      body: JSON.stringify({
                        provider_id: providerId,
                        phone: normalizeBRPhone(phone),
                        content: gptOutput,
                        project_id,
                      }),
                    });
                    const waData = await waRes.json();
                    if (waData.success) {
                      messagesSent++;
                      console.log(`[openflow-executor] Sent GPT output directly as WhatsApp message to ${phone}`);
                    } else {
                      console.warn(`[openflow-executor] Failed to send GPT output to WhatsApp:`, waData.error);
                    }
                  } else {
                    console.warn(`[openflow-executor] No active WA provider to send GPT output text to ${phone}`);
                  }
                }
              } else {
                const errText = await orRes.text();
                console.error(`[openflow-executor] OpenRouter prompt execution failed:`, errText);
                stepResult.status = "error";
                stepResult.reason = `OpenRouter error: ${orRes.status} ${errText}`;
                stepsFailed++;
                failureMessages.push(`Step ${i} (gpt_prompt): ${errText}`);
              }
            }
          }

          else if (step.tipo === "stop_on_event") {
            const stopType = step.stop_event_type || "compra_aprovada";
            const stopValue = step.stop_event_value;
            let conditionMet = false;
            let abortReason = "";

            const phone = lead_data?.phone || lead_data?.telefone;
            const leadId = lead_data?.lead_id;

            if (stopType === "compra_aprovada" && leadId) {
              const { data: purchases } = await supabase
                .from("imphq_vendas")
                .select("id")
                .eq("lead_id", leadId)
                .eq("status", "aprovado")
                .gt("created_at", originalStart)
                .limit(1);
              if (purchases && purchases.length > 0) {
                conditionMet = true;
                abortReason = "Lead realizou a compra";
              }
            } else if (stopType === "lead_respondeu" && phone) {
               const searchPhones = getBrazilianPhoneVariants(phone);
              const { data: incomingMsgs } = await supabase
                .from("imphq_wa_messages")
                .select("id")
                .in("phone", searchPhones)
                .eq("direction", "incoming")
                .gt("created_at", originalStart)
                .limit(1);
              if (incomingMsgs && incomingMsgs.length > 0) {
                conditionMet = true;
                abortReason = "Lead respondeu à automação";
              }
            } else if (stopType === "tag_adicionada" && leadId && stopValue) {
              const cleanTag = stopValue.trim().toLowerCase();
              const tagsList = leadTags || leadDb?.tags || [];
              const hasTag = tagsList.some((t: string) => t.toLowerCase() === cleanTag);
              if (hasTag) {
                conditionMet = true;
                abortReason = `Tag "${stopValue}" adicionada ao lead`;
              }
            } else if (stopType === "carrinho_abandonado" && leadId) {
              const { data: abandoned } = await supabase
                .from("imphq_vendas")
                .select("id")
                .eq("lead_id", leadId)
                .eq("status", "carrinho_abandonado")
                .gt("created_at", originalStart)
                .limit(1);
              if (abandoned && abandoned.length > 0) {
                conditionMet = true;
                abortReason = "Lead abandonou o carrinho";
              }
            }

            stepResult.status = "completed";
            stepResult.condition_met = conditionMet;
            
            if (conditionMet) {
              stepResult.notes = `Condição de parada atendida: ${abortReason}. Interrompendo fluxo.`;
              stepResult.finished_at = new Date().toISOString();
              stepResults.push(stepResult);
              status = "completed";
              
              await supabase.from("imphq_flow_executions")
                .update({ 
                  status: "completed",
                  current_step: i,
                  step_results: [...stepResults]
                })
                .eq("id", executionId);
              break; 
            } else {
              stepResult.notes = `Condição de parada "${stopType}" não atendida. Continuando fluxo.`;
            }
          }

          else if (step.tipo === "loop_steps") {
            const loopCount = Number(step.loop_count ?? 3);
            const jumpBack = Number(step.loop_jump_back_steps ?? 1);
            const intervalHours = Number(step.loop_interval_hours ?? 24);
            const targetStep = Math.max(0, i - jumpBack);

            const loopCountSoFar = stepResults.filter((r: any) => r.step === i && r.status === "completed").length;

            if (loopCountSoFar >= loopCount) {
              stepResult.status = "completed";
              stepResult.notes = `Limite de loops (${loopCount}) atingido. Continuando fluxo.`;
            } else {
              // Check early stop condition if set
              const field = step.loop_until_condition_field;
              let earlyStopMet = false;
              
              if (field && field !== "none") {
                const operator = step.loop_until_condition_operator || "equals";
                const valToCompare = replaceVariables(step.loop_until_condition_value || "", lead_data, leadDb);

                let leadValue: any = null;
                if (field === "nome") {
                  leadValue = lead_data?.nome || leadDb?.name || "";
                } else if (field === "email") {
                  leadValue = lead_data?.email || leadDb?.email || "";
                } else if (field === "phone") {
                  leadValue = lead_data?.phone || lead_data?.telefone || leadDb?.telefone || leadDb?.phone || "";
                } else if (field === "score") {
                  leadValue = lead_data?.score !== undefined ? lead_data.score : (leadDb?.score ?? 0);
                } else if (field === "tags") {
                  leadValue = leadTags || leadDb?.tags || [];
                } else if (field === "lead_memory") {
                  const memKey = step.memory_key;
                  if (memKey && leadDb?.lead_memory) {
                    leadValue = leadDb.lead_memory[memKey];
                  }
                } else {
                  leadValue = lead_data?.[field] !== undefined ? lead_data[field] : leadDb?.[field];
                }

                if (operator === "equals") {
                  earlyStopMet = String(leadValue || "").toLowerCase() === String(valToCompare || "").toLowerCase();
                } else if (operator === "not_equals") {
                  earlyStopMet = String(leadValue || "").toLowerCase() !== String(valToCompare || "").toLowerCase();
                } else if (operator === "contains") {
                  earlyStopMet = String(leadValue || "").toLowerCase().includes(String(valToCompare || "").toLowerCase());
                } else if (operator === "includes_tag") {
                  const tagsList = Array.isArray(leadValue) ? leadValue : String(leadValue || "").split(",").map(t => t.trim());
                  earlyStopMet = tagsList.some((t: string) => t.toLowerCase() === String(valToCompare || "").toLowerCase());
                }
              }

              if (earlyStopMet) {
                stepResult.status = "completed";
                stepResult.notes = `Condição de parada antecipada atendida. Loops interrompidos.`;
              } else {
                const delayMin = intervalHours * 60;
                stepResult.status = "completed";

                if (delayMin > 5) {
                  const nextRun = new Date(Date.now() + delayMin * 60000);
                  await supabase.from("imphq_flow_executions")
                    .update({
                      status: "waiting",
                      current_step: targetStep,
                      next_run_at: nextRun.toISOString(),
                      step_results: [...stepResults, { ...stepResult, notes: `Loop #${loopCountSoFar + 1} executado. Retomará na etapa #${targetStep + 1} em ${nextRun.toLocaleTimeString()}.` }],
                    })
                    .eq("id", executionId);
                  status = "waiting";
                  break; // Pauses outer execution loop
                } else {
                  // Wait inline (useful for tests/quick loops)
                  await delay(delayMin * 60000);
                  stepResult.notes = `Loop #${loopCountSoFar + 1} executado. Retornando para etapa #${targetStep + 1} (inline).`;
                  // Manual adjust of loop index (accounting for outer loop i++ at end of iteration)
                  i = targetStep - 1;
                }
              }
            }
          }

          else if (step.tipo === "ai_agent") {
            // Agente IA autônomo: invoca LLM com identidade/instruções do agente e envia via WhatsApp.
            const agentId = step.ai_agent_id;
            const phone = lead_data?.phone || lead_data?.telefone;
            if (!agentId) {
              stepResult.status = "skipped";
              stepResult.reason = "Agente IA não selecionado";
            } else if (!phone) {
              stepResult.status = "skipped";
              stepResult.reason = "Sem telefone do lead";
            } else {
              const { data: agent } = await supabase
                .from("imphq_ai_agents")
                .select("id, nome, identidade, diretrizes, objetivo, instrucoes, restricoes, base_conhecimento, qa_pairs")
                .eq("id", agentId)
                .maybeSingle();

              if (!agent) {
                stepResult.status = "error";
                stepResult.reason = `Agente ${agentId} não encontrado`;
                stepsFailed++;
              } else {
                const passCtx = step.ai_agent_pass_context !== false;
                const ctxLines = passCtx ? [
                  `Nome do lead: ${lead_data?.nome || leadDb?.name || "Lead"}`,
                  `Telefone: ${phone}`,
                  `Produto: ${lead_data?.produto || leadDb?.produto || "-"}`,
                  leadDb?.lead_memory ? `Memória: ${JSON.stringify(leadDb.lead_memory).slice(0, 500)}` : "",
                ].filter(Boolean).join("\n") : "";

                const qa = Array.isArray(agent.qa_pairs) && agent.qa_pairs.length
                  ? `\n\nExemplos Q&A:\n${agent.qa_pairs.slice(0, 10).map((q: any) => `P: ${q.pergunta || q.q}\nR: ${q.resposta || q.a}`).join("\n\n")}`
                  : "";

                // RAG: busca trechos relevantes na base de conhecimento do agente
                let ragContext = "";
                try {
                  const LK = Deno.env.get("LOVABLE_API_KEY");
                  const query = (step.mensagem || agent.objetivo || agent.identidade || "").slice(0, 500);
                  if (LK && query) {
                    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${LK}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: query, dimensions: 768 }),
                    });
                    if (embRes.ok) {
                      const ej = await embRes.json();
                      const qEmb = ej?.data?.[0]?.embedding;
                      if (qEmb) {
                        const { data: matches } = await supabase.rpc("match_agent_knowledge", {
                          p_agent_id: agentId, query_embedding: qEmb as any, match_count: 4, min_similarity: 0.45,
                        });
                        if (Array.isArray(matches) && matches.length) {
                          ragContext = `\n\n# Trechos relevantes da base\n${matches.map((m: any, i: number) => `[${i + 1}] (${m.source_name}) ${String(m.content).slice(0, 500)}`).join("\n\n")}`;
                        }
                      }
                    }
                  }
                } catch (e: any) {
                  console.warn(`[ai_agent] RAG falhou: ${e?.message}`);
                }

                const systemPrompt = [
                  agent.identidade ? `# Identidade\n${agent.identidade}` : "",
                  agent.diretrizes ? `# Diretrizes\n${agent.diretrizes}` : "",
                  agent.objetivo ? `# Objetivo\n${agent.objetivo}` : "",
                  agent.instrucoes ? `# Instruções\n${agent.instrucoes}` : "",
                  agent.restricoes ? `# Restrições\n${agent.restricoes}` : "",
                  agent.base_conhecimento ? `# Base de Conhecimento\n${String(agent.base_conhecimento).slice(0, 3000)}` : "",
                  ragContext,
                  qa,
                  ctxLines ? `# Contexto do Lead\n${ctxLines}` : "",
                  "Responda em português, tom natural de WhatsApp, curto (2-4 linhas). Sem aspas."
                ].filter(Boolean).join("\n\n");

                const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");
                let agentMsg = "";
                if (OR_KEY) {
                  try {
                    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        model: "google/gemini-2.5-flash",
                        messages: [
                          { role: "system", content: systemPrompt },
                          { role: "user", content: step.mensagem || "Inicie a conversa cumprindo o objetivo." },
                        ],
                        max_tokens: 300,
                        temperature: 0.7,
                      }),
                    });
                    if (orRes.ok) {
                      const d = await orRes.json();
                      agentMsg = (d?.choices?.[0]?.message?.content || "").trim().replace(/^"|"$/g, "");
                    }
                  } catch (e: any) {
                    console.warn(`[ai_agent] LLM falhou: ${e?.message}`);
                  }
                }
                if (!agentMsg) agentMsg = replaceVariables(step.mensagem || "Olá!", lead_data, leadDb);

                // Salva em variável opcional
                if (step.ai_agent_save_variable && lead_data?.lead_id) {
                  const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
                  const current = (ld as any)?.lead_memory || {};
                  const updated = { ...current, [step.ai_agent_save_variable]: agentMsg };
                  await supabase.from("imphq_leads").update({ lead_memory: updated }).eq("id", lead_data.lead_id);
                  if (leadDb) leadDb.lead_memory = updated;
                }

                // Descobre provider
                let providerId = step.provider_id || auto.provider_id;
                if (!providerId && project_id) {
                  const { data: pp } = await supabase.from("imphq_wa_providers").select("id").eq("is_active", true).eq("project_id", project_id).limit(1);
                  if (pp?.length) providerId = pp[0].id;
                }

                if (providerId) {
                  const waRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-api?action=send_message`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                    body: JSON.stringify({ provider_id: providerId, phone: normalizeBRPhone(phone), project_id, content: agentMsg }),
                  });
                  const waData = await waRes.json();
                  stepResult.status = waData.success ? "sent" : "error";
                  stepResult.agent_id = agentId;
                  stepResult.agent_nome = agent.nome;
                  stepResult.message_preview = agentMsg.substring(0, 120);
                  if (waData.success) messagesSent++;
                  else stepsFailed++;
                } else {
                  stepResult.status = "error";
                  stepResult.reason = "Nenhum provider WhatsApp ativo";
                  stepsFailed++;
                }
              }
            }
          }

          else if (step.tipo === "distribuir_atendentes") {
            // Distribuição round-robin/random/least_busy entre operadores.
            const strategy = step.distrib_strategy || "round_robin";
            const raw = String(step.distrib_operators || "").split(",").map((s: string) => s.trim()).filter(Boolean);

            let operators: Array<{ id: string; nome: string }> = [];
            if (raw.length) {
              const { data: tm } = await supabase
                .from("imphq_team_members")
                .select("id, nome")
                .or(raw.map(v => `id.eq.${v},nome.ilike.%${v}%`).join(","));
              operators = tm || raw.map(v => ({ id: v, nome: v }));
            } else if (project_id) {
              const { data: tm } = await supabase.from("imphq_team_members").select("id, nome").eq("project_id", project_id);
              operators = tm || [];
            }

            if (!operators.length) {
              stepResult.status = "skipped";
              stepResult.reason = "Nenhum operador disponível";
            } else {
              let chosen = operators[0];
              if (strategy === "random") {
                chosen = operators[Math.floor(Math.random() * operators.length)];
              } else if (strategy === "least_busy") {
                const counts = await Promise.all(operators.map(async (op) => {
                  const { count } = await supabase
                    .from("imphq_wa_conversations")
                    .select("id", { count: "exact", head: true })
                    .eq("assigned_to", op.id)
                    .in("status", ["aberta", "em_atendimento"]);
                  return { op, n: count || 0 };
                }));
                counts.sort((a, b) => a.n - b.n);
                chosen = counts[0].op;
              } else {
                // round_robin: usa hash simples do lead_id para consistência
                const key = String(lead_data?.lead_id || lead_data?.phone || "0");
                let h = 0;
                for (let k = 0; k < key.length; k++) h = (h * 31 + key.charCodeAt(k)) >>> 0;
                chosen = operators[h % operators.length];
              }

              // Atribui na conversa
              const phone = lead_data?.phone || lead_data?.telefone;
              if (phone && project_id) {
                await supabase
                  .from("imphq_wa_conversations")
                  .update({ assigned_to: chosen.id, updated_at: new Date().toISOString() })
                  .eq("project_id", project_id)
                  .in("phone", getBrazilianPhoneVariants(phone));
              }

              // Salva variável
              if (step.distrib_save_variable && lead_data?.lead_id) {
                const { data: ld } = await supabase.from("imphq_leads").select("lead_memory").eq("id", lead_data.lead_id).maybeSingle();
                const current = (ld as any)?.lead_memory || {};
                const updated = { ...current, [step.distrib_save_variable]: { id: chosen.id, nome: chosen.nome } };
                await supabase.from("imphq_leads").update({ lead_memory: updated }).eq("id", lead_data.lead_id);
                if (leadDb) leadDb.lead_memory = updated;
              }

              stepResult.status = "completed";
              stepResult.strategy = strategy;
              stepResult.assigned_to = { id: chosen.id, nome: chosen.nome };
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
            (stepResult as any)._failed_step_index = i;
            (stepResult as any)._failed_step_kind = step.tipo;
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

      // ============ Retry inteligente + Dead-letter ============
      if (status === "failed") {
        const { data: execRow } = await supabase
          .from("imphq_flow_executions")
          .select("retry_count, max_retries")
          .eq("id", executionId)
          .maybeSingle();
        const retryCount = (execRow?.retry_count ?? 0) + 1;
        const maxRetries = execRow?.max_retries ?? 4;
        const failedResult = stepResults.find((s: any) => s._failed_step_index !== undefined);
        const failedIdx = failedResult?._failed_step_index ?? 0;
        const failedKind = failedResult?._failed_step_kind ?? "unknown";
        // Backoff exponencial (minutos): 1, 5, 15, 60, 360
        const backoffMin = [1, 5, 15, 60, 360][Math.min(retryCount - 1, 4)];
        const nextRunAt = new Date(Date.now() + backoffMin * 60_000).toISOString();

        if (retryCount <= maxRetries) {
          await supabase.from("imphq_flow_executions")
            .update({
              status: "retrying",
              retry_count: retryCount,
              current_step: failedIdx,
              next_run_at: nextRunAt,
              step_results: stepResults,
              error_message: errorMessage,
              last_error_at: new Date().toISOString(),
              last_error_kind: failedKind,
            })
            .eq("id", executionId);
          console.log(`[openflow-executor] Retry ${retryCount}/${maxRetries} agendado para ${nextRunAt} (exec=${executionId}, step=${failedIdx})`);
        } else {
          // Move to dead-letter
          await supabase.from("imphq_flow_dead_letter").insert({
            execution_id: executionId,
            automacao_id: auto.id,
            project_id,
            lead_id: lead_data?.lead_id || null,
            current_step: failedIdx,
            step_snapshot: steps[failedIdx] || {},
            error_message: errorMessage,
            error_kind: failedKind,
            retry_count: retryCount - 1,
            step_results: stepResults,
          });
          await supabase.from("imphq_flow_executions")
            .update({
              status: "dead_letter",
              retry_count: retryCount - 1,
              step_results: stepResults,
              error_message: errorMessage,
              last_error_at: new Date().toISOString(),
              last_error_kind: failedKind,
            })
            .eq("id", executionId);
          console.log(`[openflow-executor] Execução ${executionId} movida para dead-letter após ${retryCount - 1} tentativas`);
        }
      } else if (status !== "waiting") {
        // Final update (sucesso ou parcial)
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
