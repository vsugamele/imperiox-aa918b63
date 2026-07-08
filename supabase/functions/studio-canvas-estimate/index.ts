import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(obj: any): Promise<string> {
  const enc = new TextEncoder().encode(JSON.stringify(obj || {}));
  const h = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { workflow_id, start_node_id, node_id } = await req.json();
    const [{ data: nodes }, { data: edges }, { data: costRows }] = await Promise.all([
      admin.from("imphq_studio_canvas_nodes").select("*").eq("workflow_id", workflow_id),
      admin.from("imphq_studio_canvas_edges").select("*").eq("workflow_id", workflow_id),
      admin.from("imphq_studio_model_costs").select("provider,model,cost_credits,avg_seconds"),
    ]);
    if (!nodes) throw new Error("workflow vazio");

    const costMap = new Map<string, { credits: number; seconds: number }>();
    for (const c of (costRows || [])) costMap.set(`${c.provider}:${c.model}`, { credits: Number(c.cost_credits), seconds: Number(c.avg_seconds) });

    const byId: Record<string, any> = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
    const incoming: Record<string, string[]> = {};
    const outgoing: Record<string, string[]> = {};
    for (const e of (edges || [])) {
      (incoming[e.target_id] ||= []).push(e.source_id);
      (outgoing[e.source_id] ||= []).push(e.target_id);
    }

    let targetIds: string[];
    if (node_id) targetIds = [node_id];
    else if (start_node_id) {
      const set = new Set<string>();
      const walk = (id: string) => { if (set.has(id)) return; set.add(id); (outgoing[id] || []).forEach(walk); };
      walk(start_node_id);
      targetIds = [...set];
    } else {
      targetIds = nodes.map((n: any) => n.id);
    }

    const order: string[] = [];
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const up of (incoming[id] || [])) visit(up);
      order.push(id);
    };
    for (const t of targetIds) visit(t);

    const breakdown: any[] = [];
    let totalCredits = 0, totalSeconds = 0, cachedCount = 0;
    // Simular cache com hash das entradas resolvidas (baseado em outputs existentes)
    const simOutputs: Record<string, boolean> = {};
    for (const n of nodes) if (n.status === "gerado" && n.output?.url) simOutputs[n.id] = true;

    for (const nid of order) {
      const n = byId[nid]; if (!n) continue;
      const cfg = n.config || {};
      const key = `${cfg.provider || "kie"}:${cfg.model || ""}`;
      const cost = costMap.get(key);
      const ups = (incoming[nid] || []).map(id => simOutputs[id]).filter(Boolean);
      const configHash = await sha256({ tipo: n.tipo, config: n.config, ups });
      const cached = n.status === "gerado" && n.output?.url && n.config_hash === configHash;
      const credits = cached ? 0 : (cost?.credits || 0);
      const seconds = cached ? 0 : (cost?.seconds || 0);
      if (cached) cachedCount++;
      totalCredits += credits;
      totalSeconds += seconds;
      breakdown.push({
        node_id: nid, tipo: n.tipo, titulo: n.titulo, model: cfg.model || null,
        credits, seconds, cached,
      });
      if (!cached) simOutputs[nid] = true;
    }

    return new Response(JSON.stringify({
      ok: true, total_credits: totalCredits, total_seconds: totalSeconds,
      total_nodes: order.length, cached_nodes: cachedCount, breakdown,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
