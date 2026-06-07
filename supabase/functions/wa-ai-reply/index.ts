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
    
    const isAudio = body.media_type === "audio" || (body.media_url && (body.media_url.endsWith(".ogg") || body.media_url.endsWith(".mp3") || body.media_url.endsWith(".m4a") || body.media_url.endsWith(".wav")));
    const isImage = body.media_type === "image" || (body.media_url && (body.media_url.endsWith(".png") || body.media_url.endsWith(".jpg") || body.media_url.endsWith(".jpeg") || body.media_url.endsWith(".webp")));
    
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

    if (provider.ai_enabled === false) {
      console.log(`[wa-ai-reply] IA desativada para o provedor ${provider_id} (${provider.instance_name})`);
      return new Response(JSON.stringify({ skipped: "provider_ai_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Busca config de AI (primeiro por provider_id, senão por project_id)
    let aiConfig = null;
    let configErr = null;

    if (provider_id) {
      const { data, error } = await supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("provider_id", provider_id)
        .eq("enabled", true)
        .maybeSingle();
      if (error) {
        console.error("[wa-ai-reply] AI Config query by provider_id error:", error.message);
      } else if (data) {
        aiConfig = data;
        console.log(`[wa-ai-reply] AI Config found for provider_id=${provider_id}`);
      }
    }

    if (!aiConfig) {
      const { data, error } = await supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", project_id)
        .eq("enabled", true);
      configErr = error;
      if (data && data.length > 0) {
        aiConfig = data.find((c: any) => !c.provider_id) || data[0];
        console.log(`[wa-ai-reply] AI Config found for project_id=${project_id} (fallback)`);
      }
    }

    if (configErr) console.error("[wa-ai-reply] Config query error:", configErr.message);

    if (!aiConfig) {
      console.log(`[wa-ai-reply] No enabled AI config for provider_id=${provider_id} or project_id=${project_id}`);
      return new Response(JSON.stringify({ skipped: "no_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica Blacklist de leads
    const cleanPhone = phone.replace(/\D/g, "");
    const isIgnored = (aiConfig.ignored_phones || []).some((p: string) => {
      return p.replace(/\D/g, "") === cleanPhone;
    });

    if (isIgnored) {
      console.log(`[wa-ai-reply] Número destinatário ${phone} está na blacklist do projeto`);
      return new Response(JSON.stringify({ skipped: "ignored_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-ai-reply] Config found: model=${aiConfig.ai_model} draft=${aiConfig.draft_mode} delay=${aiConfig.response_delay_seconds}`);

    // 2. Verifica cooldown e se a conversa está sob atendimento humano
    const { data: conv } = await supabase
      .from("imphq_wa_conversations")
      .select("ai_last_reply_at, ai_lock_until, message_count, contact_name, status, ai_paused_until")
      .eq("id", conversation_id)
      .maybeSingle();

    if (conv?.status === "needs_human") {
      console.log(`[wa-ai-reply] Conversa com status needs_human, ignorando IA`);
      return new Response(JSON.stringify({ skipped: "needs_human" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica pausa manual (humano respondeu recentemente)
    if (conv?.ai_paused_until) {
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
    if (conv?.ai_last_reply_at) {
      const elapsed = (Date.now() - new Date(conv.ai_last_reply_at).getTime()) / 1000;
      if (elapsed < cooldownSec) {
        console.log(`[wa-ai-reply] Cooldown ativo: ${elapsed.toFixed(1)}s < ${cooldownSec}s`);
        return new Response(JSON.stringify({ skipped: "cooldown", elapsed_s: elapsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Tenta adquirir lock — usa SELECT+UPDATE simples (evita bug do .or() no Supabase JS v2)
    if (conv?.ai_lock_until) {
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
      try {
        const cleanPhone = phone.replace(/\D/g, "");
        const searchPhones = [cleanPhone];
        if (cleanPhone.startsWith("55")) {
          searchPhones.push(cleanPhone.substring(2));
        } else {
          searchPhones.push("55" + cleanPhone);
        }

        const { data: lead } = await supabase
          .from("imphq_leads")
          .select("*")
          .eq("project_id", project_id)
          .in("phone", searchPhones)
          .maybeSingle();

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
      if (LOVABLE_API_KEY) {
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
              const { data: matches, error: rpcErr } = await supabase.rpc("match_wa_knowledge", {
                query_embedding: embedding,
                p_project_id: project_id,
                match_count: 3,
                min_similarity: 0.7,
              });
              if (rpcErr) console.error("[wa-ai-reply] match_wa_knowledge RPC error:", rpcErr.message);
              if (matches && matches.length > 0) {
                lessonsBlock = `\nREGRAS E CONHECIMENTOS ADICIONAIS APRENDIDOS:\n` +
                  matches.map((m: any) => `- Se a dúvida/situação for semelhante a "${m.pergunta}", a regra/resposta é: "${m.resposta}"`).join("\n") + "\n";
                console.log(`[wa-ai-reply] ${matches.length} lessons matched semantically`);
              }

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

      const expertPersona = aiConfig.expert_persona ? `PERSONA DO EXPERT:\n${String(aiConfig.expert_persona).slice(0, 600)}\n\n` : "";
      const productFocus = aiConfig.product_focus ? `\nOFERTA ATIVA: ${String(aiConfig.product_focus).slice(0, 400)}` : "";
      const customInstr = aiConfig.custom_instructions ? `\nREGRAS GERAIS ADICIONAIS:\n${String(aiConfig.custom_instructions).slice(0, 600)}` : "";
      const faqBlock = Array.isArray(aiConfig.faq) && aiConfig.faq.length
        ? `\nFAQ OFICIAL:\n${aiConfig.faq.slice(0, 10).map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`).join("\n").slice(0, 800)}`
        : "";

      const personalityMap: Record<string, string> = {
        assistente: "Você é um assistente virtual cordial e prestativo.",
        vendedor: "Você é um closer de vendas persuasivo mas não agressivo.",
        suporte: "Você é um agente de suporte técnico eficiente e empático.",
        consultor: "Você é um consultor especialista. Fale com autoridade.",
      };
      const toneMap: Record<string, string> = {
        profissional: "Tom profissional e direto.",
        casual: "Tom casual e descontraído, use emojis moderadamente.",
        amigavel: "Tom amigável e acolhedor, use emojis.",
        formal: "Tom formal e polido.",
      };

      // CLOSER MODE: injecao de prompt agressivo quando ha intencao de compra
      const closerEnabled = aiConfig.closer_mode_enabled !== false; // default true
      const paymentLink = aiConfig.payment_link || null;
      const closerBlock = (hasBuyIntent && closerEnabled)
        ? `

❗ MODO CLOSER ATIVADO — MISSAO CRITICA:
O lead demonstrou intencao de compra AGORA. Sua unica missao e FECHAR. Regras:
1. Seja direto. Sem rodeios. Sem "vou te passar mais informacoes".
2. Remova a ultima barreira com empatia e seguranca (ex: "muita gente ja comprou e transformou o resultado").
3. ${paymentLink
  ? `Passe ESTE link de pagamento EXATO, sem parafrasear: ${paymentLink}`
  : `NAO invente link. Diga: "Vou te passar o link agora, me da um segundo." e aguarde o humano enviar.`}
4. Se o lead tiver objecao (ex: "e caro"), use 1 frase de contorno e volte ao fechamento.
5. Maximo 3 frases curtas. Nao explique. FECHE.`
        : "";

      // Nome do lead para personalizar
      const leadFirstName = (conv?.contact_name || push_name || "").trim().split(/\s+/)[0] || "";
      const leadGreeting = leadFirstName ? `O nome do lead e "${leadFirstName}". Use o nome dele nas primeiras mensagens da conversa.` : "";

      const systemPrompt = `${expertPersona}Voce e um consultor especialista em vendas pelo WhatsApp, atendendo para "${project?.name || project_id}".
${personalityMap[aiConfig.personality] || personalityMap.consultor}
${toneMap[aiConfig.tone] || toneMap.amigavel}
${leadGreeting}
${leadContextBlock}

METODO OBRIGATORIO — use SEMPRE:
1. EMPATIA: 1 frase que valida a situacao ou desejo do lead (ex: "Faz todo sentido querer isso!")
2. ESPECIFICIDADE: 1-2 frases com dado ou beneficio concreto do produto (NAO seja vago)
3. ENVOLVIMENTO: Feche com 1 pergunta consultiva que avanca a conversa

REGRAS CRITICAS:
- MANTER O LEAD NA ROTA: Se o lead desviar para conversas aleatórias, assuntos pessoais não relacionados, ou desabafos que fujam da venda/solução, aja com empatia imediata (máximo 1 frase validando ou acolhendo o sentimento), mas em seguida retome o foco principal, conectando a dor dele com a solução/oferta e fazendo uma pergunta consultiva. Evite alongar-se em conversas vazias que esfriam o lead.
- NUNCA use placeholders como [Link] ou [Nome do curso]. Se nao souber algo, diga que vai buscar.
- NUNCA seja vago. Ex: ruim: "o curso e focado em corte". Bom: "o curso ensina 7 tecnicas de corte que funcionam em cabelos lisos e cacheados".
- Respostas curtas (maximo 4 linhas no WhatsApp). Sem blocos de texto.
- Nunca revele que e IA.
- Responda em portugues brasileiro natural.
${ctx ? `\nCONTEXTO DO PROJETO:\n${ctx}` : ""}${productFocus}${customInstr}${faqBlock}${lessonsBlock}${memoryBlock}${objectionsBlock}${closerBlock}`.trim();

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

      const model = aiConfig.ai_model || "openai/gpt-4o-mini";
      console.log(`[wa-ai-reply] Chamando OpenRouter model=${model} msgs=${msgs.length} lastRole=${msgs[msgs.length - 1]?.role}`);

      // 9. Chama OpenRouter
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
        await clearLock();
        return new Response(JSON.stringify({ error: `OpenRouter unreachable: ${fetchErr.message}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!orRes.ok) {
        const errText = await orRes.text();
        console.error(`[wa-ai-reply] OpenRouter error ${orRes.status}: ${errText.slice(0, 400)}`);
        await clearLock();
        return new Response(JSON.stringify({ error: `OpenRouter ${orRes.status}`, detail: errText.slice(0, 200) }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orData = await orRes.json();
      const aiReply = (orData?.choices?.[0]?.message?.content || "").trim();
      console.log(`[wa-ai-reply] Resposta recebida length=${aiReply.length}: ${aiReply.slice(0, 100)}`);

      if (!aiReply) {
        console.warn(`[wa-ai-reply] Resposta vazia do OpenRouter`);
        await clearLock();
        return new Response(JSON.stringify({ error: "Empty AI reply", raw: orData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Voice response generation (TTS)
      let responseAudioUrl: string | null = null;
      const voiceReplyEnabled = aiConfig.voice_reply_enabled === true || isAudio;
      const openaiKey = Deno.env.get("OPENAI_API_KEY");

      if (voiceReplyEnabled && openaiKey && aiReply) {
        console.log(`[wa-ai-reply] Generating voice response via OpenAI TTS...`);
        try {
          const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "tts-1",
              input: aiReply,
              voice: aiConfig.voice_name || "alloy",
            }),
          });

          if (ttsRes.ok) {
            const ttsBlob = await ttsRes.blob();
            const fileName = `voice_${Date.now()}.mp3`;
            const filePath = `${project_id}/${fileName}`;
            
            // Ensure media bucket exists
            await supabase.storage.createBucket("media", { public: true }).catch(() => {});
            
            // Upload to Supabase Storage
            const { error: uploadErr } = await supabase.storage
              .from("media")
              .upload(filePath, ttsBlob, { contentType: "audio/mpeg" });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage
                .from("media")
                .getPublicUrl(filePath);
              responseAudioUrl = publicUrlData?.publicUrl || null;
              console.log(`[wa-ai-reply] TTS audio uploaded successfully: ${responseAudioUrl}`);
            } else {
              console.error("[wa-ai-reply] Failed to upload TTS audio to storage:", uploadErr.message);
            }
          } else {
            console.error("[wa-ai-reply] OpenAI TTS failed:", await ttsRes.text());
          }
        } catch (ttsErr: any) {
          console.error("[wa-ai-reply] TTS generation error:", ttsErr.message);
        }
      }

      // 10. Draft mode
      if (aiConfig.draft_mode) {
        await supabase.from("imphq_wa_ai_drafts").insert({
          conversation_id, project_id, incoming_text: message,
          suggested_text: aiReply, model, status: "pending",
        });
        await supabase.from("imphq_wa_conversations").update({
          ai_last_reply_at: new Date().toISOString(), ai_lock_until: null,
        }).eq("id", conversation_id);
        console.log(`[wa-ai-reply] Draft salvo`);
        return new Response(JSON.stringify({ ok: true, draft: true, preview: aiReply.slice(0, 100) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delay configurável
      const delaySec = Number(aiConfig.response_delay_seconds ?? 2);
      if (delaySec > 0) {
        console.log(`[wa-ai-reply] Aguardando ${delaySec}s antes de enviar...`);
        await new Promise((r) => setTimeout(r, Math.min(delaySec * 1000, 10000)));
      }

      let sendSuccess = false;
      let outMsgId: string | null = null;

      if (provider.provider === "evolution") {
        const base = provider.api_url.replace(/\/+$/, "");
        const inst = encodeURIComponent(provider.instance_name);
        
        let url = `${base}/message/sendText/${inst}`;
        let bodyPayload: any = { number: phone + "@s.whatsapp.net", text: aiReply };

        if (responseAudioUrl) {
          url = `${base}/message/sendAudio/${inst}`;
          bodyPayload = {
            number: phone + "@s.whatsapp.net",
            audio: responseAudioUrl,
            options: { delay: 1000, presence: "composing" }
          };
          console.log(`[wa-ai-reply] Enviando ÁUDIO via Evolution: ${url} → ${phone}`);
        } else {
          console.log(`[wa-ai-reply] Enviando TEXTO via Evolution: ${url} → ${phone}`);
        }

        const sendRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify(bodyPayload),
        });
        const sendData = await sendRes.json().catch(() => ({}));
        console.log(`[wa-ai-reply] Evolution status=${sendRes.status} data=${JSON.stringify(sendData).slice(0, 200)}`);

        if (sendRes.ok) {
          sendSuccess = true;
          outMsgId = sendData?.key?.id || null;
        } else {
          console.error(`[wa-ai-reply] Evolution API rejeitou: ${sendRes.status} ${JSON.stringify(sendData).slice(0, 200)}`);
        }
      } else {
        console.warn(`[wa-ai-reply] Provider type '${provider.provider}' não suportado nesta função`);
      }

      if (sendSuccess) {
        await supabase.from("imphq_wa_messages").insert({
          conversation_id, direction: "outgoing", phone,
          content: aiReply, message_type: "text",
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

        await supabase.from("imphq_wa_conversations").update({
          ai_last_reply_at: new Date().toISOString(),
          ai_lock_until: null,
          last_message: aiReply.slice(0, 500),
          last_message_at: new Date().toISOString(),
          last_message_direction: "outgoing",
          message_count: ((freshConv?.message_count as number) || 0) + 1,
        }).eq("id", conversation_id);

        console.log(`[wa-ai-reply] SUCCESS: mensagem enviada para ${phone}`);
        return new Response(JSON.stringify({ ok: true, sent: true, model, preview: aiReply.slice(0, 100) }), {
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
