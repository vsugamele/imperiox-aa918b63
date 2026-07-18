import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { pushNotifyByPref, resolveProjectRecipients } from "../_shared/push-notify.ts";
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
    const { lead_ids } = await req.json();
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return new Response(JSON.stringify({ error: "lead_ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch leads with their data
    const { data: leads } = await supabase.from("imphq_leads").select("*").in("id", lead_ids.slice(0, 20));
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: "No leads found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch vendas for these leads
    const { data: vendas } = await supabase.from("imphq_vendas").select("lead_id, produto_nome, valor, status, created_at").in("lead_id", lead_ids.slice(0, 20));

    // Fetch score logs
    const { data: scoreLogs } = await supabase.from("imphq_lead_scores_log").select("lead_id, acao, pontos").in("lead_id", lead_ids.slice(0, 20));

    // Build context per lead
    const leadContexts = leads.map((lead: any) => {
      const leadVendas = (vendas || []).filter((v: any) => v.lead_id === lead.id);
      const leadScores = (scoreLogs || []).filter((s: any) => s.lead_id === lead.id);
      const data = lead.data || {};
      
      return {
        id: lead.id,
        nome: lead.nome || "Desconhecido",
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        score: lead.score || 0,
        total_gasto: lead.total_gasto || 0,
        plataforma: lead.plataforma,
        tags: lead.tags || [],
        criado_em: lead.criado_em,
        ultimo_evento: data.ultimo_evento,
        ultimo_produto: data.ultimo_produto,
        utms: data.utms,
        vendas: leadVendas.map((v: any) => ({ produto: v.produto_nome, valor: v.valor, status: v.status })),
        score_actions: leadScores.map((s: any) => `${s.acao}: ${s.pontos}pts`),
        interacoes_count: Array.isArray(data.interacoes) ? data.interacoes.length : 0,
      };
    });

    const systemPrompt = `Você é um analista de CRM preditivo especializado em marketing digital brasileiro.
Analise cada lead e retorne um JSON array com predições para cada um.

Para cada lead, avalie:
1. conversion_probability (0-100): Chance de conversão baseada em score, interações, estágio do funil, vendas anteriores
2. churn_risk ("low"/"medium"/"high"): Risco de perder o lead baseado em tempo sem interação, estágio parado
3. predicted_value (R$): Valor estimado se converter, baseado em ticket médio do produto e histórico
4. recommended_actions: Array de 2-4 ações específicas e práticas (ex: "Enviar cupom 10% por WhatsApp", "Ligar em horário comercial")
5. next_best_action: A ação mais urgente e importante
6. ai_summary: Resumo de 1-2 frases sobre o perfil e potencial do lead
7. scoring_factors: Object com fatores que influenciam (ex: {"email_presente": true, "tem_vendas": false, "score_alto": true})

REGRAS:
- Leads com "pix_gerado" ou "carrinho_abandonado" têm alta probabilidade se abordados rápido
- Leads com vendas anteriores têm menor churn e maior predicted_value
- Score > 50 indica lead quente
- Sem interação > 7 dias aumenta churn_risk
- Ações devem ser específicas ao contexto do lead (produto, canal, estágio)`;

    const userPrompt = `Analise estes ${leadContexts.length} leads e retorne predições:\n\n${JSON.stringify(leadContexts, null, 2)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "save_predictions",
            description: "Save lead predictions",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_id: { type: "string" },
                      conversion_probability: { type: "integer" },
                      churn_risk: { type: "string", enum: ["low", "medium", "high"] },
                      predicted_value: { type: "number" },
                      recommended_actions: { type: "array", items: { type: "string" } },
                      next_best_action: { type: "string" },
                      ai_summary: { type: "string" },
                      scoring_factors: { type: "object" },
                    },
                    required: ["lead_id", "conversion_probability", "churn_risk", "predicted_value", "recommended_actions", "next_best_action", "ai_summary"],
                  },
                },
              },
              required: ["predictions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_predictions" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No predictions generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { predictions } = JSON.parse(toolCall.function.arguments);

    // Upsert predictions
    const results = [];
    for (const pred of predictions) {
      const lead = leads.find((l: any) => l.id === pred.lead_id);
      if (!lead) continue;

      // Delete old predictions for this lead
      await supabase.from("imphq_lead_predictions").delete().eq("lead_id", pred.lead_id);

      const { data: inserted, error } = await supabase.from("imphq_lead_predictions").insert({
        lead_id: pred.lead_id,
        project_id: lead.project_id,
        conversion_probability: Math.min(100, Math.max(0, pred.conversion_probability)),
        churn_risk: pred.churn_risk,
        predicted_value: pred.predicted_value || 0,
        recommended_actions: pred.recommended_actions || [],
        ai_summary: pred.ai_summary,
        scoring_factors: pred.scoring_factors || {},
        next_best_action: pred.next_best_action,
      }).select().single();

      if (!error && inserted) {
        results.push(inserted);
        // Hot lead push notification when conversion >= 70 or churn high with high value
        if (pred.conversion_probability >= 70) {
          const recipients = await resolveProjectRecipients(supabase, lead.project_id);
          await pushNotifyByPref({
            supabase,
            prefKey: "hot_lead",
            title: `🔥 Lead quente: ${lead.nome || lead.email || "sem nome"}`,
            message: `${pred.conversion_probability}% de conversão • ${pred.next_best_action || pred.ai_summary || ""}`.slice(0, 180),
            user_ids: recipients,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, predictions: results, count: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-predict error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
