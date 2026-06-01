import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

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

    const ctx = await buildContext(supabase, projectId);

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
`;

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
        model: "openai/gpt-4o-mini",
        messages: aiMessages,
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tenta de novo em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content || "Sem resposta.";

    // Salvar/atualizar thread
    const newMessages = [...messages, { role: "assistant", content: reply, ts: new Date().toISOString() }];
    const title = messages[0]?.content?.slice(0, 60) || "Nova conversa";

    let savedThreadId = threadId;
    if (threadId) {
      await supabase.from("imphq_copilot_threads").update({ messages: newMessages, updated_at: new Date().toISOString() }).eq("id", threadId).eq("user_id", user.id);
    } else {
      const { data: inserted } = await supabase.from("imphq_copilot_threads").insert({
        user_id: user.id,
        project_id: projectId,
        title,
        messages: newMessages,
      }).select("id").single();
      savedThreadId = inserted?.id;
    }

    return new Response(JSON.stringify({ reply, threadId: savedThreadId, context: ctx }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("copilot-imperius error", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
