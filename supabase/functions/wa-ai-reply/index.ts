// wa-ai-reply — AI responder simples e robusto para WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { anglesPromptBlock } from "../_shared/creativeAngles.ts";
import { getCachedEmbedding } from "../_shared/embeddings.ts";
import {
  isJPProject,
  jpLookupLead,
  jpResolveLead,
  jpBuildContextBlock,
  jpBuildInstructionsBlock,
  jpProcessTags,
  jpIssueMagicLink,
  jpLogEvent,
} from "../_shared/crmBridgeJP.ts";
import { extractAndPersistLeadData } from "../_shared/leadDataExtractor.ts";

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
    const { conversation_id, project_id, phone, push_name } = body;
    let provider_id = body.provider_id;
    // Fallback: callers como wa-ai-pending-flush não passam provider_id.
    // Busca da conversa para não cair em "Missing required fields".
    if (!provider_id && conversation_id) {
      try {
        const { data: convRow } = await supabase
          .from("imphq_wa_conversations")
          .select("provider_id")
          .eq("id", conversation_id)
          .maybeSingle();
        if (convRow?.provider_id) provider_id = convRow.provider_id;
      } catch (e: any) {
        console.warn("[wa-ai-reply] provider_id fallback lookup error:", e?.message);
      }
    }
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

    // ─── Payment Confirmation Detection (bypass business hours + boas-vindas prioritárias)
    const PAYMENT_CONFIRM_PATTERNS = [
      /\bj[áa]\s+paguei\b/i,
      /\bpaguei\b/i,
      /\bj[áa]\s+(est[áa]\s+)?pago\b/i,
      /\bj[áa]\s+foi\s+pago\b/i,
      /\bj[áa]\s+(fiz|enviei|mandei)\s+(o\s+)?pix\b/i,
      /\bpix\s+(feito|enviado|pago|realizado)\b/i,
      /\bpagamento\s+(feito|enviado|realizado|confirmado|aprovado)\b/i,
      /\bcomprei\b/i,
      /\bfinalizei\b/i,
      /\b(j[áa]\s+)?fechei\b/i,
      /\bcomprovante\b/i,
      /\bacabei\s+de\s+pagar\b/i,
    ];
    let isPaymentConfirmation = false;
    let recentVendaContext: any = null;
    if (leadRow?.id && message) {
      isPaymentConfirmation = PAYMENT_CONFIRM_PATTERNS.some((re) => re.test(message));
      if (isPaymentConfirmation) {
        try {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: vendas } = await supabase
            .from("imphq_vendas")
            .select("id, status, produto_nome, valor, created_at")
            .eq("lead_id", leadRow.id)
            .gte("created_at", sevenDaysAgo)
            .order("created_at", { ascending: false })
            .limit(3);
          recentVendaContext = vendas?.[0] || null;
          console.log(`[wa-ai-reply] 💸 Payment confirmation detected. Recent venda: ${recentVendaContext?.id || "none"} (${recentVendaContext?.status || "n/a"})`);
        } catch (e: any) {
          console.warn("[wa-ai-reply] Error loading recent venda:", e?.message);
        }
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

              // ── wait_reply / input_capture: lead respondeu → retoma fluxo ──
              const isWaitReply = activeStep?.tipo === "wait_reply";
              const isInputCapture = activeStep?.tipo === "input_capture";
              if ((isWaitReply || isInputCapture) && activeExec.status === "waiting") {
                console.log(`[wa-ai-reply] ${activeStep.tipo} detected at step ${activeExecutionStep} — resuming flow with reply.`);
                const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                const SUPABASE_URL_LOCAL = Deno.env.get("SUPABASE_URL")!;
                // input_capture precisa executar o próprio step (save da variável); wait_reply pula p/ próximo
                const resumeStep = isInputCapture ? activeExecutionStep : activeExecutionStep + 1;
                await supabase.from("imphq_flow_executions")
                  .update({ status: "running", current_step: resumeStep })
                  .eq("id", activeExec.id);

                fetch(`${SUPABASE_URL_LOCAL}/functions/v1/openflow-executor`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                  body: JSON.stringify({
                    trigger_tipo: activeTriggerTipo || "whatsapp",
                    project_id,
                    automacao_id: activeExec.automacao_id,
                    resume_from_step: resumeStep,
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
                }).catch((e: any) => console.error("[wa-ai-reply] resume error:", e.message));
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
      // Reutiliza transcript já persistido por wa-audio-transcribe (evita duplo custo)
      try {
        const { data: existingMsg } = await supabase
          .from("imphq_wa_messages")
          .select("id, transcript")
          .eq("conversation_id", conversation_id)
          .eq("direction", "incoming")
          .eq("message_type", "audio")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingMsg?.transcript) {
          message = existingMsg.transcript;
          audioTranscription = existingMsg.transcript;
          console.log(`[wa-ai-reply] Transcript reutilizado do DB: "${message.slice(0, 80)}"`);
        }
      } catch (e: any) {
        console.warn("[wa-ai-reply] transcript reuse skip:", e?.message);
      }
    }

    if (isAudio && body.media_url && !audioTranscription) {
      console.log(`[wa-ai-reply] Audio message detected: ${body.media_url}. Transcribing via ElevenLabs Scribe v2...`);
      const elevenSttKey = Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY");
      if (elevenSttKey) {
        try {
          const audioFetch = await fetch(body.media_url);
          if (audioFetch.ok) {
            const audioBlob = await audioFetch.blob();
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.ogg");
            formData.append("model_id", "scribe_v2");
            formData.append("language_code", "por");
            formData.append("tag_audio_events", "false");
            formData.append("diarize", "false");

            const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
              method: "POST",
              headers: { "xi-api-key": elevenSttKey },
              body: formData,
            });

            if (sttRes.ok) {
              const sttData = await sttRes.json();
              const transcribed = (sttData.text || "").trim();
              message = transcribed || message;
              audioTranscription = transcribed || null;
              console.log(`[wa-ai-reply] ElevenLabs Scribe transcribed: "${message}"`);

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
                    .update({ transcript: transcribed })
                    .eq("id", latestMsg.id);
                  console.log(`[wa-ai-reply] Persisted transcript for message ${latestMsg.id}`);
                }
              } catch (dbErr: any) {
                console.warn("[wa-ai-reply] Failed to save transcript in DB:", dbErr.message);
              }

              if (project_id && message) {
                try {
                  const embedding = await getCachedEmbedding(supabase, message);
                  if (embedding) {
                    await supabase.from("imphq_wa_lead_memory").insert({
                      lead_id: leadRow?.id || null,
                      project_id: project_id,
                      phone: phone,
                      content: `[Áudio] ${message}`,
                      embedding,
                    });
                    console.log(`[wa-ai-reply] Audio indexado na memoria do lead: phone=${phone}`);
                  }
                } catch (embErr: any) {
                  console.error("[wa-ai-reply] embedding error for audio:", embErr.message);
                }
              }
            } else {
              console.error("[wa-ai-reply] ElevenLabs STT returned error:", sttRes.status, await sttRes.text());
            }
          } else {
            console.error("[wa-ai-reply] Failed to fetch audio file:", audioFetch.status);
          }
        } catch (err: any) {
          console.error("[wa-ai-reply] ElevenLabs STT error:", err.message);
        }
      } else {
        console.warn("[wa-ai-reply] ELEVENLABS_API_KEY not configured, cannot transcribe voice message.");
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
      .select("ai_last_reply_at, ai_lock_until, message_count, contact_name, status, ai_paused_until, ia_ativa, phone, current_intent, emotional_state, last_objection")
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

    // === HANDOFF HUMANO — detecta sinais de fricção e pausa IA ===
    // Patterns: pedido explícito de humano, raiva, ameaça, insulto, "quero cancelar", "quero reclamar"
    const HANDOFF_PATTERNS: { rx: RegExp; reason: string }[] = [
      { rx: /\b(falar|atendimento) com (humano|pessoa|gente|atendente|algu[eé]m real|dono|respons[aá]vel)\b/i, reason: "pediu humano" },
      { rx: /\b(voc[eê]|isso|isto) [eé] (um )?(rob[oô]|bot|ia|intelig[eê]ncia)\b/i, reason: "identificou bot" },
      { rx: /\b(quero (cancelar|reclamar|reembolso|meu dinheiro)|estou (com )?raiva|indignad[oa]|revoltad[oa])\b/i, reason: "reclamação/raiva" },
      { rx: /\b(golpe|enganad[oa]|fraude|processo|advogado|procon|reclame ?aqui)\b/i, reason: "risco jurídico" },
      { rx: /\b(fdp|merda|porra|caralho|filha? da puta|otari[oa]|idiota|imbecil)\b/i, reason: "linguagem hostil" },
      { rx: /\b(para|pare|chega) de (mandar|me mandar|responder|enviar)\b/i, reason: "pediu parar" },
    ];
    if (!isTestMode && message && typeof message === "string") {
      const hit = HANDOFF_PATTERNS.find(p => p.rx.test(message));
      if (hit) {
        console.log(`[wa-ai-reply] HANDOFF detectado: ${hit.reason} — pausando IA e marcando needs_human`);
        try {
          await supabase.from("imphq_wa_conversations").update({
            status: "needs_human",
            ai_paused_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          }).eq("id", conversation_id);
          await supabase.from("imphq_notifications").insert({
            projeto_id: project_id || null,
            tipo: "handoff_humano",
            titulo: `🔥 Precisa humano: ${hit.reason}`,
            mensagem: `Conversa ${conv?.contact_name || conv?.phone || conversation_id}: "${String(message).slice(0, 180)}"`,
            payload: { conversation_id, reason: hit.reason, snippet: String(message).slice(0, 300) },
            lida: false,
          });
        } catch (e: any) {
          console.warn(`[wa-ai-reply] handoff persist error: ${e?.message}`);
        }
        return new Response(JSON.stringify({ skipped: "handoff_humano", reason: hit.reason }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verifica pausa manual (humano respondeu recentemente) — com auto-resume se lead voltou com pergunta nova
    if (conv?.ai_paused_until && !isTestMode) {
      const pausedUntil = new Date(conv.ai_paused_until);
      if (pausedUntil > new Date()) {
        // Auto-resume: se já se passaram >=3min da resposta humana E o lead enviou nova msg
        let autoResume = false;
        try {
          const { data: lastHuman } = await supabase
            .from("imphq_wa_messages")
            .select("created_at")
            .eq("conversation_id", conversation_id)
            .eq("direction", "outgoing")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastHuman?.created_at) {
            const elapsedMin = (Date.now() - new Date(lastHuman.created_at).getTime()) / 60000;
            const { count: newIncoming } = await supabase
              .from("imphq_wa_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", conversation_id)
              .eq("direction", "incoming")
              .gt("created_at", lastHuman.created_at);
            if (elapsedMin >= 3 && (newIncoming || 0) >= 1) {
              autoResume = true;
              await supabase
                .from("imphq_wa_conversations")
                .update({ ai_paused_until: null })
                .eq("id", conversation_id);
              console.log(`[wa-ai-reply] resume_reason=human_followup elapsed=${elapsedMin.toFixed(1)}min new_incoming=${newIncoming}`);
            }
          }
        } catch (e: any) {
          console.warn(`[wa-ai-reply] auto-resume check error: ${e?.message}`);
        }
        if (!autoResume) {
          const remainMin = Math.ceil((pausedUntil.getTime() - Date.now()) / 60000);
          console.log(`[wa-ai-reply] IA pausada por mais ${remainMin}min (humano respondeu). Para retomar: setar ai_paused_until=null`);
          return new Response(JSON.stringify({ skipped: "human_override", paused_until: conv.ai_paused_until, resumes_in_min: remainMin }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const cooldownSec = Number(aiConfig.cooldown_seconds ?? 5);
    if (conv?.ai_last_reply_at && !isTestMode) {
      const elapsed = (Date.now() - new Date(conv.ai_last_reply_at).getTime()) / 1000;
      if (elapsed < cooldownSec) {
        console.log(`[wa-ai-reply] Cooldown ativo: ${elapsed.toFixed(1)}s < ${cooldownSec}s — enfileirando para flush`);
        await supabase
          .from("imphq_wa_conversations")
          .update({ ai_pending_since: new Date().toISOString() })
          .eq("id", conversation_id)
          .is("ai_pending_since", null);
        return new Response(JSON.stringify({ skipped: "cooldown", elapsed_s: elapsed, queued: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Tenta adquirir lock — usa SELECT+UPDATE simples (evita bug do .or() no Supabase JS v2)
    if (conv?.ai_lock_until && !isTestMode) {
      const lockExpiry = new Date(conv.ai_lock_until);
      if (lockExpiry > new Date()) {
        console.log(`[wa-ai-reply] Lock ativo até ${conv.ai_lock_until}, enfileirando para flush`);
        await supabase
          .from("imphq_wa_conversations")
          .update({ ai_pending_since: new Date().toISOString() })
          .eq("id", conversation_id)
          .is("ai_pending_since", null);
        return new Response(JSON.stringify({ skipped: "locked", lock_until: conv.ai_lock_until, queued: true }), {
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
      if (aiConfig.business_hours_only && !isPaymentConfirmation) {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo", hour: "numeric", minute: "numeric", hour12: false,
        }).formatToParts(new Date());
        const h = Number(parts.find((p) => p.type === "hour")?.value);
        const m = Number(parts.find((p) => p.type === "minute")?.value);
        const now = h * 100 + m;
        const [sh, sm] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
        const [eh, em] = (aiConfig.business_hours_end || "22:00").split(":").map(Number);
        if (now < sh * 100 + sm || now > eh * 100 + em) {
          console.log(`[wa-ai-reply] Fora do horário comercial (${h}:${m}) — enfileirando`);
          await supabase
            .from("imphq_wa_conversations")
            .update({ ai_pending_since: new Date().toISOString(), ai_lock_until: null })
            .eq("id", conversation_id)
            .is("ai_pending_since", null);
          await clearLock();
          return new Response(JSON.stringify({ skipped: "business_hours", queued: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Dentro do horário: limpa pending se houver
        if (conv.ai_pending_since) {
          await supabase
            .from("imphq_wa_conversations")
            .update({ ai_pending_since: null })
            .eq("id", conversation_id);
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

      // CONSULTIVE INTENT — lead pediu ajuda pra ESCOLHER entre produtos/cursos.
      // Quando ativo: suprime closer/recovery e força a IA a apresentar catálogo + 1 pergunta diagnóstica.
      const CONSULTIVE_PATTERNS = /\b(qual|quais|diferen[çc]a|v[áa]rios cursos|v[áa]rios curso|tem v[áa]rios|se encaixa|encaixaria|me indica|recomenda|qual recomenda|melhor pra mim|qual melhor|pra come[çc]ar|sou iniciante|n[ãa]o sei qual|t[óo] na d[úu]vida|estou na d[úu]vida|fiquei na d[úu]vida|qual escolher|qual comprar)\b/i;
      const isConsultiveProductQuery = CONSULTIVE_PATTERNS.test(message);
      if (isConsultiveProductQuery) {
        console.log(`[wa-ai-reply] 🧭 CONSULTIVE intent detected: "${message.slice(0, 60)}"`);
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

      // 6. Histórico da conversa (com recheck: pega SEMPRE o mais recente antes de gerar)
      const { data: history } = await supabase
        .from("imphq_wa_messages")
        .select("direction, content, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // 🔎 Recheck: se o lead enviou algo NOVO depois desta invocação (durante debounce/latência),
      // usa a última mensagem incoming como `message` para não responder com contexto obsoleto.
      try {
        const incomings = (history || []).filter((h: any) => h.direction === "incoming");
        const latest = incomings[0];
        if (latest?.content && String(latest.content).trim() !== String(message || "").trim()) {
          console.log(`[wa-ai-reply] 🔄 recheck: msg mais recente difere do payload — usando "${String(latest.content).slice(0,60)}"`);
          message = String(latest.content);
        }
      } catch {}




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

      // ====== MEMÓRIA DE LONGO PRAZO DO LEAD (lead_memory + histórico de compras) ======
      let leadLongMemoryBlock = "";
      try {
        const mem: any = lead?.lead_memory || {};
        const lines: string[] = [];

        // ✅ DADOS JÁ CAPTURADOS — nunca pedir de novo
        // Fallback: se lead.email vazio, varre histórico procurando email já enviado
        let effectiveEmail = String(lead?.email || "").trim().toLowerCase();
        if (!effectiveEmail && Array.isArray(history)) {
          for (const h of history) {
            if (h.direction !== "incoming") continue;
            const m = String(h.content || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
            if (m) {
              effectiveEmail = m[0].trim().toLowerCase();
              if (lead?.id) {
                try {
                  await supabase.from("imphq_leads").update({ email: effectiveEmail }).eq("id", lead.id).is("email", null);
                  (lead as any).email = effectiveEmail;
                  console.log(`[wa-ai-reply] 🔁 email retroativo capturado do histórico lead=${lead.id} email=${effectiveEmail}`);
                } catch (_) { /* ignora */ }
              }
              break;
            }
          }
        }
        const capturedLines: string[] = [];
        if (effectiveEmail) capturedLines.push(`- ✅ EMAIL já cadastrado: ${effectiveEmail} — NÃO peça de novo, use este.`);
        if (lead?.nome || mem?.nome_preferido) capturedLines.push(`- ✅ NOME: ${lead?.nome || mem.nome_preferido}`);
        if (phone) capturedLines.push(`- ✅ TELEFONE: ${phone}`);
        if (capturedLines.length) {
          lines.push("DADOS JÁ CAPTURADOS DO LEAD (não pergunte de novo, use direto):");
          lines.push(...capturedLines);
          lines.push("");
        }


        if (mem.nome_preferido) lines.push(`- Prefere ser chamado(a) de: ${String(mem.nome_preferido).slice(0, 80)}`);
        if (mem.interesse_principal) lines.push(`- Interesse principal: ${String(mem.interesse_principal).slice(0, 150)}`);
        if (mem.informacoes_pessoais?.profissao) lines.push(`- Profissão: ${String(mem.informacoes_pessoais.profissao).slice(0, 100)}`);
        if (mem.informacoes_pessoais?.objetivo) lines.push(`- Objetivo declarado: ${String(mem.informacoes_pessoais.objetivo).slice(0, 200)}`);
        const dorMem = mem.informacoes_pessoais?.dor_principal || lead?.dor_principal;
        if (dorMem) lines.push(`- Dor principal: ${String(dorMem).slice(0, 200)}`);
        if (mem.objecao_atual || lead?.objecao_atual) lines.push(`- ⚠️ Objeção ATUAL travando a venda: "${String(mem.objecao_atual || lead.objecao_atual).slice(0, 200)}" — sua resposta DEVE endereçá-la.`);
        if (Array.isArray(mem.objecoes_recorrentes) && mem.objecoes_recorrentes.length) {
          lines.push(`- Objeções recorrentes: ${mem.objecoes_recorrentes.slice(-5).join(" | ")}`);
        }
        if (Array.isArray(mem.gatilhos_positivos) && mem.gatilhos_positivos.length) {
          lines.push(`- Gatilhos que funcionam com este lead: ${mem.gatilhos_positivos.slice(-5).join(" | ")}`);
        }
        if (Array.isArray(mem.produtos_mencionados) && mem.produtos_mencionados.length) {
          lines.push(`- Produtos já mencionados pelo lead: ${mem.produtos_mencionados.slice(-5).join(" | ")}`);
        }
        if (mem.proximo_passo_sugerido) lines.push(`- 🎯 Próximo passo sugerido (da memória): ${String(mem.proximo_passo_sugerido).slice(0, 200)}`);
        if (mem.notas_ia) lines.push(`- Notas internas: ${String(mem.notas_ia).slice(0, 250)}`);
        if (lead?.nivel_qualificacao) lines.push(`- Nível de qualificação: ${lead.nivel_qualificacao.toUpperCase()}`);

        // 🧭 QUALIFICAÇÃO CONSULTIVA (dimensões preenchidas → não repetir pergunta)
        const q = mem.qualificacao || {};
        const qFilled: string[] = [];
        const qMissing: string[] = [];
        const qLabels: Record<string, string> = {
          nivel: "Nível (iniciante/intermediário/avançado)",
          objetivo: "Objetivo (hobby/renda extra/profissionalizar/escalar)",
          formato_pref: "Formato (online/presencial/híbrido)",
          orcamento_sinal: "Orçamento (baixo/médio/alto)",
          urgencia: "Urgência (agora/30d/explorando)",
        };
        for (const [k, label] of Object.entries(qLabels)) {
          if (q[k]) qFilled.push(`  ✓ ${label}: ${q[k]}`);
          else qMissing.push(`  ✗ ${label}`);
        }
        if (qFilled.length > 0 || qMissing.length > 0) {
          lines.push("");
          lines.push("🧭 QUALIFICAÇÃO CONSULTIVA DO LEAD:");
          if (qFilled.length) lines.push(...qFilled);
          if (qMissing.length) {
            lines.push("  DIMENSÕES AINDA NÃO DESCOBERTAS (faça UMA pergunta natural para descobrir a próxima, nunca 2 juntas):");
            lines.push(...qMissing);
          }
          lines.push(`  REGRA DE OURO: só envie link de checkout depois de ter AO MENOS 2 dimensões preenchidas E confirmar encaixe. Antes disso, priorize descoberta consultiva.`);
        }


        // Histórico de compras (últimas 3 pagas)
        if (lead?.id) {
          try {
            const { data: pastVendas } = await supabase
              .from("imphq_vendas")
              .select("produto_nome, status, valor, created_at")
              .eq("lead_id", lead.id)
              .in("status", ["paga", "aprovada", "approved", "paid"])
              .order("created_at", { ascending: false })
              .limit(3);
            if (pastVendas && pastVendas.length) {
              const compras = pastVendas.map((v: any) => {
                const dt = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR") : "";
                return `${v.produto_nome || "produto"}${dt ? ` em ${dt}` : ""}`;
              }).join(" | ");
              lines.push(`- 💰 Já comprou: ${compras} — NUNCA reofereça esses produtos; foque em upsell/cross.`);
            }
          } catch (_) { /* non-critical */ }
        }

        if (lines.length > 0) {
          leadLongMemoryBlock = `\n📌 MEMÓRIA DE LONGO PRAZO DO LEAD (use SEM perguntar de novo o que já está aqui):\n${lines.join("\n")}\n`;
        }
      } catch (memErr: any) {
        console.warn("[wa-ai-reply] long memory block error:", memErr?.message);
      }

      // ====== MEMÓRIA CROSS-PROJETO (mesmo telefone em outros projetos) ======
      let crossProjectMemoryBlock = "";
      try {
        if (phone) {
          const { data: cross, error: crossErr } = await supabase.rpc("get_lead_cross_memory", {
            p_phone: phone,
            p_current_project_id: project_id ? String(project_id) : null,
          });
          if (crossErr) {
            console.warn("[wa-ai-reply] get_lead_cross_memory error:", crossErr.message);
          } else if (cross && typeof cross === "object") {
            const otherLeads = Array.isArray((cross as any).leads) ? (cross as any).leads : [];
            const otherVendas = Array.isArray((cross as any).vendas) ? (cross as any).vendas : [];
            const otherMems = Array.isArray((cross as any).memories) ? (cross as any).memories : [];
            const xLines: string[] = [];

            // Map project_id -> nome (best-effort, leve)
            const projIds = Array.from(new Set([
              ...otherLeads.map((l: any) => l.project_id),
              ...otherVendas.map((v: any) => v.project_id),
              ...otherMems.map((m: any) => m.project_id),
            ].filter(Boolean).map(String)));
            const projMap: Record<string, string> = {};
            if (projIds.length) {
              try {
                const { data: projs } = await supabase
                  .from("imphq_projects")
                  .select("id,name")
                  .in("id", projIds);
                (projs || []).forEach((p: any) => { projMap[String(p.id)] = p.name; });
              } catch (_) { /* non-critical */ }
            }
            const projName = (id: any) => projMap[String(id)] || `projeto ${String(id).slice(0,6)}`;

            if (otherVendas.length) {
              const compras = otherVendas.slice(0, 5).map((v: any) => {
                const dt = v.created_at ? new Date(v.created_at).toLocaleDateString("pt-BR") : "";
                return `${v.produto_nome || "produto"} (${projName(v.project_id)}${dt ? `, ${dt}` : ""})`;
              }).join(" | ");
              xLines.push(`- 🌐 Já comprou em OUTROS projetos: ${compras} — esse lead já confia em nós; trate com proximidade e ofereça upgrade alinhado ao histórico.`);
            }
            if (otherLeads.length) {
              const dores = otherLeads
                .map((l: any) => l.dor_principal)
                .filter(Boolean)
                .slice(0, 3);
              if (dores.length) xLines.push(`- 🌐 Dores conhecidas em outros projetos: ${dores.join(" | ")}`);
              const objs = otherLeads
                .map((l: any) => l.objecao_atual)
                .filter(Boolean)
                .slice(0, 3);
              if (objs.length) xLines.push(`- 🌐 Objeções já registradas em outros projetos: ${objs.join(" | ")}`);
              const niveis = otherLeads
                .map((l: any) => l.nivel_qualificacao)
                .filter(Boolean);
              if (niveis.length) xLines.push(`- 🌐 Já foi classificado como: ${Array.from(new Set(niveis)).join(", ").toUpperCase()}`);
            }
            if (otherMems.length) {
              const insights = otherMems.slice(0, 4).map((m: any) => {
                const c = String(m.content || "").slice(0, 140);
                return `[${m.memory_type || "obs"} · ${projName(m.project_id)}] ${c}`;
              });
              xLines.push(`- 🌐 Insights de IA em outros projetos:\n  • ${insights.join("\n  • ")}`);
            }

            if (xLines.length) {
              crossProjectMemoryBlock = `\n🌐 MEMÓRIA CROSS-PROJETO (mesmo número em outros funis — use com discrição, NÃO mencione os outros projetos pelo nome, mas use o contexto para personalizar):\n${xLines.join("\n")}\n`;
            }
          }
        }
      } catch (xErr: any) {
        console.warn("[wa-ai-reply] cross-project memory error:", xErr?.message);
      }


      // 7.1. Extração universal de dados do lead a partir da mensagem (todos os projetos).
      // Captura email/nome/profissão/dor/objeção/etc e persiste em imphq_leads sem sobrescrever.
      let extractionResult: Awaited<ReturnType<typeof extractAndPersistLeadData>> | null = null;
      const leadForExtraction = leadRow || lead;
      if (leadForExtraction?.id && message) {
        try {
          extractionResult = await extractAndPersistLeadData(supabase, leadForExtraction, message);
          // Reflete mudanças no objeto em memória para o resto do fluxo enxergar
          if (extractionResult.detectedEmail && !leadForExtraction.email) {
            if (leadRow) leadRow.email = extractionResult.detectedEmail;
            if (lead) (lead as any).email = extractionResult.detectedEmail;
          }
        } catch (e: any) {
          console.warn(`[wa-ai-reply] lead data extraction error: ${e?.message}`);
        }
      }

      // 7.2. JP FREITAS — pré-fetch CRM bridge (escopo isolado ao projeto jp_freitas)
      let jpCrmContextBlock = "";
      let jpEmailKnown = false;
      let jpEffectiveEmail = "";
      let jpHasAccount = false;
      if (isJPProject(project_id)) {
        const storedEmail: string = (lead?.email || leadRow?.email || "").trim().toLowerCase();
        const detectedEmail = extractionResult?.detectedEmail || "";
        jpEffectiveEmail = detectedEmail || storedEmail || "";

        try {
          const phoneForLookup = conv?.phone || phone || "";
          const resolved = await jpResolveLead({ email: jpEffectiveEmail, phone: phoneForLookup });
          if (resolved.lookup && resolved.lookup.ok !== false) {
            // Se descobrimos email via phone, persiste no lead (sem sobrescrever)
            if (resolved.source === "phone" && resolved.emailFound && !storedEmail && lead?.id) {
              jpEffectiveEmail = resolved.emailFound;
              try {
                await supabase.from("imphq_leads").update({ email: resolved.emailFound }).eq("id", lead.id).is("email", null);
              } catch {}
            }
            if (resolved.emailFound) jpEffectiveEmail = resolved.emailFound;
            jpCrmContextBlock = jpBuildContextBlock(resolved.lookup, jpEffectiveEmail);
            const data = resolved.lookup?.data || resolved.lookup;
            jpHasAccount = !!(data?.has_account ?? data?.user_exists);
            console.log(`[wa-ai-reply] JP_FREITAS lookup ok via=${resolved.source} email=${jpEffectiveEmail}`);
          } else {
            console.log(`[wa-ai-reply] JP_FREITAS lookup vazio (email=${jpEffectiveEmail || "—"} phone=${phoneForLookup || "—"})`);
          }
        } catch (e: any) {
          console.warn(`[wa-ai-reply] JP_FREITAS lookup error: ${e?.message}`);
        }

        jpEmailKnown = !!jpEffectiveEmail;
        if (!jpEmailKnown) {
          console.log(`[wa-ai-reply] JP_FREITAS: lead sem email — IA deve pedir proativamente`);
        }
      }

      // 7.2.1. Momento atual (lead OU aluna) — injeta o estado salvo da última conversa
      let momentoBlock = "";
      try {
        const intent = (conv as any)?.current_intent || "";
        const emotion = (conv as any)?.emotional_state || "";
        const objection = (conv as any)?.last_objection || "";
        if (intent || emotion || objection) {
          const tipo = jpHasAccount ? "ALUNA" : "LEAD";
          momentoBlock = `\n🧭 MOMENTO ATUAL DA ${tipo} (último estado lido):\n`;
          if (intent) momentoBlock += `- Intenção: ${intent}\n`;
          if (emotion) momentoBlock += `- Estado emocional: ${emotion}\n`;
          if (objection) momentoBlock += `- Última objeção: ${objection}\n`;
          momentoBlock += `Adapte tom e CTA: descoberta=educar curto; consideracao=mostrar prova; decisao=fechar; objecao=quebrar a barreira específica acima; pronto_para_comprar=enviar checkout direto; suporte=resolver problema sem vender.\n`;
        }
      } catch {}


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
      let projectRulesBlock = "";

      // 7.0.1. Regras permanentes do projeto — RAG: top-K por similaridade + guardrails (unavailable)
      // + sticky A/B: cada conversa sempre vê a mesma variante de um ab_group
      try {
        const ruleEmb = await getCachedEmbedding(supabase, message);
        let rules: any[] = [];
        if (ruleEmb) {
          const { data: matched, error: matchErr } = await supabase.rpc("match_wa_rules", {
            p_project_id: project_id,
            p_query_embedding: ruleEmb,
            p_match_count: 5,
            p_threshold: 0.45,
          });
          if (matchErr) console.warn("[wa-ai-reply] match_wa_rules err:", matchErr.message);
          rules = matched || [];
        }
        // fallback: se sem embedding, carrega tudo ativo
        if (rules.length === 0) {
          const { data: all } = await supabase
            .from("imphq_wa_project_rules")
            .select("id, rule_text, rule_type, ab_group_id, ab_status")
            .eq("project_id", project_id)
            .eq("active", true)
            .order("created_at", { ascending: false })
            .limit(40);
          rules = all || [];
        }

        // sticky A/B por conversa: para cada ab_group_id, escolhe 1 variante de forma determinística
        const stickyHash = (s: string) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
          return Math.abs(h);
        };
        const byGroup = new Map<string, any[]>();
        const noGroup: any[] = [];
        for (const r of rules) {
          if (r.ab_group_id && (r.ab_status === "control" || r.ab_status === "variant")) {
            const arr = byGroup.get(r.ab_group_id) || [];
            arr.push(r);
            byGroup.set(r.ab_group_id, arr);
          } else {
            noGroup.push(r);
          }
        }
        const chosen: any[] = [...noGroup];
        for (const [gid, variants] of byGroup) {
          variants.sort((a, b) => String(a.id).localeCompare(String(b.id)));
          const pick = stickyHash(`${conversation_id}|${gid}`) % variants.length;
          chosen.push(variants[pick]);
        }

        if (chosen.length > 0) {
          const behaviorRules = chosen.filter((r: any) => r.rule_type !== "unavailable_product");
          const unavailableRules = chosen.filter((r: any) => r.rule_type === "unavailable_product");
          projectRulesBlock = "\n📜 REGRAS RELEVANTES DO PROJETO (NUNCA VIOLAR):\n" +
            behaviorRules.map((r: any) => `- ${r.rule_text}`).join("\n");
          if (unavailableRules.length > 0) {
            projectRulesBlock += "\n\n🚫 PRODUTOS/EVENTOS INDISPONÍVEIS (NÃO OFERECER):\n" +
              unavailableRules.map((r: any) => `- ${r.rule_text}`).join("\n");
          }
          projectRulesBlock += "\n";

          // increment + log de aplicações (best-effort)
          const ids = chosen.map((r: any) => r.id);
          supabase.rpc("increment_wa_rules_applied", { p_ids: ids }).then(() => null, () => null);

          const leadKey = leadRow?.id || phone || null;
          if (leadKey) {
            const rows = chosen.map((r: any) => ({
              rule_id: r.id,
              ab_group_id: r.ab_group_id || null,
              project_id,
              conversation_id,
              lead_id: leadKey,
            }));
            supabase.from("imphq_wa_rule_applications").insert(rows).then(() => null, () => null);
          }
        }
      } catch (e: any) {
        console.warn("[wa-ai-reply] project_rules RAG error:", e.message);
      }


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

      if (!activeStep || activeStep.ia_search_files !== false) {
        try {
          const embedding = await getCachedEmbedding(supabase, message);
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
      // Enriquecido com público-alvo/descrição/prioridade para permitir recomendação inteligente
      let productLinkMapBlock = "";
      if (d && Array.isArray(d.produtos) && d.produtos.length > 0) {
        const entries = d.produtos
          .map((p: any) => {
            const link = p.link_checkout || p.link || (Array.isArray(p.links) && p.links[0]) || (typeof p.links === 'string' ? p.links : null);
            if (!link || !p.nome) return null;
            const price = p.preco ? ` · R$ ${p.preco}` : "";
            const publico = p.publico_alvo || p.target || p.para_quem || "";
            const nivel = p.nivel || p.level || "";
            const desc = (p.descricao_curta || p.descricao || "").toString().slice(0, 120);
            const tag = p.tipo === "orderbump" ? " [orderbump]" : p.tipo === "downsell" ? " [downsell/entrada]" : p.tipo === "upsell" ? " [upsell]" : (p.principal || p.tipo === "principal") ? " [principal]" : "";
            const extras = [publico && `pra: ${publico}`, nivel && `nível: ${nivel}`, desc].filter(Boolean).join(" · ");
            return `  - "${p.nome}"${price}${tag} → ${link}${extras ? `\n      ${extras}` : ""}`;
          })
          .filter(Boolean);
        if (entries.length > 0) {
          productLinkMapBlock = `\nCATÁLOGO DE PRODUTOS (use EXATAMENTE estes links, nunca invente):\n${entries.join("\n")}\n\nREGRA DE RECOMENDAÇÃO:\n- Antes de sugerir/enviar link, compare o momento do lead (nível/objetivo/orçamento se souber) com o público-alvo de cada produto.\n- Se o principal for MUITO acima do momento dele (ex: iniciante vs avançado, orçamento apertado vs ticket alto), ofereça primeiro o produto de entrada/downsell com racional curto ("pra você começar leve") e só suba se ele quiser mais.\n- Nunca liste 4 produtos de uma vez — recomende 1 (ou no máx 2 comparando) com motivo concreto.\n\nREGRA DE ENVIO DE LINK:\n- Se o lead JÁ PEDIU link/preço/checkout/"quero comprar" → envie direto.\n- Caso contrário, ANTES de mandar o link, pergunte em 1 linha se ele quer que você mande ("Posso te enviar o link agora?" ou "Quer que eu já te mando o checkout?"). Só dispare o link depois do "sim/pode/manda/quero".\n`;
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
      const closerActivated = (hasBuyIntent || isHotLead) && closerEnabled && !isConsultiveProductQuery;

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

      // Âncora temporal — IA não sabe a data real sem isso
      const nowBR = new Date();
      const fmtDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(nowBR);
      const fmtTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(nowBR);
      const fmtWeekday = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(nowBR);
      const fmtMonthYear = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(nowBR);
      const temporalAnchorBlock = `
CONTEXTO TEMPORAL (FONTE DE VERDADE — IGNORE QUALQUER DATA QUE VOCÊ "ACHE" QUE SABE):
- Agora: ${fmtDate} ${fmtTime} (America/Sao_Paulo, ${fmtWeekday})
- Mês atual: ${fmtMonthYear}
REGRAS DE DATA:
- NUNCA invente data, prazo, edição, turma, lançamento, live ou webinar. Só cite data se estiver EXPLICITAMENTE no CONTEXTO DO PROJETO / FAQ / produto abaixo.
- Antes de citar qualquer data presente no contexto, compare com "Agora". Se já passou, NÃO ofereça como futura — diga que vai confirmar com a equipe e adicione [TRANSICAO_HUMANA].
- Proibido usar "ano que vem", "mês que vem", "próxima turma em X", "no próximo dia X" sem fonte explícita no contexto.
- Se o lead perguntar data de evento/turma e não houver fonte explícita: NÃO chute. Peça o e-mail para confirmação e adicione [TRANSICAO_HUMANA].
`;

      // Regras de sentimentos e limite de interações para Transição Humana
      const sentimentRules = `
⚠️ TRANSIÇÃO HUMANA PREDITIVA (REGRAS CRÍTICAS):
Analise o sentimento e a intenção do lead na última resposta dele. Se você detectar:
1. Irritação extrema, agressividade, grosseria, deboche ou frustração severa com a conversa automática.
2. Solicitação direta de reembolso, cancelamento de compra, reclamação de cobrança ou ameaças jurídicas/reclamação formal.
3. Pedido direto para falar com um atendente humano ("passa para um humano", "quero falar com uma pessoa", etc.).
Você deve responder de forma pacífica, acolhedora e prestativa, pedindo desculpas sinceras e curtas pelo inconveniente, informando que um especialista humano já está assumindo a conversa. No final dessa resposta, adicione exatamente a tag secreta: [TRANSICAO_HUMANA]

🤖 LEAD SUSPEITA / ACUSA QUE É IA ("você é um bot", "isso é IA", "robô", "você não é real", "você não tem condição de me ajudar", "tá respondendo automático", "fala sério que isso é humano"):
- NÃO negue, NÃO confirme, NÃO use frase corporativa de cortesia ("estou à disposição", "compreendo sua percepção", "fico à disposição").
- Responda em 1 frase curta, humana e desarmada (ex: "tô aqui sim — me conta o que tá pegando que eu te ajudo de verdade").
- NÃO repita o nome do lead nessa resposta.
- Adicione no FINAL exatamente: [TRANSICAO_HUMANA]
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
- "Certo,", "Certo!", "Certo.", "Compreendo", "Compreendo sua percepção", "Compreendo perfeitamente", "Compreendo seu ponto"
- "Sinto muito que se sinta assim", "Lamento que", "Lamento muito"
- "Faz todo sentido", "Faz sentido você", "Imagina!", "Imagina,", "Que legal", "Que ótimo", "Entendo perfeitamente"
- "Estou à disposição", "Fico à disposição", "À disposição", "Posso te ajudar com alguma dúvida", "Como posso te ajudar"
Essas frases são marcas registradas de bot. Comece a resposta indo direto ao ponto.

NOMINAÇÃO:
- Use o NOME do lead com PARCIMÔNIA. Pessoa real não repete o nome a cada mensagem.
- Cumprimento com nome ("Oi Maria!", "Olá João!") SÓ na PRIMEIRA mensagem ou retomada após silêncio longo. Nas mensagens seguintes, NÃO cumprimente — vá direto à resposta.
- Se já cumprimentou nesta conversa, NÃO cumprimente de novo.
- NUNCA repita o nome do lead em mensagens consecutivas. Se você usou o nome dele na resposta anterior, esta vai SEM nome.

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
- Em (A) confirmação/operacional: máximo 3 frases curtas.
- Em (B) descoberta/dúvida aberta: pode chegar a 6 frases, narrativa Sugamele liberada.
- Em (C) objeção forte/lead frio: pode chegar a 8 frases, progressão narrativa permitida.
- Em (D) lead acusa de bot e (E) pagamento: as regras específicas dos blocos vencem — mantém curto.
- REGRA DE OURO: fora de (B) e (C), nunca responda com mais que o DOBRO de palavras que o lead acabou de mandar.
`;

      const sugameleStyleRules = `
ESTILO DE ESCRITA (REGRAS SUGAMELE — OBRIGATÓRIO EM TODA RESPOSTA):
A resposta deve soar como CONVERSA REAL, não artigo, não texto de IA.
- Conectivos entre ideias: E, Mas, Só que aí, Então, E olha, Agora, Porque daí, Sendo que. Proibido frase telegráfica do tipo "Comprou. Aprendeu. Tentou." — sempre fluir.
- Artigo antes de todo substantivo ("uma mentoria", "o funil", "a copy"), não "Comprou mentoria".
- Reticências (…) para ritmo de fala quando houver reflexão, suspense ou quebra de expectativa.
- Pergunta de engajamento curta quando fizer sentido ("faz sentido?", "sabe o que acontece?", "você já percebeu isso?") — não em toda mensagem.
- ESPECIFICIDADE EXTREMA: use números, prazos, valores, exemplos concretos. Proibido genérico ("bons resultados", "muita gente", "vários alunos"). Forte: "gerou R$ 12.300 com R$ 480 de tráfego em 14 dias".
- Sem dicotomia simplista ("não é X, é Y"). Mostre nuance.
- Imagens mentais em vez de rótulos. Em vez de "você está confuso" → "você roda, roda, roda e termina o dia sem saber qual foi o próximo passo".
- Progressão narrativa quando couber (modo B/C): "No início… Depois… E foi aí que… Agora…".
- Parênteses curtos para contexto (principalmente quando ajudar a fluir).
- Coloquial natural: "tá", "tô", "pra", "na prática", "de tudo que é jeito", "gastou uma nota". Sem vulgaridade.
- Transparência: pode dizer "não dá pra explicar tudo aqui" ou "vou resumir pra não virar um livro".
- PROIBIDO: travessão (—), adjetivo vazio (incrível, transformador, revolucionário, profundo, verdadeiro) sem contexto objetivo, frase de efeito que não empurra a conversa.
- CTA conversacional, nunca interrupção. Errado: "Compre agora". Certo: "se isso fizer sentido pra você, dá uma olhada aqui embaixo e me chama que eu te ajudo a fechar".
- Em conflito com REGRAS DE COMUNICACAO HUMANA acima, as humanas vencem (especialmente nominação e abertura).
`;

      const jpBypassPayment = isJPProject(project_id) && jpHasAccount && !!jpEffectiveEmail;
      const paymentConfirmationBlock = isPaymentConfirmation ? (jpBypassPayment ? `

💸 LEAD JP FREITAS COM ACESSO ATIVO — INSTRUÇÃO PRIORITÁRIA:
O CRM confirma que este lead JÁ TEM conta e acesso ativo. NÃO peça comprovante, NÃO pergunte qual curso ele comprou, NÃO peça o email de novo.
Sua ÚNICA missão NESTA resposta:
1. Frase curta acolhedora reconhecendo o acesso já liberado (cite o programa pelo nome se estiver no STATUS acima).
2. Enviar o link mágico direto: [JP_MAGIC_LINK:${jpEffectiveEmail}]
3. Adicionar [JP_LOG:${jpEffectiveEmail}|wpp_acesso_liberado_via_bridge] no final (silencioso).
Máximo 2 frases. Sem perguntas.
` : `

💸 LEAD CONFIRMOU PAGAMENTO — INSTRUÇÃO PRIORITÁRIA (SOBRESCREVE TUDO ABAIXO):
O lead acabou de avisar que pagou${recentVendaContext?.produto_nome ? ` o produto "${recentVendaContext.produto_nome}"` : ""}${recentVendaContext?.status ? ` (status atual no sistema: ${recentVendaContext.status})` : ""}.
Sua ÚNICA missão NESTA resposta:
1. Comemorar em 1 frase curta e calorosa o passo dado (ex: "Que ótimo! Seja muito bem-vindo(a) 🎉").
2. Explicar brevemente que o sistema confirma automaticamente (Pix: minutos; cartão: imediato; boleto: até 2 dias úteis) e que o acesso/email de boas-vindas chega logo em seguida.
${recentVendaContext && ["pix_gerado","boleto_gerado","aguardando_pagamento","pendente"].includes(recentVendaContext.status) ? `3. Como o pagamento ainda consta como pendente aqui, peça gentilmente o comprovante OU o email usado na compra para conferir.\n` : `3. Se ele tiver alguma dúvida sobre o acesso, peça o email usado na compra.\n`}REGRAS RÍGIDAS:
- NÃO mande link de checkout novamente.
- NÃO tente vender mais nada agora.
- NÃO faça pergunta de qualificação ou triagem.
- Máximo 2 a 3 frases curtas. Tom acolhedor e humano.
`) : "";

      const consultiveBlock = (isConsultiveProductQuery && !isPaymentConfirmation) ? `

🧭 MODO CONSULTIVO ATIVADO — INSTRUÇÃO PRIORITÁRIA (SOBRESCREVE recovery/closer):
O lead pediu ajuda para ESCOLHER entre os cursos/produtos disponíveis (ex: "tem vários cursos, qual se encaixa pra mim", "qual indica?", "tô na dúvida").
Sua missão NESTA resposta:
1. NÃO mande link de checkout ainda. NÃO empurre recuperação de carrinho abandonado.
2. Liste de 2 a 4 cursos do catálogo (use os nomes EXATOS do MAPEAMENTO PRODUTO → LINK abaixo), 1 linha por curso, formato: "• Nome — pra quem é (1 linha)".
3. Termine com UMA pergunta diagnóstica curta (ex: "Você já corta há quanto tempo?" ou "Qual sua maior dificuldade hoje: técnica, finalização ou colorimetria?").
4. Só envie link DEPOIS que o lead responder a pergunta diagnóstica na próxima troca.
5. Use a base de conhecimento (FAQ/aulas) pra descrever cada curso com 1 detalhe concreto, nunca genérico.
Máximo 6 linhas no total.
` : "";

      const systemPrompt = `${temporalAnchorBlock}${paymentConfirmationBlock}${consultiveBlock}${expertPersona}Voce e um consultor especialista em vendas pelo WhatsApp, atendendo para "${project?.name || project_id}".
${selectedPersonalityText}
${toneMap[aiConfig.tone] || toneMap.amigavel}
${leadGreeting}
${leadContextBlock}${leadLongMemoryBlock}${crossProjectMemoryBlock}${campaignContextBlock}${jpCrmContextBlock}${momentoBlock}
${humanizationRules}${anglesPromptBlock()}
ESTRUTURA ADAPTATIVA — identifique o ESTADO do lead antes de responder:

(A) LEAD QUE JÁ SABE O QUE QUER E EXPLICITAMENTE PEDIU AVANÇO (perguntou PREÇO, pediu LINK, disse "quero comprar"/"quero fechar", pediu PIX, mandou comprovante):
→ Vá DIRETO. Responda objetivamente e apresente o próximo passo (link, forma de pagamento).
→ NÃO valide com frase de empatia, NÃO faça triagem, NÃO termine com pergunta de avanço se a info já leva ele pro checkout.
→ Ex: lead pergunta "qual o valor do Master Cuts?" → "R$ 1.997,00. Link: [URL]" — e PARA. Sem "Faz todo sentido querer saber...".
→ ATENÇÃO: apenas citar o nome de um curso/produto NÃO é modo A. "Quero informações sobre X" é modo B (descoberta), não modo A.

(B) LEAD EM DESCOBERTA (mensagem genérica OU pediu informações sobre um curso/produto sem ainda perguntar preço/link: "oi", "quero saber mais", "como funciona", "me explica", "gostaria de informações sobre o curso X"):
→ Atue como SDR — faça UMA pergunta CURTA de triagem por vez para qualificar ANTES de empurrar oferta.
→ Exemplos: "Você já trabalha com cabelo ou tá começando?", "Tá buscando mais técnica ou gestão do salão?", "Pra hoje, presencial ou online?"
→ NUNCA empilhe 2 perguntas na mesma mensagem. Espere a resposta.
→ NÃO mande data, preço, link ou descrição completa de evento na PRIMEIRA resposta. Faça ao menos 1 pergunta de qualificação antes.

(C) LEAD COM OBJEÇÃO ou EMOÇÃO ("tá caro", "vou pensar", "não tenho tempo", desabafo):
→ Empatia REAL (não frase pronta) + 1 frase com argumento concreto + convite suave.
→ Acolha a emoção em 1 linha curta, depois retome o foco com 1 dado que rebate.

REGRA META — VARIAR:
- Se você fez pergunta nas 2 últimas respostas suas, a próxima vai SEM pergunta. Só responda.
- Não toda resposta precisa terminar em pergunta. Pessoa real às vezes só responde e deixa o lead conduzir.
- Se a info responde o lead por completo, encerre. NÃO force avanço.

REGRAS CRITICAS:
- AO ENVIAR LINK DE CHECKOUT: na mesma mensagem, antecipe em 1 frase curta as 2-3 dúvidas mais comuns que o lead pode ter (forma de pagamento aceita, parcelamento, garantia, prazo de acesso) — só as relevantes pro projeto. Termine convidando a tirar QUALQUER dúvida específica antes de finalizar, em vez do genérico "se tiver dúvida me fala". Ex: "Aceita Pix, cartão em até 12x e tem 7 dias de garantia. Se tiver dúvida sobre conteúdo, acesso ou pagamento antes de fechar, me fala que te ajudo agora."
- MANTER O LEAD NA ROTA: Se o lead desviar para conversas aleatórias, assuntos pessoais não relacionados, ou desabafos que fujam da venda/solução, aja com empatia imediata (máximo 1 frase validando ou acolhendo o sentimento), mas em seguida retome o foco principal, conectando a dor dele com a solução/oferta e fazendo uma pergunta consultiva. Evite alongar-se em conversas vazias que esfriam o lead.
- NUNCA use placeholders como [Link] ou [Nome do curso]. Se nao souber algo, diga que vai buscar.
- NUNCA seja vago. Ex: ruim: "o curso e focado em corte". Bom: "o curso ensina 7 tecnicas de corte que funcionam em cabelos lisos e cacheados".
- Respostas curtas no WhatsApp por padrão, MAS a regra de tamanho condicional por modo (A/B/C/D/E) descrita acima manda — em descoberta/objeção pode chegar a 6-8 frases com narrativa Sugamele.
- Nunca revele que e IA.
- Responda em portugues brasileiro natural seguindo as REGRAS SUGAMELE de estilo.
${sugameleStyleRules}
${sentimentRules}
${draggingRules}
${offTopicBlock}
${ctx ? `\nCONTEXTO DO PROJETO:\n${ctx}` : ""}${projectRulesBlock}${productFocus}${productLinkMapBlock}${pixBlock}${customInstr}${bannedBlock}${faqBlock}${lessonsBlock}${memoryBlock}${objectionsBlock}${closerBlock}${openFlowBlock}${isJPProject(project_id) ? jpBuildInstructionsBlock(jpEmailKnown) : ""}`.trim();

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

      let model = aiConfig.ai_model || "google/gemini-2.5-flash";
      if (activeStep?.ia_search_web) {
        model = "google/gemini-2.5-flash"; // native search grounding on OpenRouter
      } else if (activeStep?.ia_model) {
        model = activeStep.ia_model === "gpt-4o" ? "openai/gpt-4o" : "google/gemini-2.5-flash";
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

      // JP FREITAS — processa tags [JP_MAGIC_LINK:...], [JP_TAG:...], [JP_LOG:...], [JP_GRANT:...]
      if (isJPProject(project_id) && /\[JP_(MAGIC_LINK|TAG|LOG|GRANT):/i.test(finalAiReply)) {
        try {
          finalAiReply = await jpProcessTags(finalAiReply, jpEffectiveEmail);
        } catch (e: any) {
          console.error(`[wa-ai-reply] jpProcessTags error: ${e?.message}`);
        }
      }

      // JP FREITAS — REDE DE SEGURANÇA: se sabemos o email e o lead pediu acesso mas
      // a IA mandou o domínio cru (sem magic link real), gera o link e substitui.
      if (isJPProject(project_id) && jpEffectiveEmail && finalAiReply) {
        try {
          const userMsg = String(message || "").toLowerCase();
          const accessIntent = /(acesso|acessar|entrar|logar|login|senha|plataforma|área de membros|area de membros|curso|aula|não consigo|nao consigo)/i.test(userMsg);
          const hasRawDomain = /https?:\/\/(www\.)?jphaireducation\.com\.br\/?(\s|$|[^\/\w])/i.test(finalAiReply);
          const hasMagicLink = /jphaireducation\.com\.br\/[^\s]+/i.test(finalAiReply) && !/jphaireducation\.com\.br\/?(\s|$)/i.test(finalAiReply.replace(/jphaireducation\.com\.br\/[a-z0-9\-_?=&%\.]+/gi, "MAGIC"));
          if (accessIntent && hasRawDomain && !hasMagicLink) {
            const res = await jpIssueMagicLink(jpEffectiveEmail);
            const link = res?.magic_link || res?.link || res?.url || res?.data?.magic_link || res?.data?.link;
            if (link) {
              finalAiReply = finalAiReply.replace(/https?:\/\/(www\.)?jphaireducation\.com\.br\/?/gi, link);
              jpLogEvent(jpEffectiveEmail, "wpp_auto_magic_link_fallback", { source: "wa-ai-reply" }).catch(() => {});
              console.log(`[wa-ai-reply] JP_FREITAS fallback magic_link injetado para ${jpEffectiveEmail}`);
            } else {
              console.warn(`[wa-ai-reply] JP_FREITAS fallback magic_link falhou para ${jpEffectiveEmail}`);
            }
          }
        } catch (e: any) {
          console.error(`[wa-ai-reply] JP_FREITAS fallback error: ${e?.message}`);
        }
      }

      // JP FREITAS — REDE DE SEGURANÇA 2: se o lead JÁ TEM acesso ativo (bridge confirmou)
      // e a IA ainda pediu comprovante / perguntou qual curso comprou / pediu email de novo,
      // sobrescreve por resposta correta com magic link.
      if (isJPProject(project_id) && jpHasAccount && jpEffectiveEmail && finalAiReply) {
        try {
          const badPatterns = /(comprovante|qual curso|qual dos dois|qual dos cursos|você comprou o|voce comprou o|me confirma.*compr|me passa.*email|qual email|passa.*e-?mail)/i;
          if (badPatterns.test(finalAiReply)) {
            const res = await jpIssueMagicLink(jpEffectiveEmail);
            const link = res?.magic_link || res?.link || res?.url || res?.data?.magic_link || res?.data?.link;
            if (link) {
              finalAiReply = `Vi seu cadastro aqui e você já tem acesso ativo. Segue o link direto pra entrar sem senha: ${link}`;
              jpLogEvent(jpEffectiveEmail, "wpp_override_pergunta_indevida", { source: "wa-ai-reply", original_snippet: finalAiReply.slice(0, 120) }).catch(() => {});
              console.log(`[wa-ai-reply] JP_FREITAS override pergunta indevida para ${jpEffectiveEmail}`);
            }
          }
        } catch (e: any) {
          console.error(`[wa-ai-reply] JP_FREITAS override error: ${e?.message}`);
        }
      }

      // Prefixo "Bom dia" quando flush invoca esta função (lead mandou fora do horário)
      if (body.from_flush === true && finalAiReply) {
        const prefix = (aiConfig.back_to_hours_prefix || "Bom dia! Voltamos ao atendimento 👋\n\n").trim();
        if (!finalAiReply.toLowerCase().startsWith(prefix.slice(0, 10).toLowerCase())) {
          finalAiReply = `${prefix}\n\n${finalAiReply}`;
          console.log(`[wa-ai-reply] FROM_FLUSH: prefixo de retorno adicionado`);
        }
      }
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
          .select("message_count, last_memory_extract_at, last_memory_extract_msg_count")
          .eq("id", conversation_id)
          .maybeSingle();


        // Detecta se a IA enviou link de checkout/pitch nesta resposta
        // para programar follow-up consultivo automático (wa-pitch-followup).
        const sentUrls = (finalAiReply.match(/https?:\/\/[^\s)]+/gi) || []);
        const pitchHost = paymentLink ? paymentLink.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] : "";
        const isPitchLink = sentUrls.some((u) => {
          const lu = u.toLowerCase();
          if (pitchHost && lu.includes(pitchHost)) return true;
          return /checkout|pay|hotmart|kiwify|monetizze|eduzz|braip|ticto|perfectpay|stripe|comprar|inscri/i.test(lu);
        });

        const updatePayload: any = {
          ai_last_reply_at: new Date().toISOString(),
          ai_lock_until: null,
          last_message: finalAiReply.slice(0, 500),
          last_message_at: new Date().toISOString(),
          last_message_direction: "outgoing",
          message_count: ((freshConv?.message_count as number) || 0) + 1,
        };
        if (isPitchLink) {
          updatePayload.last_pitch_at = new Date().toISOString();
          updatePayload.last_pitch_link = sentUrls[0] || paymentLink || null;
          updatePayload.pitch_followup_stage = 0;
          updatePayload.pitch_followup_last_at = null;
        }

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

        // ====== INTEL UPDATE: intent + emotional state + handoff summary ======
        // Não-bloqueante: erros aqui não devem impedir o sucesso do envio.
        try {
          const intelPrompt = `Voce e um analista de vendas. Leia a ultima mensagem do LEAD e a RESPOSTA da IA. Devolva APENAS JSON (sem markdown, sem texto extra) no formato exato:
{"current_intent":"<descoberta|consideracao|decisao|objecao|pronto_para_comprar|suporte|saudacao|outro>","emotional_state":"<animado|curioso|cetico|frustrado|ansioso|neutro|comprador>","last_objection":"<frase curta da principal objecao do lead OU string vazia se nao houver>"${shouldTransitionToHuman ? `,"handoff_summary":{"status":"<resumo em 1 frase>","dor":"<dor principal>","proxima_acao":"<o que humano deve fazer agora>","score":"<frio|morno|quente>","contexto":"<resumo em 2 frases para o humano entrar pronto>"}` : ""}}

LEAD: """${String(message).slice(0, 800)}"""
IA: """${String(finalAiReply).slice(0, 800)}"""
MOTIVO_HANDOFF: ${shouldTransitionToHuman ? handoffReason : "N/A"}`;

          const intelRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: intelPrompt }],
              temperature: 0.2,
              response_format: { type: "json_object" },
              max_tokens: 400,
            }),
          });

          if (intelRes.ok) {
            const intelJson = await intelRes.json();
            const raw = intelJson?.choices?.[0]?.message?.content || "{}";
            let parsed: any = {};
            try { parsed = JSON.parse(raw); } catch { parsed = {}; }

            const convUpdate: any = {};
            if (parsed.current_intent && typeof parsed.current_intent === "string") {
              convUpdate.current_intent = parsed.current_intent.slice(0, 40);
              convUpdate.intent_updated_at = new Date().toISOString();
            }
            if (shouldTransitionToHuman && parsed.handoff_summary && typeof parsed.handoff_summary === "object") {
              convUpdate.handoff_summary = parsed.handoff_summary;
              convUpdate.handoff_at = new Date().toISOString();
            }
            if (Object.keys(convUpdate).length > 0) {
              await supabase.from("imphq_wa_conversations").update(convUpdate).eq("id", conversation_id);
              console.log(`[wa-ai-reply] Intel updated: ${Object.keys(convUpdate).join(",")}`);
            }

            const emotional = parsed.emotional_state && typeof parsed.emotional_state === "string" ? parsed.emotional_state.slice(0, 40) : null;
            const objection = parsed.last_objection && typeof parsed.last_objection === "string" && parsed.last_objection.trim().length > 0 ? parsed.last_objection.slice(0, 300) : null;
            if (leadRow?.id && (emotional || objection)) {
              await supabase.from("imphq_wa_lead_memories").insert({
                project_id,
                lead_id: leadRow.id,
                phone,
                memory_type: "emotional_snapshot",
                content: `state=${emotional || "?"}; objection=${objection || "-"}`,
                emotional_state: emotional,
                last_objection: objection,
              });
            }
          } else {
            console.warn(`[wa-ai-reply] Intel call failed: ${intelRes.status}`);
          }
        } catch (intelErr: any) {
          console.warn(`[wa-ai-reply] Intel update error:`, intelErr?.message);
        }


        // ====== MEMÓRIA PERIÓDICA (fire-and-forget) ======
        // Dispara wa-memory-extract sem bloquear, com gating:
        //  - precisa de >=6 mensagens na conversa
        //  - E (>=10 min desde última extração) OU (>=4 novas mensagens desde então)
        try {
          const msgCountNow = ((freshConv?.message_count as number) || 0) + 1;
          const lastExtractAt = freshConv?.last_memory_extract_at ? new Date(freshConv.last_memory_extract_at as string).getTime() : 0;
          const lastExtractCount = (freshConv?.last_memory_extract_msg_count as number) || 0;
          const minutesSince = lastExtractAt ? (Date.now() - lastExtractAt) / 60000 : Infinity;
          const newMsgsSince = msgCountNow - lastExtractCount;
          const shouldExtract = msgCountNow >= 5 && (minutesSince >= 8 || newMsgsSince >= 3);
          if (shouldExtract && leadRow?.id) {
            fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-memory-extract`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ conversation_id, lead_id: leadRow.id, project_id }),
            }).catch((e) => console.warn("[wa-ai-reply] memory-extract dispatch failed:", e?.message));
            console.log(`[wa-ai-reply] memory-extract dispatched (msgs=${msgCountNow}, since_last=${newMsgsSince})`);
          }
        } catch (memErr: any) {
          console.warn("[wa-ai-reply] memory-extract gating error:", memErr?.message);
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
