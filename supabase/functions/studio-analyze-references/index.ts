import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { model_id, assets, projeto_id, contexto } = body as {
      model_id?: string;
      assets: Array<{ url: string; title?: string; kind?: string }>;
      projeto_id?: string;
      contexto?: string;
    };
    if (!assets?.length) {
      return new Response(JSON.stringify({ error: "assets required" }), { status: 400, headers: corsHeaders });
    }

    const imgs = assets.filter((a) => (a.kind ?? "image") === "image").slice(0, 8);

    const system = `Você é um Diretor Criativo. Analise as referências enviadas e devolva SOMENTE JSON no formato:
{
  "estilo_visual": "descrição curta",
  "paleta": ["#hex", ...],
  "enquadramento": "close, plongée, etc",
  "ritmo": "rápido/pausado/etc",
  "iluminação": "descrição",
  "copy_pattern": "padrão de copy/legenda observado",
  "hook_pattern": "padrão de hook (3 primeiros segundos)",
  "cta_pattern": "cta padrão observado",
  "duracao_sugerida_seg": 30,
  "output_recomendado": "reels | vsl | carrossel | imagem",
  "modelagem_resumo": "1 parágrafo de como replicar a estética"
}`;

    const content: any[] = [
      { type: "text", text: `Contexto do projeto: ${contexto ?? "-"}\nAnalise ${imgs.length} referências.` },
      ...imgs.map((a) => ({ type: "image_url", image_url: { url: a.url } })),
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: "AI error", detail: txt }), { status: r.status, headers: corsHeaders });
    }
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let ficha: any = {};
    try { ficha = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { ficha = { modelagem_resumo: raw }; }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let id = model_id;
    if (id) {
      await sb.from("imphq_studio_reference_models")
        .update({ ficha, status: "analyzed", output_type: ficha.output_recomendado ?? null })
        .eq("id", id).eq("user_id", auth.userId);
    } else {
      const { data, error } = await sb.from("imphq_studio_reference_models").insert({
        user_id: auth.userId,
        projeto_id: projeto_id ?? null,
        source_kind: "selection",
        source_assets: assets,
        ficha,
        output_type: ficha.output_recomendado ?? null,
        status: "analyzed",
      }).select("id").single();
      if (error) throw error;
      id = data.id;
    }

    return new Response(JSON.stringify({ id, ficha }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
