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

function resolvePrompt(text: string, upstreamOutputs: string[], modelingFicha?: any): string {
  if (!text) return text;
  const first = upstreamOutputs[0] || "";
  const fichaStr = modelingFicha ? JSON.stringify(modelingFicha) : "";
  const fichaResumo = modelingFicha?.modelagem_resumo || fichaStr;
  return text
    .replace(/\{\{anterior\.output\}\}/g, first)
    .replace(/\{\{modelagem\.ficha\}\}/g, fichaStr)
    .replace(/\{\{modelagem\.resumo\}\}/g, fichaResumo)
    .replace(/\{\{upstream\.(\d+)\.output\}\}/g, (_, i) => upstreamOutputs[Number(i)] || "");
}

async function sha256(obj: any): Promise<string> {
  const enc = new TextEncoder().encode(JSON.stringify(obj || {}));
  const h = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function logEvent(admin: any, workflowId: string, nodeId: string | null, level: string, message: string, meta?: any) {
  try {
    await admin.from("imphq_studio_canvas_run_events").insert({
      workflow_id: workflowId, node_id: nodeId, level, message, meta: meta || null,
    });
  } catch (_) { /* ignore */ }
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

async function runNode(admin: any, auth: string, node: any, upstreamOutputs: string[], projetoId: string | null, workflowId: string, modelingFicha?: any) {
  // Modeling node: fetch ficha and pass along as output text
  if (node.tipo === "modeling") {
    const mid = node.config?.model_id;
    if (mid) {
      const { data: m } = await admin.from("imphq_studio_reference_models").select("ficha").eq("id", mid).single();
      const ficha = m?.ficha || node.config?.ficha_snapshot || {};
      return { ok: true, output_url: JSON.stringify(ficha), kind: "modeling", ficha };
    }
    const snap = node.config?.ficha_snapshot || {};
    return { ok: true, output_url: JSON.stringify(snap), kind: "modeling", ficha: snap };
  }

  const kind = KIND_BY_TIPO[node.tipo];
  if (!kind) {
    const text = node.config?.texto || node.config?.prompt || "";
    return { ok: true, output_url: resolvePrompt(text, upstreamOutputs, modelingFicha), kind: "text" };
  }
  const cfg = node.config || {};
  const prompt = resolvePrompt(cfg.prompt || "", upstreamOutputs, modelingFicha);
  const params: Record<string, any> = { ...(cfg.params || {}) };

  // Referências visuais (fotos/vídeos anexados no drawer do bloco)
  const refUrls: string[] = Array.isArray(cfg.reference_urls) ? cfg.reference_urls : [];
  const refKinds: string[] = Array.isArray(cfg.reference_kinds) ? cfg.reference_kinds : [];
  const refImages = refUrls.filter((_, i) => (refKinds[i] || "image") === "image");
  const refVideos = refUrls.filter((_, i) => refKinds[i] === "video");
  if (refImages.length) {
    params.reference_image_urls = refImages;
    if (!params.image_urls) params.image_urls = refImages;
  }
  if (refVideos.length) params.reference_video_urls = refVideos;

  const payload: any = {
    kind, provider: cfg.provider || "kie", model: cfg.model, prompt, params, projeto_id: projetoId,
  };
  if (kind === "video" && (upstreamOutputs[0] || refImages[0])) payload.image_url = upstreamOutputs[0] || refImages[0];
  if (node.tipo === "avatar") {
    payload.image_url = upstreamOutputs.find(u => /\.(png|jpe?g|webp)/i.test(u)) || refImages[0] || upstreamOutputs[0];
    const audio = upstreamOutputs.find(u => /\.(mp3|wav|ogg|m4a)/i.test(u));
    if (audio) {
      params.reference_audio_urls = [audio];
      if (params.generate_audio === undefined) params.generate_audio = false;
    }
  }
  if (kind === "image" && refImages.length && !payload.image_url) payload.image_url = refImages[0];
  if (cfg.voice_id) payload.voice_id = cfg.voice_id;

  // Retry até 3x em falhas transitórias
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/studio-generate`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const gen = await r.json();
      if (!gen?.ok || !gen?.id) {
        lastErr = gen?.error || "falha ao iniciar";
        if (attempt < 3) {
          await logEvent(admin, workflowId, node.id, "warn", `tentativa ${attempt} falhou, retry em ${attempt * 2}s: ${lastErr}`);
          await new Promise((r) => setTimeout(r, attempt * 2000));
          continue;
        }
        return { ok: false, error: lastErr };
      }
      let outputUrl: string | undefined = gen.output_url;
      if (!outputUrl) {
        const polled = await pollGeneration(admin, gen.id);
        if (!polled.ok) { lastErr = polled.error || "poll failed"; break; }
        outputUrl = polled.output_url;
      }
      return { ok: true, output_url: outputUrl, kind };
    } catch (e: any) {
      lastErr = e?.message || String(e);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  return { ok: false, error: lastErr || "erro desconhecido" };
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
    const startNodeId: string | undefined = body.start_node_id;
    const forceRerun: boolean = !!body.force_rerun;

    const [{ data: nodes }, { data: edges }] = await Promise.all([
      admin.from("imphq_studio_canvas_nodes").select("*").eq("workflow_id", workflowId),
      admin.from("imphq_studio_canvas_edges").select("*").eq("workflow_id", workflowId),
    ]);
    if (!nodes) throw new Error("workflow vazio");

    const byId: Record<string, any> = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
    const incoming: Record<string, string[]> = {};
    const outgoing: Record<string, string[]> = {};
    for (const e of (edges || [])) {
      (incoming[e.target_id] ||= []).push(e.source_id);
      (outgoing[e.source_id] ||= []).push(e.target_id);
    }

    // Custos por modelo
    const { data: costRows } = await admin.from("imphq_studio_model_costs").select("provider,model,cost_credits");
    const costMap = new Map<string, number>();
    for (const c of (costRows || [])) costMap.set(`${c.provider}:${c.model}`, Number(c.cost_credits));

    (async () => {
      const outputs: Record<string, string> = {};
      for (const n of nodes) if (n.status === "gerado" && n.output?.url) outputs[n.id] = n.output.url;

      // Determinar alvos
      let targetIds: string[];
      if (singleNodeId) targetIds = [singleNodeId];
      else if (startNodeId) {
        // start_node_id + tudo a jusante
        const set = new Set<string>();
        const walk = (id: string) => { if (set.has(id)) return; set.add(id); (outgoing[id] || []).forEach(walk); };
        walk(startNodeId);
        targetIds = [...set];
      } else {
        targetIds = nodes.map((n: any) => n.id);
      }

      // Ordem topológica
      const order: string[] = [];
      const visited = new Set<string>();
      const visit = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        for (const up of (incoming[id] || [])) visit(up);
        order.push(id);
      };
      for (const t of targetIds) visit(t);

      await logEvent(admin, workflowId, null, "info", `Iniciando execução (${order.length} nós na fila)`);

      for (const nid of order) {
        const n = byId[nid];
        if (!n) continue;

        const ups = (incoming[nid] || []).map(id => outputs[id]).filter(Boolean);

        // Cache: se hash da config + hash das entradas bate, reaproveita
        const configHash = await sha256({ tipo: n.tipo, config: n.config, ups });
        if (!forceRerun && n.status === "gerado" && n.output?.url && n.config_hash === configHash) {
          outputs[nid] = n.output.url;
          await logEvent(admin, workflowId, nid, "info", `cache hit — reaproveitou output`, { hash: configHash.slice(0, 8) });
          continue;
        }

        const cfg = n.config || {};
        const estCost = costMap.get(`${cfg.provider || "kie"}:${cfg.model || ""}`) || 0;

        await admin.from("imphq_studio_canvas_nodes").update({ status: "gerando", config_hash: configHash }).eq("id", nid);
        await logEvent(admin, workflowId, nid, "info", `▶ ${n.tipo} · ${cfg.model || "—"}${estCost ? ` (~${estCost} créditos)` : ""}`);

        const t0 = Date.now();
        const res = await runNode(admin, auth, n, ups, projetoId, workflowId);
        const duration = Date.now() - t0;

        if (!res.ok) {
          await admin.from("imphq_studio_canvas_nodes").update({
            status: "erro",
            output: { error: res.error },
            duration_ms: duration,
          }).eq("id", nid);
          await logEvent(admin, workflowId, nid, "error", `✗ falhou: ${res.error}`, { duration_ms: duration });
          if (!runAll && !startNodeId) return;
          continue;
        }
        outputs[nid] = res.output_url || "";
        await admin.from("imphq_studio_canvas_nodes").update({
          status: "gerado",
          output: { url: res.output_url, kind: res.kind },
          duration_ms: duration,
          cost_actual: estCost,
        }).eq("id", nid);
        await logEvent(admin, workflowId, nid, "success", `✓ pronto em ${(duration / 1000).toFixed(1)}s`, { duration_ms: duration, cost: estCost });
      }

      await logEvent(admin, workflowId, null, "success", `Execução concluída`);
    })().catch(async (e) => {
      console.error("studio-canvas-run fatal:", e);
      await logEvent(admin, workflowId, null, "error", `fatal: ${e?.message || e}`);
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("studio-canvas-run:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
