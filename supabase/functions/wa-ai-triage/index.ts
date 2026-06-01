// WhatsApp AI Triage — classifica msgs antes de responder + escalona
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

async function classifyMessage(message: string, lastMessages: string[] = [], openrouterKey: string) {
  const sys = `Você é classificador de mensagens WhatsApp para vendas online. Responda apenas JSON válido com:
{
  "intent": "compra_quente" | "duvida" | "objecao" | "suporte" | "saudacao" | "off_topic",
  "sentiment": "positivo" | "neutro" | "negativo",
  "urgency": "high" | "medium" | "low",
  "fit_score": 0-100,
  "objecao": "string ou null (se intent=objecao, descreva a objeção em <50 chars)",
  "desejo_schwartz": "tempo" | "dinheiro" | "estresse" | "status" | null
}
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

    const classification = await classifyMessage(message, lastMessages, OPENROUTER_API_KEY);

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
