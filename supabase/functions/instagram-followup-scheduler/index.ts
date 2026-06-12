import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("[ig-followup-scheduler] Iniciando processamento de follow-ups...");

    // 1. Buscar todas as conversas elegíveis para follow-up de 24h
    // follow_up_status = 'pending' E last_message_at entre 24h e 48h atrás
    const time24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const time48hAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: convs, error: convError } = await supa
      .from("imphq_ig_conversations")
      .select("*, imphq_ig_accounts!inner(project_id, ig_user_id)")
      .eq("follow_up_status", "pending")
      .lte("last_message_at", time24hAgo)
      .gte("last_message_at", time48hAgo);

    if (convError) {
      console.error("[ig-followup-scheduler] Erro ao buscar conversas:", convError.message);
      return new Response(JSON.stringify({ error: convError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!convs || convs.length === 0) {
      console.log("[ig-followup-scheduler] Nenhuma conversa elegível para follow-up encontrada.");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ig-followup-scheduler] Encontradas ${convs.length} conversas pendentes de follow-up.`);
    let processedCount = 0;
    let successCount = 0;

    for (const conv of convs) {
      processedCount++;
      const account = conv.imphq_ig_accounts as any;
      const projectId = account?.project_id;
      const igUserId = account?.ig_user_id;

      if (!projectId || !igUserId) {
        console.warn(`[ig-followup-scheduler] Projeto ou conta IG ausente para conversa ${conv.id}`);
        continue;
      }

      console.log(`[ig-followup-scheduler] Processando conversa ${conv.id} (Lead @${conv.participant_username}) no projeto ${projectId}`);

      try {
        // 2. Buscar a configuração de IA do projeto
        let aiConfig = null;
        const { data: configs, error: configErr } = await supa
          .from("imphq_wa_ai_config")
          .select("*")
          .eq("project_id", projectId)
          .eq("enabled", true);
        if (configErr) {
          console.error(`[ig-followup-scheduler] Config query error for ${projectId}:`, configErr.message);
        } else if (configs && configs.length > 0) {
          aiConfig = configs.find((c: any) => !c.provider_id) || configs[0];
        }

        if (!aiConfig) {
          console.log(`[ig-followup-scheduler] IA desabilitada ou não configurada para o projeto ${projectId}`);
          continue;
        }

        // 3. Buscar histórico de mensagens da conversa
        const { data: dbHistory } = await supa
          .from("imphq_ig_messages")
          .select("direction, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!dbHistory || dbHistory.length === 0) {
          console.log(`[ig-followup-scheduler] Nenhum histórico de mensagens para a conversa ${conv.id}`);
          continue;
        }

        // Se o lead respondeu recentemente e o trigger de banco não atualizou por algum motivo,
        // ou se a última mensagem foi recebida (in), não devemos enviar follow-up
        if (dbHistory[0].direction === "in" || dbHistory[0].direction === "incoming") {
          console.log(`[ig-followup-scheduler] Última mensagem é recebida, pulando follow-up.`);
          await supa
            .from("imphq_ig_conversations")
            .update({ follow_up_status: "none" } as any)
            .eq("id", conv.id);
          continue;
        }

        // 4. Buscar informações do projeto para contexto
        let projectContext = "";
        const { data: project } = await supa
          .from("imphq_projects")
          .select("name, data, avatar, brand_kit")
          .eq("id", projectId)
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

        // 5. Montar os prompts do sistema e do OpenRouter
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
Você está respondendo via Instagram Direct (DM) para a empresa "${project?.name || ""}".
Seu objetivo é enviar uma mensagem curta de follow-up (acompanhamento/lembrete) após 24 horas de silêncio do lead, com o intuito de reatar a conversa de forma amigável e natural.
${projectContext ? `\nCONTEXTO DO PROJETO:\n${projectContext}` : ""}
${productFocus ? `\nOFERTA ATIVA (se fizer sentido):\n${productFocus.slice(0, 400)}\n` : ""}
${customInstr ? `\nREGRAS DO EXPERT:\n${customInstr.slice(0, 600)}\n` : ""}
REGRAS DO FOLLOW-UP:
- Seja extremamente conciso (máximo 1-2 frases curtas, ex: "Ei! Conseguiu ver o que te mandei?" ou "Olá! Ficou alguma dúvida sobre o que conversamos ontem?").
- Fale de forma muito natural e humana, como se estivesse batendo um papo.
- NUNCA mencione que você é um sistema automatizado ou IA.
- Seja amigável e utilize o tom de voz da marca.
- Não empurre a venda de forma agressiva; apenas tente puxar assunto sobre a última mensagem enviada no histórico abaixo.`;

        // Ordenar histórico cronologicamente (do mais antigo para o mais recente)
        const historyMsgs = [...dbHistory].reverse();

        const messages: any[] = [{ role: "system", content: systemPrompt }];
        historyMsgs.forEach((m: any) => {
          messages.push({
            role: m.direction === "in" || m.direction === "incoming" ? "user" : "assistant",
            content: m.content || "",
          });
        });

        // Adicionar instrução final para geração do follow-up
        messages.push({
          role: "user",
          content: "[Instrução Interna: Analise o histórico acima e gere agora a mensagem amigável de follow-up curta e objetiva de 1-2 frases.]",
        });

        // Alternar mensagens estritamente para compatibilidade com APIs do OpenRouter
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

        // 6. Chamada LLM (OpenRouter)
        const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
        if (!OPENROUTER_API_KEY) {
          throw new Error("OPENROUTER_API_KEY ausente.");
        }

        const model = aiConfig.ai_model || "google/gemini-2.5-flash";
        const temperature = Number(aiConfig.ai_temperature ?? 0.7);
        const top_p = Number(aiConfig.ai_top_p ?? 1);

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://imperiox.lovable.app",
            "X-Title": "Imperio HQ Follow-up Scheduler",
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
            max_tokens: 150,
            temperature,
            top_p,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          throw new Error(`Erro na API OpenRouter: ${aiRes.status} - ${errText}`);
        }

        const aiData = await aiRes.json();
        const aiReply = aiData.choices?.[0]?.message?.content || "";

        if (!aiReply.trim()) {
          console.warn(`[ig-followup-scheduler] Resposta gerada vazia para conversa ${conv.id}`);
          continue;
        }

        console.log(`[ig-followup-scheduler] Resposta de follow-up gerada: "${aiReply.trim()}"`);

        // 7. Enviar a mensagem via instagram-api passando metadata.is_follow_up = true
        const { data: replyData, error: replyError } = await supa.functions.invoke("instagram-api", {
          body: {
            action: "send_text",
            project_id: projectId,
            recipient_id: conv.participant_id,
            text: aiReply.trim(),
            metadata: { is_follow_up: true },
          },
        });

        if (replyError) {
          console.error(`[ig-followup-scheduler] Erro de invocação para @${conv.participant_username}:`, replyError);
          const errMsg = `failed: ${String(replyError.message || replyError).slice(0, 80)}`;
          await supa
            .from("imphq_ig_conversations")
            .update({ follow_up_status: errMsg } as any)
            .eq("id", conv.id);
          continue;
        }

        if (replyData?.success) {
          console.log(`[ig-followup-scheduler] Follow-up enviado com sucesso para @${conv.participant_username}`);
          
          // 8. Atualizar a conversa para evitar novos envios
          await supa
            .from("imphq_ig_conversations")
            .update({
              follow_up_status: "sent",
              follow_up_sent_at: new Date().toISOString(),
            } as any)
            .eq("id", conv.id);

          successCount++;
        } else {
          console.error(`[ig-followup-scheduler] Falha ao enviar follow-up para @${conv.participant_username}:`, replyData?.error);
          const errMsg = `failed: ${String(replyData?.error || 'Erro no envio').slice(0, 80)}`;
          await supa
            .from("imphq_ig_conversations")
            .update({ follow_up_status: errMsg } as any)
            .eq("id", conv.id);
        }

      } catch (innerErr: any) {
        console.error(`[ig-followup-scheduler] Erro ao processar conversa ${conv.id}:`, innerErr.message);
        const errMsg = `failed: ${(innerErr.message || String(innerErr)).slice(0, 80)}`;
        await supa
          .from("imphq_ig_conversations")
          .update({ follow_up_status: errMsg } as any)
          .eq("id", conv.id);
      }
    }

    console.log(`[ig-followup-scheduler] Concluído. Processados: ${processedCount}, Sucessos: ${successCount}`);

    return new Response(JSON.stringify({ success: true, processed: processedCount, sent: successCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[ig-followup-scheduler] Erro fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
