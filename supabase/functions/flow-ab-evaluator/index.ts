// flow-ab-evaluator: avalia variantes A/B de nós de blueprints e promove vencedora via Wilson score.
// Cron sugerido: a cada 6h.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Wilson lower bound 95%
function wilsonLower(success: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = success / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (center - margin) / denom;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: variants } = await supa
      .from("imphq_flow_node_variants")
      .select("*")
      .eq("status", "testing");

    if (!variants?.length) {
      return new Response(JSON.stringify({ ok: true, evaluated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by blueprint+node
    const groups = new Map<string, any[]>();
    for (const v of variants) {
      const k = `${v.blueprint_id}::${v.node_id}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(v);
    }

    let promoted = 0;
    const results: any[] = [];

    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const enriched = group.map((v) => ({
        ...v,
        rate: v.impressions > 0 ? v.conversions / v.impressions : 0,
        lower: wilsonLower(v.conversions || 0, v.impressions || 0),
      }));
      const minN = Math.min(...enriched.map((v) => v.impressions));
      if (minN < 100) { results.push({ key, status: "collecting", minN }); continue; }

      enriched.sort((a, b) => b.lower - a.lower);
      const winner = enriched[0];
      const second = enriched[1];

      // Significance: winner Wilson lower > second rate
      if (winner.lower > second.rate && winner.rate > second.rate) {
        await supa
          .from("imphq_flow_node_variants")
          .update({ status: "winner", weight: 100 })
          .eq("id", winner.id);
        for (const v of enriched.slice(1)) {
          await supa
            .from("imphq_flow_node_variants")
            .update({ status: "loser", weight: 0 })
            .eq("id", v.id);
        }
        promoted++;
        results.push({
          key,
          status: "promoted",
          winner: winner.variant_key,
          winner_rate: (winner.rate * 100).toFixed(2),
          loser_rate: (second.rate * 100).toFixed(2),
        });
      } else {
        results.push({ key, status: "no_significance", n: minN });
      }
    }

    return new Response(JSON.stringify({ ok: true, promoted, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
