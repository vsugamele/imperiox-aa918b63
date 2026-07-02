// wa-memory-extract — extrai memória estruturada de uma conversa e atualiza lead_memory + conversation_summary
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { conversation_id, lead_id, project_id } = await req.json();

    if (!conversation_id || !lead_id) {
      return new Response(JSON.stringify({ error: "conversation_id e lead_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pega últimas 30 mensagens da conversa
    const { data: msgs } = await supabase
      .from("imphq_wa_messages")
      .select("direction, content, sent_by, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(30);

    // Conta total de mensagens para gating de re-extração
    const { count: totalMsgs } = await supabase
      .from("imphq_wa_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation_id);


    if (!msgs || msgs.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pega lead_memory atual
    const { data: lead } = await supabase
      .from("imphq_leads")
      .select("lead_memory, name, awareness_level")
      .eq("id", lead_id)
      .maybeSingle();

    const existingMemory = (lead as any)?.lead_memory || {};

    const transcript = msgs
      .reverse()
      .map((m: any) => {
        const role = m.direction === "outgoing" ? "Assistente" : "Lead";
        return `${role}: ${m.content}`;
      })
      .join("\n");

    const systemPrompt = `Você é um extrator de memória de lead para sistema de vendas.
Analise a conversa e extraia informações relevantes para enriquecer o perfil do lead.
Responda APENAS com JSON válido no formato abaixo (sem markdown, sem explicação):

{
  "summary": "resumo da sessão em 1-2 frases",
  "nome_preferido": "como o lead prefere ser chamado ou null",
  "interesse_principal": "produto/serviço de maior interesse ou null",
  "nivel_qualificacao": "frio | morno | quente — baseado em intenção real de compra (frio=apenas curioso, morno=engajado/perguntando detalhes, quente=pediu preço/link/pix ou disse que quer comprar)",
  "objecoes_novas": ["lista de objeções novas mencionadas"],
  "objecao_atual": "a objeção MAIS recente que está travando o lead, ou null",
  "gatilhos_positivos": ["coisas que o lead reagiu positivamente"],
  "produtos_mencionados": ["produtos/serviços citados pelo lead"],
  "informacoes_pessoais": {"profissao": null, "objetivo": null, "dor_principal": null},
  "qualificacao": {
    "nivel": "iniciante | intermediario | avancado | null — experiência do lead na área",
    "objetivo": "hobby | renda_extra | profissionalizar | escalar | null — o que quer alcançar",
    "formato_pref": "online | presencial | hibrido | null — formato preferido",
    "orcamento_sinal": "baixo | medio | alto | null — sinais de poder de compra ou objeção de preço",
    "urgencia": "agora | 30d | explorando | null — quando pretende decidir"
  },
  "proximo_passo_sugerido": "ação recomendada para a próxima interação ou null",
  "notas_ia": "observações relevantes para próxima abordagem ou null"
}

REGRAS DE QUALIFICACAO:
- Preencha SÓ o que o lead disse EXPLICITAMENTE ou deu sinal claro. Nunca invente.
- Se não houver evidência, deixe null. Prefira null a chute.
- Mantenha o que já foi capturado antes, só sobrescreva com evidência nova.`;


    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Memória existente do lead: ${JSON.stringify(existingMemory).slice(0, 500)}\n\nConversa:\n${transcript.slice(0, 4000)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) throw new Error(`AI error ${resp.status}`);
    const aiData = await resp.json();
    const extracted = JSON.parse(aiData?.choices?.[0]?.message?.content || "{}");

    // Merge inteligente com memória existente
    const newMemory: Record<string, any> = { ...existingMemory };

    if (extracted.nome_preferido) newMemory.nome_preferido = extracted.nome_preferido;
    if (extracted.interesse_principal) newMemory.interesse_principal = extracted.interesse_principal;
    if (extracted.proximo_passo_sugerido) newMemory.proximo_passo_sugerido = extracted.proximo_passo_sugerido;
    if (extracted.notas_ia) newMemory.notas_ia = extracted.notas_ia;

    if (Array.isArray(extracted.objecoes_novas) && extracted.objecoes_novas.length > 0) {
      const existing = newMemory.objecoes_recorrentes || [];
      const merged = [...new Set([...existing, ...extracted.objecoes_novas])].slice(-10);
      newMemory.objecoes_recorrentes = merged;
    }

    if (Array.isArray(extracted.gatilhos_positivos) && extracted.gatilhos_positivos.length > 0) {
      const existing = newMemory.gatilhos_positivos || [];
      newMemory.gatilhos_positivos = [...new Set([...existing, ...extracted.gatilhos_positivos])].slice(-10);
    }

    if (Array.isArray(extracted.produtos_mencionados) && extracted.produtos_mencionados.length > 0) {
      const existing = newMemory.produtos_mencionados || [];
      newMemory.produtos_mencionados = [...new Set([...existing, ...extracted.produtos_mencionados])].slice(-10);
    }

    if (extracted.informacoes_pessoais) {
      newMemory.informacoes_pessoais = { ...(newMemory.informacoes_pessoais || {}), ...extracted.informacoes_pessoais };
    }

    // Qualificação consultiva — merge preservando dimensões já preenchidas
    if (extracted.qualificacao && typeof extracted.qualificacao === "object") {
      const prev = newMemory.qualificacao || {};
      const next: Record<string, any> = { ...prev };
      const validEnums: Record<string, string[]> = {
        nivel: ["iniciante", "intermediario", "avancado"],
        objetivo: ["hobby", "renda_extra", "profissionalizar", "escalar"],
        formato_pref: ["online", "presencial", "hibrido"],
        orcamento_sinal: ["baixo", "medio", "alto"],
        urgencia: ["agora", "30d", "explorando"],
      };
      for (const [k, allowed] of Object.entries(validEnums)) {
        const v = String(extracted.qualificacao?.[k] || "").toLowerCase().trim();
        if (allowed.includes(v)) next[k] = v;
      }
      newMemory.qualificacao = next;
      newMemory.qualificacao_updated_at = new Date().toISOString();
    }


    // Atualiza tanto lead_memory (JSONB) quanto as colunas FLAT consumidas pelo CRM
    const leadUpdate: Record<string, any> = {
      lead_memory: newMemory,
      updated_at: new Date().toISOString(),
    };
    const nivel = String(extracted.nivel_qualificacao || "").toLowerCase().trim();
    if (["frio", "morno", "quente"].includes(nivel)) {
      leadUpdate.nivel_qualificacao = nivel;
      leadUpdate.qualificacao_updated_at = new Date().toISOString();
    }
    if (extracted.interesse_principal) leadUpdate.ultimo_interesse = String(extracted.interesse_principal).slice(0, 200);
    const dor = extracted?.informacoes_pessoais?.dor_principal;
    if (dor) leadUpdate.dor_principal = String(dor).slice(0, 300);
    if (extracted.objecao_atual) leadUpdate.objecao_atual = String(extracted.objecao_atual).slice(0, 300);

    await Promise.all([
      supabase.from("imphq_leads").update(leadUpdate).eq("id", lead_id),
      supabase.from("imphq_wa_conversations")
        .update({
          conversation_summary: extracted.summary || null,
          last_memory_extract_at: new Date().toISOString(),
          last_memory_extract_msg_count: totalMsgs ?? msgs.length,
        })
        .eq("id", conversation_id),
    ]);


    // Persist key memory snippets as vector entries for semantic retrieval in wa-ai-reply
    if (project_id && LOVABLE_API_KEY) {
      const memorySnippets: { content: string; memory_type: string }[] = [];
      if (extracted.summary) {
        memorySnippets.push({ content: extracted.summary, memory_type: "summary" });
      }
      if (Array.isArray(extracted.objecoes_novas)) {
        extracted.objecoes_novas.forEach((o: string) => {
          if (o) memorySnippets.push({ content: `Lead tem objeção: ${o}`, memory_type: "objecao" });
        });
      }
      if (Array.isArray(extracted.gatilhos_positivos)) {
        extracted.gatilhos_positivos.forEach((g: string) => {
          if (g) memorySnippets.push({ content: `Lead responde positivamente a: ${g}`, memory_type: "gatilho" });
        });
      }

      const { data: conv } = await supabase
        .from("imphq_wa_conversations")
        .select("phone")
        .eq("id", conversation_id)
        .maybeSingle();
      const phone = (conv as any)?.phone || "";

      for (const snippet of memorySnippets.slice(0, 5)) {
        try {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-embedding-001", input: snippet.content, dimensions: 768 }),
          });
          if (embRes.ok) {
            const embJson = await embRes.json();
            const embedding = embJson?.data?.[0]?.embedding;
            if (embedding) {
              await supabase.from("imphq_wa_lead_memories").insert({
                project_id,
                lead_id,
                phone,
                content: snippet.content,
                memory_type: snippet.memory_type,
                embedding,
              });
            }
          }
        } catch (_) { /* non-critical */ }
      }
    }

    console.log(`[wa-memory-extract] lead=${lead_id} conv=${conversation_id} keys=${Object.keys(newMemory).join(",")}`);

    return new Response(
      JSON.stringify({ ok: true, extracted, lead_memory_keys: Object.keys(newMemory) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("wa-memory-extract:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
