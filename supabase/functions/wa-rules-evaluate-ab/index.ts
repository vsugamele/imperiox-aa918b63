// wa-rules-evaluate-ab — avalia A/B de regras WA; vencedor permanece active, perdedor desativa.
// Chamado por cron 1x/dia. Mínimo 30 aplicações por variante.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const min_sample = Number(body.min_sample) || 30;

    const { data: decisions, error } = await supa.rpc("evaluate_wa_rules_ab", { p_min_sample: min_sample });
    if (error) throw error;

    const results: any[] = [];
    for (const d of (decisions || [])) {
      // Empate ou diferença < 1pp → ignora
      if (Math.abs((d.winner_rate || 0) - (d.loser_rate || 0)) < 0.01) {
        results.push({ group_id: d.group_id, decided: false, reason: "tie" });
        continue;
      }
      await supa.from("imphq_wa_project_rules").update({
        ab_status: "winner", ab_decided_at: new Date().toISOString(),
      }).eq("id", d.winner_id);
      await supa.from("imphq_wa_project_rules").update({
        ab_status: "loser", active: false, ab_decided_at: new Date().toISOString(),
      }).eq("id", d.loser_id);

      // pega project_id pra log
      const { data: w } = await supa.from("imphq_wa_project_rules")
        .select("project_id, rule_text").eq("id", d.winner_id).maybeSingle();
      if (w?.project_id) {
        await supa.from("imphq_ai_actions").insert({
          projeto_id: w.project_id,
          kind: "refine_prompt",
          risk_level: "low",
          status: "completed",
          title: "🏆 A/B de regra decidido",
          reason: `Vencedora: "${(w.rule_text || "").slice(0, 120)}" (${((d.winner_rate || 0) * 100).toFixed(1)}% vs ${((d.loser_rate || 0) * 100).toFixed(1)}%)`,
          source: "wa-rules-evaluate-ab",
          payload: { group_id: d.group_id, winner_id: d.winner_id, loser_id: d.loser_id,
                     winner_rate: d.winner_rate, loser_rate: d.loser_rate },
        });
      }
      results.push({ group_id: d.group_id, decided: true, winner: d.winner_id, loser: d.loser_id });
    }

    return new Response(JSON.stringify({ ok: true, evaluated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[wa-rules-evaluate-ab]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
