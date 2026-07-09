// Gera personalidade + instruções + restrições de um Agente IA a partir do contexto do projeto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAiChat } from "../_shared/ai-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, nome } = await req.json();
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    let ctx = "";
    if (project_id) {
      const { data: proj } = await supa
        .from("imphq_projects")
        .select("name, data")
        .eq("id", project_id)
        .maybeSingle();
      if (proj) {
        const d: any = proj.data || {};
        const produtos = (d.produtos || []).map((p: any) => `- ${p.nome}${p.preco ? ` (R$ ${p.preco})` : ""}`).join("\n");
        const avatar = d.avatar || d.avatars_por_produto || {};
        ctx = `PROJETO: ${proj.name}\nNICHO: ${d.nicho || "-"}\nPRODUTOS:\n${produtos}\nAVATAR: ${JSON.stringify(avatar).slice(0, 1200)}\nBRANDING: ${JSON.stringify(d.branding || {}).slice(0, 600)}`;
      }
    }

    const sys = `Você é o Imperius, arquiteto de personas de IA para atendimento comercial via WhatsApp.
Gere a persona de um agente conversacional COMPLETO em JSON estrito, sem markdown, no formato:
{
  "identidade": "1-2 parágrafos: nome, papel na empresa, tom, expertise",
  "diretrizes": "regras de comunicação em bullets (tom, emojis, formalidade, formato de resposta)",
  "objetivo": "1 frase: função principal do agente",
  "instrucoes_atendimento": "passo-a-passo de atendimento em 5-7 bullets",
  "restricoes": "o que o agente NUNCA deve fazer, em bullets"
}
Português brasileiro, direto, sem clichês genéricos. Use o contexto do projeto.`;

    const user = `Nome do agente: ${nome || "Assistente"}\n\nCONTEXTO:\n${ctx || "(sem contexto de projeto, gerar persona genérica de atendimento comercial)"}`;

    const { content } = await callAiChat({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      json: true,
      timeoutMs: 45_000,
      tag: "agent-autofill",
    });

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
