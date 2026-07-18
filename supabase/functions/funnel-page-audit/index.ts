// Audita uma página (LP/VSL/Checkout) contra avatar + produto.
import { requireUser } from "../_shared/require-auth.ts";
// Pipeline: site-scrape (Firecrawl) -> Gemini avalia 7 critérios.
// Retorna score (0-100) + issues + quick_wins.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `Você é Imperius, auditor de páginas de venda (Schwartz/Bencivenga/Sugamele).
Receba o markdown + branding de uma página + contexto (avatar + produto) e avalie 7 critérios (0-10 cada):
headline, promessa, mecanismo_unico, prova, cta, urgencia_escassez, objecoes.
Devolva APENAS JSON:
{
  "score": number (0-100, soma ponderada),
  "criterios": { "headline": {"nota": number, "comentario": string}, ... mesmos 7 },
  "issues": string[] (problemas concretos, máx 6),
  "quick_wins": string[] (ações de alto impacto e baixo esforço, máx 5),
  "veredito": string (1 frase forte em pt-BR)
}
Seja específico, factual, em pt-BR.`;

interface Body {
  url: string;
  project_id?: string;
  produto?: any;
  avatar?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const { url, produto, avatar } = (await req.json()) as Body;
    if (!url) return json({ success: false, error: "url obrigatória" }, 400);
    if (!LOVABLE_API_KEY) return json({ success: false, error: "LOVABLE_API_KEY ausente" }, 500);

    const authHeader = req.headers.get("Authorization") || "";

    // 1) Scrape
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

    const markdown = String(scrape.markdown || "").slice(0, 7000);
    const title = scrape.title || url;
    const screenshot = scrape.screenshot || null;

    const userMsg = `URL: ${url}
TÍTULO: ${title}

--- PÁGINA (markdown) ---
${markdown}

--- PRODUTO ---
${JSON.stringify(produto || {}).slice(0, 1200)}

--- AVATAR ---
${JSON.stringify(avatar || {}).slice(0, 1500)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return json({ success: false, error: "Rate limit da IA. Tente em alguns segundos." }, 429);
      if (aiRes.status === 402) return json({ success: false, error: "Créditos da IA esgotados." }, 402);
      return json({ success: false, error: `gemini ${aiRes.status}: ${t.slice(0, 300)}` }, 502);
    }
    const aiJson = await aiRes.json();
    let audit: any = {};
    try {
      audit = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");
    } catch {
      audit = {};
    }

    audit._meta = {
      url,
      title,
      screenshot,
      audited_at: new Date().toISOString(),
    };

    return json({ success: true, audit, scrape: { title, screenshot } });
  } catch (e) {
    console.error("[funnel-page-audit] erro", e);
    return json({ success: false, error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
