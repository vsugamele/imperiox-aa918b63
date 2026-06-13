// Gera passos de campanha WhatsApp delegando a copy ao Motor de Copy unificado (intent: wa_campaign_steps).
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
    const { campaign_id, project_id, produto, count = 7, tom = "vendas", briefing = "", reference = "" } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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
