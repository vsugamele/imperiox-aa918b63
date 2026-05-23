import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, project_id, produto, count = 7, tom = "vendas", briefing = "", reference = "" } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch optional context (branding, avatar) from project
    let projectCtx = "";
    if (project_id) {
      const { data: proj } = await supabase
        .from("imphq_projects")
        .select("name, data")
        .eq("id", project_id)
        .maybeSingle();
      if (proj) {
        const d: any = proj.data || {};
        projectCtx = `\nProjeto: ${proj.name}\nBranding/tom de voz: ${JSON.stringify(d.branding || {}).slice(0, 600)}\nAvatar: ${JSON.stringify(d.avatar || {}).slice(0, 600)}`;
      }
    }

    // Fetch top-rated references (swipes) for inspiration
    let refsCtx = "";
    if (project_id) {
      const { data: refs } = await supabase
        .from("imphq_swipes")
        .select("title, raw_text, rating, gatilhos, mecanismo")
        .eq("project_id", project_id)
        .gte("rating", 4)
        .order("rating", { ascending: false })
        .limit(5);
      if (refs && refs.length) {
        refsCtx = "\n\nReferências de alta performance (inspire-se em estrutura/gatilhos, NÃO copie literal):\n" +
          refs.map((r: any, i: number) => `[${i + 1}] ${r.title} (rating ${r.rating}) — gatilhos: ${(r.gatilhos || []).join(", ")} — mecanismo: ${r.mecanismo || "—"}\nTrecho: ${String(r.raw_text || "").slice(0, 300)}`).join("\n");
      }
    }


    const N = Math.max(1, Math.min(60, Number(count) || 7));

    const systemPrompt = `Você é Imperius, estrategista de copy WhatsApp para grupos. Escreva em pt-BR.

REGRAS DE FORMATAÇÃO (CRÍTICO — siga sempre):
- Formate como mensagem real do WhatsApp, com RESPIROS visuais.
- SEPARE parágrafos com UMA LINHA EM BRANCO (use "\\n\\n" no JSON).
- Saudação em linha própria. Corpo em 2-3 parágrafos curtos (1-3 linhas cada). CTA em linha própria no final.
- Use *negrito* para destaques (1-2 por mensagem, no máximo).
- Listas com "•" ou emoji + linha quando fizer sentido.
- Emojis sutis, no início de blocos ou no CTA. Nunca em excesso.
- Use {nome}, {produto}, {grupo_nome} quando fizer sentido.

Exemplo de estrutura correta (note os \\n\\n entre blocos):
"Fala, {nome}! 👊\\n\\nAmanhã às 20h rola nossa aula ao vivo sobre *{produto}*.\\n\\nVou te mostrar o método exato que uso pra fechar 3x mais clientes.\\n\\n👉 Confirma sua presença respondendo EU VOU."`;

    const userPrompt = `Gere uma sequência de ${N} mensagens WhatsApp para grupos.
Produto: ${produto || "(não informado)"}
Tom: ${tom}
Briefing: ${briefing || "(livre)"}${reference ? `\n\nReferência de copy (imite tom/estrutura, NÃO copie literal):\n${String(reference).slice(0, 4000)}` : ""}${projectCtx}${refsCtx}

Estrutura de cada mensagem:
- day_offset (0 = dia da entrada, 1 = dia seguinte, etc.) — distribua de forma natural ao longo de ${N} dias
- send_time (HH:MM, 24h, entre 09:00 e 20:00)
- content (texto da mensagem COM \\n\\n entre parágrafos, conforme regras de formatação)

Retorne APENAS JSON válido no formato:
{ "steps": [ { "day_offset": 0, "send_time": "09:00", "content": "Fala, {nome}!\\n\\nCorpo da mensagem aqui.\\n\\n👉 CTA final." }, ... ] }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione na workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: t.slice(0, 400) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const steps: any[] = Array.isArray(parsed.steps) ? parsed.steps : [];

    if (steps.length === 0) {
      return new Response(JSON.stringify({ error: "IA não retornou steps válidos" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find current max step_order
    const { data: existing } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("step_order")
      .eq("campaign_id", campaign_id)
      .order("step_order", { ascending: false })
      .limit(1);
    let nextOrder = (existing?.[0]?.step_order ?? -1) + 1;

    const toInsert = steps.map((s: any) => ({
      campaign_id,
      step_order: nextOrder++,
      content: String(s.content || "").slice(0, 4000),
      media_type: "text",
      send_time: typeof s.send_time === "string" && /^\d{2}:\d{2}/.test(s.send_time) ? s.send_time.slice(0, 5) : "09:00",
      days_offset: Number.isInteger(s.day_offset) ? s.day_offset : 0,
      is_active: true,
    }));

    const { error: insErr } = await supabase.from("imphq_wa_campaign_steps").insert(toInsert as any);
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, inserted: toInsert.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
