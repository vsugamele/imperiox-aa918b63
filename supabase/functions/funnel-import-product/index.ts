// Importa produto a partir de uma URL (LP / VSL / checkout).
// Pipeline: site-scrape (Firecrawl) -> Lovable AI Gateway (Gemini) -> JSON estruturado.
// O cliente persiste o resultado em imphq_projects.data.produtos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Você é Imperius, especialista em engenharia reversa de ofertas (Schwartz, Bencivenga, Sugamele).
Dado o markdown + branding de uma página de produto, devolva APENAS JSON válido no schema:
{
  "nome": string,
  "promessa": string,
  "mecanismo_unico": string,
  "avatar": string,
  "dores": string[],
  "objecoes": string[],
  "beneficios": string[],
  "bonus": string[],
  "garantia": string|null,
  "precos": [{ "label": string, "valor": string }],
  "tom_voz": string,
  "headline_principal": string,
  "cta_principal": string,
  "palavras_chave": string[],
  "categoria": string
}
Seja conciso, factual, em pt-BR. Nada além do JSON.`;

const REINVENT_PROMPT = `Você é Imperius. Reescreva o produto abaixo com mecanismo único NOVO (Breakthrough/Schwartz: novidade + especificidade + prova).
Mantenha avatar e categoria; troque o ângulo. Devolva APENAS JSON no mesmo schema do input.`;

interface Body {
  url: string;
  template?: "novo_mecanismo" | "clonar" | "extrair";
  project_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { url, template = "extrair", project_id } = (await req.json()) as Body;
    if (!url) return json({ success: false, error: "url obrigatória" }, 400);
    if (!LOVABLE_API_KEY) return json({ success: false, error: "LOVABLE_API_KEY ausente" }, 500);

    const authHeader = req.headers.get("Authorization") || "";

    // 1) Scrape via site-scrape (reaproveita persistência de screenshot no bucket site-thumbs)
    const scrapeRes = await fetch(`${SUPABASE_URL}/functions/v1/site-scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader || `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ url }),
    });
    const scrape = await scrapeRes.json().catch(() => ({}));
    if (!scrape?.success) {
      return json({ success: false, error: scrape?.error || "site-scrape falhou" }, 502);
    }

    const markdown = String(scrape.markdown || "").slice(0, 8000);
    const branding = scrape.branding || null;
    const title = scrape.title || url;
    const screenshot = scrape.screenshot || null;

    // 2) Extração estruturada via Lovable AI Gateway
    const userMsg = `URL: ${url}\nTÍTULO: ${title}\n\n--- MARKDOWN ---\n${markdown}\n\n--- BRANDING ---\n${JSON.stringify(branding || {}).slice(0, 1500)}`;

    const extractRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!extractRes.ok) {
      const t = await extractRes.text();
      if (extractRes.status === 429) return json({ success: false, error: "Rate limit da IA. Tente em alguns segundos." }, 429);
      if (extractRes.status === 402) return json({ success: false, error: "Créditos da IA esgotados." }, 402);
      return json({ success: false, error: `gemini ${extractRes.status}: ${t.slice(0, 300)}` }, 502);
    }
    const ext = await extractRes.json();
    let produto: any = {};
    try {
      produto = JSON.parse(ext.choices?.[0]?.message?.content || "{}");
    } catch {
      produto = {};
    }

    // 3) Se "novo_mecanismo": reescreve com Breakthrough
    if (template === "novo_mecanismo" && produto?.nome) {
      const reRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: REINVENT_PROMPT },
            { role: "user", content: JSON.stringify(produto) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (reRes.ok) {
        const j = await reRes.json();
        try {
          const novo = JSON.parse(j.choices?.[0]?.message?.content || "{}");
          if (novo?.nome) produto = { ...produto, ...novo, _origem: "novo_mecanismo" };
        } catch { /* ignore */ }
      }
    }

    // Metadados de import
    produto._import = {
      url,
      template,
      imported_at: new Date().toISOString(),
      thumbnail: screenshot,
    };
    if (screenshot && !produto.imagem) produto.imagem = screenshot;
    if (branding?.colors?.primary && !produto.cor_primaria) produto.cor_primaria = branding.colors.primary;

    // 4) Log opcional (não bloqueante)
    if (project_id) {
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
        await sb.from("imphq_ai_actions").insert({
          project_id,
          tipo: "funnel_import_product",
          status: "executed",
          risk: "low",
          payload: { url, template, produto_nome: produto?.nome },
        });
      } catch (e) {
        console.error("[funnel-import-product] log ai_actions falhou", e);
      }
    }

    return json({ success: true, produto, scrape: { title, screenshot, branding } });
  } catch (e) {
    console.error("[funnel-import-product] erro", e);
    return json({ success: false, error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
