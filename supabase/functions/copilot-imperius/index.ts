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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL_PRIMARY = "google/gemini-2.5-flash";
const MODEL_FALLBACK = "google/gemini-2.5-pro";
const MAX_TOOL_STEPS = 5;

// Roteamento: prefixos google/ e openai/ vão pelo Lovable Gateway; resto pelo OpenRouter
function resolveProvider(model: string): { url: string; apiKey: string } {
  const isLovable = /^(google|openai)\//.test(model);
  if (isLovable) {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY };
  }
  if (!OPENROUTER_API_KEY) throw new Error(`OPENROUTER_API_KEY não configurada (modelo ${model})`);
  return { url: "https://openrouter.ai/api/v1/chat/completions", apiKey: OPENROUTER_API_KEY };
}

// Pré-matcher: força uma tool quando a pergunta é clara
function preMatchTool(text: string): string | null {
  const t = text.toLowerCase();
  if (/quem (mandou|enviou|falou)|últimas? mensage|mensagens? recente|chegou no whats/.test(t)) return "ultimasMensagensWhatsapp";
  if (/(vendas?|compr(ou|aram)|faturou|faturamento|receita)( de)? hoje/.test(t)) return "vendasDoDia";
  if (/(leads?)( de)? hoje\b|capturei hoje|quantos leads hoje/.test(t)) return "leadsDoDia";
  if (/(leads?|conversas?) (travad|parad|sem resposta|sem retorno)/.test(t)) return "leadsTravadosWhatsapp";
  if (/(cpa|roas|gasto( em)? ads|campanha (pior|melhor)|performance (do |dos )?ads)/.test(t)) return "adsPerformance";
  if (/leads? quent|hot lead|pix gerado|boleto gerado/.test(t)) return "leadsQuentes";
  // Investigativa: filtros de período, tag, formulário, evento
  if (/leads?.*(preench|formul[áa]rio|tag |da tag|com tag|sem tag|em (janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)|esse m[êe]s|[úu]ltimos? \d+ dias|entre \d|sem venda|com venda|responderam|preencheram)/.test(t)) return "buscarLeads";
  return null;
}

async function callAI(body: any, signal: AbortSignal, model = MODEL_PRIMARY) {
  const { url, apiKey } = resolveProvider(model);
  return await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "imperius-copilot",
    },
    body: JSON.stringify({ ...body, model }),
    signal,
  });
}

const PERSONA = `Você é Imperius, copiloto estratégico do Imperio HQ. Tom: direto, afiado, sem rodeios. Português brasileiro.

CAPACIDADES (via tools):
- LEITURA: vendasDoDia, vendasResumo, leadsDoDia, leadsResumo, buscarLeads (investigativa: período+tag+form+plataforma+evento+tem_venda), adsPerformance, buscarLead, leadsTravadosWhatsapp, leadsQuentes, ultimasMensagensWhatsapp.
- IMPORTANTE: "leads capturados/hoje/quantos leads" → use leadsDoDia. Consultas com FILTROS (mês, tag, formulário, evento, "quem preencheu", "quem respondeu", "sem venda") → use buscarLeads. NUNCA use vendasDoDia para pergunta sobre leads.
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

    // Pré-matcher: força tool específica no primeiro step quando reconhecemos intenção
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const forcedTool = preMatchTool(lastUserMsg);
    console.log("[copilot] start", { user_id: user.id, msg_preview: lastUserMsg.slice(0, 80), forced_tool: forcedTool, project_id: projectId });

    // Loop de tool calling (não-stream)
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const toolChoice = step === 0 && forcedTool
        ? { type: "function", function: { name: forcedTool } }
        : "auto";
      let res = await callAI({
        messages: modelMessages, tools: TOOL_SPECS, tool_choice: toolChoice, stream: false,
      }, req.signal);
      // Fallback de modelo em rate-limit/erro
      if (res.status === 429 || res.status === 502 || res.status === 503) {
        console.warn("[copilot] primary failed, trying fallback", res.status);
        res = await callAI({
          messages: modelMessages, tools: TOOL_SPECS, tool_choice: toolChoice, stream: false,
        }, req.signal, MODEL_FALLBACK);
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("[copilot] tool-step err", res.status, t.slice(0, 300));
        if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tenta de novo em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos Lovable AI esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: `Falha na IA (${res.status})` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      console.log("[copilot] step", step, { tool_calls: msg?.tool_calls?.map((t: any) => t.function?.name), content_len: msg?.content?.length || 0 });
      if (!msg) break;

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        modelMessages.push({ role: "assistant", content: msg.content || "" });
        break;
      }

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
    }

    // Streaming da resposta final
    let finalRes = await callAI({
      messages: modelMessages, stream: true, tool_choice: "none",
    }, req.signal);
    if (finalRes.status === 429 || finalRes.status === 502 || finalRes.status === 503) {
      console.warn("[copilot] final primary failed, fallback", finalRes.status);
      finalRes = await callAI({
        messages: modelMessages, stream: true, tool_choice: "none",
      }, req.signal, MODEL_FALLBACK);
    }
    if (!finalRes.ok || !finalRes.body) {
      const t = await finalRes.text().catch(() => "");
      console.error("[copilot] final stream err", finalRes.status, t.slice(0, 300));
      if (finalRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tenta de novo." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (finalRes.status === 402) return new Response(JSON.stringify({ error: "Créditos Lovable AI esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `Falha na IA final (${finalRes.status})` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          console.error("[copilot] EMPTY final response", { tool_count: toolActivity.length, tools: toolActivity.map(t => t.name) });
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
          } else if (toolActivity.length) {
            // Tenta verbalizar fallbacks específicos por tool antes de mostrar JSON.
            const wa = toolActivity.find((a) => a.name === "ultimasMensagensWhatsapp");
            if (wa) {
              const leads = wa.result?.leads || wa.result?.mensagens || [];
              const horas = wa.result?.horas ?? 24;
              if (!leads.length) {
                finalText = `Ninguém mandou mensagem no WhatsApp nas últimas ${horas}h.`;
              } else {
                const linhas = leads.slice(0, 10).map((l: any) => {
                  const quem = l.nome || l.phone;
                  const min = Math.round((Date.now() - new Date(l.em).getTime()) / 60000);
                  const quando = min < 60 ? `${min}min` : `${Math.round(min / 60)}h`;
                  return `- **${quem}** (há ${quando}): ${l.ultima || l.conteudo || ""}`;
                }).join("\n");
                finalText = `Nas últimas ${horas}h, ${leads.length} ${leads.length === 1 ? "lead mandou" : "leads mandaram"} mensagem:\n\n${linhas}`;
              }
            } else {
              const resumo = toolActivity.map((a) => `**${a.name}**: ${JSON.stringify(a.result).slice(0, 400)}`).join("\n\n");
              finalText = `Coletei os dados, mas a IA não escreveu resposta. Resumo bruto:\n\n${resumo}`;
            }
          } else {
            finalText = "Não consegui interpretar o pedido. Reformula? Ex: 'últimas mensagens no WhatsApp', 'vendas de hoje', 'leads travados'.";
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
