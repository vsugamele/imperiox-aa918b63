import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { project_id, mode = "daily", custom_event = "" } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Project context (avatar + briefing + branding)
    const { data: project } = await supabase
      .from("imphq_projects")
      .select("id, name, avatar, brand_kit, data")
      .eq("id", project_id)
      .maybeSingle();

    if (!project) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avatar: any = project.avatar || {};
    const perfil = avatar.perfil_psicologico || {};
    const brandKit: any = project.brand_kit || {};
    const briefing: any = project.data?.briefing || {};

    const dores: any[] = avatar.dores || [];
    const desejos: any[] = avatar.desejos || [];
    const top3Dores = dores.slice(0, 3).map((d: any) => d.descricao || d.text || "").filter(Boolean);
    const top3Desejos = desejos.slice(0, 3).map((d: any) => d.descricao || d.text || "").filter(Boolean);

    // 2. Last 24h sales
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: vendas24h } = await supabase
      .from("imphq_vendas")
      .select("id, valor, produto_nome, created_at")
      .eq("project_id", project_id)
      .gte("created_at", since24h)
      .limit(20);

    // 3. Hot leads of the day
    const { data: leadsHoje } = await supabase
      .from("imphq_leads")
      .select("id, name, score, last_objection")
      .eq("project_id", project_id)
      .gte("created_at", since24h)
      .order("score", { ascending: false })
      .limit(5);

    // 4. Stories already done in last 7d (avoid repetition)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentStories } = await supabase
      .from("imphq_expert_logs" as any)
      .select("metadata, created_at")
      .eq("project_id", project_id)
      .eq("action", "story_idea_used")
      .gte("created_at", since7d)
      .limit(20);

    const recentHooks = (recentStories || [])
      .map((r: any) => r.metadata?.hook)
      .filter(Boolean)
      .slice(0, 10);

    // 5. Build context for AI
    const totalVendas24h = (vendas24h || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
    const qtdVendas24h = (vendas24h || []).length;

    const context = {
      projeto: project.name,
      produto: briefing.produto || project.name,
      avatar_retrato: perfil.retrato || avatar.publico || "",
      ferida_central: perfil.ferida_central || avatar.dor_principal || "",
      desejo_externo: avatar.desejo_externo || avatar.resultado_sonhado || "",
      inimigo: avatar.inimigo || "",
      top3_dores: top3Dores,
      top3_desejos: top3Desejos,
      arquetipo: brandKit.arquetipo || "",
      tom_voz: brandKit.tom_voz || brandKit.tom || "",
      vendas_24h: { quantidade: qtdVendas24h, valor_total: totalVendas24h, produtos: (vendas24h || []).map((v: any) => v.produto_nome).filter(Boolean) },
      leads_quentes_hoje: (leadsHoje || []).map((l: any) => ({ nome: l.name, score: l.score, ultima_objecao: l.last_objection })),
      stories_evitar: recentHooks,
      contexto_extra: custom_event,
      modo: mode, // "daily" | "bastidor"
    };

    const systemPrompt = `Você é um estrategista de conteúdo de Stories de Instagram, especialista em vendas diretas para infoprodutos brasileiros.
Gere 5 ideias de Stories DE HOJE, ultra-específicas, baseadas no contexto fornecido.
Cada Story deve ter:
- hook (3-5s, gancho de tela inicial - máx 12 palavras)
- tensao (corpo: cria desconforto/identificação - máx 30 palavras)
- cta (chamada final clara - máx 15 palavras)
- formato: "narrativo" | "enquete" | "caixa_pergunta" | "depoimento" | "polemica"
- gatilho_origem: qual elemento do contexto foi usado (ex: "dor #1", "vendas 24h", "objeção do lead João", "evento bastidor")
- duracao_segundos: 15 ou 30

Regras:
- NUNCA repita hooks dos "stories_evitar"
- Misture os 5: 2 educativos, 2 emocionais, 1 de venda direta
- Tom: ${brandKit.tom_voz || "direto, brasileiro, sem rodeios"}
- Se modo="bastidor", priorize stories sobre o que aconteceu HOJE no negócio
- Use português brasileiro coloquial`;

    const userPrompt = `Contexto do projeto:\n${JSON.stringify(context, null, 2)}\n\nGere 5 ideias de Stories pra HOJE.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "gerar_stories",
              description: "Retorna 5 ideias de Stories",
              parameters: {
                type: "object",
                properties: {
                  stories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hook: { type: "string" },
                        tensao: { type: "string" },
                        cta: { type: "string" },
                        formato: { type: "string", enum: ["narrativo", "enquete", "caixa_pergunta", "depoimento", "polemica"] },
                        gatilho_origem: { type: "string" },
                        duracao_segundos: { type: "number", enum: [15, 30] },
                      },
                      required: ["hook", "tensao", "cta", "formato", "gatilho_origem", "duracao_segundos"],
                    },
                  },
                  resumo_contexto: { type: "string", description: "1 frase sobre o estado do negócio hoje" },
                },
                required: ["stories", "resumo_contexto"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "gerar_stories" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 minuto." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Sem créditos. Adicione em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : { stories: [], resumo_contexto: "" };

    return new Response(
      JSON.stringify({
        stories: result.stories || [],
        resumo_contexto: result.resumo_contexto || "",
        contexto_usado: {
          dores: top3Dores.length,
          desejos: top3Desejos.length,
          vendas_24h: qtdVendas24h,
          leads_quentes: (leadsHoje || []).length,
          stories_evitados: recentHooks.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("daily-stories-ideas error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
