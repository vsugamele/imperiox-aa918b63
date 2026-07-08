import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const KIND_BY_TIPO: Record<string, "image" | "video" | "audio"> = {
  image: "image", video: "video", audio: "audio", avatar: "video",
};

function resolvePrompt(text: string, upstreamOutputs: string[]): string {
  if (!text) return text;
  // {{anterior.output}} → primeiro upstream; suporta também {{upstream.N.output}}
  const first = upstreamOutputs[0] || "";
  return text
    .replace(/\{\{anterior\.output\}\}/g, first)
    .replace(/\{\{upstream\.(\d+)\.output\}\}/g, (_, i) => upstreamOutputs[Number(i)] || "");
}

async function pollGeneration(admin: any, id: string, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: g } = await admin.from("imphq_studio_generations").select("status,output_url,error").eq("id", id).single();
    if (g?.status === "completed" && g.output_url) return { ok: true, output_url: g.output_url };
    if (g?.status === "failed") return { ok: false, error: g.error || "falhou" };
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/studio-generate-status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (_) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 6000));
  }
  return { ok: false, error: "timeout" };
}

async function runNode(admin: any, auth: string, node: any, upstreamOutputs: string[], projetoId: string | null) {
  const kind = KIND_BY_TIPO[node.tipo];
  if (!kind) {
    // prompt / publish → apenas propaga
    const text = node.config?.texto || node.config?.prompt || "";
    return { ok: true, output_url: resolvePrompt(text, upstreamOutputs), kind: "text" };
  }
  const cfg = node.config || {};
  const prompt = resolvePrompt(cfg.prompt || "", upstreamOutputs);
  const params: Record<string, any> = { ...(cfg.params || {}) };

  const payload: any = {
    kind, provider: cfg.provider || "kie", model: cfg.model, prompt, params, projeto_id: projetoId,
  };
  // Referência de imagem/áudio upstream
  if (kind === "video" && upstreamOutputs[0]) payload.image_url = upstreamOutputs[0];
  if (node.tipo === "avatar") {
    payload.image_url = upstreamOutputs.find(u => /\.(png|jpe?g|webp)/i.test(u)) || upstreamOutputs[0];
    const audio = upstreamOutputs.find(u => /\.(mp3|wav|ogg|m4a)/i.test(u));
    if (audio) {
      params.reference_audio_urls = [audio];
      if (params.generate_audio === undefined) params.generate_audio = false;
    }
  }
  if (cfg.voice_id) payload.voice_id = cfg.voice_id;

  const r = await fetch(`${SUPABASE_URL}/functions/v1/studio-generate`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const gen = await r.json();
  if (!gen?.ok || !gen?.id) return { ok: false, error: gen?.error || "falha ao iniciar" };

  let outputUrl: string | undefined = gen.output_url;
  if (!outputUrl) {
    const polled = await pollGeneration(admin, gen.id);
    if (!polled.ok) return { ok: false, error: polled.error };
    outputUrl = polled.output_url;
  }
  return { ok: true, output_url: outputUrl, kind };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const workflowId: string = body.workflow_id;
    const projetoId: string | null = body.projeto_id || null;
    const runAll: boolean = !!body.run_all;
    const singleNodeId: string | undefined = body.node_id;

    const [{ data: nodes }, { data: edges }] = await Promise.all([
      admin.from("imphq_studio_canvas_nodes").select("*").eq("workflow_id", workflowId),
      admin.from("imphq_studio_canvas_edges").select("*").eq("workflow_id", workflowId),
    ]);
    if (!nodes) throw new Error("workflow vazio");

    const byId: Record<string, any> = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
    const incoming: Record<string, string[]> = {};
    for (const e of (edges || [])) {
      (incoming[e.target_id] ||= []).push(e.source_id);
    }

    // Executa em background
    (async () => {
      const outputs: Record<string, string> = {};
      // preencher outputs já concluídos
      for (const n of nodes) if (n.status === "gerado" && n.output?.url) outputs[n.id] = n.output.url;

      const targetIds = singleNodeId ? [singleNodeId] : nodes.map((n: any) => n.id);

      // Ordem topológica simples
      const order: string[] = [];
      const visited = new Set<string>();
      const visit = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        for (const up of (incoming[id] || [])) visit(up);
        order.push(id);
      };
      for (const t of targetIds) visit(t);

      for (const nid of order) {
        const n = byId[nid];
        if (!n) continue;
        if (!runAll && nid !== singleNodeId && outputs[nid]) continue;
        if (n.status === "gerado" && outputs[nid] && nid !== singleNodeId) continue;

        const ups = (incoming[nid] || []).map(id => outputs[id]).filter(Boolean);

        await admin.from("imphq_studio_canvas_nodes").update({ status: "gerando" }).eq("id", nid);
        const res = await runNode(admin, auth, n, ups, projetoId);
        if (!res.ok) {
          await admin.from("imphq_studio_canvas_nodes").update({
            status: "erro",
            output: { error: res.error },
          }).eq("id", nid);
          if (!runAll) return;
          continue;
        }
        outputs[nid] = res.output_url || "";
        await admin.from("imphq_studio_canvas_nodes").update({
          status: "gerado",
          output: { url: res.output_url, kind: res.kind },
        }).eq("id", nid);
      }
    })().catch((e) => console.error("studio-canvas-run fatal:", e));

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("studio-canvas-run:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
