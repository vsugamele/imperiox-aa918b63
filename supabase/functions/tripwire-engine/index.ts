// Tripwire Engine — gera oferta de baixo ticket (R$ 7-97) usando a skill TRIPWIRE MATADOR
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { loadSkillPrompt, runSkill } from "../_shared/run-skill.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, product, core_offer, avatar, branding } = await req.json();
    if (!project_id || !product) {
      return new Response(JSON.stringify({ error: "project_id e product obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // carrega skill + contexto (avatar/branding do projeto se não vier)
    const skill = await loadSkillPrompt(sb, "tripwire-matador");
    let avatarCtx = avatar, brandingCtx = branding;
    if (!avatarCtx || !brandingCtx) {
      const { data: proj } = await sb.from("imphq_projects").select("data").eq("id", project_id).maybeSingle();
      const d = (proj as any)?.data || {};
      avatarCtx = avatarCtx || d.avatar || d.avatars_por_produto;
      brandingCtx = brandingCtx || d.branding || d.brand;
    }

    const produto_nome = product?.nome || product?.name || "produto principal";
    const ticket = product?.preco_por || product?.preco || product?.price;
    const promessa = product?.promessa || product?.descricao || "";

    const instruction = `Gere a oferta TRIPWIRE completa em JSON estrito (sem markdown):
{
  "diagnostico_escada": "qual problema resolve + qual degrau prepara",
  "formato": "Diagnóstico|Template|Mini-Método|Acesso|Revelação|Checklist",
  "quick_win": "resultado único e mensurável",
  "nomes_opcoes": ["5-7 nomes"],
  "nome_escolhido": { "nome": "...", "justificativa": "..." },
  "preco": { "valor": 27, "ancora": "menos que um jantar", "justificativa": "..." },
  "copy": {
    "headline": "...",
    "subheadline": "...",
    "corpo": "4 parágrafos em texto único",
    "empilhamento": ["item 1 — valor R$X", "..."],
    "garantia": "...",
    "cta": "..."
  },
  "pagina_obrigado": "script completo da TYP estratégica em texto único",
  "incompletude_estrategica": "o problema que o tripwire revela e o Core Offer (${core_offer || produto_nome}) resolve"
}

CORE OFFER do funil: ${core_offer || produto_nome} (R$ ${ticket || "—"})
A oferta tripwire DEVE preparar a escada para esse core.`;

    const result = await runSkill({
      systemPrompt: skill || "Você é o Imperius Tripwire Matador, especialista em ofertas low-ticket pt-BR.",
      ctx: { produto_nome, ticket: String(ticket || "—"), promessa, avatar: avatarCtx, branding: brandingCtx },
      instruction,
      model: "google/gemini-2.5-flash",
      jsonSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          diagnostico_escada: { type: "string" },
          formato: { type: "string" },
          quick_win: { type: "string" },
          nomes_opcoes: { type: "array", items: { type: "string" } },
          nome_escolhido: { type: "object", additionalProperties: true },
          preco: { type: "object", additionalProperties: true },
          copy: { type: "object", additionalProperties: true },
          pagina_obrigado: { type: "string" },
          incompletude_estrategica: { type: "string" },
        },
        required: ["nome_escolhido", "preco", "copy"],
      },
    });

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
