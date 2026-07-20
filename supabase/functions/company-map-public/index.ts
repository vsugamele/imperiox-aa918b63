import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fields removed from nodes/annotations before returning (privacy)
const NODE_SAFE_FIELDS = [
  "id", "map_id", "label", "kind", "color", "description",
  "position", "size", "width", "height", "image_url", "url",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) return json({ error: "Token inválido" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: map, error: mErr } = await sb
      .from("imphq_company_maps")
      .select("id, name, viewport")
      .eq("share_token", token)
      .maybeSingle();

    if (mErr) throw mErr;
    if (!map) return json({ error: "Link inválido ou revogado" }, 404);

    const [nodesRes, edgesRes, annRes] = await Promise.all([
      sb.from("imphq_company_map_nodes").select("*").eq("map_id", map.id),
      sb.from("imphq_company_map_edges").select("id, source_id, target_id, source_kind, target_kind, style, label").eq("map_id", map.id),
      sb.from("imphq_company_map_annotations" as any).select("*").eq("map_id", map.id),
    ]);

    const nodes = (nodesRes.data || []).map((n: any) => {
      const safe: any = {};
      for (const f of NODE_SAFE_FIELDS) safe[f] = n[f] ?? null;
      // hide checklist items but keep counts
      const checklist = Array.isArray(n.checklist) ? n.checklist : [];
      safe.checklist_total = checklist.length;
      safe.checklist_done = checklist.filter((c: any) => c?.done).length;
      return safe;
    });

    return json({
      map: { id: map.id, name: map.name, viewport: map.viewport },
      nodes,
      edges: edgesRes.data || [],
      annotations: annRes.data || [],
    });
  } catch (e: any) {
    return json({ error: e?.message || "Erro" }, 500);
  }
});
