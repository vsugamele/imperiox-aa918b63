// Gera 3 variações de copy (headline, lead, CTA) para um nó do funil
// usando contexto do produto + branding do projeto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { projeto_id, node_id, asset_kind, asset_label, produto } = await req.json();
    if (!projeto_id || !node_id) {
      return new Response(JSON.stringify({ error: "projeto_id e node_id obrigatórios" }), { status: 400, headers: corsHeaders });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Branding / avatar do projeto
    const { data: projeto } = await supabase
      .from("imphq_projects")
      .select("nome, branding, avatar, contexto")
      .eq("id", projeto_id)
      .maybeSingle();

    const prod = produto || {};
    const prompt = `Você é o Imperius, copywriter direto-resposta sênior. Gere 3 variações de copy curtas e potentes para o ativo "${asset_label || asset_kind || node_id}" dentro de um funil de vendas.

PROJETO: ${projeto?.nome || "—"}
BRANDING/TOM: ${JSON.stringify(projeto?.branding || {}).slice(0, 600)}
AVATAR/DOR: ${JSON.stringify(projeto?.avatar || {}).slice(0, 600)}

PRODUTO: ${prod.nome || "—"}
PREÇO: ${prod.preco_por || prod.preco || "—"}
PROMESSA: ${prod.descricao || "—"}

Gere 3 variações distintas em ângulos diferentes (urgência, prova social, dor/desejo). Pt-BR.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "emit_variations",
            description: "Emite 3 variações de copy.",
            parameters: {
              type: "object",
              properties: {
                variations: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      angulo: { type: "string", description: "Ex: urgência, prova social, dor" },
                      headline: { type: "string" },
                      lead: { type: "string", description: "1-2 frases" },
                      cta: { type: "string", description: "Botão / chamada" },
                    },
                    required: ["angulo", "headline", "lead", "cta"],
                  },
                },
              },
              required: ["variations"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_variations" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway ${aiRes.status}: ${t}` }), { status: 500, headers: corsHeaders });
    }
    const data = await aiRes.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Sem variações retornadas");
    const args = JSON.parse(tc.function.arguments);
    const variations = args.variations || [];

    // Salva no DB
    const { data: saved, error: sErr } = await supabase
      .from("imphq_funnel_node_copies")
      .upsert({
        projeto_id,
        node_id,
        asset_kind: asset_kind || null,
        produto_id: prod.id || null,
        copies: variations,
        selected_idx: 0,
      }, { onConflict: "projeto_id,node_id" })
      .select()
      .single();

    if (sErr) throw sErr;

    return new Response(JSON.stringify({ ok: true, copies: variations, record: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
