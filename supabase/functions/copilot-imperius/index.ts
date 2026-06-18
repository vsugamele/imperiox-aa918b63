// Imperius Copilot — agente com tool calling (OpenRouter) + streaming SSE final
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { TOOL_SPECS, runTool, type ToolCtx } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";
const MAX_TOOL_STEPS = 5;

const PERSONA = `Você é Imperius, copiloto estratégico do Imperio HQ. Tom: direto, afiado, sem rodeios. Português brasileiro.

CAPACIDADES (via tools):
- LEITURA: vendasDoDia, vendasResumo, adsPerformance, buscarLead, leadsTravadosWhatsapp, ultimasMensagensWhatsapp.
- Resolver projeto por nome (buscarProjeto) ANTES de qualquer ação que mencione projeto.
- EXECUÇÃO AUTO (low-risk, sem confirmar): criarTarefas, adicionarChecklistNaTarefa, moverTarefa, agendarLembrete, anotarLead.
- EXECUÇÃO COM APROVAÇÃO (entra na Caixa de Ações): enviarWhatsapp, enviarWhatsappEmMassa.

REGRAS:
1. Projeto pelo nome → buscarProjeto primeiro. 1 match = use; múltiplos = pergunte qual.
2. Se buscarProjeto retornar matches:[] (fallback "sem_match_exato"), NÃO desista: cite os candidatos retornados (até 5 nomes) e pergunte ao usuário qual é o projeto. NUNCA encerre sem texto.
3. Perguntas sobre "hoje", "agora", "quem", SEMPRE use tools — nunca diga "não tenho dados".
4. Para criar tarefas em vários projetos, 1 call de criarTarefas POR projeto.
5. WhatsApp: SEMPRE via enviarWhatsapp/enviarWhatsappEmMassa — explique ao usuário que entrou na fila de aprovação.
6. Disparo em massa (>5 leads): confirme com o usuário ANTES de chamar a tool.
7. Use anotarLead para registrar fatos importantes sobre o lead direto na conversa.
8. Após executar tools, responda em pt-BR com: constatação central → números → próximos passos ("→ ...").
9. Nunca invente números. Use apenas o que veio das tools.
10. SEMPRE escreva ao menos uma frase em pt-BR antes de finalizar — mesmo que seja para pedir esclarecimento.`;

interface ContextHints {
  vendas30d_total: number;
  vendas30d_count: number;
  projeto_atual: string | null;
}

async function buildHints(supabase: any, projectId: string | null): Promise<ContextHints> {
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  let q = supabase.from("imphq_vendas").select("valor").eq("status", "aprovado").gte("data_venda", since30).limit(2000);
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  const total = (data || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  let projNome: string | null = null;
  if (projectId) {
    const { data: p } = await supabase.from("imphq_projects").select("name").eq("id", projectId).single();
    projNome = p?.name || null;
  }
  return { vendas30d_total: total, vendas30d_count: data?.length || 0, projeto_atual: projNome };
}

async function persistThread(supabase: any, userId: string, projectId: string | null, threadId: string | null, messages: any[], extraMeta: any) {
  const title = messages.find((m: any) => m.role === "user")?.content?.slice(0, 60) || "Nova conversa";
  try {
    if (threadId) {
      await supabase.from("imphq_copilot_threads").update({
        messages, updated_at: new Date().toISOString(),
      }).eq("id", threadId).eq("user_id", userId);
      return threadId;
    }
    const { data: inserted } = await supabase.from("imphq_copilot_threads").insert({
      user_id: userId, project_id: projectId, title, messages,
    }).select("id").single();
    return inserted?.id || null;
  } catch (e: any) {
    console.error("[copilot-imperius] persist failed:", e?.message);
    return threadId;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { messages, projectId, threadId } = body as { messages: any[]; projectId: string | null; threadId?: string };

    const hints = await buildHints(supabase, projectId);
    const ctx: ToolCtx = { supabase, userId: user.id, projectId };

    const systemPrompt = `${PERSONA}

CONTEXTO ATUAL:
- Projeto no header: ${hints.projeto_atual || "nenhum (todos os projetos)"}
- Vendas últimos 30d: R$${hints.vendas30d_total.toFixed(2)} (${hints.vendas30d_count} vendas)
- Data/hora agora: ${new Date().toISOString()}`;

    // Mensagens do modelo
    const modelMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Coletar tool activity para persistir e expor pro frontend
    const toolActivity: any[] = [];

    // Loop de tool calling (não-stream)
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, messages: modelMessages, tools: TOOL_SPECS, tool_choice: "auto", stream: false,
        }),
        signal: req.signal,
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("[copilot] tool-step err", res.status, t.slice(0, 300));
        if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tenta de novo." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        // sem tools — vamos streamar a resposta final
        modelMessages.push({ role: "assistant", content: msg.content || "" });
        break;
      }

      // Executar todas as tools desta rodada
      modelMessages.push({ role: "assistant", content: msg.content || null, tool_calls: toolCalls });
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        const result = await runTool(name, parsedArgs, ctx);
        toolActivity.push({ name, args: parsedArgs, result, ts: new Date().toISOString() });
        modelMessages.push({
          role: "tool", tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
      // continua loop pra próxima resposta
    }

    // Streaming da resposta final (sem tools, pra dar feel responsivo)
    const finalRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: modelMessages, stream: true }),
      signal: req.signal,
    });
    if (!finalRes.ok || !finalRes.body) {
      const t = await finalRes.text().catch(() => "");
      console.error("[copilot] final stream err", finalRes.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: "Falha na IA final" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Emitir prefixo SSE com tool activity antes do stream
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        if (toolActivity.length) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tools", tools: toolActivity })}\n\n`));
        }
        const reader = finalRes.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n"); buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j.choices?.[0]?.delta?.content;
                if (delta) fullText += delta;
              } catch {}
            }
          }
        } catch (e) { console.warn("[copilot] stream interrupted", e); }

        // Guard: se modelo não escreveu nada, gerar fallback útil
        let finalText = fullText.trim();
        if (!finalText) {
          const semMatch = toolActivity.find(
            (a) => a.name === "buscarProjeto" && a.result?.fallback === "sem_match_exato",
          );
          if (semMatch) {
            const termo = semMatch.result?.termo_buscado || "esse nome";
            const cands = (semMatch.result?.candidatos || [])
              .slice(0, 5)
              .map((c: any) => c.nome)
              .filter(Boolean);
            finalText = cands.length
              ? `Não encontrei projeto com "${termo}". Quis dizer: ${cands.join(", ")}?`
              : `Não encontrei projeto com "${termo}" e não há projetos ativos cadastrados.`;
          } else {
            finalText = "Não consegui formular uma resposta. Reformula o pedido?";
          }
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: finalText } }] })}\n\n`),
            );
          } catch {}
        }

        // Persistir
        if (!req.signal.aborted) {
          const newMessages = [
            ...messages,
            { role: "assistant", content: finalText, ts: new Date().toISOString(), tools: toolActivity },
          ];
          const savedId = await persistThread(supabase, user.id, projectId, threadId || null, newMessages, {});
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", threadId: savedId })}\n\n`));
          } catch {}
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err: any) {
    console.error("[copilot-imperius] fatal", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
