// Nurture Auto-Segment — diariamente segmenta leads e propõe sequências
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function genSequence(segment: string, count: number, contexto: string) {
  const sys = `Você é copywriter sênior. Gere sequência de nutrição em pt-BR para o segmento descrito. Responda JSON: { "steps": [{"day": 0, "channel": "email"|"whatsapp", "subject": "...", "body": "..."}] }. 3-5 passos.`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Segmento: ${segment}\n${count} leads\nContexto: ${contexto}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  try {
    return JSON.parse(data?.choices?.[0]?.message?.content || "{}");
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Hot Leads sem contato em 2h — dispara já (auto)
    const cut2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: hotStale } = await supabase
      .from("imphq_leads")
      .select("id, nome, whatsapp, projeto_id, ultimo_produto")
      .eq("hot_lead", true)
      .lt("hot_lead_at", cut2h)
      .is("ultimo_contato_at", null)
      .limit(20);

    let hotActions = 0;
    for (const lead of hotStale || []) {
      if (!lead.whatsapp) continue;
      await supabase.from("imphq_ai_actions").insert({
        kind: "sendWhatsApp",
        risk_level: "low",
        confidence: 0.8,
        impact_brl: 200,
        title: `Reativar hot lead ${lead.nome || lead.id}`,
        reason: `Hot lead há 2h+ sem contato. Última oferta: ${lead.ultimo_produto || "—"}`,
        payload: {
          lead_id: lead.id,
          number: lead.whatsapp,
          text: `Oi ${(lead.nome || "").split(" ")[0]}! Vi seu interesse e quero te ajudar. Posso te mandar a oferta agora?`,
        },
        projeto_id: lead.projeto_id,
        source: "nurture-auto-segment",
        status: "approved",
        auto_executed: true,
      });
      hotActions++;
    }

    // 2. Segmento "dormente" — sem evento em 14d
    const cut14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dormant, count: dormCount } = await supabase
      .from("imphq_leads")
      .select("id, projeto_id, ultimo_produto", { count: "exact" })
      .lt("updated_at", cut14d)
      .neq("status", "cliente")
      .limit(100);

    if ((dormCount || 0) >= 10) {
      const seq = await genSequence("Leads dormentes 14d+", dormCount || 0, "Reativação última chance");
      if (seq) {
        await supabase.from("imphq_ai_actions").insert({
          kind: "notify",
          risk_level: "medium",
          confidence: 0.75,
          impact_brl: (dormCount || 0) * 50,
          title: `Sequência reativação · ${dormCount} dormentes`,
          reason: `${dormCount} leads sem atividade há 14+ dias. Sequência IA pronta para envio em massa.`,
          payload: { segment: "dormente_14d", lead_count: dormCount, sequence: seq, lead_ids: (dormant || []).map((l: any) => l.id) },
          source: "nurture-auto-segment",
          status: "proposed",
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, hot_actions: hotActions, dormant_proposed: (dormCount || 0) >= 10 ? 1 : 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("nurture-auto-segment:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
