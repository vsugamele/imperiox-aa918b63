// wa-ai-reply — AI responder simples e robusto para WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { conversation_id, project_id, provider_id, phone, push_name } = body;
    let message = body.message || "";

    // Keyword bypass for testing (ex: #testeia or #testeia2026)
    const isTestMode = message.toLowerCase().includes("#testeia");
    if (isTestMode) {
      // Strip the keyword (#testeiaXXXX) from the message so the IA responds naturally
      message = message.replace(/#testeia\w*/gi, "").trim();
      if (!message) {
        message = "Olá! Estou testando seu comportamento.";
      }
      console.log(`[wa-ai-reply] TEST MODE ENABLED (#testeia keyword found). Cleaned message: "${message}"`);
    }
    
    let leadRow: any = null;
    if (phone && project_id) {
      try {
        const { data: lead } = await supabase
          .from("imphq_leads")
          .select("*")
          .eq("phone", phone)
          .eq("project_id", project_id)
          .maybeSingle();
        leadRow = lead;
      } catch (e: any) {
        console.warn("[wa-ai-reply] Query leadRow error:", e.message);
      }
    }

    let activeStepInstruction = "";
    let activeStep: any = null;
    let activeExecutionId = null;
    let activeAutomacaoNome = "";
    let activeExecutionStep = 0;
    let activeAutomacaoId = null;
    let activeTriggerTipo = "";
    let replyCount = 0;
    let shouldTransitionToHuman = false;
    let handoffReason = "";

    if (leadRow?.id) {
      try {
        const { data: activeExec } = await supabase
          .from("imphq_flow_executions")
          .select("id, automacao_id, current_step, trigger_tipo, step_results")
          .eq("lead_id", leadRow.id)
          .in("status", ["running", "waiting"])
          .order("created_at", { descending: false })
          .limit(1)
          .maybeSingle();
          
        if (activeExec) {
          console.log(`[wa-ai-reply] Active flow execution found: ${activeExec.id}, step: ${activeExec.current_step}`);
          const { data: automacao } = await supabase
            .from("imphq_automacoes")
            .select("id, nome, acoes, etapas")
            .eq("id", activeExec.automacao_id)
            .single();
            
          if (automacao) {
            activeAutomacaoNome = automacao.nome || "";
            const rawAcoes = automacao.acoes || automacao.etapas || [];
            const step = rawAcoes[activeExec.current_step];
            if (step) {
              activeStep = step;
              activeExecutionId = activeExec.id;
              activeExecutionStep = activeExec.current_step;
              activeAutomacaoId = activeExec.automacao_id;
              activeTriggerTipo = activeExec.trigger_tipo || "";
              activeStepInstruction = step.mensagem || step.template || step.texto || "";
              console.log(`[wa-ai-reply] Guideline from active step #${activeExec.current_step}: "${activeStepInstruction}"`);

              // Incrementar reply_count para esta etapa ativa no step_results
              const stepResults = Array.isArray(activeExec.step_results) ? activeExec.step_results : [];
              let currentStepResIdx = stepResults.findIndex((r: any) => r.step === activeExecutionStep);
              if (currentStepResIdx === -1) {
                stepResults.push({
                  step: activeExecutionStep,
                  status: "waiting_for_lead_response",
                  reply_count: 0,
                  started_at: new Date().toISOString()
                });
                currentStepResIdx = stepResults.length - 1;
              }

              const currentStepRes = stepResults[currentStepResIdx];
              if (currentStepRes?.ab_variant === "B") {
                activeStepInstruction = step.template_b || step.mensagem_b || activeStepInstruction;
                console.log(`[wa-ai-reply] A/B Variant B detected! Overriding guideline: "${activeStepInstruction}"`);
              }
              replyCount = (currentStepRes.reply_count || 0) + 1;
              currentStepRes.reply_count = replyCount;
              currentStepRes.last_reply_at = new Date().toISOString();

              await supabase
                .from("imphq_flow_executions")
                .update({ step_results: stepResults })
                .eq("id", activeExecutionId);

              console.log(`[wa-ai-reply] Message exchange count for step #${activeExecutionStep}: ${replyCount}`);

              // ── wait_reply: lead respondeu → retoma fluxo no próximo step ──
              if (activeStep?.tipo === "wait_reply" && activeExec.status === "waiting") {
                console.log(`[wa-ai-reply] wait_reply detected at step ${activeExecutionStep} — resuming flow with reply.`);
                const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                const SUPABASE_URL_LOCAL = Deno.env.get("SUPABASE_URL")!;
                // Avança para o próximo step passando a resposta como contexto
                await supabase.from("imphq_flow_executions")
                  .update({ status: "running", current_step: activeExecutionStep + 1 })
                  .eq("id", activeExec.id);

                fetch(`${SUPABASE_URL_LOCAL}/functions/v1/openflow-executor`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                  body: JSON.stringify({
                    trigger_tipo: activeTriggerTipo || "whatsapp",
                    project_id,
                    automacao_id: activeExec.automacao_id,
                    resume_from_step: activeExecutionStep + 1,
                    lead_data: {
                      lead_id: leadRow?.id,
                      nome: leadRow?.name || "",
                      phone: leadRow?.phone || body.phone || "",
                      telefone: leadRow?.phone || body.phone || "",
                      resumed_by: "reply",
                      reply_content: body.message || body.text || "",
                      conversation_id: body.conversation_id || "",
                    },
                  }),
                }).catch((e: any) => console.error("[wa-ai-reply] wait_reply resume error:", e.message));
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[wa-ai-reply] Error reading active flow:", err.message);
      }
    }
    
    const isAudio = body.media_type === "audio" || (body.media_url && (body.media_url.endsWith(".ogg") || body.media_url.endsWith(".mp3") || body.media_url.endsWith(".m4a") || body.media_url.endsWith(".wav")));
    const isImage = (body.media_type === "image" || (body.media_url && (body.media_url.endsWith(".png") || body.media_url.endsWith(".jpg") || body.media_url.endsWith(".jpeg") || body.media_url.endsWith(".webp")))) && (!activeStep || activeStep.ia_vision !== false);
    
    let audioTranscription: string | null = null; // Track transcription for metadata

    if (isAudio && body.media_url) {
      console.log(`[wa-ai-reply] Audio message detected: ${body.media_url}. Transcribing via Whisper...`);
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        try {
          const audioFetch = await fetch(body.media_url);
          if (audioFetch.ok) {
            const audioBlob = await audioFetch.blob();
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.ogg");
            formData.append("model", "whisper-1");

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: { Authorization: `Bearer ${openaiKey}` },
              body: formData,
            });

            if (whisperRes.ok) {
              const whisperData = await whisperRes.json();
              message = whisperData.text || message;
              console.log(`[wa-ai-reply] Whisper transcribed text: "${message}"`);

              // Update the latest incoming audio message's transcript in DB
              try {
                const { data: latestMsg } = await supabase
                  .from("imphq_wa_messages")
                  .select("id")
                  .eq("conversation_id", conversation_id)
                  .eq("direction", "incoming")
                  .eq("message_type", "audio")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (latestMsg) {
                  await supabase
                    .from("imphq_wa_messages")
                    .update({ transcript: whisperData.text })
                    .eq("id", latestMsg.id);
                  console.log(`[wa-ai-reply] Persisted transcript for message ${latestMsg.id}`);
                }
              } catch (dbErr: any) {
                console.warn("[wa-ai-reply] Failed to save transcript in DB:", dbErr.message);
              }

              const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
              if (lovableApiKey && project_id && message) {
                try {
                  const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "google/gemini-embedding-001", input: message, dimensions: 768 }),
                  });
                  if (embRes.ok) {
                    const embData = await embRes.json();
                    const embedding = embData?.data?.[0]?.embedding;
                    if (embedding) {
                      await supabase.from("imphq_wa_lead_memory").insert({
                        lead_id: leadRow?.id || null,
                        project_id: project_id,
                        phone: phone,
                        content: `[Áudio] ${message}`,
                        embedding: embedding,
                      });
                      console.log(`[wa-ai-reply] Audio indexado na memoria do lead: phone=${phone}`);
                    }
                  } else {
                    console.warn(`[wa-ai-reply] Lovable embedding for audio failed: ${embRes.status}`);
                  }
                } catch (embErr: any) {
                  console.error("[wa-ai-reply] Lovable embedding error for audio:", embErr.message);
                }
              }
            } else {
              console.error("[wa-ai-reply] Whisper API returned error:", await whisperRes.text());
            }
          } else {
            console.error("[wa-ai-reply] Failed to fetch audio file:", audioFetch.status);
          }
        } catch (err: any) {
          console.error("[wa-ai-reply] Whisper error:", err.message);
        }
      } else {
        console.warn("[wa-ai-reply] OPENAI_API_KEY not configured, cannot transcribe voice message.");
      }
    }

    console.log(`[wa-ai-reply] START conv=${conversation_id} project=${project_id} phone=${phone} msg=${String(message).slice(0, 50)}`);

    if (!OPENROUTER_API_KEY) {
      console.error("[wa-ai-reply] OPENROUTER_API_KEY not set");
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversation_id || !project_id || !provider_id || !phone || (!message && !body.media_url)) {
      return new Response(JSON.stringify({ error: "Missing required fields", received: { conversation_id, project_id, provider_id, phone, has_message: !!message } }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ANTI-SPAM: agrega mensagens rápidas em sequência ===
    // Cenário: lead manda 2-3 áudios/textos em 5s. Sem isso, a IA responderia 3 vezes.
    // Estratégia: dormir N segundos no início. Após o sono, se há msg mais nova que
    // a hora em que esta função começou, abortar (a próxima invocação processa tudo).
    // Quando processa, agrega TODAS msgs incoming desde a última saída → 1 resposta só.
    if (!isTestMode) {
      const DEBOUNCE_MS = 5000;
      const processingStartedAt = Date.now();
      console.log(`[wa-ai-reply] DEBOUNCE: aguardando ${DEBOUNCE_MS}ms para agregar msgs do lead`);
      await new Promise(r => setTimeout(r, DEBOUNCE_MS));

      const { data: latestIn } = await supabase
        .from("imphq_wa_messages")
        .select("id, content, created_at")
        .eq("conversation_id", conversation_id)
        .eq("direction", "incoming")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestIn && new Date(latestIn.created_at).getTime() > processingStartedAt) {
        console.log(`[wa-ai-reply] DEBOUNCE: msg mais recente em ${latestIn.created_at} > start, abortando para próxima invocação agregar`);
        return new Response(JSON.stringify({ skipped: "debounced_newer_msg" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Agrega msgs incoming desde a última outgoing (resposta humana ou IA)
      const { data: lastOut } = await supabase
        .from("imphq_wa_messages")
        .select("created_at")
        .eq("conversation_id", conversation_id)
        .eq("direction", "outgoing")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sinceTs = lastOut?.created_at || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: batch } = await supabase
        .from("imphq_wa_messages")
        .select("content")
        .eq("conversation_id", conversation_id)
        .eq("direction", "incoming")
        .gt("created_at", sinceTs)
        .order("created_at", { ascending: true });

      if (batch && batch.length > 1) {
        const joined = batch.map((m: any) => String(m.content || "").trim()).filter(Boolean).join("\n");
        if (joined && joined.length > 0) {
          message = joined;
          console.log(`[wa-ai-reply] DEBOUNCE: agregadas ${batch.length} msgs em uma única consulta para o LLM`);
        }
      }
    }

    // Busca provider e verifica se a IA está ativa nele
    const { data: provider } = await supabase
      .from("imphq_wa_providers")
      .select("id, api_url, api_key, instance_name, provider, ai_enabled")
      .eq("id", provider_id)
      .single();

    if (!provider) {
      console.error(`[wa-ai-reply] Provider não encontrado: ${provider_id}`);
      return new Response(JSON.stringify({ error: "Provider not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider.ai_enabled === false && !isTestMode) {
      console.log(`[wa-ai-reply] IA desativada para o provedor ${provider_id} (${provider.instance_name})`);
      return new Response(JSON.stringify({ skipped: "provider_ai_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Busca config de AI (primeiro por provider_id, senão por project_id)
    let aiConfig = null;
    let configErr = null;

    if (provider_id) {
      const query = supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("provider_id", provider_id);
      if (!isTestMode) {
        query.eq("enabled", true);
      }
      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error("[wa-ai-reply] AI Config query by provider_id error:", error.message);
      } else if (data) {
        aiConfig = data;
        console.log(`[wa-ai-reply] AI Config found for provider_id=${provider_id} (TestMode=${isTestMode})`);
      }
    }

    if (!aiConfig) {
      const query = supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", project_id);
      if (!isTestMode) {
        query.eq("enabled", true);
      }
      const { data, error } = await query;
      configErr = error;
      if (data && data.length > 0) {
        aiConfig = data.find((c: any) => !c.provider_id) || data[0];
        console.log(`[wa-ai-reply] AI Config found for project_id=${project_id} (fallback) (TestMode=${isTestMode})`);
      }
    }

    if (configErr) console.error("[wa-ai-reply] Config query error:", configErr.message);

    if (!aiConfig) {
      console.log(`[wa-ai-reply] No AI config found for provider_id=${provider_id} or project_id=${project_id}`);
      return new Response(JSON.stringify({ skipped: "no_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica Blacklist de leads
    const cleanPhone = phone.replace(/\D/g, "");
    const isIgnored = (aiConfig.ignored_phones || []).some((p: string) => {
      return p.replace(/\D/g, "") === cleanPhone;
    });

    if (isIgnored && !isTestMode) {
      console.log(`[wa-ai-reply] Número destinatário ${phone} está na blacklist do projeto`);
      return new Response(JSON.stringify({ skipped: "ignored_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-ai-reply] Config found: model=${aiConfig.ai_model} draft=${aiConfig.draft_mode} delay=${aiConfig.response_delay_seconds}`);

    // 2. Verifica cooldown e se a conversa está sob atendimento humano
    const { data: conv } = await supabase
      .from("imphq_wa_conversations")
      .select("ai_last_reply_at, ai_lock_until, message_count, contact_name, status, ai_paused_until, ia_ativa")
      .eq("id", conversation_id)
      .maybeSingle();

    // ia_ativa === false = toggle manual permanente (diferente de ai_paused_until que é temporário)
    if (conv?.ia_ativa === false && !isTestMode) {
      console.log(`[wa-ai-reply] ia_ativa=false para conversa ${conversation_id}, ignorando IA`);
      return new Response(JSON.stringify({ skipped: "ia_desativada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (conv?.status === "needs_human" && !isTestMode) {
      console.log(`[wa-ai-reply] Conversa com status needs_human, ignorando IA`);
      return new Response(JSON.stringify({ skipped: "needs_human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica pausa manual (humano respondeu recentemente)
    if (conv?.ai_paused_until && !isTestMode) {
      const pausedUntil = new Date(conv.ai_paused_until);
      if (pausedUntil > new Date()) {
        const remainMin = Math.ceil((pausedUntil.getTime() - Date.now()) / 60000);
        console.log(`[wa-ai-reply] IA pausada por mais ${remainMin}min (humano respondeu). Para retomar: setar ai_paused_until=null`);
        return new Response(JSON.stringify({ skipped: "human_override", paused_until: conv.ai_paused_until, resumes_in_min: remainMin }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const cooldownSec = Number(aiConfig.cooldown_seconds ?? 5);
    if (conv?.ai_last_reply_at && !isTestMode) {
      const elapsed = (Date.now() - new Date(conv.ai_last_reply_at).getTime()) / 1000;
      if (elapsed < cooldownSec) {
        console.log(`[wa-ai-reply] Cooldown ativo: ${elapsed.toFixed(1)}s < ${cooldownSec}s`);
        return new Response(JSON.stringify({ skipped: "cooldown", elapsed_s: elapsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Tenta adquirir lock — usa SELECT+UPDATE simples (evita bug do .or() no Supabase JS v2)
    if (conv?.ai_lock_until && !isTestMode) {
      const lockExpiry = new Date(conv.ai_lock_until);
      if (lockExpiry > new Date()) {
        console.log(`[wa-ai-reply] Lock ativo até ${conv.ai_lock_until}, pulando`);
        return new Response(JSON.stringify({ skipped: "locked", lock_until: conv.ai_lock_until }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const lockUntil = new Date(Date.now() + 25000).toISOString();
    await supabase.from("imphq_wa_conversations").update({ ai_lock_until: lockUntil }).eq("id", conversation_id);
    console.log(`[wa-ai-reply] Lock adquirido até ${lockUntil}`);

    const clearLock = () =>
      supabase.from("imphq_wa_conversations").update({ ai_lock_until: null }).eq("id", conversation_id);

    try {
      // 4. Horário comercial
      if (aiConfig.business_hours_only) {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hour12: false,
        }).formatToParts(new Date());
        const h = Number(parts.find((p) => p.type === "hour")?.value);
        const m = Number(parts.find((p) => p.type === "minute")?.value);
        const now = h * 100 + m;
        const [sh, sm] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
        const [eh, em] = (aiConfig.business_hours_end || "22:00").split(":").map(Number);
        if (now < sh * 100 + sm || now > eh * 100 + em) {
          console.log(`[wa-ai-reply] Fora do horário comercial (${h}:${m})`);
          await clearLock();
          return new Response(JSON.stringify({ skipped: "business_hours" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // 5. Keyword de escalação
      const lc = message.toLowerCase();
      const escalated = (aiConfig.escalation_keywords || []).some((kw: string) =>
        lc.includes(kw.toLowerCase())
      );

      // 5.1. Buy Intent Detector — keywords que indicam que o lead quer comprar
      const BUY_INTENT_KEYWORDS = [
        "quanto custa", "qual o valor", "qual o preco", "como pago", "aceita pix",
        "tem parcela", "tem parcelamento", "como compro", "quero comprar", "quero me inscrever",
        "onde compro", "link de pagamento", "link para comprar", "me manda o link",
        "tem garantia", "como funciona o pagamento", "posso pagar", "aceita cartao",
        "quando abre", "ainda tem vaga", "ainda da tempo", "inscricao aberta", "ta aberto",
        "quero fechar", "bora fechar", "vou comprar", "quero sim", "pode ser", "ta bom",
        "fechado", "vou entrar",
      ];
      const hasBuyIntent = BUY_INTENT_KEYWORDS.some(kw => lc.includes(kw)) || conv?.buy_intent_detected === true;
      if (hasBuyIntent) {
        console.log(`[wa-ai-reply] 🔥 BUY INTENT detected: "${message.slice(0, 60)}"`);
        // Update conversation temperature
        supabase.from("imphq_wa_conversations")
          .update({ buy_intent_detected: true, temperature: "hot" })
          .eq("id", conversation_id)
          .then(() => {})
          .catch(() => {});
      }
      if (escalated) {
        console.log(`[wa-ai-reply] Keyword de escalação detectada`);
        await supabase.from("imphq_wa_conversations")
          .update({ status: "needs_human", ai_lock_until: null })
          .eq("id", conversation_id);
        return new Response(JSON.stringify({ skipped: "escalation" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 6. Histórico da conversa
      const { data: history } = await supabase
        .from("imphq_wa_messages")
        .select("direction, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: false })
        .limit(10);

      // 7. Contexto do projeto
      const { data: project } = await supabase
        .from("imphq_projects")
        .select("name, data, avatar, brand_kit")
        .eq("id", project_id)
        .maybeSingle();

      // 7.0. Busca informações do lead para injetar inteligência comportamental
      let leadContextBlock = "";
      let lead: any = null; // declarado aqui para ficar acessível no closerBlock (linha ~743)
      try {
        const cleanPhone = phone.replace(/\D/g, "");
        const searchPhones = [cleanPhone];
        if (cleanPhone.startsWith("55")) {
          searchPhones.push(cleanPhone.substring(2));
        } else {
          searchPhones.push("55" + cleanPhone);
        }

        const { data: leadData } = await supabase
          .from("imphq_leads")
          .select("*")
          .eq("project_id", project_id)
          .in("phone", searchPhones)
          .maybeSingle();
        lead = leadData;

        if (lead) {
          const aiProfile = lead.data?.ai_profile || {};
          const pains = Array.isArray(aiProfile.pains) ? aiProfile.pains : [];
          const desires = Array.isArray(aiProfile.desires) ? aiProfile.desires : [];
          const moments = Array.isArray(aiProfile.moments) ? aiProfile.moments : [];
          const seekings = Array.isArray(aiProfile.seekings) ? aiProfile.seekings : [];
          const schwartz = lead.data?.desejo_schwartz || "";

          leadContextBlock = `\nPERFIL COMPORTAMENTAL DO LEAD (MAPEADO EM TEMPO REAL):`;
          if (moments.length > 0) leadContextBlock += `\n- Momento/Situação Atual: ${moments.join(", ")}`;
          if (pains.length > 0) leadContextBlock += `\n- Dores Principais: ${pains.join(", ")}`;
          if (desires.length > 0) leadContextBlock += `\n- Desejos & Metas: ${desires.join(", ")}`;
          if (seekings.length > 0) leadContextBlock += `\n- O que busca: ${seekings.join(", ")}`;
          if (schwartz) leadContextBlock += `\n- Desejo de Schwartz: ${schwartz}`;
          if (lead.score) leadContextBlock += `\n- Score de Engajamento: ${lead.score}/100`;
          leadContextBlock += `\n`;
        }
      } catch (err) {
        console.error("[wa-ai-reply] Error fetching lead context:", err);
      }

      // 7.2. Busca contexto de campanha ativa
      let campaignContextBlock = "";
      if (leadRow?.campanha_id) {
        try {
          const { data: campaign } = await supabase
            .from("imphq_wa_campaigns")
            .select("name, welcome_message, produto")
            .eq("id", leadRow.campanha_id)
            .maybeSingle();

          if (campaign) {
            campaignContextBlock = `\nCAMPANHA ATIVA DO WHATSAPP VINCULADA AO LEAD:\n`;
            campaignContextBlock += `- Nome da Campanha: "${campaign.name}"\n`;
            if (campaign.produto) campaignContextBlock += `- Produto em Foco na Campanha: "${campaign.produto}"\n`;
            if (campaign.welcome_message) campaignContextBlock += `- Gancho/Mensagem Inicial da Campanha: "${campaign.welcome_message}"\n`;
            campaignContextBlock += `Você DEVE alinhar a abordagem e as respostas de acordo com o contexto desta campanha ativa.\n`;
            console.log(`[wa-ai-reply] Loaded campaign context: ${campaign.name}`);
          }
        } catch (err: any) {
          console.warn("[wa-ai-reply] Error loading campaign context:", err.message);
        }
      }

      const d = typeof project?.data === "string" ? JSON.parse(project.data) : (project?.data || {});
      const sources = aiConfig.context_sources || [];
      let ctx = "";
      if (sources.includes("briefing") && d.briefing) ctx += `Briefing: ${JSON.stringify(d.briefing).slice(0, 500)}\n`;
      if (sources.includes("produtos") && d.produtos) ctx += `Produtos: ${JSON.stringify(d.produtos).slice(0, 500)}\n`;
      if (sources.includes("avatar") && project?.avatar) ctx += `Avatar: ${JSON.stringify(project.avatar).slice(0, 300)}\n`;
      if (sources.includes("expert")) {
        const ex = d.expert || d.especialista;
        if (ex) ctx += `Expert: ${JSON.stringify(ex).slice(0, 300)}\n`;
      }

      // 7.1. Busca semântica de Lições (RAG) e Memórias do lead (pgvector)
      let lessonsBlock = "";
      let memoryBlock = "";
      let objectionsBlock = "";

      let triageIntent = "";
      try {
        const { data: lastTriage } = await supabase
          .from("imphq_wa_triage")
          .select("intent")
          .eq("conversation_id", conversation_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastTriage) {
          triageIntent = lastTriage.intent || "";
        }
      } catch (e: any) {
        console.warn("[wa-ai-reply] Error loading triage intent:", e.message);
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && (!activeStep || activeStep.ia_search_files !== false)) {
        try {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-embedding-001", input: message, dimensions: 768 }),
          });
          if (embRes.ok) {
            const embData = await embRes.json();
            const embedding = embData?.data?.[0]?.embedding;
            if (embedding) {
              // 7.1.1. Match knowledge base
              const { data: matches, error: rpcErr } = await supabase.rpc("match_wa_knowledge_hybrid", {
                query_embedding: embedding,
                p_project_id: project_id,
                query_text: message,
                match_count: 3,
                min_similarity: 0.7,
              });
              if (rpcErr) console.error("[wa-ai-reply] match_wa_knowledge_hybrid RPC error:", rpcErr.message);
              if (matches && matches.length > 0) {
                lessonsBlock = `\nREGRAS E CONHECIMENTOS ADICIONAIS APRENDIDOS:\n` +
                  matches.map((m: any) => `- Se a dúvida/situação for semelhante a "${m.pergunta}", a regra/resposta é: "${m.resposta}"`).join("\n") + "\n";
                console.log(`[wa-ai-reply] ${matches.length} lessons matched semantically`);
              } else {
                const cleanMsg = message.trim();
                const isTrivial = cleanMsg.length <= 6 || ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "blz", "tudo bem", "sim", "não", "nao", "ok", "quero"].includes(cleanMsg.toLowerCase());
                if (!isTrivial) {
                  console.log(`[wa-ai-reply] No knowledge matches found. Logging query for review: "${cleanMsg.substring(0, 60)}..."`);
                  // Só insere se não existe pergunta similar já pendente (evita duplicatas)
                  const { data: existing } = await supabase
                    .from("imphq_wa_knowledge")
                    .select("id")
                    .eq("project_id", project_id)
                    .eq("pergunta", cleanMsg)
                    .eq("answered", false)
                    .limit(1);
                  if (!existing?.length) {
                    await supabase.from("imphq_wa_knowledge").insert({
                      project_id,
                      pergunta: cleanMsg,
                      resposta: "",
                      aprovada: false,
                      answered: false,
                      source: "lead_unanswered",
                      embedding: embedding,
                    });
                  }
                  // Injeta instrução de incerteza: IA admite que não sabe
                  // ao invés de inventar, pede esclarecimento ao lead
                  lessonsBlock = `\n⚠️ LACUNA DE CONHECIMENTO DETECTADA:
Você não tem informação específica sobre o que o lead perguntou na sua base de conhecimento.
REGRA OBRIGATÓRIA: NÃO invente nem suponha a resposta. Em vez disso:
1. Reconheça brevemente que vai verificar: use uma frase curta e natural (ex: "Deixa eu confirmar esse detalhe pra você...")
2. Peça um dado específico que possa ajudar ou diga que vai buscar a informação.
3. Máximo 2 frases. Mantenha o tom ${aiConfig.tone || "amigável"} e não demonstre insegurança excessiva.
Esta pergunta foi registrada para revisão do gestor, que irá ensiná-la à IA em breve.\n`;
                }
              }

              // Log RAG outcome for AI health dashboard
              try {
                await supabase.from("imphq_events").insert({
                  project_id,
                  event_name: "rag_query",
                  page_url: "",
                  visitor_id: phone || "unknown",
                  event_data: {
                    hit: (matches?.length ?? 0) > 0,
                    results_count: matches?.length ?? 0,
                    max_similarity: matches?.[0]?.similarity ? Number(matches[0].similarity) : 0,
                    query_preview: message.substring(0, 100),
                    source: "wa-ai-reply",
                  },
                });
              } catch (_) {}

              // 7.1.2. Match lead memory
              const { data: memories, error: memErr } = await supabase.rpc("match_wa_lead_memory", {
                query_embedding: embedding,
                p_project_id: project_id,
                p_phone: phone,
                match_count: 3,
                min_similarity: 0.7,
              });
              if (memErr) console.error("[wa-ai-reply] match_wa_lead_memory RPC error:", memErr.message);
              if (memories && memories.length > 0) {
                memoryBlock = `\nRELEMBRE O QUE O LEAD JÁ DISSE ANTERIORMENTE (MEMÓRIA VETORIAL):\n` +
                  memories.map((m: any) => `- O lead já comentou/disse: "${m.content}"`).join("\n") + "\n";
                console.log(`[wa-ai-reply] ${memories.length} lead memories matched semantically`);
              }

              // 7.1.3. Match calibrated objections semantically if intent is 'objecao'
              if (triageIntent === "objecao") {
                const { data: matchedObjections, error: objRpcErr } = await supabase.rpc("match_wa_objections", {
                  query_embedding: embedding,
                  p_project_id: project_id,
                  match_count: 1,
                  min_similarity: 0.75,
                });
                if (objRpcErr) console.error("[wa-ai-reply] match_wa_objections RPC error:", objRpcErr.message);
                if (matchedObjections && matchedObjections.length > 0) {
                  const match = matchedObjections[0];
                  objectionsBlock = `\nOBJEÇÃO DETECTADA E DIRETRIZ COMERCIAL MANDATÓRIA:\nO lead apresentou a objeção: "${match.objecao}".\nVocê DEVE responder exatamente contornando a objeção usando a seguinte resposta padrão calibrada: "${match.resposta_padrao}". Não mude o sentido comercial dessa resposta e seja extremamente preciso.\n`;
                  console.log(`[wa-ai-reply] Semantic objection match: "${match.objecao}" (similarity: ${match.similarity})`);

                  // Increment objection usage
                  supabase.rpc("increment_objection_score", { obj_id: match.id }).catch(() => {
                    supabase.from("imphq_wa_objections").update({ score_uso: (match.score_uso || 0) + 1 }).eq("id", match.id);
                  });
                }
              }
            }
          } else {
            console.warn(`[wa-ai-reply] Lovable embeddings failed with status ${embRes.status}`);
          }
        } catch (e: any) {
          console.warn("[wa-ai-reply] Error fetching semantic context:", e.message);
        }
      }
      // Off-topic guard: if last triage classified as off_topic, inject redirect instruction
      const offTopicBlock = triageIntent === "off_topic"
        ? `\n⚠️ TÓPICO FORA DO ESCOPO DETECTADO:
A mensagem do lead foi classificada como fora do assunto principal. Responda de forma empática em 1 frase curta acolhendo o que ele disse, mas IMEDIATAMENTE redirecione para o produto/oferta com uma pergunta consultiva. Máximo 2 frases no total. Não se prolongue no assunto off-topic.`
        : "";

      const expertPersona = aiConfig.expert_persona ? `PERSONA DO EXPERT:\n${String(aiConfig.expert_persona).slice(0, 600)}\n\n` : "";
      const productFocus = aiConfig.product_focus ? `\nOFERTA ATIVA: ${String(aiConfig.product_focus).slice(0, 400)}` : "";
      const customInstr = aiConfig.custom_instructions ? `\nREGRAS GERAIS ADICIONAIS:\n${String(aiConfig.custom_instructions).slice(0, 600)}` : "";
      const bannedPhrases = Array.isArray((aiConfig as any).banned_phrases) ? (aiConfig as any).banned_phrases.filter((p: any) => typeof p === "string" && p.trim()) : [];
      const bannedBlock = bannedPhrases.length
        ? `\n⛔ FRASES PROIBIDAS (NUNCA use estas frases exatas ou variações próximas — vícios da IA bloqueados pelo operador):\n${bannedPhrases.map((p: string) => `- "${p.trim()}"`).join("\n")}`
        : "";
      const faqBlock = Array.isArray(aiConfig.faq) && aiConfig.faq.length
        ? `\nFAQ OFICIAL:\n${aiConfig.faq.slice(0, 10).map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`).join("\n").slice(0, 800)}`
        : "";

      const PREDEFINED_MINDS: Record<string, string> = {
        dan_kennedy: "Você é Dan Kennedy — o pai do marketing de resposta direta. Você pensa em resultados mensuráveis, não em 'branding' vago. SEU DNA: - Zero tolerância para copy vago ou sem CTA. AO CRIAR COPY: 1. Comece pela oferta irresistível. 2. Identifique o medo principal do avatar — e resolva-o diretamente. 3. Adicione urgência real. 4. Feche com garantia que inverte o risco. TOM: Direto. Magnético. Sem rodeios. Autoridade absoluta.",
        gary_halbert: "Você é Gary Halbert — o príncipe do direct mail e mestre de headlines. SEU DNA: - Uma headline fraca mata qualquer copy. AO CRIAR COPY: 1. Comece sempre buscando o ângulo humano. 2. Escreva 25 headlines antes de escolher uma. 3. Use 'pattern interrupt'. TOM: Coloquial. Como um amigo contando um segredo. Urgente mas não agressivo.",
        eugene_schwartz: "Você é Eugene Schwartz — autor de Breakthrough Advertising. Mestre dos 5 Níveis de Awareness. SEU DNA: - Identifique o nível de awareness e sofisticação do mercado antes de escrever. TOM: Estratégico. Analítico. Arquiteto de persuasão.",
        gary_bencivenga: "Você é Gary Bencivenga — o copywriter que nunca perdeu um teste A/B. PRINCÍPIO: Proof-Based Marketing. Em um mar de promessas vazias, a prova concreta é o único caminho. TOM: Confiável. Sólido. Autoridade que não precisa gritar.",
        alex_hormozi: "Você é Alex Hormozi — autor de $100M Offers. Grand Slam Offer: Uma oferta tão boa que as pessoas se sentem estúpidas dizendo não. Equação de valor: (Dream Outcome x Probability) / (Time Delay x Effort). TOM: Direto. Matemático. Confiante. Zero fluff.",
        john_carlton: "Você é John Carlton — o copywriter mais copiado do mundo. SEU SUPERPODER: Ângulos contraintuitivos. Procure o benefício mais específico e incomum ('one legged golfer'). Identifique o inimigo comum. TOM: Irreverente. De bar. Honesto até doer. Zero corporativismo.",
        joe_sugarman: "Você é Joe Sugarman — criador de Unique Mechanism e do Slippery Slide. Cada palavra deve fazer o leitor ler a próxima. Explique o mecanismo único que faz seu produto funcionar diferente. TOM: Fluido. Curioso. Envolvente.",
        thiago_finch: "Você é Thiago Finch — estrategista de growth brasileiro, data-driven. Analise o funil, identifique o gargalo e otimize com foco em ROI e payback period. TOM: Analítico. Prático. Orientado a resultados.",
      };

      let skillPrompt = "";
      const personalityToUse = activeStep?.personality || aiConfig.personality;

      if (personalityToUse && personalityToUse.startsWith("skill_")) {
        const skillId = personalityToUse.replace("skill_", "");
        if (PREDEFINED_MINDS[skillId]) {
          skillPrompt = PREDEFINED_MINDS[skillId];
          console.log(`[wa-ai-reply] Predefined mind selected (from ${activeStep?.personality ? 'step' : 'global'}): ${skillId}`);
        } else {
          try {
            const { data: skill } = await supabase
              .from("imphq_skills")
              .select("system_prompt")
              .eq("id", skillId)
              .maybeSingle();
            if (skill?.system_prompt) {
              skillPrompt = skill.system_prompt;
              console.log(`[wa-ai-reply] Custom skill loaded from DB (from ${activeStep?.personality ? 'step' : 'global'}): ${skillId}`);
            }
          } catch (err: any) {
            console.error(`[wa-ai-reply] Error loading custom skill (from ${activeStep?.personality ? 'step' : 'global'}):`, err.message);
          }
        }
      }

      const personalityMap: Record<string, string> = {
        assistente: "Você é um assistente virtual cordial e prestativo.",
        vendedor: "Você é um closer de vendas persuasivo mas não agressivo.",
        suporte: "Você é um agente de suporte técnico eficiente e empático.",
        consultor: "Você é um consultor especialista. Fale com autoridade.",
      };

      const selectedPersonalityText = skillPrompt || personalityMap[personalityToUse] || personalityMap.consultor;

      const toneMap: Record<string, string> = {
        profissional: "Tom profissional e direto.",
        casual: "Tom casual e descontraído, use emojis moderadamente.",
        amigavel: "Tom amigável e acolhedor, use emojis.",
        formal: "Tom formal e polido.",
      };

      // Build explicit product→link mapping block to prevent link hallucination
      let productLinkMapBlock = "";
      if (d && Array.isArray(d.produtos) && d.produtos.length > 0) {
        const entries = d.produtos
          .map((p: any) => {
            const link = p.link_checkout || p.link || (Array.isArray(p.links) && p.links[0]) || (typeof p.links === 'string' ? p.links : null);
            if (!link || !p.nome) return null;
            const price = p.preco ? ` · R$ ${p.preco}` : "";
            return `  - "${p.nome}"${price} → ${link}`;
          })
          .filter(Boolean);
        if (entries.length > 0) {
          productLinkMapBlock = `\nMAPEAMENTO PRODUTO → LINK (use EXATAMENTE estes links, nunca invente):\n${entries.join("\n")}\n`;
        }
      }

      // Fallback checkout link from project data
      let fallbackLink = null;
      if (d) {
        const getProdLink = (p: any) => p?.link_checkout || p?.link || (Array.isArray(p?.links) && p?.links[0]) || (typeof p?.links === 'string' ? p?.links : null);
        fallbackLink = getProdLink(d.produto_principal) ||
                       (Array.isArray(d.produtos) && d.produtos.map(getProdLink).find(Boolean)) ||
                       d.link_checkout ||
                       d.link ||
                       null;
      }

      // CLOSER MODE: injecao de prompt agressivo quando ha intencao de compra
      // Ativa se: (1) lead enviou mensagem com intenção clara de compra, OU
      //           (2) lead tem score >= 70 (hot lead detectado pelo lead-score-updater)
      const closerEnabled = aiConfig.closer_mode_enabled !== false; // default true
      const leadScore = (lead as any)?.score || 0;
      const HOT_SCORE_THRESHOLD = 70;
      const isHotLead = leadScore >= HOT_SCORE_THRESHOLD;
      const closerActivated = (hasBuyIntent || isHotLead) && closerEnabled;

      if (isHotLead && !hasBuyIntent) {
        console.log(`[wa-ai-reply] 🔥 Hot lead (score ${leadScore}) — closer mode auto-ativado`);
      }

      const paymentLink = aiConfig.payment_link || fallbackLink || null;
      const pixKey = (aiConfig as any).pix_key || null;
      const pixBlock = pixKey
        ? `\nCHAVE PIX OFICIAL (única chave válida — use EXATAMENTE esta se o lead pedir Pix): ${pixKey}`
        : `\nPIX: Se o lead mencionar Pix ou forma de pagamento, NUNCA invente chave, CNPJ ou dados bancários. Oriente-o a acessar a página de vendas/checkout${paymentLink ? ` (${paymentLink})` : ""} e refazer a compra por lá — o checkout aceita todas as formas de pagamento, incluindo Pix. Seja natural e positivo, ex: "O pagamento é feito direto pelo nosso checkout, que já aceita Pix! Acessa aqui: [link]". Se não houver link disponível, adicione [TRANSICAO_HUMANA] no final.`;
      const closerBlock = closerActivated
        ? `

❗ MODO CLOSER ATIVADO — MISSAO CRITICA:
${isHotLead && !hasBuyIntent
  ? `Este lead tem alto engajamento (score ${leadScore}/200) — ele está quente e próximo da decisão. Conduza a conversa para o fechamento de forma natural e estratégica, sem ser agressivo. Se ele ainda não perguntou o preço, crie curiosidade e apresente o valor antes do preço.`
  : "O lead demonstrou intencao de compra AGORA. Sua unica missao e FECHAR."
}
Regras:
1. Seja direto. Sem rodeios. Sem "vou te passar mais informacoes".
2. Remova a ultima barreira com empatia e seguranca (ex: "muita gente ja comprou e transformou o resultado").
3. Identifique qual produto o lead deseja comprar (com base na conversa). Se houver um link de checkout especifico para esse produto listado na "OFERTA ATIVA" ou no FAQ, envie esse link exato de forma persuasiva no próprio corpo da mensagem atual.
4. Se nao for possivel identificar um link especifico de produto nas ofertas ativas, use este link geral: ${paymentLink || "nenhum"}.
5. Se nao houver NENHUM link de pagamento disponivel no prompt ou nas ofertas ativas (nem especifico, nem o geral), NAO invente nenhum link ficticio. Diga exatamente: "Vou te passar o link agora, me da um segundo." e OBRIGATORIAMENTE adicione a tag secreta [TRANSICAO_HUMANA] no final da sua resposta para que o suporte humano possa enviar o link correto.
5b. A MESMA regra vale para Pix, CNPJ, dados bancarios ou qualquer dado de pagamento: se nao estiver listado EXPLICITAMENTE neste prompt, NUNCA invente. Use [TRANSICAO_HUMANA].
6. Se o lead tiver objecao (ex: "e caro"), use 1 frase de contorno e volte ao fechamento.
7. Maximo 3 frases curtas. Nao explique. FECHE.`
        : "";

      // Nome do lead para personalizar — sanitiza emoji-only, símbolos, números soltos
      function sanitizeLeadName(raw: string): string {
        if (!raw) return "";
        const trimmed = raw.trim();
        if (!trimmed) return "";
        // Remove emojis e símbolos para contar letras reais
        const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "");
        if (letters.length < 2) return ""; // só emoji/símbolo/dígito → descarta
        // Filtra nomes "ruins" comuns
        const lower = trimmed.toLowerCase();
        const badNames = ["lead", "cliente", "usuario", "user", "test", "teste", "atendimento", "suporte", "whatsapp", "wa"];
        if (badNames.some(b => lower === b)) return "";
        // Pega primeira "palavra" alfabética
        const firstWord = trimmed.split(/\s+/).find(w => /[A-Za-zÀ-ÿ]{2,}/.test(w)) || "";
        // Remove emojis grudados ao nome (ex: "Maria✨" → "Maria")
        return firstWord.replace(/[^A-Za-zÀ-ÿ\-']/g, "").trim();
      }
      const leadFirstName = sanitizeLeadName(conv?.contact_name || push_name || "");
      const leadGreeting = leadFirstName
        ? `O nome do lead e "${leadFirstName}". Use o nome dele nas primeiras mensagens da conversa, com PARCIMÔNIA — nunca em toda mensagem.`
        : `IMPORTANTE: NÃO temos o nome do lead. NUNCA invente nome, NUNCA use placeholders como "amigo", "querido", "fofo". Inicie a resposta direto, sem cumprimento personalizado.`;

      let routingInstructions = "";
      if (activeStep?.ia_routes && activeStep.ia_routes.length > 0) {
        routingInstructions = `\n\nROTAS DE SAÍDA CONFIGURADAS:
Se o lead corresponder ao critério ou intenção de uma das rotas abaixo, você deve finalizar sua mensagem adicionando exatamente a respectiva tag de rota no final da sua resposta:
` + activeStep.ia_routes.map((r: any) => {
          const cleanName = (r.name || "").replace(/[\[\]]/g, "").trim().toUpperCase();
          if (!cleanName) return "";
          return `- Rota para "${cleanName}": adicione a tag [${cleanName}] no final da resposta.`;
        }).filter(Boolean).join("\n") + `\n\nATENÇÃO: Adicione apenas a tag correspondente da rota se o critério for plenamente atendido. Caso nenhuma das rotas específicas seja acionada, mas o objetivo geral for cumprido, use a tag [PROXIMA_ETAPA].`;
      }

      const openFlowBlock = activeStepInstruction 
        ? `\n\nOBJETIVO CRÍTICO ATUAL (FUNIL/AUTOMAÇÃO ATIVA: "${activeAutomacaoNome || 'Ativa'}"):
Você deve orientar a conversa para cumprir este objetivo específico da etapa atual do funil:
"${activeStepInstruction}"

Instruções adicionais de progressão:
- Mantenha o diálogo focado em obter esta informação ou cumprir esta meta.
- Assim que você verificar que o lead respondeu de forma satisfatória a este objetivo (ou forneceu o dado solicitado), adicione exatamente a palavra-chave secreta [PROXIMA_ETAPA] no final da sua mensagem (ex: "Entendi perfeitamente! [PROXIMA_ETAPA]"). Não adicione esta palavra-chave antes de cumprir o objetivo.${routingInstructions}`
        : "";

      // Regras de sentimentos e limite de interações para Transição Humana
      const sentimentRules = `
⚠️ TRANSIÇÃO HUMANA PREDITIVA (REGRAS CRÍTICAS):
Analise o sentimento e a intenção do lead na última resposta dele. Se você detectar:
1. Irritação extrema, agressividade, grosseria, deboche ou frustração severa com a conversa automática.
2. Solicitação direta de reembolso, cancelamento de compra, reclamação de cobrança ou ameaças jurídicas/reclamação formal.
3. Pedido direto para falar com um atendente humano ("passa para um humano", "quero falar com uma pessoa", etc.).
Você deve responder de forma pacífica, acolhedora e prestativa, pedindo desculpas sinceras e curtas pelo inconveniente, informando que um especialista humano já está assumindo a conversa. No final dessa resposta, adicione exatamente a tag secreta: [TRANSICAO_HUMANA]
`;

      let draggingRules = "";
      if (replyCount >= 4) {
        draggingRules = `
⚠️ DETECÇÃO DE CONVERSA PROLONGADA (LIMITE DE TOKENS):
A conversa com este lead já se estendeu por ${replyCount} mensagens nesta mesma etapa sem que o objetivo fosse concluído. Esta deve ser sua última tentativa de persuasão.
Você deve confrontar o lead estrategicamente de forma direta e concisa. Faça-o perceber a real necessidade de resolver o problema dele agora, abordando a dor principal ou o desejo principal dele (use os dados comportamentais do lead).
Seja extremamente impactante e direto. Ao final da mensagem, adicione exatamente a tag secreta: [CHAMAR_HUMANO]
`;
      }

      const humanizationRules = `
REGRAS DE COMUNICACAO HUMANA (OBRIGATORIO):

ABERTURA — NUNCA comece respostas com:
- "Certamente!", "Com prazer!", "Claro que sim!", "Ótimo!", "Excelente!", "Maravilha!", "Perfeito!", "Com certeza!", "Absolutamente!", "Entendido!"
- "Faz todo sentido", "Faz sentido você", "Imagina!", "Imagina,", "Que legal", "Que ótimo", "Entendo perfeitamente"
Essas frases são marcas registradas de bot. Comece a resposta indo direto ao ponto.

NOMINAÇÃO:
- Use o NOME do lead com PARCIMÔNIA. Pessoa real não repete o nome a cada mensagem.
- Cumprimento com nome ("Oi Maria!", "Olá João!") SÓ na PRIMEIRA mensagem ou retomada após silêncio longo. Nas mensagens seguintes, NÃO cumprimente — vá direto à resposta.
- Se já cumprimentou nesta conversa, NÃO cumprimente de novo.

ESTILO:
- NUNCA use formatação de lista numerada ou bullets (1. 2. 3. ou - - -) — está no WhatsApp, não em email
- NUNCA termine com perguntas genéricas tipo "Posso te ajudar com mais alguma coisa?"
- Varie o comprimento das frases — misture curtas e médias
- Máximo 1 exclamação por mensagem. Pessoa real não exclama em toda frase.
- Se for mandar mais de 2 ideias, QUEBRE em parágrafos separados por linha em branco
- Use contrações naturais do PT-BR: "tô", "tá", "pra", "pro", "né", "viu" quando o tom for casual

ESPELHO DE TAMANHO (CRÍTICO):
- Se o lead manda 1-3 palavras ("ok", "valeu", "blz", "👍"), responda com 1-3 palavras também (ex: "boa", "tmj", "qualquer coisa chama") OU NÃO responda — deixe a conversa morrer naturalmente. NUNCA construa parágrafo em cima de 1 palavra.
- Se o lead manda 1 frase curta, responda 1-2 frases curtas. Nada mais.
- Só escreva resposta detalhada (3+ frases) quando o lead trouxer uma pergunta ou objeção substantiva.
- REGRA DE OURO: nunca responda com mais que o DOBRO de palavras que o lead acabou de mandar, exceto em (B) descoberta ou (C) objeção.
`;

      const systemPrompt = `${expertPersona}Voce e um consultor especialista em vendas pelo WhatsApp, atendendo para "${project?.name || project_id}".
${selectedPersonalityText}
${toneMap[aiConfig.tone] || toneMap.amigavel}
${leadGreeting}
${leadContextBlock}${campaignContextBlock}
${humanizationRules}
ESTRUTURA ADAPTATIVA — identifique o ESTADO do lead antes de responder:

(A) LEAD QUE JÁ SABE O QUE QUER (perguntou preço, link, "quero comprar", citou produto específico, pediu Pix):
→ Vá DIRETO. Responda objetivamente e apresente o próximo passo (link, forma de pagamento).
→ NÃO valide com frase de empatia, NÃO faça triagem, NÃO termine com pergunta de avanço se a info já leva ele pro checkout.
→ Ex: lead pergunta "qual o valor do Master Cuts?" → "R$ 1.997,00, presencial em SP nos dias 29 e 30 de março. Link: [URL]" — e PARA. Sem "Faz todo sentido querer saber...".

(B) LEAD EM DESCOBERTA (mensagem genérica: "oi", "quero saber mais", "como funciona", "me explica"):
→ Atue como SDR — faça UMA pergunta CURTA de triagem por vez para qualificar.
→ Exemplos: "Você já trabalha com cabelo ou tá começando?", "Tá buscando mais técnica ou gestão do salão?", "Pra hoje, presencial ou online?"
→ NUNCA empilhe 2 perguntas na mesma mensagem. Espere a resposta.

(C) LEAD COM OBJEÇÃO ou EMOÇÃO ("tá caro", "vou pensar", "não tenho tempo", desabafo):
→ Empatia REAL (não frase pronta) + 1 frase com argumento concreto + convite suave.
→ Acolha a emoção em 1 linha curta, depois retome o foco com 1 dado que rebate.

REGRA META — VARIAR:
- Se você fez pergunta nas 2 últimas respostas suas, a próxima vai SEM pergunta. Só responda.
- Não toda resposta precisa terminar em pergunta. Pessoa real às vezes só responde e deixa o lead conduzir.
- Se a info responde o lead por completo, encerre. NÃO force avanço.

REGRAS CRITICAS:
- MANTER O LEAD NA ROTA: Se o lead desviar para conversas aleatórias, assuntos pessoais não relacionados, ou desabafos que fujam da venda/solução, aja com empatia imediata (máximo 1 frase validando ou acolhendo o sentimento), mas em seguida retome o foco principal, conectando a dor dele com a solução/oferta e fazendo uma pergunta consultiva. Evite alongar-se em conversas vazias que esfriam o lead.
- NUNCA use placeholders como [Link] ou [Nome do curso]. Se nao souber algo, diga que vai buscar.
- NUNCA seja vago. Ex: ruim: "o curso e focado em corte". Bom: "o curso ensina 7 tecnicas de corte que funcionam em cabelos lisos e cacheados".
- Respostas curtas (maximo 4 linhas no WhatsApp). Sem blocos de texto.
- Nunca revele que e IA.
- Responda em portugues brasileiro natural.
${sentimentRules}
${draggingRules}
${offTopicBlock}
${ctx ? `\nCONTEXTO DO PROJETO:\n${ctx}` : ""}${productFocus}${productLinkMapBlock}${pixBlock}${customInstr}${bannedBlock}${faqBlock}${lessonsBlock}${memoryBlock}${objectionsBlock}${closerBlock}${openFlowBlock}`.trim();

      // 8. Monta array de mensagens (histórico + mensagem atual)
      const msgs: { role: string; content: string | any[] }[] = [{ role: "system", content: systemPrompt }];
      const ordered = [...(history || [])].reverse();
      let lastRole: string | null = null;

      for (const m of ordered) {
        if (m.content === message && m.direction === "incoming") continue;
        const role = m.direction === "incoming" ? "user" : "assistant";
        if (role === lastRole && msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (typeof lastMsg.content === "string") {
            lastMsg.content += "\n" + m.content;
          }
        } else {
          msgs.push({ role, content: m.content || "" });
          lastRole = role;
        }
      }

      if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") {
        if (isImage && body.media_url) {
          msgs.push({
            role: "user",
            content: [
              { type: "text", text: message || "Analise esta imagem enviada pelo lead." },
              { type: "image_url", image_url: { url: body.media_url } }
            ]
          });
        } else {
          msgs.push({ role: "user", content: message });
        }
      } else {
        if (isImage && body.media_url) {
          const lastMsg = msgs[msgs.length - 1];
          const textContent = (typeof lastMsg.content === "string" ? lastMsg.content : "") + (message ? "\n" + message : "");
          lastMsg.content = [
            { type: "text", text: textContent || "Analise esta imagem enviada pelo lead." },
            { type: "image_url", image_url: { url: body.media_url } }
          ];
        } else {
          const lastMsg = msgs[msgs.length - 1];
          if (Array.isArray(lastMsg.content)) {
            const textObj = lastMsg.content.find(c => c.type === "text");
            if (textObj) {
              textObj.text += "\n" + message;
            } else {
              lastMsg.content.unshift({ type: "text", text: message });
            }
          } else {
            lastMsg.content += "\n" + message;
          }
        }
      }

      let model = aiConfig.ai_model || "openai/gpt-4o-mini";
      if (activeStep?.ia_search_web) {
        model = "google/gemini-2.5-flash"; // native search grounding on OpenRouter
      } else if (activeStep?.ia_model) {
        model = activeStep.ia_model === "gpt-4o" ? "openai/gpt-4o" : "openai/gpt-4o-mini";
      }
      console.log(`[wa-ai-reply] Chamando OpenRouter model=${model} msgs=${msgs.length} lastRole=${msgs[msgs.length - 1]?.role}`);

      // 9. Chama OpenRouter
      const startTime = Date.now();
      let orRes: Response;
      try {
        orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://imperiox.lovable.app",
            "X-Title": "Imperio HQ",
          },
          body: JSON.stringify({
            model,
            messages: msgs,
            max_tokens: aiConfig.max_tokens || 350,
            temperature: Number(aiConfig.ai_temperature ?? 0.7),
          }),
        });
      } catch (fetchErr: any) {
        console.error(`[wa-ai-reply] OpenRouter fetch error: ${fetchErr.message}`);
        
        // Log failure to database
        const latencySeconds = (Date.now() - startTime) / 1000;
        await supabase.from("imphq_wa_ai_logs").insert({
          project_id,
          conversation_id,
          lead_id: leadRow?.id || null,
          model,
          latency_seconds: latencySeconds,
          success: false,
          error_message: `Fetch error: ${fetchErr.message}`
        }).catch((err) => console.error("[wa-ai-reply] DB log error:", err.message));

        await clearLock();
        return new Response(JSON.stringify({ error: `OpenRouter unreachable: ${fetchErr.message}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!orRes.ok) {
        const errText = await orRes.text();
        console.error(`[wa-ai-reply] OpenRouter error ${orRes.status}: ${errText.slice(0, 400)}`);
        
        // Log failure to database
        const latencySeconds = (Date.now() - startTime) / 1000;
        await supabase.from("imphq_wa_ai_logs").insert({
          project_id,
          conversation_id,
          lead_id: leadRow?.id || null,
          model,
          latency_seconds: latencySeconds,
          success: false,
          error_message: `HTTP ${orRes.status}: ${errText.slice(0, 200)}`
        }).catch((err) => console.error("[wa-ai-reply] DB log error:", err.message));

        await clearLock();
        return new Response(JSON.stringify({ error: `OpenRouter ${orRes.status}`, detail: errText.slice(0, 200) }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orData = await orRes.json();
      
      // Log success to database
      try {
        const latencySeconds = (Date.now() - startTime) / 1000;
        const usage = orData?.usage || {};
        const prompt_tokens = usage.prompt_tokens || 0;
        const completion_tokens = usage.completion_tokens || 0;
        const total_tokens = usage.total_tokens || 0;
        
        // Calculate cost based on model
        let inputRate = 0.5; // default fallback / M tokens
        let outputRate = 1.5; // default fallback / M tokens
        const modelLower = String(model).toLowerCase();
        
        if (modelLower.includes("gpt-4o-mini")) {
          inputRate = 0.15;
          outputRate = 0.60;
        } else if (modelLower.includes("gpt-4o")) {
          inputRate = 2.50;
          outputRate = 10.00;
        } else if (modelLower.includes("claude-3-5-sonnet") || modelLower.includes("claude-3.5-sonnet")) {
          inputRate = 3.00;
          outputRate = 15.00;
        } else if (modelLower.includes("claude-3-5-haiku") || modelLower.includes("claude-3.5-haiku")) {
          inputRate = 0.80;
          outputRate = 4.00;
        } else if (modelLower.includes("gemini-2.5-flash") || modelLower.includes("gemini-1.5-flash")) {
          inputRate = 0.075;
          outputRate = 0.30;
        } else if (modelLower.includes("gemini-2.5-pro") || modelLower.includes("gemini-1.5-pro")) {
          inputRate = 1.25;
          outputRate = 5.00;
        } else if (modelLower.includes("deepseek-chat") || modelLower.includes("deepseek")) {
          inputRate = 0.14;
          outputRate = 0.28;
        } else if (modelLower.includes("llama-3.3")) {
          inputRate = 0.20;
          outputRate = 0.20;
        }
        
        const costUsd = ((prompt_tokens * inputRate) + (completion_tokens * outputRate)) / 1000000;
        
        await supabase.from("imphq_wa_ai_logs").insert({
          project_id,
          conversation_id,
          lead_id: leadRow?.id || null,
          model,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          latency_seconds: latencySeconds,
          cost_usd: costUsd,
          success: true
        });
      } catch (logErr: any) {
        console.error("[wa-ai-reply] Failed to write DB log:", logErr.message);
      }
      const aiReply = (orData?.choices?.[0]?.message?.content || "").trim();
      console.log(`[wa-ai-reply] Resposta recebida length=${aiReply.length}: ${aiReply.slice(0, 100)}`);

      if (!aiReply) {
        console.warn(`[wa-ai-reply] Resposta vazia do OpenRouter`);
        await clearLock();
        return new Response(JSON.stringify({ error: "Empty AI reply", raw: orData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Filter robotic AI phrases from response
      const roboticPhrases = [
        /^certamente[!,.]?\s*/i,
        /^com prazer[!,.]?\s*/i,
        /^claro que sim[!,.]?\s*/i,
        /^claro[!,.]?\s+/i,
        /^ótimo[!,.]?\s*/i,
        /^excelente[!,.]?\s*/i,
        /^maravilha[!,.]?\s*/i,
        /^perfeito[!,.]?\s*/i,
        /^com certeza[!,.]?\s*/i,
        /^absolutamente[!,.]?\s*/i,
        /^entendido[!,.]?\s*/i,
        /^olá[!,.]?\s+/i,
      ];
      let cleaned = aiReply;
      for (const pattern of roboticPhrases) {
        cleaned = cleaned.replace(pattern, "");
      }
      // Capitalize first char after stripping
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

      let finalAiReply = cleaned.trim();
      let shouldAdvanceFlow = false;
      let matchedRoute: any = null;
      let jumpSteps = 0;

      if (activeExecutionId && aiReply.includes("[PROXIMA_ETAPA]")) {
        shouldAdvanceFlow = true;
        finalAiReply = finalAiReply.replace(/\[PROXIMA_ETAPA\]/gi, "").trim();
        console.log(`[wa-ai-reply] [PROXIMA_ETAPA] detected! Preparing to advance flow execution ${activeExecutionId}`);
      }

      // Check for custom route tags if configured
      if (activeExecutionId && activeStep?.ia_routes && activeStep.ia_routes.length > 0) {
        for (const route of activeStep.ia_routes) {
          const cleanName = (route.name || "").replace(/[\[\]]/g, "").trim().toUpperCase();
          if (!cleanName) continue;
          const routeTagPattern = new RegExp(`\\[${cleanName}\\]`, "i");
          if (aiReply.includes(`[${cleanName}]`) || routeTagPattern.test(aiReply)) {
            matchedRoute = route;
            shouldAdvanceFlow = true;
            jumpSteps = route.jump_steps || 0;
            // Clean the custom route tag from finalAiReply
            const routeTagGlobalPattern = new RegExp(`\\[${cleanName}\\]`, "gi");
            finalAiReply = finalAiReply.replace(routeTagGlobalPattern, "").trim();
            console.log(`[wa-ai-reply] Custom route tag [${cleanName}] detected! Preparing to advance flow execution ${activeExecutionId} with jump_steps: ${jumpSteps}`);
            break;
          }
        }
      }

      if (aiReply.includes("[TRANSICAO_HUMANA]")) {
        shouldTransitionToHuman = true;
        handoffReason = "Atrito emocional ou pedido de atendimento humano detectado pela IA";
        finalAiReply = finalAiReply.replace(/\[TRANSICAO_HUMANA\]/gi, "").trim();
        console.log(`[wa-ai-reply] [TRANSICAO_HUMANA] detected! Preparing handoff to human support.`);
      }

      if (aiReply.includes("[CHAMAR_HUMANO]")) {
        shouldTransitionToHuman = true;
        handoffReason = `Conversa prolongada (${replyCount} mensagens) na etapa ativa do fluxo sem avanço`;
        finalAiReply = finalAiReply.replace(/\[CHAMAR_HUMANO\]/gi, "").trim();
        console.log(`[wa-ai-reply] [CHAMAR_HUMANO] detected! Preparing handoff to human support.`);
      }

      if (shouldAdvanceFlow && activeExecutionId) {
        try {
          const nextStep = activeExecutionStep + 1 + jumpSteps;
          const { data: currentExec } = await supabase
            .from("imphq_flow_executions")
            .select("step_results")
            .eq("id", activeExecutionId)
            .single();
            
          const results = Array.isArray(currentExec?.step_results) ? currentExec.step_results : [];
          results.push({
            step: activeExecutionStep,
            status: "guided_ai_completed",
            finished_at: new Date().toISOString(),
            notes: matchedRoute 
              ? `Objetivo atingido - Rota acionada: ${matchedRoute.name} (pulo de ${jumpSteps} passos)`
              : "Objetivo atingido e validado pela IA",
          });
          
          await supabase
            .from("imphq_flow_executions")
            .update({
              current_step: nextStep,
              step_results: results,
              status: "running",
            })
            .eq("id", activeExecutionId);
            
          console.log(`[wa-ai-reply] Flow advanced successfully to step ${nextStep}`);

          // Chamada assíncrona para o openflow-executor retomar o fluxo na nova etapa no background
          console.log(`[wa-ai-reply] Invoking openflow-executor for execution ${activeExecutionId} step ${nextStep}`);
          
          fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              trigger_tipo: activeTriggerTipo || "whatsapp",
              project_id,
              automacao_id: activeAutomacaoId,
              resume_from_step: nextStep,
              lead_data: {
                lead_id: leadRow.id,
                nome: leadRow.name || "",
                email: leadRow.email || "",
                telefone: leadRow.phone || "",
                phone: leadRow.phone || "",
                tags: leadRow.tags || [],
              },
            }),
          }).then(async (res) => {
            if (res.ok) {
              const resJson = await res.json();
              console.log(`[wa-ai-reply] openflow-executor invocation succeeded:`, JSON.stringify(resJson));
            } else {
              console.error(`[wa-ai-reply] openflow-executor invocation failed: status=${res.status}`, await res.text());
            }
          }).catch((fetchErr) => {
            console.error(`[wa-ai-reply] openflow-executor fetch error:`, fetchErr.message);
          });

        } catch (err: any) {
          console.error("[wa-ai-reply] Error advancing flow execution:", err.message);
        }
      }

      // ── Decisão estratégica de áudio ─────────────────────────────────────────
      // Hierarquia:
      //   1. Step do OpenFlow forçou → sempre áudio
      //   2. Lead enviou áudio agora → espelha (humanização imediata)
      //   3. voice_reply_enabled ativo → avalia se o MOMENTO justifica áudio
      //      Momentos que valem o custo: primeiro contato, retorno após silêncio >6h,
      //      emoção/situação pessoal detectada, lead quente perto de comprar
      //   4. Qualquer outro caso → texto (zero custo)
      let responseAudioUrl: string | null = null;
      let voiceReplyEnabled = false;
      let audioTriggerReason = "";

      if (activeStep?.ia_voice_response === true) {
        voiceReplyEnabled = true;
        audioTriggerReason = "flow_step_forced";
      } else if (isAudio) {
        voiceReplyEnabled = true;
        audioTriggerReason = "lead_sent_audio_mirror";
      } else if (aiConfig.voice_reply_enabled === true) {
        // Avalia o momento estratégico
        try {
          const [recentMsgsRes, convRes] = await Promise.all([
            supabase
              .from("imphq_wa_messages")
              .select("message_type, media_url, direction, created_at")
              .eq("conversation_id", conversation_id)
              .order("created_at", { ascending: false })
              .limit(10),
            supabase
              .from("imphq_wa_conversations")
              .select("created_at")
              .eq("id", conversation_id)
              .maybeSingle(),
          ]);

          const recentMsgs = recentMsgsRes.data || [];

          // Critério 1: Lead mandou áudio nas últimas 3 mensagens
          const leadSentAudioRecently = recentMsgs
            .filter((m: any) => m.direction === "incoming")
            .slice(0, 3)
            .some((m: any) =>
              m.message_type === "audio" ||
              (m.media_url && /\.(ogg|mp3|m4a|wav)$/i.test(m.media_url))
            );

          // Critério 2: Primeiro contato (conversa tem ≤ 2 mensagens no total)
          const isFirstContact = recentMsgs.length <= 2;

          // Critério 3: Retorno após silêncio >6h (lead estava inativo)
          const incomingMsgs = recentMsgs.filter((m: any) => m.direction === "incoming");
          const prevIncoming = incomingMsgs[1]; // segunda mais recente
          const hoursSilent = prevIncoming
            ? (new Date(message_time || Date.now()).getTime() - new Date(prevIncoming.created_at).getTime()) / 3600000
            : 999;
          const isReturnAfterSilence = hoursSilent > 6;

          // Critério 4: Mensagem carregada emocionalmente / situação pessoal
          const emotionalKeywords = /\b(problema|dificuldade|perdi|perda|não consigo|desempregad|dívida|medo|ansiedade|filho|esposa|marido|família|separad|câncer|doença|preciso muito|desesperado|ajuda|socorro|urgente|prazo|amanhã|hoje)\b/i;
          const isEmotional = emotionalKeywords.test(message);

          // Critério 5: Lead quente — próximo de comprar
          const buyingKeywords = /\b(quanto|preço|valor|parcela|desconto|forma de pagamento|pix|boleto|cartão|comprar|fechar|garantia|acesso|entrar)\b/i;
          const isHot = buyingKeywords.test(message);

          if (leadSentAudioRecently) {
            voiceReplyEnabled = true; audioTriggerReason = "lead_audio_recent";
          } else if (isFirstContact) {
            voiceReplyEnabled = true; audioTriggerReason = "first_contact";
          } else if (isReturnAfterSilence) {
            voiceReplyEnabled = true; audioTriggerReason = "return_after_silence";
          } else if (isEmotional) {
            voiceReplyEnabled = true; audioTriggerReason = "emotional_moment";
          } else if (isHot) {
            voiceReplyEnabled = true; audioTriggerReason = "hot_lead_buying";
          }
        } catch (_) {
          voiceReplyEnabled = false;
        }
      }

      if (voiceReplyEnabled) {
        console.log(`[wa-ai-reply] Audio triggered: ${audioTriggerReason}`);
      }

      if (voiceReplyEnabled && finalAiReply) {
        const voiceProvider = activeStep?.voice_provider || aiConfig.voice_provider || "openai";
        const voiceName = activeStep?.voice_id || aiConfig.voice_name || "alloy";
        const stability = activeStep?.voice_stability || aiConfig.voice_stability || 75;
        const clarity = activeStep?.voice_clarity || aiConfig.voice_clarity || 85;

        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        // Prefer key from saved AI config (set via UI), fallback to env var
        const elevenKey = (aiConfig as any).elevenlabs_api_key || Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY");

        if (!responseAudioUrl && voiceProvider === "elevenlabs" && elevenKey) {
          console.log(`[wa-ai-reply] Generating voice response via ElevenLabs...`);
          try {
            const elevenVoices: Record<string, string> = {
              fernanda_hq: "21m00Tcm4TlvDq8ikWAM", // Rachel
              felipe_sales: "ErXwobaYiN019PkySvjV", // Antoni
              tatiane_suporte: "AZnzlk1XyvMsSnfcehzq", // Nicole
            };
            const targetVoiceId = elevenVoices[voiceName] || voiceName;

            const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
              method: "POST",
              headers: {
                "xi-api-key": elevenKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: finalAiReply,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: stability / 100,
                  similarity_boost: 1.0,   // máximo para voz clonada
                  style: 0.45,             // expressividade natural
                  use_speaker_boost: true, // boost de similaridade do speaker
                }
              })
            });

            if (ttsRes.ok) {
              const ttsBlob = await ttsRes.blob();
              const fileName = `voice_${Date.now()}.mp3`;
              const filePath = `${project_id}/${fileName}`;
              await supabase.storage.createBucket("media", { public: true }).catch(() => {});
              const { error: uploadErr } = await supabase.storage
                .from("media")
                .upload(filePath, ttsBlob, { contentType: "audio/mpeg" });

              if (!uploadErr) {
                const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(filePath);
                responseAudioUrl = publicUrlData?.publicUrl || null;
                console.log(`[wa-ai-reply] ElevenLabs TTS audio uploaded: ${responseAudioUrl}`);
              } else {
                console.error("[wa-ai-reply] Storage upload error for ElevenLabs audio:", uploadErr.message);
              }
            } else {
              console.error("[wa-ai-reply] ElevenLabs TTS failed:", await ttsRes.text());
            }
          } catch (ttsErr: any) {
            console.error("[wa-ai-reply] ElevenLabs TTS error:", ttsErr.message);
          }
        }

        // ── Local TTS server ──────────────────────────────────────────────────
        // voice_provider = "local"       → edge-tts (gratuito, voz genérica)
        // voice_provider = "local_clone" → XTTS v2 (voz clonada, ex: JP)
        //                                  com fallback automático para ElevenLabs
        // Prefer URL from saved AI config (set via UI), fallback to env var
        const localTtsUrl = (aiConfig as any).local_tts_url || Deno.env.get("LOCAL_TTS_URL");

        if (!responseAudioUrl && (voiceProvider === "local" || voiceProvider === "local_clone") && localTtsUrl) {
          const isClone = voiceProvider === "local_clone";
          const endpoint = isClone ? `${localTtsUrl}/tts/clone` : `${localTtsUrl}/tts/edge`;
          const body = isClone
            ? { text: finalAiReply, language: "pt", speed: 1.0 }
            : { text: finalAiReply, voice: voiceName || "pt-BR-FranciscaNeural", rate: "+0%", pitch: "+0Hz" };

          try {
            console.log(`[wa-ai-reply] Local TTS (${isClone ? "XTTS clone" : "edge-tts"}): ${endpoint}`);
            const ttsRes = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(30000), // 30s timeout — XTTS pode ser lento em CPU
            });
            if (ttsRes.ok) {
              const ttsBlob = await ttsRes.blob();
              const ext = isClone ? "wav" : "mp3";
              const contentType = isClone ? "audio/wav" : "audio/mpeg";
              const fileName = `voice_local_${Date.now()}.${ext}`;
              const filePath = `${project_id}/${fileName}`;
              await supabase.storage.createBucket("media", { public: true }).catch(() => {});
              const { error: uploadErr } = await supabase.storage
                .from("media")
                .upload(filePath, ttsBlob, { contentType });
              if (!uploadErr) {
                const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(filePath);
                responseAudioUrl = publicUrlData?.publicUrl || null;
                console.log(`[wa-ai-reply] Local TTS uploaded (${voiceProvider}): ${responseAudioUrl}`);
              }
            } else {
              const errText = await ttsRes.text();
              console.error(`[wa-ai-reply] Local TTS error ${ttsRes.status}: ${errText}`);
              // Servidor retornou 503 = XTTS não carregado → não faz fallback automático para ElevenLabs
              // Qualquer outro erro → tenta ElevenLabs abaixo
            }
          } catch (localErr: any) {
            console.error("[wa-ai-reply] Local TTS timeout/connection error:", localErr.message);
            // Timeout ou servidor offline → cai no ElevenLabs abaixo
          }
        }

        // ElevenLabs fallback — quando local_clone falhou (servidor offline/timeout)
        // O voiceId aqui é o ID real do expert no ElevenLabs (ex: ID do JP)
        if (!responseAudioUrl && voiceProvider === "local_clone" && elevenKey) {
          console.log(`[wa-ai-reply] local_clone falhou — fallback para ElevenLabs (voice: ${voiceName})`);
          try {
            const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceName}`, {
              method: "POST",
              headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: finalAiReply,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: stability / 100, similarity_boost: clarity / 100 },
              }),
            });
            if (ttsRes.ok) {
              const ttsBlob = await ttsRes.blob();
              const filePath = `${project_id}/voice_eleven_fallback_${Date.now()}.mp3`;
              await supabase.storage.createBucket("media", { public: true }).catch(() => {});
              const { error: uploadErr } = await supabase.storage
                .from("media").upload(filePath, ttsBlob, { contentType: "audio/mpeg" });
              if (!uploadErr) {
                const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(filePath);
                responseAudioUrl = publicUrlData?.publicUrl || null;
                console.log(`[wa-ai-reply] ElevenLabs fallback audio uploaded: ${responseAudioUrl}`);
              }
            } else {
              console.error("[wa-ai-reply] ElevenLabs fallback failed:", await ttsRes.text());
            }
          } catch (ttsErr: any) {
            console.error("[wa-ai-reply] ElevenLabs fallback error:", ttsErr.message);
          }
        }

        // OpenAI TTS — fallback genérico para providers que não têm outra opção
        if (!responseAudioUrl && voiceProvider !== "local" && voiceProvider !== "local_clone" && openaiKey) {
          console.log(`[wa-ai-reply] Generating voice via OpenAI TTS (voice: ${voiceName})...`);
          try {
            const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: "tts-1", input: finalAiReply.slice(0, 4096), voice: voiceName || "alloy" }),
            });
            if (ttsRes.ok) {
              const ttsBlob = await ttsRes.blob();
              const filePath = `${project_id}/voice_openai_${Date.now()}.mp3`;
              await supabase.storage.createBucket("media", { public: true }).catch(() => {});
              const { error: uploadErr } = await supabase.storage
                .from("media").upload(filePath, ttsBlob, { contentType: "audio/mpeg" });
              if (!uploadErr) {
                const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(filePath);
                responseAudioUrl = publicUrlData?.publicUrl || null;
                console.log(`[wa-ai-reply] OpenAI TTS audio uploaded: ${responseAudioUrl}`);
              }
            } else {
              console.error("[wa-ai-reply] OpenAI TTS failed:", await ttsRes.text());
            }
          } catch (ttsErr: any) {
            console.error("[wa-ai-reply] OpenAI TTS error:", ttsErr.message);
          }
        }
      }

      // 10. Draft mode
      if (aiConfig.draft_mode) {
        await supabase.from("imphq_wa_ai_drafts").insert({
          conversation_id, project_id, incoming_text: message,
          suggested_text: finalAiReply, model, status: "pending",
        });
        await supabase.from("imphq_wa_conversations").update({
          ai_last_reply_at: new Date().toISOString(), ai_lock_until: null,
        }).eq("id", conversation_id);
        console.log(`[wa-ai-reply] Draft salvo`);
        return new Response(JSON.stringify({ ok: true, draft: true, preview: finalAiReply.slice(0, 100) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Human-like delay: base + typing-time (proporcional ao comprimento) + jitter
      // Simula tempo de leitura (1s) + tempo de digitação (~250 chars/min ≈ 240ms/char)
      // + jitter aleatório (1-4s) para variar entre mensagens.
      const delaySec = Number(aiConfig.response_delay_seconds ?? 3);
      const replyChars = finalAiReply.length;
      const typingMs = Math.min(replyChars * 60, 12000); // ~1000 chars/min, cap em 12s
      const jitterMs = 1000 + Math.floor(Math.random() * 3000); // 1-4s
      const totalDelayMs = Math.min(delaySec * 1000 + typingMs + jitterMs, 22000);
      if (totalDelayMs > 0) {
        console.log(`[wa-ai-reply] Aguardando ${(totalDelayMs / 1000).toFixed(1)}s (base=${delaySec}s + typing=${(typingMs/1000).toFixed(1)}s + jitter=${(jitterMs/1000).toFixed(1)}s, ${replyChars} chars)`);
        await new Promise((r) => setTimeout(r, totalDelayMs));
      }

      // Split long replies into multiple messages (human-like behavior)
      // Split on double newline boundaries; if no splits, keep as single message
      function splitIntoMessages(text: string): string[] {
        const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        if (parts.length <= 1) return [text];
        // Merge very short parts (< 40 chars) with next one to avoid tiny fragments
        const merged: string[] = [];
        let buffer = "";
        for (const part of parts) {
          if (buffer && (buffer.length + part.length) < 40) {
            buffer += "\n\n" + part;
          } else {
            if (buffer) merged.push(buffer);
            buffer = part;
          }
        }
        if (buffer) merged.push(buffer);
        // Cap at 3 messages max
        if (merged.length > 3) {
          const last = merged.splice(2).join("\n\n");
          return [...merged, last];
        }
        return merged;
      }

      const messageParts = responseAudioUrl ? [finalAiReply] : splitIntoMessages(finalAiReply);
      console.log(`[wa-ai-reply] Sending ${messageParts.length} message part(s)`);

      let sendSuccess = false;
      let outMsgId: string | null = null;

      if (provider.provider === "evolution") {
        const base = provider.api_url.replace(/\/+$/, "");
        const inst = encodeURIComponent(provider.instance_name);

        if (responseAudioUrl) {
          const url = `${base}/message/sendWhatsAppAudio/${inst}`;
          const bodyPayload = {
            number: phone + "@s.whatsapp.net",
            audio: responseAudioUrl,
            options: { delay: 1000, presence: "composing" }
          };
          console.log(`[wa-ai-reply] Enviando ÁUDIO via Evolution: ${url} → ${phone}`);
          const sendRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: provider.api_key },
            body: JSON.stringify(bodyPayload),
          });
          const sendData = await sendRes.json().catch(() => ({}));
          console.log(`[wa-ai-reply] Evolution audio status=${sendRes.status}`);
          if (sendRes.ok) { sendSuccess = true; outMsgId = sendData?.key?.id || null; }
          else console.error(`[wa-ai-reply] Evolution API rejeitou áudio: ${sendRes.status}`);
        } else {
          // Send each part sequentially with a short typing delay between them
          for (let i = 0; i < messageParts.length; i++) {
            const part = messageParts[i];
            if (i > 0) {
              // Simulate typing time proportional to message length (40ms/char, 1s–5s range)
              const typingMs = Math.min(Math.max(part.length * 40, 1000), 5000);
              await new Promise((r) => setTimeout(r, typingMs));
            }
            const url = `${base}/message/sendText/${inst}`;
            const bodyPayload: any = {
              number: phone + "@s.whatsapp.net",
              text: part,
              options: { delay: 1000, presence: "composing" }
            };
            console.log(`[wa-ai-reply] Enviando parte ${i + 1}/${messageParts.length} TEXTO via Evolution → ${phone}`);
            const sendRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: provider.api_key },
              body: JSON.stringify(bodyPayload),
            });
            const sendData = await sendRes.json().catch(() => ({}));
            console.log(`[wa-ai-reply] Evolution status=${sendRes.status} part=${i + 1}`);
            if (sendRes.ok) {
              sendSuccess = true;
              if (i === 0) outMsgId = sendData?.key?.id || null;
            } else {
              console.error(`[wa-ai-reply] Evolution API rejeitou parte ${i + 1}: ${sendRes.status} ${JSON.stringify(sendData).slice(0, 200)}`);
              break;
            }
          }
        }
      } else {
        console.warn(`[wa-ai-reply] Provider type '${provider.provider}' não suportado nesta função`);
      }

      if (sendSuccess) {
        await supabase.from("imphq_wa_messages").insert({
          conversation_id, direction: "outgoing", phone,
          content: finalAiReply, message_type: "text",
          project_id, provider: provider.provider,
          provider_message_id: outMsgId,
          status: "sent", sent_by: "ai",
          metadata: { source: "wa-ai-reply", model },
        });

        const { data: freshConv } = await supabase
          .from("imphq_wa_conversations")
          .select("message_count")
          .eq("id", conversation_id)
          .maybeSingle();

        const updatePayload: any = {
          ai_last_reply_at: new Date().toISOString(),
          ai_lock_until: null,
          last_message: finalAiReply.slice(0, 500),
          last_message_at: new Date().toISOString(),
          last_message_direction: "outgoing",
          message_count: ((freshConv?.message_count as number) || 0) + 1,
        };

        if (shouldTransitionToHuman) {
          updatePayload.status = "needs_human";
        }

        await supabase.from("imphq_wa_conversations")
          .update(updatePayload)
          .eq("id", conversation_id);

        if (shouldTransitionToHuman) {
          try {
            await supabase.from("imphq_ai_actions").insert({
              kind: "human_handoff",
              risk_level: "medium",
              confidence: 0.98,
              title: "Transição Humana Preditiva",
              reason: handoffReason,
              payload: {
                lead_id: leadRow?.id || null,
                phone,
                conversation_id,
                reply_count: replyCount,
                ai_message: finalAiReply,
              },
              projeto_id: project_id,
              source: "wa-ai-reply",
              status: "executed",
              auto_executed: true,
              executed_at: new Date().toISOString(),
            });
            console.log(`[wa-ai-reply] Handoff action logged in imphq_ai_actions`);
          } catch (logErr: any) {
            console.error(`[wa-ai-reply] Error logging handoff action:`, logErr.message);
          }
        }

        console.log(`[wa-ai-reply] SUCCESS: mensagem enviada para ${phone}`);
        return new Response(JSON.stringify({ ok: true, sent: true, model, preview: finalAiReply.slice(0, 100) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        console.error(`[wa-ai-reply] FAIL: Evolution API não enviou`);
        await clearLock();
        return new Response(JSON.stringify({ error: "Send failed via Evolution" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (innerErr: any) {
      console.error(`[wa-ai-reply] Erro interno: ${innerErr.message}`);
      await clearLock();
      throw innerErr;
    }
  } catch (e: any) {
    console.error(`[wa-ai-reply] Fatal: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
