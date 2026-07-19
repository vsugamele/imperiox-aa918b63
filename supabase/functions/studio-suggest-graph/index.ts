import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM = `Você é diretor criativo do Studio Imperius. Dado um produto (nome, avatar, promessa) e opcionalmente uma ficha de modelagem visual, proponha um GRAFO de blocos para produzir 1 criativo (reels/story/VSL curta).

Tipos disponíveis: image, video, audio, avatar, prompt, publish.
Conexões válidas típicas: image→video, video→audio, audio→publish, image→avatar, audio→avatar, avatar→publish.

Devolva SOMENTE JSON:
{
  "titulo": "curto",
  "output_type": "reels|story|vsl|carrossel",
  "nodes": [
    { "tipo": "image", "titulo": "Cena 1 – hook", "prompt": "prompt visual detalhado no estilo da ficha" },
    { "tipo": "video", "titulo": "Anima hook", "prompt": "instrução de movimento" },
    { "tipo": "audio", "titulo": "Narração hook", "prompt": "texto do locutor pt-BR" },
    { "tipo": "publish", "titulo": "Publicar" }
  ],
  "edges": [{ "from": 0, "to": 1 }, { "from": 1, "to": 2 }, { "from": 2, "to": 3 }]
}

Regras:
- 4 a 8 nós. Sempre termine em publish.
- Prompts curtos e diretos, em pt-BR quando texto falado, em inglês visual quando descrição de imagem/vídeo.
- Considere o avatar/persona e a promessa do produto para o hook.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { projeto_id, produto_idx = 0 } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let produto: any = {};
    let avatar: any = {};
    let ficha: any = null;
    if (projeto_id) {
      const { data: p } = await sb.from("imphq_projects").select("data").eq("id", projeto_id).maybeSingle();
      const raw: any = (p as any)?.data;
      const b = raw?.briefing ?? raw ?? {};
      produto = (b?.produtos ?? [])[produto_idx] ?? {};
      avatar = b?.avatares_por_produto?.[produto_idx] ?? b?.avatar ?? {};
      const { data: m } = await sb.from("imphq_studio_reference_models" as any)
        .select("ficha").eq("projeto_id", projeto_id).eq("user_id", auth.userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      ficha = (m as any)?.ficha ?? null;
    }

    const userMsg = `PRODUTO: ${JSON.stringify(produto).slice(0, 1500)}
AVATAR: ${JSON.stringify(avatar).slice(0, 1500)}
FICHA DE MODELAGEM: ${ficha ? JSON.stringify(ficha).slice(0, 2000) : "(nenhuma — improvise estética premium/cinematográfica)"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: "AI error", detail: txt }), { status: r.status, headers: corsHeaders });
    }
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let graph: any = {};
    try { graph = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { graph = {}; }

    return new Response(JSON.stringify(graph), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
