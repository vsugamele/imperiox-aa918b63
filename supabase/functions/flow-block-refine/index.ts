// Refina o texto de um bloco de FlowBlueprint usando imagens conectadas
// (multimodal com Gemini). Lê o bloco, chama o modelo com image_url + texto
// atual + instruções, e persiste o novo texto no blueprint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Body = z.object({
  blueprint_id: z.string().uuid(),
  node_id: z.string().min(1),
  block_id: z.string().min(1),
  image_urls: z.array(z.string().url()).min(1).max(6),
  instructions: z.string().max(2000).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const { blueprint_id, node_id, block_id, image_urls, instructions } = parsed.data;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row, error } = await sb
      .from("imphq_flow_blueprints")
      .select("blueprint")
      .eq("id", blueprint_id)
      .maybeSingle();
    if (error || !row) return json({ error: "blueprint_not_found" }, 404);

    const bp: any = row.blueprint;
    const node = bp?.nodes?.find((n: any) => n.id === node_id);
    const block = node?.blocks?.find((b: any) => b.id === block_id);
    if (!block) return json({ error: "block_not_found" }, 404);

    const current = String(block.text || block.image_prompt || "").slice(0, 4000);

    const userContent: any[] = [
      {
        type: "text",
        text: `Você é um copywriter que reescreve um bloco de roteiro/script analisando as imagens conectadas.

CONTEXTO DO BLOCO ATUAL (pode estar vazio):
"""
${current || "(vazio)"}
"""

${instructions ? `INSTRUÇÕES EXTRAS DO USUÁRIO:\n${instructions}\n\n` : ""}TAREFA:
1. Descreva mentalmente o que vê nas imagens (cena, expressão, texto sobreposto, cenário, produto).
2. Reescreva o bloco ancorando a copy no que aparece nas imagens (referencie elementos visuais concretos).
3. Mantenha o mesmo idioma (pt-BR), tom persuasivo e o mesmo formato (mesmos títulos/marcadores se houver).
4. Responda APENAS com o texto final do bloco. Nada de explicações, nada de "###" a mais que o original.`,
      },
      ...image_urls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return json({ error: `ai_upstream_${res.status}`, detail: txt.slice(0, 300) }, res.status === 429 ? 429 : 502);
    }
    const data = await res.json();
    const newText: string = (data.choices?.[0]?.message?.content || "").trim();
    if (!newText) return json({ error: "empty_output" }, 502);

    const nextBp = {
      ...bp,
      nodes: bp.nodes.map((n: any) =>
        n.id === node_id
          ? { ...n, blocks: n.blocks.map((b: any) => (b.id === block_id ? { ...b, text: newText } : b)) }
          : n
      ),
    };
    await sb.from("imphq_flow_blueprints").update({ blueprint: nextBp }).eq("id", blueprint_id);

    return json({ text: newText });
  } catch (e: any) {
    return json({ error: e?.message || "erro" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
