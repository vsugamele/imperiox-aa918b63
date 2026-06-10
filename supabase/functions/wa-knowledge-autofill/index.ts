// wa-knowledge-autofill: gera rascunhos de resposta para perguntas sem cobertura na base de conhecimento
// Roda via cron semanal. Para cada projeto, pega até 30 perguntas sem resposta e gera drafts com LLM.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!LOVABLE_KEY && !OR_KEY) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de LLM configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca perguntas sem resposta, agrupadas por projeto
    const { data: unanswered } = await supabase
      .from("imphq_wa_knowledge")
      .select("id, pergunta, project_id")
      .eq("source", "lead_unanswered")
      .eq("aprovada", false)
      .eq("resposta", "")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!unanswered || unanswered.length === 0) {
      return new Response(JSON.stringify({ ok: true, drafted: 0, message: "Nenhuma pergunta pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agrupa por projeto e pega contexto do projeto uma vez
    const byProject: Record<string, typeof unanswered> = {};
    for (const q of unanswered) {
      if (!byProject[q.project_id]) byProject[q.project_id] = [];
      byProject[q.project_id].push(q);
    }

    let totalDrafted = 0;

    for (const [projectId, questions] of Object.entries(byProject)) {
      // Limita a 30 por projeto por rodada
      const batch = questions.slice(0, 30);

      // Contexto do projeto
      const { data: proj } = await supabase
        .from("imphq_projects")
        .select("name, data")
        .eq("id", projectId)
        .maybeSingle();

      const pData = typeof proj?.data === "string" ? JSON.parse(proj.data) : (proj?.data || {});
      const projName = proj?.name || "Projeto";
      const expert = pData.expert || pData.especialista || {};
      const product = pData.produto || pData.product || "";

      // Busca knowledge aprovada existente como contexto (até 10 exemplos)
      const { data: existingKnowledge } = await supabase
        .from("imphq_wa_knowledge")
        .select("pergunta, resposta")
        .eq("project_id", projectId)
        .eq("aprovada", true)
        .limit(10);

      const knowledgeExamples = (existingKnowledge || [])
        .map((k: any) => `P: ${k.pergunta}\nR: ${k.resposta}`)
        .join("\n\n");

      const systemPrompt = `Você é um especialista em vendas e atendimento ao cliente do projeto "${projName}".
${product ? `Produto/Serviço: ${product}` : ""}
${expert?.nome ? `Expert/Especialista: ${expert.nome}` : ""}
${expert?.bio ? `Bio: ${expert.bio}` : ""}

Sua tarefa é gerar rascunhos de resposta para perguntas que leads fizeram e que não tinham cobertura na base de conhecimento.

${knowledgeExamples ? `Exemplos de respostas já aprovadas para referência:\n${knowledgeExamples}\n` : ""}

Para cada pergunta, gere uma resposta concisa, informativa e no tom adequado para WhatsApp (máximo 3 parágrafos).
Se não tiver informações suficientes para responder, escreva "PRECISA_DE_REVISÃO: [motivo]" para que o operador preencha.
Responda APENAS com JSON no formato: {"respostas": [{"id": "uuid", "resposta": "texto"}]}`;

      const questionsJson = batch.map((q: any) => ({ id: q.id, pergunta: q.pergunta }));

      const payload = {
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere rascunhos para:\n${JSON.stringify(questionsJson, null, 2)}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      };

      let drafts: Array<{ id: string; resposta: string }> = [];

      // Tenta Lovable primeiro, depois OpenRouter
      try {
        const apiUrl = LOVABLE_KEY
          ? "https://ai.gateway.lovable.dev/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";
        const apiKey = LOVABLE_KEY || OR_KEY;

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content || "{}";
          const parsed = JSON.parse(content);
          drafts = parsed.respostas || [];
        }
      } catch (e: any) {
        console.error(`[wa-knowledge-autofill] LLM error for project ${projectId}:`, e.message);
        continue;
      }

      // Gera embeddings e atualiza cada rascunho
      for (const draft of drafts) {
        if (!draft.id || !draft.resposta) continue;

        const question = batch.find((q: any) => q.id === draft.id);
        if (!question) continue;

        // Embedding do par pergunta+resposta
        let embedding: number[] | null = null;
        const combined = `${question.pergunta}\n\n${draft.resposta}`;

        try {
          const embUrl = LOVABLE_KEY
            ? "https://ai.gateway.lovable.dev/v1/embeddings"
            : "https://openrouter.ai/api/v1/embeddings";
          const embModel = LOVABLE_KEY ? "google/gemini-embedding-001" : "openai/text-embedding-3-small";
          const embKey = LOVABLE_KEY || OR_KEY;

          const embRes = await fetch(embUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${embKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: embModel, input: combined.slice(0, 2000), dimensions: 768 }),
          });
          if (embRes.ok) {
            const embData = await embRes.json();
            embedding = embData?.data?.[0]?.embedding || null;
          }
        } catch (_) {}

        // Atualiza o registro existente com o rascunho
        const updatePayload: Record<string, unknown> = {
          resposta: draft.resposta,
          source: "ai_draft",
          aprovada: false,
        };
        if (embedding) updatePayload.embedding = embedding;

        await supabase
          .from("imphq_wa_knowledge")
          .update(updatePayload)
          .eq("id", draft.id);

        totalDrafted++;
      }

      console.log(`[wa-knowledge-autofill] Project ${projectId}: ${drafts.length} drafts gerados`);
    }

    return new Response(JSON.stringify({ ok: true, drafted: totalDrafted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-knowledge-autofill] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
