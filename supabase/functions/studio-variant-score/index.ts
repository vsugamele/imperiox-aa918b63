// Avalia todas as variantes de um batch_group_id do Studio: para cada nó, chama a IA
// (vision quando há imagem gerada, texto quando é prompt puro) e calcula um score 0-100.
// Marca a variante com maior score como is_variant_winner=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYS_TEXT = `Você avalia hooks/prompts em 5 dimensões (0-20 cada, total 0-100): curiosidade, especificidade, promessa, contraste, ritmo. Responda APENAS JSON: { "score": 0-100, "breakdown": {...}, "veredito": "...", "diagnostico": "..." }`;
const SYS_VISION = `Você avalia criativos visuais para Reels/Ads em 5 dimensões (0-20 cada, total 0-100): impacto visual, clareza da mensagem, stopping power (para o scroll?), coerência com o prompt, viabilidade comercial. Responda APENAS JSON: { "score": 0-100, "breakdown": {...}, "veredito": "...", "diagnostico": "..." }`;

async function scoreText(prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYS_TEXT },
        { role: "user", content: `AVALIAR:\n${prompt}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  const content = (j.choices?.[0]?.message?.content || "").replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(content);
}

async function scoreVision(prompt: string, imageUrl: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYS_VISION },
        { role: "user", content: [
          { type: "text", text: `PROMPT USADO:\n${prompt || "(sem prompt)"}` },
          { type: "image_url", image_url: { url: imageUrl } },
        ] as any },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  const content = (j.choices?.[0]?.message?.content || "").replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(content);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user?.id) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { batch_group_id } = await req.json();
    if (!batch_group_id) throw new Error("batch_group_id obrigatório");

    const { data: nodes, error } = await admin
      .from("imphq_studio_canvas_nodes").select("*")
      .eq("batch_group_id", batch_group_id);
    if (error) throw error;
    if (!nodes?.length) throw new Error("nenhuma variante encontrada");

    const results: any[] = [];
    let bestId: string | null = null;
    let bestScore = -1;

    for (const n of nodes) {
      try {
        const promptTxt = n.config?.prompt || n.config?.texto || n.titulo || "";
        const outUrl = n.output?.url || "";
        const outKind = n.output?.kind;
        let scoreData: any;
        if (outUrl && outKind === "image") {
          scoreData = await scoreVision(promptTxt, outUrl);
        } else {
          scoreData = await scoreText(promptTxt);
        }
        const score = Number(scoreData?.score || 0);
        await admin.from("imphq_studio_canvas_nodes").update({
          variant_score: score, variant_score_data: scoreData, is_variant_winner: false,
        }).eq("id", n.id);
        results.push({ id: n.id, label: n.variant_label, score, veredito: scoreData?.veredito });
        if (score > bestScore) { bestScore = score; bestId = n.id; }
      } catch (e: any) {
        console.error("score fail", n.id, e?.message);
        results.push({ id: n.id, label: n.variant_label, error: e?.message });
      }
    }

    if (bestId) {
      await admin.from("imphq_studio_canvas_nodes").update({ is_variant_winner: true }).eq("id", bestId);
    }

    return new Response(JSON.stringify({ ok: true, winner_id: bestId, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("studio-variant-score:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
