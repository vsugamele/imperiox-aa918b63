// Swipe File — Importação (JSON estruturado, texto bruto via IA, URL via Firecrawl)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SwipeBlocks {
  gancho?: string;
  participacao_ativa?: string;
  narrativa?: string;
  reframe?: string;
  cta_engajamento?: string;
  cta_venda?: string;
  [k: string]: any;
}

interface SwipeRow {
  user_id: string;
  project_id?: string | null;
  produto_id?: string | null;
  title: string;
  criador?: string | null;
  plataforma?: string | null;
  formato?: string | null;
  mecanismo?: string | null;
  gatilhos?: string[];
  nicho?: string | null;
  tags?: string[];
  blocks: SwipeBlocks;
  source_url?: string | null;
  raw_text?: string | null;
}

async function aiExtractStructure(rawText: string): Promise<Partial<SwipeRow>> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "Você é um copywriter que disseca copys. Retorne APENAS JSON válido (sem markdown) com o esquema solicitado." },
        { role: "user", content: `Quebre essa copy nos seguintes campos. Use null para o que não couber. Esquema JSON:
{
  "title": "string curta (máx 60 chars)",
  "criador": "string ou null",
  "plataforma": "Instagram|TikTok|YouTube|LP|Email|Outro|null",
  "formato": "Reel|VSL|Anúncio|Story|Email|Post|Outro|null",
  "mecanismo": "string curta descrevendo o mecanismo (ex: segredo + escassez)",
  "gatilhos": ["array de gatilhos psicológicos detectados"],
  "blocks": {
    "gancho": "frase de abertura",
    "participacao_ativa": "instrução de engajamento se houver",
    "narrativa": "corpo narrativo",
    "reframe": "virada/promessa",
    "cta_engajamento": "CTA de engajamento se houver",
    "cta_venda": "CTA principal de venda"
  }
}

COPY:
"""${rawText.slice(0, 8000)}"""` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(txt);
}

async function fetchUrl(url: string): Promise<string> {
  if (FIRECRAWL_API_KEY) {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const j = await r.json();
    return j.data?.markdown || j.markdown || "";
  }
  const r = await fetch(url);
  const html = await r.text();
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { mode, payload, project_id = null, produto_id = null, nicho = null } = body;

    const rows: SwipeRow[] = [];

    if (mode === "json") {
      // payload: { produto?, criador?, plataforma?, roteiros: [...] }
      const data = typeof payload === "string" ? JSON.parse(payload) : payload;
      const list = data.roteiros || data.copies || data.swipes || (Array.isArray(data) ? data : [data]);
      const baseCriador = data.criador || data.creator || null;
      const basePlataforma = data.plataforma || data.platform || null;
      const baseProduto = data.produto || data.product || null;
      for (const r of list) {
        rows.push({
          user_id: user.id,
          project_id,
          produto_id,
          title: r.titulo || r.title || r.id || "Sem título",
          criador: r.criador || baseCriador,
          plataforma: r.plataforma || basePlataforma,
          formato: r.formato || r.format || null,
          mecanismo: r.mecanismo || r.mechanism || null,
          gatilhos: Array.isArray(r.gatilhos) ? r.gatilhos : [],
          nicho: r.nicho || nicho || baseProduto,
          tags: Array.isArray(r.tags) ? r.tags : [],
          blocks: {
            gancho: r.gancho || r.hook || "",
            participacao_ativa: r.participacao_ativa || r.engagement || "",
            narrativa: r.narrativa || r.body || "",
            reframe: r.reframe || "",
            cta_engajamento: r.cta_engajamento || r.cta_engagement || "",
            cta_venda: r.cta_venda || r.cta_sale || r.cta || "",
            ...(r.blocks || {}),
          },
        });
      }
    } else if (mode === "text") {
      const extracted = await aiExtractStructure(payload);
      rows.push({
        user_id: user.id,
        project_id,
        produto_id,
        title: extracted.title || "Copy importada",
        criador: extracted.criador || null,
        plataforma: extracted.plataforma || null,
        formato: extracted.formato || null,
        mecanismo: extracted.mecanismo || null,
        gatilhos: extracted.gatilhos || [],
        nicho,
        blocks: extracted.blocks || {},
        raw_text: payload,
      });
    } else if (mode === "url") {
      const text = await fetchUrl(payload);
      const extracted = await aiExtractStructure(text);
      rows.push({
        user_id: user.id,
        project_id,
        produto_id,
        title: extracted.title || payload,
        criador: extracted.criador || null,
        plataforma: extracted.plataforma || null,
        formato: extracted.formato || null,
        mecanismo: extracted.mecanismo || null,
        gatilhos: extracted.gatilhos || [],
        nicho,
        blocks: extracted.blocks || {},
        raw_text: text.slice(0, 20000),
        source_url: payload,
      });
    } else {
      return new Response(JSON.stringify({ error: "mode inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: inserted, error } = await supabase.from("imphq_swipes").insert(rows as any).select();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, count: inserted?.length || 0, swipes: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[swipe-import]", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
