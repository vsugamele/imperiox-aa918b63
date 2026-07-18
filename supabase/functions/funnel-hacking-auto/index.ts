// Funnel Hacking Automático — scrape URL do concorrente + análise + sugere ativos espelho
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireUser } from "../_shared/require-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

async function scrape(url: string) {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY não configurado");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Firecrawl ${res.status}`);
  return (data?.markdown || data?.data?.markdown || "").slice(0, 8000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const { project_id, product, urls } = await req.json();
    if (!project_id || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "project_id e urls[] obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Scrape paralelo (máx 3 URLs)
    const slice = urls.slice(0, 3);
    const scraped = await Promise.allSettled(slice.map((u: string) => scrape(u)));
    const corpus = scraped.map((r, i) => {
      const ok = r.status === "fulfilled" ? r.value : `[ERRO: ${(r as any).reason?.message || "scrape falhou"}]`;
      return `### URL ${i + 1}: ${slice[i]}\n${ok}`;
    }).join("\n\n---\n\n");

    const sys = `Você é o Imperius Funnel Hacker. Aplique engenharia reversa em páginas do concorrente e devolva um dossiê estratégico em JSON.

Categorias disponíveis (catId:itemId) para sugerir ativos espelho:
- copy: nomes_viciantes, promessas, mecanismos, oferta_devastadora
- ads: copy_anuncio, ganchos_impactantes, ganchos_agressivos, arma_curiosidade
- vsl: vsl_7blocos, hero, promessa, mecanismo_vsl, prova, cta
- ofertas: tripwire, core, premium, bonus
- produto: order_bump, upsell, downsell
- publico: avatar_4, dores, desejos, objecoes
- estrategias: escada_valor, mapa_funil, reposicionamento`;

    const usr = `PROJETO DO USUÁRIO: produto "${product?.nome || product?.name || "—"}" (R$ ${product?.preco_por || product?.preco || "—"})

PÁGINAS DO CONCORRENTE (raw markdown):
${corpus}

Retorne JSON:
{
  "dossie": {
    "promessa_central": "1 frase",
    "mecanismo_unico": "como o concorrente explica que funciona",
    "ofertas_detectadas": [{ "tipo": "principal|bump|upsell|downsell", "nome": "...", "preco": "..." }],
    "garantia": "...",
    "provas_sociais": ["tipo1", "tipo2"],
    "urgencia": "tipo e razão",
    "estrutura_pagina": "VSL | longform | híbrido + descrição rápida"
  },
  "gaps_identificados": ["3-5 pontos cegos que o concorrente ignora e que viramos vantagem"],
  "angulo_contra_ataque": "1 parágrafo pronto para usar em copy",
  "ativos_espelho": [
    { "catId": "...", "itemId": "...", "motivo": "1 frase prática", "prioridade": "alta|media|baixa" }
  ]
}

Priorize 6-8 ativos espelho relevantes ao nosso produto. Português BR.`;

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

    return new Response(JSON.stringify({ result: parsed, scraped_urls: slice }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
