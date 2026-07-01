// wa-lead-qualifier — qualifica lead via IA com base nas últimas mensagens
// Salva em imphq_leads.data.qualificacao e atualiza nivel_qualificacao
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function qualify(messages: string[]): Promise<any> {
  const sys = `Você é um SDR senior. Analise as mensagens do lead e classifique em JSON ESTRITO:
{
  "orcamento": "baixo" | "medio" | "alto" | "desconhecido",
  "urgencia": 1-5,
  "nivel_experiencia": "iniciante" | "intermediario" | "avancado" | "desconhecido",
  "objetivo": "string curta <80 chars ou null",
  "temperatura": "frio" | "morno" | "quente",
  "score": 0-100,
  "proxima_pergunta": "string com 1 pergunta consultiva para avançar, ou null se já está pronto pra comprar",
  "resumo": "string <120 chars do estado do lead"
}
Pense em sinais reais: pergunta de preço/pagamento = quente; só curioso = frio; com dúvidas técnicas = morno.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Últimas mensagens do lead:\n${messages.join("\n")}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!r.ok) throw new Error(`gateway ${r.status}`);
  const j = await r.json();
  return JSON.parse(j.choices?.[0]?.message?.content || "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { lead_id, conversation_id } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let leadIdResolved = lead_id;
    let phone: string | null = null;
    let projectId: string | null = null;

    if (conversation_id && !lead_id) {
      const { data: conv } = await supabase
        .from("imphq_wa_conversations")
        .select("phone, project_id")
        .eq("id", conversation_id)
        .maybeSingle();
      if (conv) {
        phone = conv.phone;
        projectId = conv.project_id;
        const { data: lead } = await supabase
          .from("imphq_leads")
          .select("id")
          .eq("phone", phone)
          .eq("project_id", projectId)
          .maybeSingle();
        leadIdResolved = lead?.id;
      }
    }

    if (!leadIdResolved) {
      return new Response(JSON.stringify({ ok: false, error: "lead não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead } = await supabase
      .from("imphq_leads")
      .select("*")
      .eq("id", leadIdResolved)
      .single();
    if (!lead) throw new Error("lead não existe");

    // pega últimas 20 mensagens do lead
    const { data: msgs } = await supabase
      .from("imphq_wa_messages")
      .select("body, from_me")
      .eq("phone", lead.phone)
      .eq("project_id", lead.project_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const incoming = (msgs || []).filter((m: any) => !m.from_me).reverse().map((m: any) => m.body).filter(Boolean);
    if (incoming.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "sem mensagens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = await qualify(incoming);

    const newData = { ...(lead.data || {}), qualificacao: { ...q, updated_at: new Date().toISOString() } };
    await supabase
      .from("imphq_leads")
      .update({
        data: newData,
        nivel_qualificacao: q.temperatura,
        qualificacao_updated_at: new Date().toISOString(),
      })
      .eq("id", leadIdResolved);

    return new Response(JSON.stringify({ ok: true, qualificacao: q }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
