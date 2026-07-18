// ig-feedback-learn: Records operator feedback on AI messages and optionally
// adds good replies to the knowledge base for RAG improvement
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";

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
        body: JSON.stringify({ model: "google/gemini-embedding-001", input: text.slice(0, 2000).trim(), dimensions: 768 }),
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
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000).trim(), dimensions: 768 }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.data?.[0]?.embedding ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { message_id, feedback, correction, project_id } = await req.json();

    if (!message_id || !feedback) {
      return new Response(JSON.stringify({ error: "message_id and feedback required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the feedback on the message
    await supa.from("imphq_ig_messages")
      .update({ feedback, feedback_correction: correction || null })
      .eq("id", message_id);

    if (feedback === "good" && project_id) {
      // Load the message and the previous lead message to form a Q&A pair
      const { data: msg } = await supa.from("imphq_ig_messages")
        .select("content, conversation_id, created_at")
        .eq("id", message_id).single();

      if (msg) {
        // Get the last inbound message before this one (the "question")
        const { data: prevMsgs } = await supa.from("imphq_ig_messages")
          .select("content")
          .eq("conversation_id", msg.conversation_id)
          .eq("direction", "in")
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
            source: "feedback:good",
            aprovada: true,
          });
          console.log(`[ig-feedback] Added good reply to knowledge base for project ${project_id}`);
        }

        // Log to ai_actions so the "Evolução de Prompts" panel shows history
        await supa.from("imphq_ai_actions").insert({
          projeto_id: project_id,
          kind: "refine_skill",
          risk_level: "low",
          status: "completed",
          title: "✅ Resposta aprovada adicionada à base",
          reason: `O operador aprovou uma resposta da IA. A dupla pergunta/resposta foi adicionada à knowledge base via embedding para melhorar futuras respostas.`,
          source: "ig-feedback-learn",
          payload: { message_id, question: question?.slice(0, 200), answer: answer?.slice(0, 200) },
        });
      }
    }

    if (feedback === "bad" && correction && project_id) {
      // Add the correction as a knowledge item
      const embedding = await getEmbedding(correction);
      if (embedding) {
        await supa.from("imphq_wa_knowledge").insert({
          project_id,
          pergunta: "Resposta corrigida pelo operador",
          resposta: correction,
          embedding,
          source: "feedback:correction",
          aprovada: true,
        });
        console.log(`[ig-feedback] Added correction to knowledge base for project ${project_id}`);
      }

      // Log correction to ai_actions
      await supa.from("imphq_ai_actions").insert({
        projeto_id: project_id,
        kind: "refine_prompt",
        risk_level: "low",
        status: "completed",
        title: "✏️ Correção do operador incorporada",
        reason: `O operador corrigiu uma resposta da IA. A correção foi adicionada à knowledge base: "${correction?.slice(0, 150)}"`,
        source: "ig-feedback-learn",
        payload: { message_id, correction: correction?.slice(0, 300) },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[ig-feedback] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
