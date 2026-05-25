// Gera (ou expande) uma sequência de nutrição com IA. Usa briefing + projeto + avatar.
// Input: { project_id, sequence_id?, produto_nome, nome?, objetivo?, count?: number, briefing?: string }
// Cria registros em imphq_nurture_sequences (se sequence_id ausente) e imphq_nurture_emails.
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
    const { project_id, sequence_id, produto_nome, nome, objetivo, count = 12, briefing = "" } = await req.json();
    if (!project_id || !produto_nome) throw new Error("project_id e produto_nome obrigatórios");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    let seqId = sequence_id as string | undefined;
    if (!seqId) {
      const { data: created, error } = await sb.from("imphq_nurture_sequences").insert({
        project_id, produto_nome,
        nome: nome || `Nutrição IA - ${produto_nome}`,
        objetivo, duracao_dias: Math.max(30, count * 3), cadencia: "semanal", ativa: false,
      }).select().single();
      if (error) throw error;
      seqId = created.id;
    }

    const { data: proj } = await sb.from("imphq_projects").select("name,avatar,brand_kit,settings").eq("id", project_id).maybeSingle();
    const avatarStr = JSON.stringify(proj?.avatar || {}).slice(0, 800);
    const brandStr = JSON.stringify(proj?.brand_kit || {}).slice(0, 400);

    const sys = `Você é especialista em e-mail marketing de nutrição. Gere ${count} e-mails para 1 ano de relacionamento (lead → comprador). Mix: conteúdo (60%), conexão (20%), oferta (20%). Estágios: topo/meio/fundo. Responda JSON: { "emails": [{ "dia_numero": int, "estagio": "topo"|"meio"|"fundo", "assunto": "...", "corpo_texto": "...", "corpo_html": "<p>...</p>" }] }`;
    const user = `Projeto: ${proj?.name}\nProduto: ${produto_nome}\nObjetivo: ${objetivo || "Converter lead em comprador em até 1 ano"}\nBriefing: ${briefing}\nAvatar: ${avatarStr}\nBranding: ${brandStr}`;

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
    let parsed: any;
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}"); } catch { parsed = { emails: [] }; }
    const emails = (parsed.emails || []).slice(0, count);

    const rows = emails.map((e: any) => ({
      sequence_id: seqId,
      dia_numero: e.dia_numero || 0,
      estagio: e.estagio || "meio",
      assunto: e.assunto || "",
      corpo_texto: e.corpo_texto || "",
      corpo_html: e.corpo_html || `<p>${(e.corpo_texto || "").replace(/\n/g, "</p><p>")}</p>`,
      status: "rascunho",
      gerado_por_ia: true,
      modelo_ia: "google/gemini-3-flash-preview",
      contexto_usado: { briefing, produto_nome },
    }));
    if (rows.length) await sb.from("imphq_nurture_emails").insert(rows);

    return new Response(JSON.stringify({ sequence_id: seqId, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("nurture-ai-generate:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
