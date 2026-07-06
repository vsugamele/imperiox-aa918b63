// wa-feedback-learn: registra feedback do operador em mensagens WA da IA e enriquece knowledge base
// Suporta 3 tipos de correção:
//  - "answer"      → resposta melhor, vira par P/R na knowledge base (comportamento legado)
//  - "rule"        → regra comportamental do projeto, injetada SEMPRE no prompt (imphq_wa_project_rules)
//  - "unavailable" → produto/evento indisponível, vira regra restritiva
//  - "auto"        → classificação via LLM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function classifyCorrection(correction: string, leadMsg: string): Promise<"answer" | "rule" | "unavailable"> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "answer";
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Classifique a correção do operador em UMA palavra: 'answer' (uma resposta melhor literal), 'rule' (regra comportamental/política permanente, ex: 'sempre qualifique antes de oferecer', 'nunca cite preço') ou 'unavailable' (produto/evento expirado, indisponível). Responda APENAS a palavra." },
          { role: "user", content: `Pergunta do lead: "${leadMsg}"\n\nCorreção do operador: "${correction}"` },
        ],
        temperature: 0,
      }),
    });
    const j = await resp.json();
    const out = (j?.choices?.[0]?.message?.content || "").toLowerCase().trim();
    if (out.includes("rule")) return "rule";
    if (out.includes("unavail")) return "unavailable";
    return "answer";
  } catch {
    return "answer";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { message_id, feedback, correction, project_id } = body;
    let correction_type: "answer" | "rule" | "unavailable" | "complement" | "auto" = body.correction_type || "auto";

    if (!message_id || !feedback) {
      return new Response(JSON.stringify({ error: "message_id e feedback obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salva feedback na mensagem
    await supa.from("imphq_wa_messages")
      .update({
        feedback,
        feedback_correction: correction || null,
        feedback_correction_type: feedback === "bad" ? (correction_type === "auto" ? null : correction_type) : null,
      })
      .eq("id", message_id);

    if (feedback === "good" && project_id) {
      const { data: msg } = await supa.from("imphq_wa_messages")
        .select("content, conversation_id, created_at, phone")
        .eq("id", message_id)
        .single();

      if (msg) {
        const { data: prevMsgs } = await supa.from("imphq_wa_messages")
          .select("content")
          .eq("conversation_id", msg.conversation_id)
          .eq("direction", "incoming")
          .lt("created_at", msg.created_at)
          .order("created_at", { ascending: false })
          .limit(1);

        const question = prevMsgs?.[0]?.content || "Lead perguntou";
        const answer = msg.content;
        const combined = `${question}\n\n${answer}`;

        const embedding = await getCachedEmbedding(supa, combined);
        if (embedding) {
          await supa.from("imphq_wa_knowledge").insert({
            project_id,
            pergunta: question,
            resposta: answer,
            embedding,
            source: "feedback:good:wa",
            aprovada: true,
          });
        }

        await supa.from("imphq_ai_actions").insert({
          projeto_id: project_id,
          kind: "refine_skill",
          risk_level: "low",
          status: "completed",
          title: "✅ Resposta WA aprovada adicionada à base",
          reason: `Operador aprovou resposta da IA no WhatsApp. Par P/R adicionado à knowledge base.`,
          source: "wa-feedback-learn",
          payload: { message_id, question: question.slice(0, 200), answer: answer.slice(0, 200) },
        });
      }
    }

    if (feedback === "bad" && correction && project_id) {
      // Busca pergunta do lead que antecedeu
      let leadQuestion = "Resposta corrigida pelo operador (WA)";
      const { data: badMsg } = await supa.from("imphq_wa_messages")
        .select("conversation_id, created_at")
        .eq("id", message_id)
        .maybeSingle();
      if (badMsg?.conversation_id) {
        const { data: prevIn } = await supa.from("imphq_wa_messages")
          .select("content")
          .eq("conversation_id", badMsg.conversation_id)
          .eq("direction", "incoming")
          .lt("created_at", badMsg.created_at)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prevIn?.content && prevIn.content.length > 3) {
          leadQuestion = String(prevIn.content).slice(0, 500);
        }
      }

      // Classificação automática se necessário
      if (correction_type === "auto") {
        correction_type = await classifyCorrection(correction, leadQuestion);
        // Atualiza o tipo na mensagem com o valor classificado
        await supa.from("imphq_wa_messages")
          .update({ feedback_correction_type: correction_type })
          .eq("id", message_id);
      }

      // ROTA 1: regra do projeto (comportamental ou produto indisponível)
      if (correction_type === "rule" || correction_type === "unavailable") {
        const rule_type = correction_type === "unavailable" ? "unavailable_product" : "behavior";
        const ruleEmb = await getCachedEmbedding(supa, correction);

        // Detecta conflito com regra ativa similar → cria como variante A/B
        let ab_group_id: string | null = null;
        let ab_status: string | null = null;
        if (ruleEmb && rule_type === "behavior") {
          const { data: similar } = await supa.rpc("match_wa_rules", {
            p_project_id: project_id,
            p_query_embedding: ruleEmb,
            p_match_count: 1,
            p_threshold: 0.85,
          });
          const conflict = (similar || []).find((s: any) => s.rule_type === "behavior");
          if (conflict) {
            ab_group_id = conflict.ab_group_id || crypto.randomUUID();
            ab_status = "variant";
            // garante que a regra original vire control no mesmo grupo
            if (!conflict.ab_group_id) {
              await supa.from("imphq_wa_project_rules").update({
                ab_group_id, ab_status: "control", ab_started_at: new Date().toISOString(),
              }).eq("id", conflict.id);
            }
          }
        }

        await supa.from("imphq_wa_project_rules").insert({
          project_id,
          rule_text: correction,
          rule_type,
          active: true,
          created_from_message_id: message_id,
          embedding: ruleEmb,
          ab_group_id,
          ab_status,
          ab_started_at: ab_group_id ? new Date().toISOString() : null,
        });

        await supa.from("imphq_ai_actions").insert({
          projeto_id: project_id,
          kind: "refine_prompt",
          risk_level: "low",
          status: "completed",
          title: ab_group_id
            ? "🧪 Nova variante A/B de regra criada"
            : (correction_type === "unavailable"
              ? "🚫 Restrição de produto adicionada"
              : "📜 Regra do projeto adicionada"),
          reason: ab_group_id
            ? `Conflito detectado — regra adicionada como variante A/B: "${correction.slice(0, 150)}"`
            : `Operador definiu nova ${correction_type === "unavailable" ? "restrição de produto" : "regra"}: "${correction.slice(0, 150)}"`,
          source: "wa-feedback-learn",
          payload: { message_id, correction: correction.slice(0, 300), rule_type, ab_group_id },
        });
      } else {
        // ROTA 2: resposta literal melhor (comportamento legado)
        const embedding = await getCachedEmbedding(supa, `${leadQuestion}\n\n${correction}`);
        if (embedding) {
          await supa.from("imphq_wa_knowledge").insert({
            project_id,
            pergunta: leadQuestion,
            resposta: correction,
            embedding,
            source: "feedback:correction:wa",
            aprovada: true,
          });
        }

        await supa.from("imphq_ai_actions").insert({
          projeto_id: project_id,
          kind: "refine_prompt",
          risk_level: "low",
          status: "completed",
          title: "✏️ Correção WA do operador incorporada",
          reason: `Operador corrigiu resposta da IA no WhatsApp: "${correction.slice(0, 150)}"`,
          source: "wa-feedback-learn",
          payload: { message_id, correction: correction.slice(0, 300) },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, correction_type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-feedback-learn] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
