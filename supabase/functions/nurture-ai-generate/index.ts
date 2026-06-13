// Gera sequência de nutrição delegando a copy ao Motor de Copy unificado (intent: nurture_sequence).
// Input: { project_id, sequence_id?, produto_nome, nome?, objetivo?, count?: number, briefing?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Delega ao Motor de Copy
    const userPrompt = `Gere exatamente ${count} e-mails.
Produto: ${produto_nome}
Objetivo: ${objetivo || "Converter lead em comprador em até 1 ano"}
Briefing: ${briefing || "(livre)"}`;

    const ceResp = await fetch(`${SUPABASE_URL}/functions/v1/copy-engine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        intent: "nurture_sequence",
        input: userPrompt,
        context: { project_id, product_slug: produto_nome },
      }),
    });

    if (!ceResp.ok) {
      const t = await ceResp.text();
      const st = ceResp.status === 429 || ceResp.status === 402 ? ceResp.status : 500;
      return new Response(JSON.stringify({ error: `copy-engine ${ceResp.status}: ${t.slice(0, 300)}` }), { status: st, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ceData = await ceResp.json();
    let parsed: any;
    try { parsed = JSON.parse(ceData?.content || "{}"); } catch { parsed = { emails: [] }; }
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
      modelo_ia: ceData?.model || "copy-engine",
      contexto_usado: { briefing, produto_nome, intent: "nurture_sequence" },
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
