// Gera passos de campanha WhatsApp (modo create) OU propõe diff de ajuste (modo adjust)
// delegando a copy ao Motor de Copy unificado (intent: wa_campaign_steps).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      campaign_id,
      project_id,
      produto,
      count = 7,
      tom = "vendas",
      briefing = "",
      reference = "",
      mode = "create", // "create" | "adjust"
      adjust_request = "",
      adjust_scope = "all", // "all" | "active"
      allow_timing = true, // pode mexer em days_offset/send_time
    } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---------- MODO ADJUST: propõe diff sem gravar ----------
    if (mode === "adjust") {
      if (!String(adjust_request).trim()) {
        return new Response(JSON.stringify({ error: "adjust_request obrigatório no modo adjust" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let q = supabase
        .from("imphq_wa_campaign_steps")
        .select("id, step_order, content, days_offset, send_time, is_active, media_type")
        .eq("campaign_id", campaign_id)
        .order("step_order", { ascending: true });
      if (adjust_scope === "active") q = q.eq("is_active", true);

      const { data: steps, error: stepsErr } = await q;
      if (stepsErr) {
        return new Response(JSON.stringify({ error: stepsErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!steps || steps.length === 0) {
        return new Response(JSON.stringify({ error: "Sequência vazia — nada para ajustar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truncar conteúdo para caber no prompt
      const stepsForPrompt = steps.map((s: any, i: number) => ({
        idx: i,
        id: s.id,
        ordem: s.step_order + 1,
        dia: s.days_offset,
        horario: s.send_time || "09:00",
        ativo: s.is_active,
        content: String(s.content || ""),
      }));

      const userPrompt = `Você é um editor de sequências de WhatsApp. O usuário pediu um AJUSTE em uma sequência já existente.

PEDIDO DO USUÁRIO:
"""
${String(adjust_request).slice(0, 2000)}
"""

PRODUTO: ${produto || "(não informado)"}
TOM: ${tom}
PERMITIDO ALTERAR DIAS/HORÁRIOS: ${allow_timing ? "SIM" : "NÃO — preserve days_offset e send_time originais"}
INSTRUÇÕES EXTRAS: ${briefing || "(nenhuma)"}

REGRAS:
- Preserve a ordem (idx) e a estrutura da sequência.
- Reescreva apenas o que for necessário para atender ao pedido.
- Se uma mensagem NÃO precisa mudar, marque "changed": false e devolva content original.
- Atualize datas, contagem regressiva, dia da semana e referências temporais para serem consistentes com o pedido.
- Mantenha o tom de voz e o estilo das mensagens originais.
- NÃO adicione nem remova mensagens — só edite as ${steps.length} existentes.

SEQUÊNCIA ATUAL (JSON):
${JSON.stringify(stepsForPrompt).slice(0, 60000)}

RESPONDA APENAS JSON VÁLIDO neste formato exato:
{"steps":[{"idx":0,"changed":true|false,"content":"texto novo ou igual","days_offset":N,"send_time":"HH:MM","reason":"breve explicação se changed=true"}]}`;

      const ceResp = await fetch(`${SUPABASE_URL}/functions/v1/copy-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({
          intent: "wa_campaign_steps",
          input: userPrompt,
          context: { project_id, product_slug: produto, mode: "adjust" },
        }),
      });

      if (!ceResp.ok) {
        const t = await ceResp.text();
        if (ceResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (ceResp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: t.slice(0, 400) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const ceData = await ceResp.json();
      let parsed: any = {};
      try { parsed = JSON.parse(ceData?.content || "{}"); } catch { parsed = {}; }
      const out: any[] = Array.isArray(parsed.steps) ? parsed.steps : [];

      // Montar diff por id
      const diff = stepsForPrompt.map((orig) => {
        const proposed = out.find((p) => Number(p.idx) === orig.idx);
        if (!proposed) {
          return { id: orig.id, ordem: orig.ordem, changed: false, before: orig, after: orig, reason: "" };
        }
        const afterContent = String(proposed.content || orig.content);
        const afterDays = allow_timing && Number.isInteger(proposed.days_offset) ? proposed.days_offset : orig.dia;
        const afterTime = allow_timing && typeof proposed.send_time === "string" && /^\d{2}:\d{2}/.test(proposed.send_time)
          ? proposed.send_time.slice(0, 5)
          : orig.horario;
        const changed = afterContent !== orig.content || afterDays !== orig.dia || afterTime !== orig.horario;
        return {
          id: orig.id,
          ordem: orig.ordem,
          changed,
          before: orig,
          after: { ...orig, content: afterContent, dia: afterDays, horario: afterTime },
          reason: String(proposed.reason || "").slice(0, 200),
        };
      });

      return new Response(JSON.stringify({ ok: true, mode: "adjust", diff }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- MODO CREATE (comportamento original) ----------
    // Buscar referências top-rated (swipes) e steps existentes
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
        refsCtx = "\n\nReferências de alta performance (inspire-se, NÃO copie):\n" +
          refs.map((r: any, i: number) => `[${i + 1}] ${r.title} (rating ${r.rating}) — gatilhos: ${(r.gatilhos || []).join(", ")} — mecanismo: ${r.mecanismo || "—"}\nTrecho: ${String(r.raw_text || "").slice(0, 300)}`).join("\n");
      }
    }

    const { data: existingSteps } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("step_order, content, days_offset, send_time")
      .eq("campaign_id", campaign_id)
      .order("step_order", { ascending: true });

    let existingStepsCtx = "";
    let lastDaysOffset = 0;
    if (existingSteps && existingSteps.length > 0) {
      existingStepsCtx = "\n\n## MENSAGENS JÁ EXISTENTES (continue a sequência, NÃO repita ganchos):\n" +
        existingSteps.map((s: any) => `Passo #${s.step_order + 1} (Dia ${s.days_offset} às ${s.send_time || "09:00"}): "${s.content || "(vazia)"}"`).join("\n\n");
      lastDaysOffset = Math.max(...existingSteps.map((s: any) => Number(s.days_offset) || 0)) + 1;
    }

    const N = Math.max(1, Math.min(60, Number(count) || 7));

    const userPrompt = `Gere exatamente ${N} mensagens WhatsApp para grupos.
Produto: ${produto || "(não informado)"}
Tom: ${tom}
Briefing: ${briefing || "(livre)"}${existingStepsCtx}${reference ? `\n\nReferência (imite estrutura, NÃO copie):\n${String(reference).slice(0, 4000)}` : ""}${refsCtx}`;

    const ceResp = await fetch(`${SUPABASE_URL}/functions/v1/copy-engine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        intent: "wa_campaign_steps",
        input: userPrompt,
        context: { project_id, product_slug: produto },
      }),
    });

    if (!ceResp.ok) {
      const t = await ceResp.text();
      if (ceResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (ceResp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: t.slice(0, 400) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ceData = await ceResp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(ceData?.content || "{}"); } catch { parsed = {}; }
    const steps: any[] = Array.isArray(parsed.steps) ? parsed.steps : [];

    if (steps.length === 0) {
      return new Response(JSON.stringify({ error: "IA não retornou steps válidos" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      days_offset: Number.isInteger(s.day_offset) ? s.day_offset + lastDaysOffset : lastDaysOffset,
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
