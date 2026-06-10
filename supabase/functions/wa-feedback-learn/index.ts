// wa-feedback-learn: registra feedback do operador em mensagens WA da IA e enriquece knowledge base
// Espelho do ig-feedback-learn para o canal WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_KEY) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 2000), dimensions: 768 }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.data?.[0]?.embedding) return d.data[0].embedding;
      }
    } catch (_) {}
  }
  const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OR_KEY) return null;
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000), dimensions: 768 }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.data?.[0]?.embedding ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { message_id, feedback, correction, project_id } = await req.json();

    if (!message_id || !feedback) {
      return new Response(JSON.stringify({ error: "message_id e feedback obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salva feedback na mensagem
    await supa.from("imphq_wa_messages")
      .update({ feedback, feedback_correction: correction || null })
      .eq("id", message_id);

    if (feedback === "good" && project_id) {
      const { data: msg } = await supa.from("imphq_wa_messages")
        .select("content, conversation_id, created_at, phone")
        .eq("id", message_id)
        .single();

      if (msg) {
        // Busca a última mensagem incoming antes desta (a "pergunta")
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

        const embedding = await getEmbedding(combined);
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

        console.log(`[wa-feedback-learn] Good feedback: added Q&A to knowledge base for project ${project_id}`);
      }
    }

    if (feedback === "bad" && correction && project_id) {
      // Busca pergunta real do lead que antecedeu esta mensagem da IA
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
      const embedding = await getEmbedding(`${leadQuestion}\n\n${correction}`);
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

      console.log(`[wa-feedback-learn] Bad feedback: correction added to knowledge base for project ${project_id}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-feedback-learn] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
