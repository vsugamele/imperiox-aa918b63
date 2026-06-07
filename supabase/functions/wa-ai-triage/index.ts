// WhatsApp AI Triage — classifica msgs antes de responder + escalona
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

async function classifyMessage(
  message: string,
  lastMessages: string[] = [],
  openrouterKey: string,
  triageStages: any[] | null = null,
  triagePrompt: string | null = null
) {
  const stages = Array.isArray(triageStages) && triageStages.length > 0
    ? triageStages
    : [
        { id: "frio", label: "Frio", description: "Sem interesse claro ou mensagem off-topic/saudacao" },
        { id: "morno", label: "Morno", description: "Demonstrou interesse, fez perguntas, tirou dúvidas sobre o produto" },
        { id: "quente", label: "Quente", description: "Pronto para comprar, pediu preço, link de pagamento ou pix" },
        { id: "cliente", label: "Cliente", description: "Já é cliente ou comprou o produto" }
      ];

  const stagesDesc = stages.map((s: any) => `- "${s.id}" (${s.label}): ${s.description || ""}`).join("\n");
  const stageIds = stages.map((s: any) => `"${s.id}"`).join(" | ");

  const sys = `Você é classificador de mensagens WhatsApp para vendas online. Responda apenas JSON válido com:
{
  "intent": "compra_quente" | "duvida" | "objecao" | "suporte" | "saudacao" | "off_topic",
  "sentiment": "positivo" | "neutro" | "negativo",
  "urgency": "high" | "medium" | "low",
  "fit_score": 0-100,
  "stage": ${stageIds},
  "objecao": "string ou null (se intent=objecao, descreva a objeção em <50 chars)",
  "desejo_schwartz": "tempo" | "dinheiro" | "estresse" | "status" | null,
  "extracted_profile": {
    "pain": "uma descrição curta (<80 caracteres) de uma dor/dificuldade/medo que o lead demonstrou ter, ou null",
    "desire": "uma descrição curta (<80 caracteres) de uma meta/desejo/objetivo que o lead quer alcançar, ou null",
    "moment": "momento/situação atual profissional ou pessoal relatada pelo lead (ex: iniciante, trabalha em salão, desempregada) de <80 caracteres, ou null",
    "seeking": "o que o lead busca ou está precisando no produto (ex: quer aprender corte crespo, quer organizar finanças) de <80 caracteres, ou null"
  }
}

Estágios de Funil disponíveis para classificar o lead no campo "stage":
${stagesDesc}

${triagePrompt ? `Instruções adicionais de classificação do projeto:\n${triagePrompt}\n` : ""}

Mapeie o desejo visceral do cliente (Lei 4 de Eugene Schwartz):
- "tempo" (liberdade, economizar tempo, automatizar processos manuais)
- "dinheiro" (escala de faturamento, lucro, retorno financeiro, ROI)
- "estresse" (alívio de complexidade, facilidade, estabilidade, paz de espírito)
- "status" (prestígio, autoridade no mercado, ser o melhor da área, destaque de marca)
Considere o contexto. 'compra_quente' = quer comprar agora (pede link, preço, pix).`;

  const ctx = lastMessages.length > 0 ? `\n\nÚltimas msgs do lead:\n${lastMessages.join("\n")}` : "";

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://imperiox.lovable.app",
      "X-Title": "Imperio HQ",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Mensagem: "${message}"${ctx}` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`AI error ${resp.status}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { message, message_id, conversation_id, lead_id, projeto_id } = await req.json();

    if (!message) throw new Error("message obrigatório");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured in Supabase environment secrets");

    // Busca configurações de triage personalizadas do projeto
    let triageStages = null;
    let triagePrompt = null;
    if (projeto_id) {
      const { data: config } = await supabase
        .from("imphq_wa_ai_config")
        .select("triage_stages, triage_prompt")
        .eq("project_id", projeto_id)
        .eq("enabled", true)
        .limit(1)
        .maybeSingle();
      if (config) {
        triageStages = config.triage_stages;
        triagePrompt = config.triage_prompt;
      }
    }

    // Busca últimas 3 msgs do lead pra contexto
    let lastMessages: string[] = [];
    if (conversation_id) {
      const { data: prev } = await supabase
        .from("imphq_wa_messages")
        .select("content, from_me")
        .eq("conversation_id", conversation_id)
        .eq("from_me", false)
        .order("created_at", { ascending: false })
        .limit(3);
      lastMessages = (prev || []).map((m: any) => m.content).filter(Boolean);
    }

    const classification = await classifyMessage(message, lastMessages, OPENROUTER_API_KEY, triageStages, triagePrompt);

    // Busca resposta de objeção cadastrada
    let suggestedReply: string | null = null;
    if (classification.intent === "objecao" && classification.objecao && projeto_id) {
      const { data: obj } = await supabase
        .from("imphq_wa_objections")
        .select("id, resposta_padrao")
        .eq("status", "ativa")
        .or(`projeto_id.eq.${projeto_id},projeto_id.is.null`)
        .ilike("objecao", `%${classification.objecao.slice(0, 30)}%`)
        .limit(1)
        .maybeSingle();
      if (obj?.resposta_padrao) {
        suggestedReply = obj.resposta_padrao;
        await supabase.rpc("increment_objection_score", { obj_id: obj.id }).catch(() => {
          // fallback se RPC não existir
          supabase.from("imphq_wa_objections").update({ score_uso: (obj as any).score_uso + 1 || 1 }).eq("id", obj.id);
        });
      } else {
        // Propõe nova objeção pro Imperius
        await supabase.from("imphq_ai_actions").insert({
          kind: "notify",
          risk_level: "low",
          confidence: 0.7,
          impact_brl: 100,
          title: `Nova objeção detectada: "${classification.objecao}"`,
          reason: `Mensagem: "${message.slice(0, 100)}". Cadastre resposta padrão pra automatizar.`,
          payload: { objecao: classification.objecao, exemplo: message, projeto_id, lead_id },
          projeto_id,
          source: "wa-ai-triage",
          status: "proposed",
        });
      }
    }

    let escalated = false;
    // Escalonamento
    if (classification.urgency === "high" || classification.intent === "compra_quente") {
      escalated = true;
      if (lead_id) {
        await supabase
          .from("imphq_leads")
          .update({ score: 90, updated_at: new Date().toISOString() })
          .eq("id", lead_id);
      }
      await supabase.from("imphq_ai_actions").insert({
        kind: "notify",
        risk_level: "low",
        confidence: 0.9,
        impact_brl: 500,
        title: `🔥 Lead quente no WhatsApp`,
        reason: `${classification.intent} · "${message.slice(0, 80)}"`,
        payload: { lead_id, conversation_id, message },
        projeto_id,
        source: "wa-ai-triage",
        status: "proposed",
      });
    }

    // Eugene Schwartz desire classification and tagging
    if (lead_id && classification.desejo_schwartz) {
      const desejoMap: Record<string, string> = {
        tempo: "Desejo: Tempo",
        dinheiro: "Desejo: Dinheiro",
        estresse: "Desejo: Estresse",
        status: "Desejo: Status"
      };
      const tagToAdd = desejoMap[classification.desejo_schwartz];
      if (tagToAdd) {
        try {
          const { data: currentLead } = await supabase
            .from("imphq_leads")
            .select("tags, data")
            .eq("id", lead_id)
            .maybeSingle();
          
          const currentTags = currentLead?.tags || [];
          const currentData = currentLead?.data || {};
          
          const updatePayload: any = {
            updated_at: new Date().toISOString()
          };
          
          let needsUpdate = false;
          
          if (!currentTags.includes(tagToAdd)) {
            updatePayload.tags = [...currentTags, tagToAdd];
            needsUpdate = true;
          }
          
          if (currentData.desejo_schwartz !== classification.desejo_schwartz) {
            updatePayload.data = {
              ...currentData,
              desejo_schwartz: classification.desejo_schwartz
            };
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await supabase
              .from("imphq_leads")
              .update(updatePayload)
              .eq("id", lead_id);
            console.log(`[triage] Updated lead ${lead_id} with desire "${classification.desejo_schwartz}" (tag: "${tagToAdd}")`);
          }
        } catch (tagErr) {
          console.warn("[triage] Failed to update lead tags:", tagErr);
        }
      }
    }

    // Process and merge dynamic AI lead profile
    if (lead_id && classification.extracted_profile) {
      try {
        const { data: currentLead } = await supabase
          .from("imphq_leads")
          .select("data")
          .eq("id", lead_id)
          .maybeSingle();

        const currentData = currentLead?.data || {};
        const oldProfile = currentData.ai_profile || { pains: [], desires: [], moments: [], seekings: [] };
        
        const ep = classification.extracted_profile;
        const newProfile = {
          pains: Array.isArray(oldProfile.pains) ? [...oldProfile.pains] : [],
          desires: Array.isArray(oldProfile.desires) ? [...oldProfile.desires] : [],
          moments: Array.isArray(oldProfile.moments) ? [...oldProfile.moments] : [],
          seekings: Array.isArray(oldProfile.seekings) ? [...oldProfile.seekings] : [],
          updated_at: new Date().toISOString()
        };

        let needsProfileUpdate = false;

        const addUnique = (arr: string[], val: any) => {
          if (val && typeof val === "string" && val.trim() !== "" && !val.toLowerCase().includes("null") && !arr.some(v => v.toLowerCase() === val.trim().toLowerCase())) {
            arr.push(val.trim());
            return true;
          }
          return false;
        };

        if (addUnique(newProfile.pains, ep.pain)) needsProfileUpdate = true;
        if (addUnique(newProfile.desires, ep.desire)) needsProfileUpdate = true;
        if (addUnique(newProfile.moments, ep.moment)) needsProfileUpdate = true;
        if (addUnique(newProfile.seekings, ep.seeking)) needsProfileUpdate = true;

        if (needsProfileUpdate) {
          newProfile.pains = newProfile.pains.slice(-5);
          newProfile.desires = newProfile.desires.slice(-5);
          newProfile.moments = newProfile.moments.slice(-5);
          newProfile.seekings = newProfile.seekings.slice(-5);

          const mergedData = {
            ...currentData,
            ai_profile: newProfile
          };
          
          if (classification.desejo_schwartz) {
            mergedData.desejo_schwartz = classification.desejo_schwartz;
          }

          await supabase
            .from("imphq_leads")
            .update({
              data: mergedData,
              updated_at: new Date().toISOString()
            })
            .eq("id", lead_id);
          console.log(`[triage] Updated lead ${lead_id} AI profile:`, newProfile);
        }
      } catch (profileErr: any) {
        console.warn("[triage] Failed to update lead AI profile:", profileErr?.message);
      }
    }

    if (classification.sentiment === "negativo") {
      // Conta últimas negativas
      const { count } = await supabase
        .from("imphq_wa_triage")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation_id)
        .eq("sentiment", "negativo")
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if ((count || 0) >= 1) {
        escalated = true;
        await supabase.from("imphq_ai_actions").insert({
          kind: "createTask",
          risk_level: "medium",
          confidence: 0.85,
          impact_brl: 300,
          title: `⚠️ Atendimento humano necessário`,
          reason: `Lead com sentimento negativo recorrente. Bot pausado.`,
          payload: { titulo: `[atendimento humano] WhatsApp`, descricao: `Lead: ${lead_id}\nÚltima msg: "${message}"`, prioridade: "alta" },
          projeto_id,
          source: "wa-ai-triage",
          status: "proposed",
        });
      }
    }

    // 8. Memória Vetorial (pgvector) do lead
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && conversation_id && projeto_id) {
      try {
        const { data: conv } = await supabase
          .from("imphq_wa_conversations")
          .select("phone")
          .eq("id", conversation_id)
          .maybeSingle();

        if (conv?.phone) {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-embedding-001", input: message, dimensions: 768 }),
          });
          if (embRes.ok) {
            const embData = await embRes.json();
            const embedding = embData?.data?.[0]?.embedding;
            if (embedding) {
              await supabase.from("imphq_wa_lead_memory").insert({
                lead_id: lead_id || null,
                project_id: projeto_id,
                phone: conv.phone,
                content: message,
                embedding: embedding,
              });
              console.log(`[triage] Stored lead memory embedding for conversation=${conversation_id} phone=${conv.phone}`);
            }
          } else {
            console.warn(`[triage] Lovable embedding failed: ${embRes.status}`);
          }
        }
      } catch (embErr: any) {
        console.error("[triage] Error storing lead memory:", embErr.message);
      }
    }

    if (lead_id && classification.stage) {
      try {
        await supabase
          .from("imphq_leads")
          .update({ status: classification.stage, updated_at: new Date().toISOString() })
          .eq("id", lead_id);
        console.log(`[triage] Updated lead ${lead_id} status to: ${classification.stage}`);
      } catch (leadStageErr: any) {
        console.warn("[triage] Failed to update lead stage status:", leadStageErr?.message);
      }
    }

    await supabase.from("imphq_wa_triage").insert({
      message_id,
      conversation_id,
      lead_id,
      projeto_id,
      intent: classification.intent,
      sentiment: classification.sentiment,
      urgency: classification.urgency,
      fit_score: classification.fit_score,
      raw_message: message,
      ai_response: suggestedReply,
      escalated,
    });

    return new Response(
      JSON.stringify({ ok: true, classification, suggestedReply, escalated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("wa-ai-triage:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
