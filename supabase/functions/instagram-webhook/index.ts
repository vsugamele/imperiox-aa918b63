// Instagram webhook receiver — Meta envia POST com mensagens, comentários, menções
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  // ============ VERIFICAÇÃO (GET handshake) ============
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    // Verify token é parametrizável: passa via ?project=ID e busca no DB
    // OU usa token "imperiohq" universal (mais simples para começar)
    const projectId = url.searchParams.get("project");
    let expected = "imperiohq"; // fallback universal
    if (projectId) {
      const { data } = await supa
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", projectId)
        .eq("provider", "instagram")
        .maybeSingle();
      if (data?.credentials?.webhook_verify_token) expected = data.credentials.webhook_verify_token;
    }
    if (mode === "subscribe" && token === expected) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ============ EVENTOS (POST) ============
  try {
    const payload = await req.json();
    // Loga tudo primeiro (auditoria)
    const { data: logEntry } = await supa.from("imphq_ig_webhook_logs").insert({
      event_type: payload.object || "unknown",
      payload,
      processed: false,
    }).select("id").maybeSingle();

    if (payload.object !== "instagram") {
      if (logEntry) {
        await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
      }
      return new Response("OK", { status: 200 });
    }

    for (const entry of payload.entry || []) {
      const igUserId = entry.id;
      const { data: account } = await supa
        .from("imphq_ig_accounts")
        .select("id, project_id")
        .eq("ig_user_id", igUserId)
        .maybeSingle();
      if (!account) continue;

      // --- MENSAGENS (DMs) ---
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const recipientId = messaging.recipient?.id;
        const isInbound = senderId !== igUserId;
        const participantId = isInbound ? senderId : recipientId;
        if (!participantId) continue;

        const senderUsername = messaging.sender?.username || null;
        const senderName = messaging.sender?.name || null;
        const senderAvatar = messaging.sender?.avatar || null;

        const upsertData: any = {
          account_id: account.id,
          participant_id: participantId,
          last_message: messaging.message?.text || "[mídia]",
          last_message_at: new Date(messaging.timestamp || Date.now()).toISOString(),
        };

        if (senderUsername) upsertData.participant_username = senderUsername;
        if (senderName) upsertData.participant_name = senderName;
        if (senderAvatar) upsertData.participant_avatar = senderAvatar;

        // upsert conversation
        const { data: conv } = await supa
          .from("imphq_ig_conversations")
          .upsert(upsertData, { onConflict: "account_id,participant_id" })
          .select("id, participant_username, participant_name")
          .single();

        if (conv && messaging.message) {
          const content = messaging.message.text || null;
          await supa.from("imphq_ig_messages").insert({
            conversation_id: conv.id,
            direction: isInbound ? "in" : "out",
            type: messaging.message.attachments?.[0]?.type || "text",
            content,
            media_url: messaging.message.attachments?.[0]?.payload?.url || null,
            mid: messaging.message.mid,
            status: "received",
          });

          // AI Direct Message Autoresponder!
          if (isInbound && content) {
            try {
              (async () => {
                try {
                  let aiConfig = null;
                  const { data: configs, error: configErr } = await supa
                    .from("imphq_wa_ai_config")
                    .select("*")
                    .eq("project_id", account.project_id)
                    .eq("enabled", true);
                  if (configErr) {
                    console.error("[ig-webhook] Config query error:", configErr.message);
                  } else if (configs && configs.length > 0) {
                    aiConfig = configs.find((c: any) => !c.provider_id) || configs[0];
                  }

                  if (!aiConfig) {
                    console.log(`[ig-webhook] AI not enabled for project ${account.project_id}`);
                    return;
                  }

                  // 1. Business hours check
                  if (aiConfig.business_hours_only) {
                    const now = new Date();
                    const formatter = new Intl.DateTimeFormat("en-US", {
                      timeZone: "America/Sao_Paulo",
                      hour: "numeric",
                      minute: "numeric",
                      hour12: false,
                    });
                    const parts = formatter.formatToParts(now);
                    const hourVal = parts.find(p => p.type === "hour")?.value;
                    const minuteVal = parts.find(p => p.type === "minute")?.value;
                    const currentHour = Number(hourVal) * 100 + Number(minuteVal);

                    const [sh, sm] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
                    const [eh, em] = (aiConfig.business_hours_end || "20:00").split(":").map(Number);
                    const startNum = sh * 100 + sm;
                    const endNum = eh * 100 + em;
                    if (currentHour < startNum || currentHour > endNum) {
                      console.log(`[ig-webhook] Outside business hours, skipping AI`);
                      return;
                    }
                  }

                  // 2. Escalation keywords check
                  const lc = content.toLowerCase();
                  const isEscalation = (aiConfig.escalation_keywords || []).some((kw: string) =>
                    lc.includes(kw.toLowerCase())
                  );
                  if (isEscalation) {
                    console.log(`[ig-webhook] Escalation keyword detected in DM, skipping AI`);
                    return;
                  }

                  // 3. Cooldown check
                  const cooldownSec = aiConfig.cooldown_seconds ?? 15;
                  const { data: lastAiMsg } = await supa
                    .from("imphq_ig_messages")
                    .select("created_at")
                    .eq("conversation_id", conv.id)
                    .eq("direction", "out")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (lastAiMsg?.created_at) {
                    const last = new Date(lastAiMsg.created_at).getTime();
                    if (Date.now() - last < cooldownSec * 1000) {
                      console.log(`[ig-webhook] AI cooldown active (${cooldownSec}s), skipping`);
                      return;
                    }
                  }

                  // 4. Double-response check: if the last message in history is from us, skip
                  const { data: recentMsgs } = await supa
                    .from("imphq_ig_messages")
                    .select("direction")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(2);
                  if (recentMsgs && recentMsgs.length > 0 && recentMsgs[0].direction === "out") {
                    console.log(`[ig-webhook] Last message was outgoing, skipping to prevent double reply`);
                    return;
                  }

                  // Fire triage (fire-and-forget) + read last triage for this IG conversation
                  let lastIgTriage: any = null;
                  try {
                    const { data: tr } = await supa
                      .from("imphq_wa_triage")
                      .select("intent, sentiment, fit_score, desejo_schwartz, ai_response")
                      .eq("conversation_id", conv.id)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    lastIgTriage = tr;
                  } catch (_) {}
                  supa.functions.invoke("wa-ai-triage", {
                    body: { message: content, conversation_id: conv.id, projeto_id: account.project_id },
                  }).catch(() => {});

                  // Build project context
                  let projectContext = "";
                  const { data: project } = await supa
                    .from("imphq_projects")
                    .select("name, data, avatar, brand_kit, user_id")
                    .eq("id", account.project_id)
                    .single();

                  if (project) {
                    const sources = aiConfig.context_sources || [];
                    const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
                    if (sources.includes("briefing") && d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 600)}\n`;
                    if (sources.includes("produtos") && d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 600)}\n`;
                    if (sources.includes("avatar") && project.avatar) projectContext += `Avatar: ${JSON.stringify(project.avatar).slice(0, 400)}\n`;
                    if (sources.includes("branding") && project.brand_kit) projectContext += `Branding: ${JSON.stringify(project.brand_kit).slice(0, 400)}\n`;
                    if (sources.includes("copy_arsenal")) {
                      const ca = d.copy_arsenal || (d.produtos?.[0]?.copy_arsenal);
                      if (ca) projectContext += `Copy Arsenal: ${JSON.stringify(ca).slice(0, 400)}\n`;
                    }
                    if (sources.includes("expert")) {
                      const ex = d.expert || d.especialista;
                      if (ex) projectContext += `Expert: ${JSON.stringify(ex).slice(0, 400)}\n`;
                    }
                    if (sources.includes("faq") && Array.isArray(aiConfig.faq) && aiConfig.faq.length) {
                      const faqStr = aiConfig.faq
                        .slice(0, 20)
                        .map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`)
                        .join("\n");
                      projectContext += `FAQ OFICIAL:\n${faqStr.slice(0, 1200)}\n`;
                    }
                  }

                  // RAG search in imphq_wa_knowledge (using OpenRouter openai/text-embedding-3-small)
                  let ragBlock = "";
                  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
                  try {
                    if (OPENROUTER_API_KEY && content.length > 8) {
                      const embRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: content, dimensions: 768 }),
                      });
                      if (embRes.ok) {
                        const { data: ed } = await embRes.json();
                        const qEmb = ed?.[0]?.embedding;
                        if (qEmb) {
                          const { data: matches } = await supa.rpc("match_wa_knowledge", {
                            query_embedding: qEmb, p_project_id: account.project_id, match_count: 3, min_similarity: 0.72,
                          });
                          if (matches && matches.length) {
                            ragBlock = "\n\nRESPOSTAS DE REFERÊNCIA DO TIME:\n" +
                              matches.map((m: any, i: number) => `Ref ${i + 1}:\nPergunta: ${m.pergunta}\nResposta: ${m.resposta}`).join("\n\n");
                          }
                        }
                      }
                    }
                  } catch (e: any) { console.warn("[ig-webhook] RAG skip:", e?.message); }

                  const personalityPrompts: Record<string, string> = {
                    assistente: "Você é um assistente virtual cordial e prestativo.",
                    vendedor: "Você é um closer de vendas persuasivo mas não agressivo. Foque em entender a dor e apresentar a solução.",
                    suporte: "Você é um agente de suporte técnico eficiente e empático.",
                    consultor: "Você é um consultor especialista. Fale com autoridade e dê recomendações valiosas.",
                  };

                  const toneInstructions: Record<string, string> = {
                    profissional: "Tom profissional e direto.",
                    casual: "Tom casual e descontraído, use emojis moderadamente.",
                    amigavel: "Tom amigável e acolhedor, use emojis.",
                    formal: "Tom formal e respeitoso.",
                    urgente: "Tom de urgência e escassez.",
                  };

                  const expertPersona = aiConfig.expert_persona;
                  const customInstr = aiConfig.custom_instructions;
                  const productFocus = aiConfig.product_focus;

                  // Pre-compute triage profile block for Instagram DM system prompt
                  let igTriageBlock = "";
                  if (lastIgTriage?.intent) {
                    igTriageBlock += `\n📊 PERFIL DO LEAD:\n- Intenção: ${lastIgTriage.intent} | Sentimento: ${lastIgTriage.sentiment} | Fit Score: ${lastIgTriage.fit_score}/100`;
                    if (lastIgTriage.desejo_schwartz) igTriageBlock += ` | Desejo: ${lastIgTriage.desejo_schwartz}`;
                    if (lastIgTriage.ai_response) igTriageBlock += `\n- Resposta sugerida para objeção: "${lastIgTriage.ai_response}"`;
                    if (lastIgTriage.intent === "compra_quente") igTriageBlock += "\n⚡ Lead QUENTE — conduza para o fechamento!";
                    if (lastIgTriage.intent === "objecao") igTriageBlock += "\n⚠️ Lead com objeção — quebre com empatia.";
                  }

                  const systemPrompt = `${expertPersona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${expertPersona.slice(0, 600)}\n\n` : ""}${personalityPrompts[aiConfig.personality] || personalityPrompts.assistente}
${toneInstructions[aiConfig.tone] || toneInstructions.profissional}
Você está respondendo via Instagram Direct (DM) para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (mencione quando fizer sentido):\n${productFocus.slice(0, 400)}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT (obrigatórias, nunca quebre):\n${customInstr.slice(0, 600)}\n` : ""}
${aiConfig.welcome_message ? `\nMensagem de boas-vindas padrão: ${aiConfig.welcome_message}` : ""}${igTriageBlock}
REGRAS GERAIS DE CONVERSAÇÃO NO INSTAGRAM:
- Responda em português brasileiro de forma natural, curta, direta e simpática. DMs do Instagram devem ser dinâmicas e fluidas!
- ABORDAGEM DE COPY E PERSUASÃO (MÉTODO E3):
  * Nunca invente ou tente criar desejos na mente do lead. Identifique seu desejo ou dor primária e use-os para canalizar a resposta (conforme a Lei 4 de Eugene Schwartz).
  * Sempre que o lead perguntar sobre a eficácia do produto, preço, diferencial ou como funciona, explique de forma cativante baseando-se no MECANISMO ÚNICO (apelido e processo exclusivo) cadastrado no contexto do projeto.
  * Mostre de forma firme, mas sutil, que o nosso Mecanismo é o único veículo viável capaz de gerar a transformação prometida, invalidando soluções genéricas concorrentes.
- Seja EXTREMAMENTE CONCISO (máximo 1-2 parágrafos curtos).
- Não envie blocos densos ou extensos de texto. Fale como um humano real conversando.
- NUNCA diga que é uma inteligência artificial, robô ou assistente limitado. Não use frases como "como sou um assistente virtual, não tenho acesso".
- Se o lead perguntar sobre entrega de produtos, status de pedidos, envio, rastreamento ou qualquer suporte técnico/financeiro que você não saiba responder, diga amigavelmente que vai verificar os detalhes com a equipe administrativa interna imediatamente e que ele receberá uma notificação com a resposta em breve (por e-mail, WhatsApp ou notificação push no aplicativo/PWA).
- NUNCA invente informações. Se não souber, diga que verificará com a equipe.`;

                  // Fetch recent messages for history context
                  const { data: dbHistory } = await supa
                    .from("imphq_ig_messages")
                    .select("direction, content")
                    .eq("conversation_id", conv.id)
                    .order("created_at", { ascending: false })
                    .limit(11);

                  const historyMsgs = (dbHistory || []).slice();
                  // Skip current message if already inserted
                  if (historyMsgs.length > 0 && historyMsgs[0].content === content && historyMsgs[0].direction === "in") {
                    historyMsgs.shift();
                  }

                  const messages: any[] = [{ role: "system", content: systemPrompt + ragBlock }];
                  [...historyMsgs].reverse().forEach((m: any) => {
                    messages.push({
                      role: m.direction === "in" ? "user" : "assistant",
                      content: m.content || "",
                    });
                  });
                  messages.push({ role: "user", content });

                  // Strictly alternate messages
                  const formattedMessages: any[] = [];
                  let lastRole: string | null = null;
                  messages.forEach((msg) => {
                    if (msg.role === lastRole) {
                      if (formattedMessages.length > 0) {
                        formattedMessages[formattedMessages.length - 1].content += "\n" + msg.content;
                      }
                    } else {
                      formattedMessages.push({ ...msg });
                      lastRole = msg.role;
                    }
                  });

                  // LLM API Calls (Pure OpenRouter)
                  const model = aiConfig.ai_model || "openai/gpt-4o-mini";
                  const temperature = Number(aiConfig.ai_temperature ?? 0.7);
                  const top_p = Number(aiConfig.ai_top_p ?? 1);

                  async function callLLM(mdl: string) {
                    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
                    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://imperiox.lovable.app",
                        "X-Title": "Imperio HQ",
                      },
                      body: JSON.stringify({ model: mdl, messages: formattedMessages, max_tokens: aiConfig.max_tokens || 300, temperature, top_p }),
                    });
                  }

                  let aiRes: Response | null = null;
                  try {
                    aiRes = await callLLM(model);
                    if (!aiRes.ok) {
                      console.warn(`[ig-webhook] OpenRouter primary model failed, fallback to openai/gpt-4o-mini`);
                      aiRes = await callLLM("openai/gpt-4o-mini");
                    }
                  } catch (e: any) {
                    console.warn("[ig-webhook] AI provider call failed:", e?.message);
                  }

                  if (aiRes && aiRes.ok) {
                    const aiData = await aiRes.json();
                    const aiReply = aiData.choices?.[0]?.message?.content || "";

                    if (aiReply.trim()) {
                      if (aiConfig.draft_mode) {
                        // Draft mode: save suggested reply
                        await supa.from("imphq_wa_ai_drafts").insert({
                          conversation_id: conv.id,
                          project_id: account.project_id,
                          incoming_text: content,
                          suggested_text: aiReply,
                          model,
                          provider: "instagram",
                          status: "pending",
                        });
                        console.log(`[ig-webhook] AI draft saved for @${conv.participant_username || 'lead'}`);

                        // Web push notification
                        if (project?.user_id) {
                          const leadName = conv.participant_username || conv.participant_name || "Lead do Instagram";
                          supa.functions.invoke("send-push", {
                            body: {
                              user_id: project.user_id,
                              title: `💡 Rascunho de IA (Instagram)`,
                              message: `Sugestão para @${leadName}: "${aiReply.slice(0, 60)}..."`,
                              url: `/whatsapp`,
                            },
                          }).catch((e: any) => console.warn("[ig-webhook] push notify error:", e?.message));
                        }
                      } else {
                        // Autoresponder active: wait for delay and reply
                        const delay = (aiConfig.response_delay_seconds || 3) * 1000;
                        if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay, 10000)));

                        const replyRes = await supa.functions.invoke("instagram-api", {
                          body: {
                            action: "send_text",
                            project_id: account.project_id,
                            recipient_id: participantId,
                            text: aiReply,
                          },
                        });
                        const replyData = await replyRes.data;
                        if (replyData?.success) {
                          console.log(`[ig-webhook] AI direct reply sent successfully`);
                        } else {
                          console.error(`[ig-webhook] Failed to send AI direct reply:`, replyData?.error);
                        }
                      }
                    }
                  } else if (aiRes) {
                    const errText = await aiRes.text();
                    console.warn(`[ig-webhook] LLM error ${aiRes.status}:`, errText.slice(0, 200));
                  }
                } catch (innerErr: any) {
                  console.error("[ig-webhook] Async DM AI error:", innerErr.message);
                }
              })();
            } catch (triggerErr: any) {
              console.warn("[ig-webhook] Async DM AI trigger error:", triggerErr.message);
            }
          }
        }
      }

      // --- COMENTÁRIOS / MENÇÕES ---
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          const v = change.value || {};
          const commentId = v.id;
          const commentText = v.text;
          const fromUserId = v.from?.id;
          const fromUsername = v.from?.username;

          // Upsert comment
          await supa.from("imphq_ig_comments").upsert({
            account_id: account.id,
            media_id: v.media?.id,
            comment_id: commentId,
            parent_comment_id: v.parent_id || null,
            from_user_id: fromUserId,
            from_username: fromUsername,
            text: commentText,
          }, { onConflict: "comment_id" });

          // AI autoresponder for PUBLIC COMMENTS!
          // Make sure it is incoming (not from the business account owner themselves)
          const isFromMe = fromUserId === igUserId;
          if (!isFromMe && commentText) {
            try {
              (async () => {
                try {
                  // --- CHECK INSTAGRAM COMMENT TRIGGERS ---
                  const { data: matchedTriggers } = await supa
                    .from("imphq_ig_comment_triggers")
                    .select("*")
                    .eq("project_id", account.project_id)
                    .eq("is_active", true);

                  const commentLc = commentText.toLowerCase().trim();
                  let matchedTrigger: any = null;

                  if (matchedTriggers && matchedTriggers.length > 0) {
                    matchedTrigger = matchedTriggers.find((t: any) => {
                      const kw = (t.trigger_keyword || "").toLowerCase().trim();
                      if (!kw) return false;
                      // Match comment text containing keyword
                      return commentLc.includes(kw);
                    });
                  }

                  if (matchedTrigger) {
                    console.log(`[ig-webhook] Matched comment trigger: "${matchedTrigger.trigger_keyword}" for comment "${commentText}"`);
                    
                    // Increment match count
                    await supa.rpc("increment_trigger_matches", { trigger_id: matchedTrigger.id }).catch(() => {
                      supa.from("imphq_ig_comment_triggers")
                        .update({ match_count: (matchedTrigger.match_count || 0) + 1 })
                        .eq("id", matchedTrigger.id);
                    });

                    // 1. Public Reply
                    if (matchedTrigger.reply_comment_template) {
                      const replyText = matchedTrigger.reply_comment_template.replace("{{nome}}", fromUsername || "você");
                      await supa.functions.invoke("instagram-api", {
                        body: {
                          action: "reply_comment",
                          project_id: account.project_id,
                          comment_id: commentId,
                          message: replyText
                        }
                      });
                    }

                    // 2. Private Direct Message (DM) Reply
                    if (matchedTrigger.send_dm_template) {
                      const dmText = matchedTrigger.send_dm_template.replace("{{nome}}", fromUsername || "você");
                      const dmRes = await supa.functions.invoke("instagram-api", {
                        body: {
                          action: "private_reply",
                          project_id: account.project_id,
                          comment_id: commentId,
                          message: dmText
                        }
                      });
                      
                      const dmSuccess = dmRes.data?.success || false;
                      if (dmSuccess) {
                        await supa.rpc("increment_trigger_dms", { trigger_id: matchedTrigger.id }).catch(() => {
                          supa.from("imphq_ig_comment_triggers")
                            .update({ dm_sent_count: (matchedTrigger.dm_sent_count || 0) + 1 })
                            .eq("id", matchedTrigger.id);
                        });
                      }
                    }

                    // Skip standard AI autoresponder
                    return;
                  }

                  let aiConfig = null;
                  const { data: configs, error: configErr } = await supa
                    .from("imphq_wa_ai_config")
                    .select("*")
                    .eq("project_id", account.project_id)
                    .eq("enabled", true);
                  if (configErr) {
                    console.error("[ig-webhook] Config query error (comments):", configErr.message);
                  } else if (configs && configs.length > 0) {
                    aiConfig = configs.find((c: any) => !c.provider_id) || configs[0];
                  }

                  if (!aiConfig) {
                    console.log(`[ig-webhook] AI not enabled for project ${account.project_id}`);
                    return;
                  }

                  // 1. Business hours check
                  if (aiConfig.business_hours_only) {
                    const now = new Date();
                    const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                    const currentHour = brTime.getHours() * 100 + brTime.getMinutes();
                    const [sh, sm] = (aiConfig.business_hours_start || "08:00").split(":").map(Number);
                    const [eh, em] = (aiConfig.business_hours_end || "20:00").split(":").map(Number);
                    const startNum = sh * 100 + sm;
                    const endNum = eh * 100 + em;
                    if (currentHour < startNum || currentHour > endNum) {
                      console.log(`[ig-webhook] Outside business hours, skipping comment AI`);
                      return;
                    }
                  }

                  // 2. Escalation keywords check
                  const lc = commentText.toLowerCase();
                  const isEscalation = (aiConfig.escalation_keywords || []).some((kw: string) =>
                    lc.includes(kw.toLowerCase())
                  );
                  if (isEscalation) {
                    console.log(`[ig-webhook] Escalation keyword detected in comment, skipping`);
                    return;
                  }

                  // 3. Double reply safeguard
                  const { data: existingComments } = await supa
                    .from("imphq_ig_comments")
                    .select("replied")
                    .eq("comment_id", commentId)
                    .maybeSingle();
                  if (existingComments?.replied) {
                    console.log(`[ig-webhook] Already replied to comment ${commentId}, skipping`);
                    return;
                  }

                  // Build project context
                  let projectContext = "";
                  const { data: project } = await supa
                    .from("imphq_projects")
                    .select("name, data, avatar, brand_kit, user_id")
                    .eq("id", account.project_id)
                    .single();

                  if (project) {
                    const sources = aiConfig.context_sources || [];
                    const d = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
                    if (sources.includes("briefing") && d.briefing) projectContext += `Briefing: ${JSON.stringify(d.briefing).slice(0, 600)}\n`;
                    if (sources.includes("produtos") && d.produtos) projectContext += `Produtos: ${JSON.stringify(d.produtos).slice(0, 600)}\n`;
                    if (sources.includes("avatar") && project.avatar) projectContext += `Avatar: ${JSON.stringify(project.avatar).slice(0, 400)}\n`;
                    if (sources.includes("branding") && project.brand_kit) projectContext += `Branding: ${JSON.stringify(project.brand_kit).slice(0, 400)}\n`;
                    if (sources.includes("copy_arsenal")) {
                      const ca = d.copy_arsenal || (d.produtos?.[0]?.copy_arsenal);
                      if (ca) projectContext += `Copy Arsenal: ${JSON.stringify(ca).slice(0, 400)}\n`;
                    }
                    if (sources.includes("expert")) {
                      const ex = d.expert || d.especialista;
                      if (ex) projectContext += `Expert: ${JSON.stringify(ex).slice(0, 400)}\n`;
                    }
                    if (sources.includes("faq") && Array.isArray(aiConfig.faq) && aiConfig.faq.length) {
                      const faqStr = aiConfig.faq
                        .slice(0, 20)
                        .map((f: any) => `Q: ${f.pergunta}\nA: ${f.resposta}`)
                        .join("\n");
                      projectContext += `FAQ OFICIAL:\n${faqStr.slice(0, 1200)}\n`;
                    }
                  }

                  // RAG search in imphq_wa_knowledge (using OpenRouter openai/text-embedding-3-small)
                  let ragBlock = "";
                  try {
                    if (OPENROUTER_API_KEY && commentText.length > 8) {
                      const embRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: commentText, dimensions: 768 }),
                      });
                      if (embRes.ok) {
                        const { data: ed } = await embRes.json();
                        const qEmb = ed?.[0]?.embedding;
                        if (qEmb) {
                          const { data: matches } = await supa.rpc("match_wa_knowledge", {
                            query_embedding: qEmb, p_project_id: account.project_id, match_count: 3, min_similarity: 0.72,
                          });
                          if (matches && matches.length) {
                            ragBlock = "\n\nRESPOSTAS DE REFERÊNCIA DO TIME:\n" +
                              matches.map((m: any, i: number) => `Ref ${i + 1}:\nPergunta: ${m.pergunta}\nResposta: ${m.resposta}`).join("\n\n");
                          }
                        }
                      }
                    }
                  } catch (e: any) { console.warn("[ig-webhook] comment RAG skip:", e?.message); }

                  const personalityPrompts: Record<string, string> = {
                    assistente: "Você é um assistente virtual cordial e prestativo.",
                    vendedor: "Você é um closer de vendas persuasivo mas não agressivo. Foque em entender a dor e apresentar a solução.",
                    suporte: "Você é um agente de suporte técnico eficiente e empático.",
                    consultor: "Você é um consultor especialista. Fale com autoridade e dê recomendações valiosas.",
                  };

                  const toneInstructions: Record<string, string> = {
                    profissional: "Tom profissional e direto.",
                    casual: "Tom casual e descontraído, use emojis moderadamente.",
                    amigavel: "Tom amigável e acolhedor, use emojis.",
                    formal: "Tom formal e respeitoso.",
                    urgente: "Tom de urgência e escassez.",
                  };

                  const expertPersona = aiConfig.expert_persona;
                  const customInstr = aiConfig.custom_instructions;
                  const productFocus = aiConfig.product_focus;

                  const systemPrompt = `${expertPersona ? `PERSONA DO EXPERT (incorpore essa voz de forma natural):\n${expertPersona.slice(0, 600)}\n\n` : ""}${personalityPrompts[aiConfig.personality] || personalityPrompts.assistente}
${toneInstructions[aiConfig.tone] || toneInstructions.profissional}
Você está respondendo a um comentário público no Instagram para a empresa "${project?.name || ""}".
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (mencione quando fizer sentido):\n${productFocus.slice(0, 400)}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT (obrigatórias, nunca quebre):\n${customInstr.slice(0, 600)}\n` : ""}
REGRAS GERAIS PARA COMENTÁRIOS NO INSTAGRAM:
- Responda em português brasileiro de forma extremamente natural, amigável e muito curta (máximo 1-2 frases curtas). Comentários do Instagram devem ser super objetivos e chamativos!
- Se o lead pedir informações, links, preços, etc. ou demonstrar forte interesse, responda de forma simpática dizendo que enviou os detalhes no Direct (DM) dele! Ex: "Te enviei tudo no direct! Confere lá 😉"
- NUNCA invente informações.`;

                  const messages = [
                    { role: "system", content: systemPrompt + ragBlock },
                    { role: "user", content: commentText }
                  ];

                  // LLM API Calls (Pure OpenRouter)
                  const model = aiConfig.ai_model || "openai/gpt-4o-mini";
                  const temperature = Number(aiConfig.ai_temperature ?? 0.7);
                  const top_p = Number(aiConfig.ai_top_p ?? 1);

                  async function callLLM(mdl: string) {
                    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
                    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://imperiox.lovable.app",
                        "X-Title": "Imperio HQ",
                      },
                      body: JSON.stringify({ model: mdl, messages, max_tokens: aiConfig.max_tokens || 300, temperature, top_p }),
                    });
                  }

                  let aiRes: Response | null = null;
                  try {
                    aiRes = await callLLM(model);
                    if (!aiRes.ok) {
                      console.warn(`[ig-webhook] Comment OpenRouter failed, fallback to openai/gpt-4o-mini`);
                      aiRes = await callLLM("openai/gpt-4o-mini");
                    }
                  } catch (e: any) {
                    console.warn("[ig-webhook] Comment AI provider call failed:", e?.message);
                  }

                  if (aiRes && aiRes.ok) {
                    const aiData = await aiRes.json();
                    const aiReply = aiData.choices?.[0]?.message?.content || "";

                    if (aiReply.trim()) {
                      if (aiConfig.draft_mode) {
                        // Draft mode for comments: save draft
                        await supa.from("imphq_wa_ai_drafts").insert({
                          conversation_id: null,
                          project_id: account.project_id,
                          incoming_text: `Comentário de @${fromUsername}: "${commentText}"`,
                          suggested_text: aiReply,
                          model,
                          provider: "instagram_comment",
                          status: "pending",
                          metadata: { comment_id: commentId, from_username: fromUsername },
                        });
                        console.log(`[ig-webhook] AI comment draft saved for @${fromUsername}`);

                        // Web push notification
                        if (project?.user_id) {
                          supa.functions.invoke("send-push", {
                            body: {
                              user_id: project.user_id,
                              title: `💡 Rascunho de Comentário IA`,
                              message: `@${fromUsername} comentou: "${commentText.slice(0, 40)}..."`,
                              url: `/whatsapp`,
                            },
                          }).catch((e: any) => console.warn("[ig-webhook] push notify error:", e?.message));
                        }
                      } else {
                        // Autoresponder active: reply public comment
                        const delay = (aiConfig.response_delay_seconds || 3) * 1000;
                        if (delay > 0) await new Promise(r => setTimeout(r, Math.min(delay, 10000)));

                        const replyRes = await supa.functions.invoke("instagram-api", {
                          body: {
                            action: "reply_comment",
                            project_id: account.project_id,
                            comment_id: commentId,
                            message: aiReply,
                          },
                        });
                        const replyData = await replyRes.data;
                        if (replyData?.success) {
                          console.log(`[ig-webhook] AI comment reply sent successfully`);

                          // Premium: If the reply contains direct/chamei/enviei/inbox, send direct message
                          const replyLc = aiReply.toLowerCase();
                          if (replyLc.includes("direct") || replyLc.includes("chamei") || replyLc.includes("enviei") || replyLc.includes("inbox")) {
                            const dmMessageText = productFocus 
                              ? `Olá! Vi que você comentou no nosso post. Aqui estão as informações sobre a nossa oferta:\n\n${productFocus}`
                              : `Olá! Vi que você comentou no nosso post. Como prometido, aqui estão as informações! Como posso te ajudar hoje?`;

                            await supa.functions.invoke("instagram-api", {
                              body: {
                                action: "private_reply",
                                project_id: account.project_id,
                                comment_id: commentId,
                                message: dmMessageText,
                              },
                            });
                            console.log(`[ig-webhook] Triggered private direct message reply from comment`);
                          }
                        } else {
                          console.error(`[ig-webhook] Failed to reply to comment:`, replyData?.error);
                        }
                      }
                    }
                  } else if (aiRes) {
                    const errText = await aiRes.text();
                    console.warn(`[ig-webhook] Comment LLM error ${aiRes.status}:`, errText.slice(0, 200));
                  }
                } catch (innerErr: any) {
                  console.error("[ig-webhook] Async Comment AI error:", innerErr.message);
                }
              })();
            } catch (triggerErr: any) {
              console.warn("[ig-webhook] Async Comment AI trigger error:", triggerErr.message);
            }
          }
        }
      }
    }

    if (logEntry) {
      await supa.from("imphq_ig_webhook_logs").update({ processed: true }).eq("id", logEntry.id);
    }
    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("instagram-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
