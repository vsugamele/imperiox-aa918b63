// Cria N nós irmãos (variações A/B/C…) de um nó existente do canvas do Studio.
// A IA gera N ângulos criativos distintos aplicando pequenas mutações no prompt/config.
// Cada variante herda upstream do nó de origem e é agrupada por batch_group_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM = `Você é diretor criativo de performance. Recebe um bloco base (prompt/hook/roteiro) e gera N variações distintas, cada uma explorando um ângulo criativo diferente (curiosidade, contraste, prova, urgência, autoridade, mecanismo único, transformação, contra-intuitivo, storytelling, específico numérico). pt-BR, sem clichê, sem emoji, sem colchete. Responda APENAS JSON válido.`;

async function generateVariants(basePrompt: string, contexto: string, n: number, strategy: string) {
  const angulos = strategy === "hooks"
    ? "curiosidade, contraste, específico numérico, contra-intuitivo, prova social"
    : strategy === "styles"
    ? "cinematográfico, casual/POV, alto contraste, minimalista, colorido/pop"
    : "ângulos criativos distintos";

  const user = `BLOCO BASE:\n${basePrompt}\n\n${contexto ? `CONTEXTO:\n${contexto}\n\n` : ""}TAREFA: Gere ${n} variações distintas explorando ${angulos}. Cada variação deve ser reescrita completa (não anotação), pronta para usar como prompt/roteiro.\n\nJSON: { "variacoes": [{ "label": "A", "angulo": "<uma palavra>", "prompt": "<texto pronto>" }, ...] }`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  const j = JSON.parse(txt);
  const content = (j.choices?.[0]?.message?.content || "").replace(/^```json\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(content);
  return (parsed.variacoes || []).slice(0, n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { node_id, count = 3, strategy = "hooks", contexto = "" } = await req.json();
    if (!node_id) throw new Error("node_id obrigatório");
    const n = Math.max(2, Math.min(6, Number(count)));

    const { data: baseNode, error: nErr } = await admin
      .from("imphq_studio_canvas_nodes").select("*").eq("id", node_id).single();
    if (nErr || !baseNode) throw new Error("nó base não encontrado");

    const basePrompt = baseNode.config?.prompt || baseNode.config?.texto || baseNode.titulo || "";
    if (!basePrompt) throw new Error("nó base sem prompt/texto para variar");

    const variants = await generateVariants(basePrompt, contexto, n, strategy);
    if (!variants.length) throw new Error("IA não devolveu variações");

    const batchGroupId = crypto.randomUUID();
    const workflowId = baseNode.workflow_id;
    const baseX = baseNode.position?.x || 400;
    const baseY = baseNode.position?.y || 200;

    // upstream edges do nó base — replicamos para cada variante
    const { data: upEdges } = await admin
      .from("imphq_studio_canvas_edges").select("*")
      .eq("workflow_id", workflowId).eq("target_id", node_id);

    // marca o próprio nó base como parte do grupo (label A)
    await admin.from("imphq_studio_canvas_nodes").update({
      batch_group_id: batchGroupId, variant_label: "A", variant_angulo: "original",
    }).eq("id", node_id);

    const created: any[] = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const label = String.fromCharCode(66 + i); // B, C, D…
      const cfg = { ...(baseNode.config || {}), prompt: v.prompt || basePrompt };
      // limpa outputs para variante rodar do zero
      const position = { x: baseX, y: baseY + (i + 1) * 260 };
      const { data: newNode, error } = await admin.from("imphq_studio_canvas_nodes").insert({
        workflow_id: workflowId,
        tipo: baseNode.tipo,
        titulo: `${baseNode.titulo || baseNode.tipo} · ${label}`,
        config: cfg,
        position,
        status: "pendente",
        batch_group_id: batchGroupId,
        variant_of: node_id,
        variant_label: label,
        variant_angulo: v.angulo || null,
      }).select("*").single();
      if (error) { console.error("insert variant fail", error); continue; }
      created.push(newNode);

      // replica edges upstream
      for (const e of (upEdges || [])) {
        await admin.from("imphq_studio_canvas_edges").insert({
          workflow_id: workflowId, source_id: e.source_id, target_id: newNode.id,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, batch_group_id: batchGroupId, created: created.length, variants: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("studio-batch-variations:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
