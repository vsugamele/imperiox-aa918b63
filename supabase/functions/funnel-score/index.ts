// Score de Qualidade do Funil — 10 dimensões via IA
// Retorna nota 0-10 por dimensão, score global e sugestões.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const DIMENSIONS = [
  { id: "copy", label: "Copy" },
  { id: "estrutura", label: "Estrutura" },
  { id: "ctas", label: "CTAs" },
  { id: "confianca", label: "Confiança" },
  { id: "urgencia", label: "Urgência" },
  { id: "prova_social", label: "Prova social" },
  { id: "oferta", label: "Oferta" },
  { id: "bumps", label: "Bumps/Upsell" },
  { id: "recovery", label: "Recovery" },
  { id: "mobile", label: "Mobile" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id, product, existing_assets } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const [{ data: project }, { data: vendas }, { data: ads }] = await Promise.all([
      sb.from("imphq_projects").select("id, name, briefing, avatar, brand_kit").eq("id", project_id).maybeSingle(),
      sb.from("imphq_vendas").select("valor, produto, created_at").eq("project_id", project_id).order("created_at", { ascending: false }).limit(100),
      sb.from("imphq_ads_spend").select("spend, ctr, cpa, date").eq("project_id", project_id).order("date", { ascending: false }).limit(30),
    ]);

    const existing = (existing_assets || []).map((a: any) => `${a.catId}:${a.itemId}=${a.status || "?"}`).join(", ");
    const briefing = (project?.briefing as any) || {};
    const totalVendas = vendas?.length || 0;
    const avgCtr = ads?.length ? (ads.reduce((s, a: any) => s + Number(a.ctr || 0), 0) / ads.length) : 0;

    const sys = `Você é o Imperius Funnel Scorer. Avalie um funil em 10 dimensões e devolva JSON.
Dimensões (todas com nota 0-10, justificativa de 1 frase, e 1 sugestão prática):
${DIMENSIONS.map(d => `- ${d.id}: ${d.label}`).join("\n")}

Considere o framework Yoshitani 7/5/3 (CTR ads 7%, conv LP 5%, conv checkout 3%) para julgar gaps.
Seja honesto: notas baixas (0-4) para o que falta, médias (5-7) para o ok-mas-melhorável, altas (8-10) só para o que está completo e validado.`;

    const usr = `PROJETO: ${project?.name}
PRODUTO: ${product?.nome || product?.name || "—"} (R$ ${product?.preco_por || product?.preco || "—"})
BRIEFING: ${JSON.stringify(briefing).slice(0, 1200)}
AVATAR: ${JSON.stringify(project?.avatar || {}).slice(0, 500)}
KPIs: vendas=${totalVendas}, CTR=${avgCtr.toFixed(2)}%
ATIVOS NO HUB: ${existing || "nenhum"}

Retorne JSON:
{
  "score_global": number 0-100,
  "dimensoes": [
    { "id": "copy", "label": "Copy", "nota": 0-10, "diagnostico": "...", "sugestao": "..." },
    ...10 dimensões na ordem listada
  ],
  "top_oportunidades": ["3 ações concretas priorizadas"]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI failed", detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify({ score: parsed, kpis: { totalVendas, avgCtr } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
