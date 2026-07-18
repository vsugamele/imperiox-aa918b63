// Swipe File — Importação (JSON estruturado, texto bruto via IA, URL via Firecrawl)
// Detecta automaticamente formato VSL (longo) vs. copy curta e aplica esquema de blocos correspondente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SwipeBlocks {
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

// Heurística rápida para decidir se é VSL antes de chamar a IA
function looksLikeVsl(text: string): boolean {
  if (!text) return false;
  const wc = text.trim().split(/\s+/).length;
  const t = text.toLowerCase();
  const markers = [
    /nos? pr[oó]ximos?\s+\d+\s+minutos?/i,
    /meu nome é/i,
    /você vai descobrir/i,
    /garantia (incondicional|de \d+ dias)/i,
    /b[oô]nus #?\d/i,
    /clique no bot[ãa]o (abaixo|aqui)/i,
    /in the next \d+ minutes?/i,
    /my name is/i,
    /bonus #?\d/i,
  ];
  const hits = markers.filter((r) => r.test(t)).length;
  return wc >= 1200 || hits >= 2;
}

const SHORT_SCHEMA = `{
  "title": "string curta (máx 60 chars)",
  "criador": "string ou null",
  "plataforma": "Instagram|TikTok|YouTube|LP|Email|Outro|null",
  "formato": "Reel|Anúncio|Story|Email|Post|Outro|null",
  "mecanismo": "string curta descrevendo o mecanismo (ex: segredo + escassez)",
  "gatilhos": ["array de gatilhos psicológicos detectados"],
  "blocks": {
    "__schema": "short6",
    "gancho": "frase de abertura",
    "participacao_ativa": "instrução de engajamento se houver",
    "narrativa": "corpo narrativo",
    "reframe": "virada/promessa",
    "cta_engajamento": "CTA de engajamento se houver",
    "cta_venda": "CTA principal de venda"
  }
}`;

const VSL_SCHEMA = `{
  "title": "string curta (máx 80 chars)",
  "criador": "string ou null",
  "plataforma": "YouTube|LP|VTurb|Outro|null",
  "formato": "VSL",
  "mecanismo": "nome do mecanismo único declarado/inferido (ex: 'Protocolo 3P')",
  "gatilhos": ["lista de gatilhos psicológicos detectados"],
  "blocks": {
    "__schema": "vsl7",
    "b1_gancho": "abertura + interrupção de padrão + promessa (texto literal e completo do bloco)",
    "b2_agitacao": "agitação da dor: sintomas, causa raiz negligenciada, custo de não resolver",
    "b3_origem": "história de origem do expert: antes, crise, busca, descoberta, transformação",
    "b4_mecanismo": "apresentação do mecanismo único: nome, analogia, pilares, por que concorrência falha",
    "b5_oferta": "revelação da oferta + escada de ancoragem (valor real, custo, mercado, preço final)",
    "b6_value_stack": "lista de bônus, cada um amarrado a uma objeção que mata",
    "b7_garantia_cta": "garantia + CTA final + urgência/escassez"
  },
  "vsl_meta": {
    "promessa_central": "1 frase que resume a promessa",
    "publico_alvo": "1 frase descrevendo o avatar implícito",
    "duracao_estimada_min": "número aproximado em minutos",
    "tipo_garantia": "incondicional|condicional|risco invertido|nenhuma"
  }
}`;

async function aiExtractStructure(rawText: string, vsl: boolean): Promise<Partial<SwipeRow> & { vsl_meta?: any }> {
  const schema = vsl ? VSL_SCHEMA : SHORT_SCHEMA;
  const instruction = vsl
    ? `Você é um copywriter sênior dissecando uma VSL (Video Sales Letter). Preserve o TEXTO REAL de cada bloco — não resuma. Se um bloco não existir, devolva string vazia.`
    : `Você é um copywriter que disseca copys curtas. Use null para o que não couber.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `${instruction} Retorne APENAS JSON válido, sem markdown.` },
        { role: "user", content: `Quebre essa copy no esquema abaixo. Schema:
${schema}

COPY:
"""${rawText.slice(0, vsl ? 30000 : 8000)}"""` },
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

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { mode, payload, project_id = null, produto_id = null, nicho = null, force_format = null } = body;

    const rows: SwipeRow[] = [];

    if (mode === "json") {
      const data = typeof payload === "string" ? JSON.parse(payload) : payload;
      const list = data.roteiros || data.copies || data.swipes || (Array.isArray(data) ? data : [data]);
      const baseCriador = data.criador || data.creator || null;
      const basePlataforma = data.plataforma || data.platform || null;
      const baseProduto = data.produto || data.product || null;
      for (const r of list) {
        const incomingBlocks = r.blocks || {};
        const isVslRow = (r.formato || "").toLowerCase() === "vsl" || incomingBlocks.__schema === "vsl7";
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
          blocks: isVslRow
            ? {
                __schema: "vsl7",
                b1_gancho: r.b1_gancho || r.gancho || incomingBlocks.b1_gancho || "",
                b2_agitacao: r.b2_agitacao || incomingBlocks.b2_agitacao || "",
                b3_origem: r.b3_origem || incomingBlocks.b3_origem || "",
                b4_mecanismo: r.b4_mecanismo || incomingBlocks.b4_mecanismo || "",
                b5_oferta: r.b5_oferta || incomingBlocks.b5_oferta || "",
                b6_value_stack: r.b6_value_stack || incomingBlocks.b6_value_stack || "",
                b7_garantia_cta: r.b7_garantia_cta || r.cta_venda || incomingBlocks.b7_garantia_cta || "",
                ...incomingBlocks,
              }
            : {
                __schema: "short6",
                gancho: r.gancho || r.hook || "",
                participacao_ativa: r.participacao_ativa || r.engagement || "",
                narrativa: r.narrativa || r.body || "",
                reframe: r.reframe || "",
                cta_engajamento: r.cta_engajamento || r.cta_engagement || "",
                cta_venda: r.cta_venda || r.cta_sale || r.cta || "",
                ...incomingBlocks,
              },
        });
      }
    } else if (mode === "text" || mode === "url") {
      const text = mode === "url" ? await fetchUrl(payload) : payload;
      const vsl = force_format === "vsl" ? true : force_format === "short" ? false : looksLikeVsl(text);
      const extracted: any = await aiExtractStructure(text, vsl);
      rows.push({
        user_id: user.id,
        project_id,
        produto_id,
        title: extracted.title || (mode === "url" ? payload : "Copy importada"),
        criador: extracted.criador || null,
        plataforma: extracted.plataforma || null,
        formato: extracted.formato || (vsl ? "VSL" : null),
        mecanismo: extracted.mecanismo || null,
        gatilhos: extracted.gatilhos || [],
        nicho,
        blocks: {
          ...(extracted.blocks || {}),
          ...(vsl && extracted.vsl_meta ? { __vsl_meta: extracted.vsl_meta } : {}),
        },
        raw_text: text.slice(0, 30000),
        source_url: mode === "url" ? payload : null,
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
