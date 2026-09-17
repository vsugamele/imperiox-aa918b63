import { z } from "https://esm.sh/zod@3.25.76";
// Gera um Plano de Lançamento estruturado (fases + cronograma + ações).
// Salva como kanban cards em uma coluna "🚀 Plano de Lançamento" e retorna o plano completo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const launchPlanSchema = z.object({plano:z.object({fases:z.array(z.object({nome:z.string().nullish(),objetivo:z.string().nullish(),acoes:z.array(z.object({dia:z.union([z.number(),z.string()]).nullish(),titulo:z.string().nullish(),tipo:z.string().nullish(),descricao:z.string().nullish()}).passthrough()).nullish()}).passthrough()).nullish()}).passthrough().nullish()}).passthrough();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { project_id, produto, objetivo, prazo_dias = 30, meta_faturamento, briefing = "", apply = false } = await req.json();
    if (!project_id) throw new Error("project_id obrigatório");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: proj } = await sb.from("imphq_projects").select("name,avatar,brand_kit,settings").eq("id", project_id).maybeSingle();
    const avatarStr = JSON.stringify(proj?.avatar || {}).slice(0, 800);

    const sys = `Você é estrategista de lançamento (estilo PLF/Erico Rocha). Gere um plano completo em fases: pré-lançamento (aquecimento), evento (CPL/webinar), abertura de carrinho, fechamento, pós-venda. Responda JSON: { "plano": { "resumo": "...", "fases": [{ "nome": "Pré-lançamento", "dias": [1,7], "objetivo": "...", "acoes": [{ "titulo": "...", "descricao": "...", "tipo": "copy|email|video|trafego|live|ads", "dia": int }] }] } }`;
    const user = `Projeto: ${proj?.name}\nProduto: ${produto || "(geral)"}\nObjetivo: ${objetivo || "Lançamento de novo produto"}\nPrazo: ${prazo_dias} dias\nMeta de faturamento: ${meta_faturamento ? "R$ " + meta_faturamento : "não definida"}\nBriefing: ${briefing}\nAvatar: ${avatarStr}`;

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
    let parsed: z.infer<typeof launchPlanSchema>;
    try { parsed = launchPlanSchema.parse(JSON.parse(data?.choices?.[0]?.message?.content || "{}")); } catch { parsed = { plano: { fases: [] } }; }
    const plano = parsed.plano || { fases: [] };

    let createdCards = 0;
    if (apply && plano.fases?.length) {
      const { data: existingCol } = await sb.from("imphq_kanban_columns")
        .select("id").eq("project_id", project_id).ilike("title", "%lançamento%").maybeSingle();
      let columnId = existingCol?.id;
      if (!columnId) {
        const { data: newCol } = await sb.from("imphq_kanban_columns")
          .insert({ project_id, title: "🚀 Plano de Lançamento", position: 0 }).select().single();
        columnId = newCol?.id;
      }
      if (columnId) {
        for (const fase of plano.fases) {
          for (const acao of (fase.acoes || [])) {
            await sb.from("imphq_kanban_cards").insert({
              column_id: columnId, project_id,
              title: `D${acao.dia || "?"} · ${fase.nome} · ${acao.titulo}`,
              description: `**Tipo:** ${acao.tipo}\n\n${acao.descricao || ""}\n\n---\n_Objetivo da fase: ${fase.objetivo || ""}_`,
              tags: ["lancamento-ia", fase.nome?.toLowerCase().replace(/\s+/g, "-"), acao.tipo].filter(Boolean),
              ai_generated: true,
              metadata: { source: "lancamento-ai-generate", fase: fase.nome, dia: acao.dia },
            });
            createdCards++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ plano, applied: apply, cards: createdCards }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : "Unknown error";
    console.error("lancamento-ai-generate:", e);
    return new Response(JSON.stringify({ error: String(message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
