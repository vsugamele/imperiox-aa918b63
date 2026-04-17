// Daily Briefing Edge Function
// Gera resumo executivo diário com IA cruzando vendas, leads, ads e tarefas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Action { label: string; route: string; icon: string }

async function gatherMetrics(supabase: any, projectId: string | null) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  // Vendas 24h
  let vendasQ: any = supabase.from("imphq_vendas").select("valor, produto_nome, status").eq("status", "aprovado").gte("created_at", last24h);
  if (projectId) vendasQ = vendasQ.eq("project_id", projectId);
  const vendas24hRes: any = await vendasQ;
  const vendas24h: any[] = vendas24hRes?.data ?? [];

  // Vendas 7d
  let vendas7Q: any = supabase.from("imphq_vendas").select("valor").eq("status", "aprovado").gte("created_at", last7d);
  if (projectId) vendas7Q = vendas7Q.eq("project_id", projectId);
  const vendas7dRes: any = await vendas7Q;
  const vendas7d: any[] = vendas7dRes?.data ?? [];

  // Hot leads não contactados (score>=70 e sem follow-up nas últimas 2h)
  let leadsQ: any = supabase.from("imphq_leads").select("id, nome, score, ultimo_contato_em").gte("score", 70).gte("created_at", last2h);
  if (projectId) leadsQ = leadsQ.eq("project_id", projectId);
  const hotLeadsRes: any = await leadsQ;
  const hotLeadsRaw: any[] = hotLeadsRes?.data ?? [];
  const hotLeads = hotLeadsRaw.filter((l) => !l.ultimo_contato_em || new Date(l.ultimo_contato_em).getTime() < Date.now() - 2 * 60 * 60 * 1000);

  // Tarefas atrasadas
  let tasksQ: any = supabase.from("imphq_tasks").select("id, titulo, due_date").lt("due_date", new Date().toISOString()).neq("status", "done");
  if (projectId) tasksQ = tasksQ.eq("project_id", projectId);
  const tarefasRes: any = await tasksQ;
  const tarefasAtrasadas: any[] = tarefasRes?.data ?? [];

  const receita24h = vendas24h.reduce((s, v) => s + Number(v.valor || 0), 0);
  const receita7d = vendas7d.reduce((s, v) => s + Number(v.valor || 0), 0);
  const mediaDiaria = receita7d / 7;
  const ticketMedio = vendas24h.length > 0 ? receita24h / vendas24h.length : 0;
  const variacao = mediaDiaria > 0 ? ((receita24h - mediaDiaria) / mediaDiaria) * 100 : 0;

  return {
    receita24h,
    vendasCount: vendas24h.length,
    ticketMedio,
    mediaDiaria,
    variacaoVsMedia: variacao,
    hotLeadsCount: hotLeads.length,
    hotLeadsNomes: hotLeads.slice(0, 3).map((l: any) => l.nome).filter(Boolean),
    tarefasAtrasadasCount: tarefasAtrasadas.length,
    tarefasAtrasadasTitulos: tarefasAtrasadas.slice(0, 3).map((t: any) => t.titulo).filter(Boolean),
  };
}

async function generateBriefingWithAI(metrics: any): Promise<{ briefing_text: string; actions: Action[] }> {
  const systemPrompt = `Você é o Imperius, comandante estratégico do Imperio HQ. Gere briefings executivos diários em português do Brasil, tom direto e estratégico, sem rodeios. Máximo 3 frases. Identifique a oportunidade ou risco mais crítico AGORA.`;

  const userPrompt = `Métricas das últimas 24h:
- Receita: R$ ${metrics.receita24h.toFixed(2)} (${metrics.vendasCount} vendas)
- Ticket médio: R$ ${metrics.ticketMedio.toFixed(2)}
- Média diária 7d: R$ ${metrics.mediaDiaria.toFixed(2)}
- Variação vs média: ${metrics.variacaoVsMedia.toFixed(1)}%
- Hot leads não contactados: ${metrics.hotLeadsCount} ${metrics.hotLeadsNomes.length ? `(ex: ${metrics.hotLeadsNomes.join(", ")})` : ""}
- Tarefas atrasadas: ${metrics.tarefasAtrasadasCount} ${metrics.tarefasAtrasadasTitulos.length ? `(ex: ${metrics.tarefasAtrasadasTitulos.join(", ")})` : ""}

Gere o briefing e 3 ações priorizadas.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "emit_briefing",
          description: "Emite o briefing diário e as 3 ações prioritárias.",
          parameters: {
            type: "object",
            properties: {
              briefing_text: { type: "string", description: "Resumo executivo em pt-BR, máx 3 frases, tom Imperius." },
              actions: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Ação curta, max 6 palavras" },
                    route: { type: "string", enum: ["/leads", "/financas", "/tarefas", "/dashboard", "/whatsapp", "/projetos"] },
                    icon: { type: "string", enum: ["flame", "target", "alert", "trending", "check"] },
                  },
                  required: ["label", "route", "icon"],
                  additionalProperties: false,
                },
              },
            },
            required: ["briefing_text", "actions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_briefing" } },
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`AI gateway ${response.status}: ${t}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call returned");
  const args = JSON.parse(toolCall.function.arguments);
  return args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const projectId = url.searchParams.get("project_id");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const today = new Date().toISOString().slice(0, 10);
    const projKey = projectId || "__global__";

    // Se não for force, retornar existente do dia
    if (!force) {
      const { data: existing } = await supabase
        .from("imphq_daily_briefings")
        .select("*")
        .eq("briefing_date", today)
        .or(projectId ? `project_id.eq.${projectId}` : "project_id.is.null")
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ briefing: existing, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const metrics = await gatherMetrics(supabase, projectId);
    const { briefing_text, actions } = await generateBriefingWithAI(metrics);

    // Upsert (delete + insert para garantir unicidade por dia+projeto)
    await supabase
      .from("imphq_daily_briefings")
      .delete()
      .eq("briefing_date", today)
      .or(projectId ? `project_id.eq.${projectId}` : "project_id.is.null");

    const { data: inserted, error: insErr } = await supabase
      .from("imphq_daily_briefings")
      .insert({
        briefing_date: today,
        project_id: projectId,
        briefing_text,
        actions,
        metrics,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ briefing: inserted, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
