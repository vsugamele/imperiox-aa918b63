// Gera copy de gatilho de comentário Instagram (resposta pública + DM)
// Input: { project_id, keyword, channel: "comment"|"dm"|"story"|"story_mention", briefing?: string }
// Output: { reply_public: string, dm_message: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id, keyword, channel = "comment", briefing = "" } = await req.json();
    if (!keyword?.trim()) throw new Error("keyword obrigatório");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    let projCtx = "";
    if (project_id) {
      const { data: proj } = await sb.from("imphq_projects").select("name, avatar, brand_kit, data").eq("id", project_id).maybeSingle();
      const av = JSON.stringify(proj?.avatar || {}).slice(0, 600);
      const br = JSON.stringify(proj?.brand_kit || {}).slice(0, 300);
      projCtx = `Projeto: ${proj?.name || "—"}\nAvatar: ${av}\nBranding: ${br}`;
    }

    const channelLabel: Record<string, string> = {
      comment: "comentário público em post",
      dm: "DM (mensagem privada que mencionou a keyword)",
      story: "resposta a story",
      story_mention: "menção em story",
    };
    const needsPublic = channel === "comment";

    const sys = `Você é especialista em copy para gatilhos de Instagram. Tom: humano, direto, conversacional, pt-BR. Sem hashtags. Sem emojis em excesso (1-2 no máximo).
Quando um lead comenta a palavra-chave (${channelLabel[channel] || channel}), você gera:
${needsPublic ? '1. "reply_public": resposta pública curta (<120 caracteres) chamando o lead pro privado.\n' : ''}2. "dm_message": mensagem privada (DM) entregando o que foi prometido. Use {{nome}} pra referenciar o username. 2-4 linhas. Termine com pergunta ou CTA claro.
Responda APENAS JSON: { ${needsPublic ? '"reply_public": "...", ' : ''}"dm_message": "..." }`;

    const user = `Palavra-chave que ativa o gatilho: "${keyword}"
Canal: ${channelLabel[channel]}
Briefing extra: ${briefing || "—"}
${projCtx}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      const st = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      return new Response(JSON.stringify({ error: `AI ${resp.status}: ${t.slice(0, 200)}` }), { status: st, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}"); } catch { /* fallback */ }

    return new Response(JSON.stringify({
      reply_public: parsed.reply_public || "",
      dm_message: parsed.dm_message || "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ig-trigger-ai-generate:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
