// wa-rules-reindex — backfill de embeddings em imphq_wa_project_rules
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const project_id: string | undefined = body.project_id;
    const limit = Number(body.limit) || 200;

    let q = supa.from("imphq_wa_project_rules")
      .select("id, rule_text, project_id")
      .is("embedding", null)
      .limit(limit);
    if (project_id) q = q.eq("project_id", project_id);

    const { data: rows, error } = await q;
    if (error) throw error;

    let ok = 0, fail = 0;
    for (const r of (rows || [])) {
      try {
        const emb = await getCachedEmbedding(supa, r.rule_text);
        if (!emb) { fail++; continue; }
        const { error: upErr } = await supa.from("imphq_wa_project_rules")
          .update({ embedding: emb }).eq("id", r.id);
        if (upErr) { fail++; continue; }
        ok++;
      } catch { fail++; }
    }
    return new Response(JSON.stringify({ ok: true, indexed: ok, failed: fail, total: rows?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-rules-reindex]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
