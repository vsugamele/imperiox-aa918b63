import { z } from "https://esm.sh/zod@3.25.76";
import type { Database, Json } from "../../../src/integrations/supabase/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { record } from "../_shared/value.ts";
import { safeError } from "../_shared/errors.ts";
const requestSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system", "tool"]), content: z.string() }).passthrough()),
  projectId: z.string().nullish(),
  threadId: z.string().nullish(),
  channel: z.enum(["web", "whatsapp"]).optional(),
  userId: z.string().nullish(),
  senderName: z.string().nullish(),
  targetJid: z.string().nullish(),
  providerId: z.string().nullish(),
  stream: z.boolean().optional(),
});
const toolCallSchema = z.object({ id: z.string(), type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() }) });
const responseSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullish(), tool_calls: z.array(toolCallSchema).optional() }).optional() })).optional() });
type ModelMessage = { role: string; content: string | null; tool_call_id?: string; tool_calls?: z.infer<typeof toolCallSchema>[] };
type ToolActivity = { name: string; args: unknown; result: unknown; ts: string };
function jsonValue(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : jsonValue(item));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([,item]) => item !== undefined).map(([key,item]) => [key,jsonValue(item)]));
  throw new Error("Valor não serializável na conversa");
}
// Imperius Copilot — agente com tool calling (OpenRouter + Fallback) + Web SSE & WhatsApp
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { TOOL_SPECS, runTool, type ToolCtx } from "./tools.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("copilot-imperius");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MODEL_PRIMARY = Deno.env.get("COPILOT_MODEL_PRIMARY") || "google/gemini-2.5-flash";
const MODEL_FALLBACK = Deno.env.get("COPILOT_MODEL_FALLBACK") || "google/gemini-2.5-pro";
const MAX_TOOL_STEPS = 6;
const DEFAULT_ADMIN_USER_ID = "bded734b-15c0-4db3-851b-5ad763ee33c8"; // Vinicius

// Pré-matcher: força uma tool quando a pergunta é direta e sem filtro de projeto específico que precise de busca prévia
function preMatchTool(text: string): string | null {
  const t = text.toLowerCase();
  if (/testes? (de )?criativos?|testes? no ar|como est[aã]o os testes/.test(t)) return "testesCriativosNoAr";
  if (/fila de aprova|pendentes? (de |pra )?aprova|o que tem pra aprovar|decis[oõ]es pendentes/.test(t)) return "filaAprovacoesPendentes";
  if (/cloud ?phone|geelark|status dos aparelhos/.test(t)) return "statusCloudPhonesGeelark";
  if (/quem (mandou|enviou|falou)|últimas? mensage|mensagens? recente|chegou no whats/.test(t)) return "ultimasMensagensWhatsapp";
  if (/(leads?|conversas?) (travad|parad|sem resposta|sem retorno)/.test(t)) return "leadsTravadosWhatsapp";
  if (/leads? quent|hot lead|pix gerado|boleto gerado/.test(t)) return "leadsQuentes";
  return null;
}

// Chama OpenRouter prioritariamente (se configurado) com fallback automático para Lovable Gateway
async function callAI(body: Record<string, unknown>, signal: AbortSignal, model = MODEL_PRIMARY): Promise<Response> {
  const providers: Array<{ name: string; url: string; key: string }> = [];
  if (OPENROUTER_API_KEY) {
    providers.push({ name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY });
  }
  if (LOVABLE_API_KEY && /^(google|openai)\//.test(model)) {
    providers.push({ name: "lovable", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_API_KEY });
  }
  if (!providers.length) {
    throw new Error("Nenhuma chave de IA configurada (OPENROUTER_API_KEY / LOVABLE_API_KEY)");
  }

  let lastRes: Response | null = null;
  for (const prov of providers) {
    try {
      const res = await fetch(prov.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${prov.key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://imperiox.vercel.app",
          "X-Title": "Imperio HQ Copilot",
          "X-Lovable-AIG-SDK": "imperius-copilot",
        },
        body: JSON.stringify({ ...body, model }),
        signal,
      });
      if (res.ok) return res;
      lastRes = res;
      console.warn(`[copilot] provider ${prov.name} returned ${res.status} for model ${model}, trying next provider if available`);
    } catch (e) {
      console.warn(`[copilot] provider ${prov.name} fetch error:`, safeError(e));
    }
  }
  return lastRes || new Response(JSON.stringify({ error: "Falha em todos os provedores de IA" }), { status: 502 });
}

const PERSONA = `Você é Imperius, Diretor de Operações e Copiloto Estratégico da Império Digital (Imperio HQ).
Você atende diretamente os sócios fundadores (Vinicius Sugamele e Bruno - Macete Mental).
Tom: executivo, direto, afiado, sem rodeios, orientado a dados reais e execução imediata. Português brasileiro.

PROJETOS ATIVOS (IDs diretos que você já pode passar direto no parâmetro projeto_id das tools):
- jp_freitas (JP Freitas / Código dos Cortes Perfeitos R$47 / Finalização Express / JP Hair Education)
- slimsoda (SlimSoda Powder US DTC / Whop)
- linfaflow (LinfaFlow DTC Drenagem Linfática / X1 / Care Room)
- cardioflush (CardioFlush LT)
- cinna-shield (Cinna Shield)
- memoflow (MemoFlow)
- leaftide (Leaftide)
- vigor_boost (Vigor Boost)
- horsejello (HorseJello)
- vanessa_equilibreon (Vanessa — EquilibreON)
- laise (Laíse — Aviator)
- tatuagem (Tatuagem — Jonathan)
- dr---fitness (DR - Fitness)

CAPACIDADES COMPLETAS (64 tools):
1. PROJETOS & MAPAS: listarProjetos, buscarProjeto, mapaOperacionalProjeto, dossieProdutoBlueprint (mecanismo, avatar, oferta, páginas e swipes).
2. VENDAS & CAIXA: vendasDoDia, vendasResumo, vendasPorPlataforma, lucroDoDia, projecaoLucroMes, previsaoReceita, fluxoCaixaMes, chargebacksRecentes.
3. TRÁFEGO & ADS: testesCriativosNoAr (testes ativos, gasto Zernio, IC, vendas reais, CPA por variante), adsPerformance, listarAnunciosAtivos, pausarAnuncio, ativarAnuncio, ajustarOrcamentoAdset, roasPorCriativo, alertaQueimaOrcamento, diagnosticoYoshitani.
4. LEADS & WHATSAPP CRM: leadsDoDia, leadsResumo, buscarLeads (filtros: desde, ate, tag, form_id, plataforma, status, evento, tem_venda), buscarLead, leadsTravadosWhatsapp, ultimasMensagensWhatsapp, leadsQuentes, funilPorEtapa, listarRecuperaveis, recuperarVendaPix, listarTemplatesRecuperacao, pontuarLead, anotarLead, enviarWhatsapp, enviarWhatsappEmMassa, agendarMensagemWhatsapp, listarAgendamentosWhatsapp, cancelarAgendamentoWhatsapp, statusChipsWhatsapp.
5. CRIATIVOS, IMAGENS & MERCADO: gerarImagemCriativo (gera imagem real e envia no chat/WhatsApp), topCriativos, listarBatchesCriativos, oportunidadesMercado, concorrentesAtivos.
6. TAREFAS, ROTINAS & APROVAÇÕES: filaAprovacoesPendentes, gerenciarRotinasDiarias (listar/criar/pausar/ativar), dispararRotinaSistema (relatorio_testes, briefing_matinal, sincronizar_ads, monitor_saude_wa), criarTarefas, adicionarChecklistNaTarefa, moverTarefa, atribuirTarefa, tarefasPorResponsavel, tarefasAtrasadas, cargaTrabalhoEquipe, listarEquipe, estatisticasKanban, agendarLembrete, proximosEventosCalendario, briefingDiario, automacoesAtivas, execucoesTravadas.

REGRAS DE OURO:
1. Se o usuário mencionar um projeto conhecido (ex: "JP", "Slim Soda", "LinfaFlow", "CardioFlush"), você já pode usar o ID direto correspondente (ex: "jp_freitas", "slimsoda", "linfaflow", "cardioflush") ou chamar buscarProjeto se tiver dúvida.
2. Perguntas sobre dados, métricas, testes, vendas, leads, tarefas ou status: SEMPRE chame as tools correspondentes antes de responder. Nunca invente números.
3. Se o usuário pedir para GERAR UMA IMAGEM ou CRIATIVO VISUAL, chame a tool gerarImagemCriativo com um prompt visual detalhado.
4. Se o usuário pedir para escrever copy, ganchos (hooks), roteiros (Reels/TikTok/Comment-to-DM/VSL) de um produto específico, consulte primeiro dossieProdutoBlueprint ou topCriativos do projeto para usar o mecanismo, avatar e dores reais daquele produto.
5. Após executar tools, responda em pt-BR com clareza: constatação direta → números/dados → próximos passos acionáveis.`;

interface ContextHints {
  vendas30d_total: number;
  vendas30d_count: number;
  projeto_atual: string | null;
}

async function buildHints(supabase: SupabaseClient<Database>, projectId: string | null): Promise<ContextHints> {
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  let q = supabase.from("imphq_vendas").select("valor").eq("status", "aprovado").gte("data_venda", since30).limit(2000);
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  const total = (data || []).reduce((s: number, v) => s + Number(v.valor || 0), 0);
  let projNome: string | null = null;
  if (projectId) {
    const { data: p } = await supabase.from("imphq_projects").select("name").eq("id", projectId).single();
    projNome = p?.name || null;
  }
  return { vendas30d_total: total, vendas30d_count: data?.length || 0, projeto_atual: projNome };
}

async function persistThread(supabase: SupabaseClient<Database>, userId: string, projectId: string | null, threadId: string | null, messages: unknown[], customTitle?: string) {
  const title = customTitle || String(record(messages.find(m => record(m).role === "user")).content || "").slice(0, 60) || "Nova conversa";
  try {
    if (threadId) {
      await supabase.from("imphq_copilot_threads").update({
        messages: jsonValue(messages), updated_at: new Date().toISOString(),
      }).eq("id", threadId);
      return threadId;
    }
    const { data: inserted } = await supabase.from("imphq_copilot_threads").insert({
      user_id: userId, project_id: projectId, title, messages: jsonValue(messages),
    }).select("id").single();
    return inserted?.id || null;
  } catch (e) {
    console.error("[copilot-imperius] persist failed:", safeError(e));
    return threadId;
  }
}

function buildFallbackText(toolActivity: ToolActivity[]): string {
  const semMatch = toolActivity.find(
    (a) => a.name === "buscarProjeto" && record(a.result).fallback === "sem_match_exato",
  );
  if (semMatch) {
    const termo = record(semMatch.result).termo_buscado || "esse nome";
    const candidates = record(semMatch.result).candidatos;
    const cands = (Array.isArray(candidates) ? candidates : [])
      .slice(0, 5)
      .map((c) => record(c).nome)
      .filter(Boolean);
    return cands.length
      ? `Não encontrei projeto com "${termo}". Quis dizer: ${cands.join(", ")}?`
      : `Não encontrei projeto com "${termo}" e não há projetos ativos cadastrados.`;
  }
  if (toolActivity.length) {
    const wa = toolActivity.find((a) => a.name === "ultimasMensagensWhatsapp");
    if (wa) {
      const leadData = record(wa.result).leads || record(wa.result).mensagens;
      const leads = Array.isArray(leadData) ? leadData.map(record) : [];
      const horas = record(wa.result).horas ?? 24;
      if (!leads.length) return `Ninguém mandou mensagem no WhatsApp nas últimas ${horas}h.`;
      const linhas = leads.slice(0, 10).map((l) => {
        const quem = l.nome || l.phone;
        const min = Math.round((Date.now() - new Date(typeof l.em === "string" ? l.em : 0).getTime()) / 60000);
        const quando = min < 60 ? `${min}min` : `${Math.round(min / 60)}h`;
        return `- *${quem}* (há ${quando}): ${l.ultima || l.conteudo || ""}`;
      }).join("\n");
      return `Nas últimas ${horas}h, ${leads.length} ${leads.length === 1 ? "lead mandou" : "leads mandaram"} mensagem:\n\n${linhas}`;
    }
    const resumo = toolActivity.map((a) => `*${a.name}*: ${JSON.stringify(a.result).slice(0, 400)}`).join("\n\n");
    return `Dados coletados:\n\n${resumo}`;
  }
  return "Preciso de mais detalhe pra investigar. Ex: 'como estão os testes de criativos', 'vendas de hoje do JP', 'gera uma imagem de criativo pro SlimSoda'.";
}

function formatForWhatsApp(md: string): string {
  return md
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/^#{1,3}\s+(.+)$/gm, "*$1*")
    .trim();
}

async function sendWhatsAppReply(
  supabase: SupabaseClient<Database>,
  targetJid: string,
  providerId: string | null | undefined,
  text: string,
  images: string[],
) {
  let q = supabase.from("imphq_wa_providers").select("id, api_url, api_key, instance_name").eq("is_active", true);
  if (providerId) q = q.eq("id", providerId);
  const { data: prov } = await q.order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!prov?.api_url || !prov?.instance_name || !prov?.api_key) {
    console.warn("[copilot-wa] Nenhum provider Evolution ativo encontrado para responder");
    return;
  }

  const apiBase = String(prov.api_url).replace(/\/+$/, "");
  const inst = encodeURIComponent(String(prov.instance_name));
  const number = targetJid.includes("@") ? targetJid : `${targetJid}@s.whatsapp.net`;

  if (text) {
    const waText = `🤖 *Imperius*\n\n${formatForWhatsApp(text)}`;
    await fetch(`${apiBase}/message/sendText/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: String(prov.api_key) },
      body: JSON.stringify({ number, text: waText }),
    }).catch((e) => console.warn("[copilot-wa] sendText error:", safeError(e)));
  }

  for (const imgUrl of images) {
    await fetch(`${apiBase}/message/sendMedia/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: String(prov.api_key) },
      body: JSON.stringify({
        number,
        mediatype: "image",
        media: imgUrl,
        caption: "🎨 Criativo gerado pelo Imperius",
      }),
    }).catch((e) => console.warn("[copilot-wa] sendMedia error:", safeError(e)));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE);
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Conversa inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isServiceRole = Boolean(SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`);
    let userId = parsed.data.userId || DEFAULT_ADMIN_USER_ID;

    if (!isServiceRole) {
      let authorizedTeamMember = false;
      if (parsed.data.channel === "whatsapp" && parsed.data.userId) {
        const { data: tm } = await supabase
          .from("imphq_team_members")
          .select("user_id")
          .eq("user_id", parsed.data.userId)
          .or("is_active.eq.true,is_active.is.null")
          .maybeSingle();
        if (tm?.user_id) {
          authorizedTeamMember = true;
          userId = tm.user_id;
        }
      }

      if (!authorizedTeamMember) {
        const userClient = createClient<Database>(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        userId = user.id;
      }
    }

    const channel = parsed.data.channel || "web";
    const isWhatsApp = channel === "whatsapp" || parsed.data.stream === false;
    const targetJid = parsed.data.targetJid || null;
    const projectId = parsed.data.projectId ?? null;
    let threadId = parsed.data.threadId ?? null;
    let conversationMessages = parsed.data.messages;

    // Se vier do WhatsApp e tiver targetJid, recupera histórico recente (últimas 6h) daquela conversa
    const waThreadTitle = targetJid ? `wa:${targetJid}` : undefined;
    if (isWhatsApp && waThreadTitle && !threadId) {
      const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString();
      const { data: recentThread } = await supabase
        .from("imphq_copilot_threads")
        .select("id, messages")
        .eq("title", waThreadTitle)
        .gte("updated_at", cutoff)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentThread?.id && Array.isArray(recentThread.messages)) {
        threadId = recentThread.id;
        const past = (recentThread.messages as Array<Record<string, unknown>>)
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
          .slice(-8)
          .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));
        conversationMessages = [...past, ...conversationMessages];
      }
    }

    const hints = await buildHints(supabase, projectId);
    const ctx: ToolCtx = { supabase, userId, projectId };

    const channelInstructions = isWhatsApp
      ? `\nCANAL ATUAL: WhatsApp (${targetJid?.endsWith("@g.us") ? "Grupo Oficial Imperio X com os sócios Vinicius e Bruno" : "Chat Privado 1 a 1 com sócio"}).\nRemetente atual: ${parsed.data.senderName || "Sócio"}.\nFormate para leitura rápida no celular (use *negrito* com 1 asterisco, listas curtas e objetivas).`
      : "";

    const systemPrompt = `${PERSONA}${channelInstructions}

CONTEXTO ATUAL:
- Projeto no header: ${hints.projeto_atual || "nenhum (todos os projetos disponíveis)"}
- Vendas aprovadas últimos 30d: R$${hints.vendas30d_total.toFixed(2)} (${hints.vendas30d_count} vendas)
- Data/hora agora: ${new Date().toISOString()}`;

    const modelMessages: ModelMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const toolActivity: ToolActivity[] = [];
    const generatedImages: string[] = [];

    const lastUserMsg = [...conversationMessages].reverse().find((m) => m.role === "user")?.content || "";
    const forcedTool = preMatchTool(lastUserMsg);
    console.log("[copilot] start", { user_id: userId, channel, msg_preview: lastUserMsg.slice(0, 80), forced_tool: forcedTool, project_id: projectId });

    let loopAnswer = "";

    // Loop de tool calling
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const toolChoice = step === 0 && forcedTool
        ? { type: "function", function: { name: forcedTool } }
        : "auto";
      let res = await callAI({
        messages: modelMessages, tools: TOOL_SPECS, tool_choice: toolChoice, stream: false,
      }, req.signal);
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 402) {
        console.warn("[copilot] primary failed, trying fallback model", res.status);
        res = await callAI({
          messages: modelMessages, tools: TOOL_SPECS, tool_choice: toolChoice, stream: false,
        }, req.signal, MODEL_FALLBACK);
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("[copilot] tool-step err", res.status, t.slice(0, 300));
        const errMsg = res.status === 429
          ? "Rate limit atingido. Tente novamente em alguns segundos."
          : `Falha temporária na IA (${res.status}).`;
        if (isWhatsApp && targetJid) {
          await sendWhatsAppReply(supabase, targetJid, parsed.data.providerId, `⚠️ ${errMsg}`, []);
        }
        return new Response(JSON.stringify({ error: errMsg }), { status: res.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = responseSchema.parse(await res.json());
      const choice = data.choices?.[0];
      const msg = choice?.message;
      console.log("[copilot] step", step, { tool_calls: msg?.tool_calls?.map((t) => t.function?.name), content_len: msg?.content?.length || 0 });
      if (!msg) break;

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        loopAnswer = (msg.content || "").trim();
        if (loopAnswer) {
          modelMessages.push({ role: "assistant", content: loopAnswer });
        }
        break;
      }

      modelMessages.push({ role: "assistant", content: msg.content || null, tool_calls: toolCalls });
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let parsedArgs: unknown = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
        const result = await runTool(name, parsedArgs, ctx);
        const recResult = record(result);
        if (typeof recResult.image_url === "string" && recResult.image_url) {
          generatedImages.push(recResult.image_url);
        }
        toolActivity.push({ name, args: parsedArgs, result, ts: new Date().toISOString() });
        modelMessages.push({
          role: "tool", tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }

    // ── MODO WHATSAPP / JSON (Sem SSE) ──
    if (isWhatsApp) {
      let finalText = loopAnswer;
      if (!finalText) {
        let synRes = await callAI({
          messages: modelMessages, stream: false, tool_choice: "none",
        }, req.signal);
        if (!synRes.ok) {
          synRes = await callAI({
            messages: modelMessages, stream: false, tool_choice: "none",
          }, req.signal, MODEL_FALLBACK);
        }
        if (synRes.ok) {
          const synData = responseSchema.parse(await synRes.json());
          finalText = (synData.choices?.[0]?.message?.content || "").trim();
        }
      }
      if (!finalText) {
        finalText = buildFallbackText(toolActivity);
      }

      const newMessages = [
        ...conversationMessages,
        { role: "assistant", content: finalText, ts: new Date().toISOString(), tools: toolActivity },
      ];
      const savedId = await persistThread(supabase, userId, projectId, threadId, newMessages, waThreadTitle);

      if (targetJid) {
        await sendWhatsAppReply(supabase, targetJid, parsed.data.providerId, finalText, generatedImages);
      }

      return new Response(
        JSON.stringify({ ok: true, text: finalText, tools: toolActivity, images: generatedImages, threadId: savedId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── MODO WEB UI (Streaming SSE) ──
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Se o loop já produziu a resposta final completa em loopAnswer, emite direto via SSE sem gastar segunda chamada
    if (loopAnswer) {
      const stream = new ReadableStream({
        async start(controller) {
          if (toolActivity.length) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tools", tools: toolActivity })}\n\n`));
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: loopAnswer } }] })}\n\n`),
          );
          const newMessages = [
            ...conversationMessages,
            { role: "assistant", content: loopAnswer, ts: new Date().toISOString(), tools: toolActivity },
          ];
          const savedId = await persistThread(supabase, userId, projectId, threadId, newMessages);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", threadId: savedId })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    // Caso o loop tenha atingido MAX_TOOL_STEPS terminando em tool result, faz streaming da síntese final
    let finalRes = await callAI({
      messages: modelMessages, stream: true, tool_choice: "none",
    }, req.signal);
    if (finalRes.status === 429 || finalRes.status === 502 || finalRes.status === 503 || finalRes.status === 402) {
      console.warn("[copilot] final primary failed, fallback", finalRes.status);
      finalRes = await callAI({
        messages: modelMessages, stream: true, tool_choice: "none",
      }, req.signal, MODEL_FALLBACK);
    }
    if (!finalRes.ok || !finalRes.body) {
      const t = await finalRes.text().catch(() => "");
      console.error("[copilot] final stream err", finalRes.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: `Falha na IA final (${finalRes.status})` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
                const j: unknown = JSON.parse(payload);
                const choices = record(j).choices;
                const delta = Array.isArray(choices) ? record(record(choices[0]).delta).content : undefined;
                if (typeof delta === "string") fullText += delta;
              } catch { /* ignore */ }
            }
          }
        } catch (e) { console.warn("[copilot] stream interrupted", e); }

        let finalText = fullText.trim();
        if (!finalText) {
          finalText = buildFallbackText(toolActivity);
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: finalText } }] })}\n\n`),
            );
          } catch { /* ignore */ }
        }

        if (!req.signal.aborted) {
          const newMessages = [
            ...conversationMessages,
            { role: "assistant", content: finalText, ts: new Date().toISOString(), tools: toolActivity },
          ];
          const savedId = await persistThread(supabase, userId, projectId, threadId, newMessages);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", threadId: savedId })}\n\n`));
          } catch { /* ignore */ }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err) {
    console.error("[copilot-imperius] fatal", err);
    return new Response(JSON.stringify({ error: safeError(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
