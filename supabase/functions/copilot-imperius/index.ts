import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

const PERSONA = `Você é Imperius, copiloto estratégico do Imperio HQ. Tom: direto, afiado, sem rodeios.
Responde em português brasileiro. Sempre se baseia em DADOS REAIS do contexto fornecido.
Quando der uma resposta:
1. Comece com a constatação central (1-2 linhas).
2. Detalhe os números que sustentam.
3. Termine com 1-3 ações concretas em bullets ("→ ...").
Nunca invente números — se faltar dado, diga "preciso de mais dados em [tabela X]".`;

interface ContextSummary {
  vendas30d: { total: number; count: number; topProduto: string | null };
  leadsQuentes: { count: number; topLeads: any[] };
  ads30d: { total: number; topCampanhas: any[] };
  recuperacao: { abertas: number; potencial: number };
  cohortRecente: { ultimoMes: string | null; novosLeads: number; recompra: number };
}

async function buildContext(supabase: any, projectId: string | null): Promise<ContextSummary> {
  const filter = (q: any, col = "project_id") => projectId ? q.eq(col, projectId) : q;
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const [vendas, leadsQ, ads, recovery] = await Promise.all([
    filter(supabase.from("imphq_vendas").select("valor, produto_nome, data_venda").eq("status", "aprovado").gte("data_venda", since30).limit(500)),
    filter(supabase.from("imphq_leads").select("id, nome, email, score, status").gte("score", 70).limit(20)),
    filter(supabase.from("imphq_ads_spend").select("valor, campanha, plataforma").gte("data_ref", since30.slice(0, 10)).limit(200)),
    filter(supabase.from("imphq_vendas").select("valor").in("status", ["pendente", "expirado", "carrinho_abandonado"]).limit(500)),
  ]);

  const vendasData = vendas.data || [];
  const totalVendas = vendasData.reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
  const produtoMap = new Map<string, number>();
  for (const v of vendasData) {
    const p = v.produto_nome || "—";
    produtoMap.set(p, (produtoMap.get(p) || 0) + Number(v.valor || 0));
  }
  const topProduto = [...produtoMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const adsData = ads.data || [];
  const totalAds = adsData.reduce((s: number, a: any) => s + Number(a.valor || 0), 0);
  const campMap = new Map<string, number>();
  for (const a of adsData) {
    const k = a.campanha || a.plataforma || "—";
    campMap.set(k, (campMap.get(k) || 0) + Number(a.valor || 0));
  }
  const topCampanhas = [...campMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, valor]) => ({ nome, valor }));

  const recoveryData = recovery.data || [];
  const potencial = recoveryData.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);

  return {
    vendas30d: { total: totalVendas, count: vendasData.length, topProduto },
    leadsQuentes: { count: (leadsQ.data || []).length, topLeads: (leadsQ.data || []).slice(0, 5) },
    ads30d: { total: totalAds, topCampanhas },
    recuperacao: { abertas: recoveryData.length, potencial },
    cohortRecente: { ultimoMes: new Date().toISOString().slice(0, 7), novosLeads: 0, recompra: 0 },
  };
}

async function buildRagBlock(supabase: any, query: string, projectId: string | null): Promise<{ block: string; sources: any[] }> {
  try {
    const emb = await getCachedEmbedding(supabase, query);
    if (!emb) return { block: "", sources: [] };
    const { data, error } = await supabase.rpc("match_rag_chunks", {
      query_embedding: emb as any,
      p_project_id: projectId,
      top_k: 5,
      min_similarity: 0.4,
    });
    if (error || !data?.length) return { block: "", sources: [] };
    const block = "\n## Conhecimento do projeto (top relevantes)\n" +
      data.map((c: any, i: number) => `[${i + 1}] (${c.source_type}/${c.source_field || "main"}, sim=${c.similarity.toFixed(2)})\n${c.content}`).join("\n\n");
    const sources = data.map((c: any) => ({
      source_type: c.source_type,
      source_field: c.source_field,
      similarity: Number(c.similarity.toFixed(2)),
    }));
    return { block, sources };
  } catch (e: any) {
    console.warn("[copilot-imperius] RAG failed:", e?.message);
    return { block: "", sources: [] };
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
    const { messages, projectId, threadId, stream = true } = body as { messages: any[]; projectId: string | null; threadId?: string; stream?: boolean };

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    const [ctx, rag] = await Promise.all([
      buildContext(supabase, projectId),
      buildRagBlock(supabase, lastUserMsg, projectId),
    ]);

    const contextBlock = `# CONTEXTO REAL DO NEGÓCIO ${projectId ? `(projeto ${projectId})` : "(todos os projetos)"} — últimos 30d

## Vendas
- Receita total: R$ ${ctx.vendas30d.total.toFixed(2)}
- Nº vendas aprovadas: ${ctx.vendas30d.count}
- Top produto: ${ctx.vendas30d.topProduto || "n/d"}

## Leads quentes (score ≥ 70)
- Quantidade: ${ctx.leadsQuentes.count}
- Top 5: ${ctx.leadsQuentes.topLeads.map((l: any) => `${l.nome || l.email} (score ${l.score}, status ${l.status})`).join("; ") || "—"}

## Investimento em ads
- Gasto total: R$ ${ctx.ads30d.total.toFixed(2)}
- Top campanhas: ${ctx.ads30d.topCampanhas.map((c: any) => `${c.nome}: R$${c.valor.toFixed(0)}`).join("; ") || "—"}
- ROAS aproximado: ${ctx.ads30d.total > 0 ? (ctx.vendas30d.total / ctx.ads30d.total).toFixed(2) : "n/d"}x

## Recuperação pendente
- Vendas abertas: ${ctx.recuperacao.abertas}
- Potencial em R$: ${ctx.recuperacao.potencial.toFixed(2)}
${rag.block}`;

    const aiMessages = [
      { role: "system", content: PERSONA + "\n\n" + contextBlock },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream,
      }),
      signal: req.signal,
    });


    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tenta de novo em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Helper para persistir thread após terminar
    const persistThread = async (replyText: string) => {
      const newMessages = [...messages, { role: "assistant", content: replyText, ts: new Date().toISOString(), sources: rag.sources }];
      const title = messages[0]?.content?.slice(0, 60) || "Nova conversa";
      try {
        if (threadId) {
          await supabase.from("imphq_copilot_threads").update({ messages: newMessages, updated_at: new Date().toISOString() }).eq("id", threadId).eq("user_id", user.id);
          return threadId;
        }
        const { data: inserted } = await supabase.from("imphq_copilot_threads").insert({
          user_id: user.id, project_id: projectId, title, messages: newMessages,
        }).select("id").single();
        return inserted?.id;
      } catch (e: any) {
        console.error("[copilot-imperius] persist failed:", e?.message);
        return threadId;
      }
    };

    // Modo legacy (sem stream)
    if (!stream) {
      const aiData = await aiRes.json();
      const reply = aiData.choices?.[0]?.message?.content || "Sem resposta.";
      const savedThreadId = await persistThread(reply);
      return new Response(JSON.stringify({ reply, threadId: savedThreadId, context: ctx, sources: rag.sources }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo streaming SSE — tee do upstream pro cliente e pra persistência
    let fullText = "";
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const transform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch { /* ignora chunks parciais */ }
        }
      },
      async flush(controller) {
        // Se o cliente abortou, ele persiste a parcial — evita race/duplicidade
        if (req.signal.aborted) {
          console.log("[copilot-imperius] aborted by client, skipping server persist");
          return;
        }
        const savedThreadId = await persistThread(fullText || "Sem resposta.");
        const meta = `data: ${JSON.stringify({ type: "meta", threadId: savedThreadId, sources: rag.sources })}\n\n`;
        try { controller.enqueue(encoder.encode(meta)); } catch { /* fechado */ }
      },

    });

    return new Response(aiRes.body!.pipeThrough(transform), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("copilot-imperius error", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
