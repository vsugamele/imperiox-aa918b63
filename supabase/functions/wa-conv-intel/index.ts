// Gera resumo + intent_tags de uma conversa WhatsApp on-demand
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conversation_id, force = false } = await req.json();
    if (!conversation_id || typeof conversation_id !== "string") {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conv } = await supabase
      .from("imphq_wa_conversations")
      .select("id, ai_summary, ai_summary_updated_at, intent_tags, lead_id, last_incoming_at, contact_name, contact_phone")
      .eq("id", conversation_id)
      .maybeSingle();

    if (!conv) {
      return new Response(JSON.stringify({ summary: "", intent_tags: [], not_found: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // cache 10 min se não forçar
    if (!force && conv.ai_summary && conv.ai_summary_updated_at) {
      const ageMs = Date.now() - new Date(conv.ai_summary_updated_at).getTime();
      if (ageMs < 10 * 60 * 1000) {
        return new Response(JSON.stringify({
          summary: conv.ai_summary,
          intent_tags: conv.intent_tags || [],
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: msgs } = await supabase
      .from("imphq_wa_messages")
      .select("body, from_me, created_at, message_type")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(40);

    const ordered = (msgs || []).reverse();
    const transcript = ordered.map((m: any) => {
      const who = m.from_me ? "ATENDENTE" : "LEAD";
      const body = (m.body || `[${m.message_type || "media"}]`).slice(0, 400);
      return `${who}: ${body}`;
    }).join("\n");

    if (!transcript.trim()) {
      return new Response(JSON.stringify({ summary: "Sem mensagens.", intent_tags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Você analisa conversas WhatsApp de vendas. Responda APENAS JSON válido:
{
  "summary": "2-3 frases em pt-BR resumindo: quem é o lead, o que quer, em que estágio está e qual o próximo passo recomendado para o atendente.",
  "intent_tags": ["array de 1-4 tags curtas em snake_case escolhidas entre: quer_preco, pediu_pix, pediu_link, objecao_preco, objecao_tempo, objecao_confianca, duvida_produto, suporte, ja_cliente, frio, agendou, pediu_demo, comparando, urgente"]
}`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://imperiox.lovable.app",
        "X-Title": "Imperio HQ",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Conversa:\n${transcript}` },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "ai failed", detail: t.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const summary = (parsed.summary || "").toString().slice(0, 600);
    const intent_tags = Array.isArray(parsed.intent_tags)
      ? parsed.intent_tags.filter((t: any) => typeof t === "string").slice(0, 6)
      : [];

    await supabase
      .from("imphq_wa_conversations")
      .update({
        ai_summary: summary,
        ai_summary_updated_at: new Date().toISOString(),
        intent_tags,
      })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({ summary, intent_tags, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
