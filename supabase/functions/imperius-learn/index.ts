// Imperius Learning Loop
// Roda diariamente: agrega outcomes -> recalcula imphq_ai_policy (thresholds + kill switch)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Outcomes inferidos automaticamente p/ ações executadas há +24h sem outcome
  await inferOutcomes(supabase);

  // 2) Agregar por (kind, source)
  const { data: outcomes, error } = await supabase
    .from("imphq_ai_action_outcomes")
    .select("kind, source, result, revenue_delta")
    .gte("observed_at", since)
    .limit(10000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const groups = new Map<string, { kind: string; source: string | null; total: number; success: number; failure: number; reverted: number; revenue: number }>();
  for (const o of outcomes ?? []) {
    const key = `${o.kind}::${o.source ?? ""}`;
    const g = groups.get(key) ?? { kind: o.kind, source: o.source ?? null, total: 0, success: 0, failure: 0, reverted: 0, revenue: 0 };
    g.total++;
    if (o.result === "success") g.success++;
    else if (o.result === "failure") g.failure++;
    else if (o.result === "reverted") g.reverted++;
    g.revenue += Number(o.revenue_delta ?? 0);
    groups.set(key, g);
  }

  const updates = [];
  for (const g of groups.values()) {
    const successRate = g.total > 0 ? g.success / g.total : 0;
    const failureRate = g.total > 0 ? (g.failure + g.reverted) / g.total : 0;

    // Política: floor de confiança sobe se taxa de sucesso cai. Kill switch se >20% falhas com n>=10.
    const killed = g.total >= 10 && failureRate >= 0.2;
    const autoExecThreshold = killed ? 0.99 : Math.max(0.7, Math.min(0.95, 1 - successRate * 0.3));
    const confidenceFloor = killed ? 0.95 : Math.max(0.6, 0.85 - successRate * 0.2);

    updates.push({
      scope: "global",
      kind: g.kind,
      source: g.source,
      confidence_floor: Number(confidenceFloor.toFixed(2)),
      auto_exec_threshold: Number(autoExecThreshold.toFixed(2)),
      sample_size: g.total,
      success_rate: Number(successRate.toFixed(3)),
      failure_rate: Number(failureRate.toFixed(3)),
      killed,
      killed_reason: killed ? `failure_rate=${(failureRate * 100).toFixed(0)}% em ${g.total} amostras (30d)` : null,
      updated_at: new Date().toISOString(),
    });
  }

  if (updates.length > 0) {
    const { error: upErr } = await supabase
      .from("imphq_ai_policy")
      .upsert(updates, { onConflict: "scope,kind,source" });
    if (upErr) console.error("policy upsert", upErr);
  }

  return new Response(JSON.stringify({ ok: true, groups: updates.length, outcomes: outcomes?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Inferência simples: ação 'approved'/'auto_executed' há +24h sem outcome => neutro;
// se for pauseAd e CPA do projeto melhorou nos 3d seguintes => success, senão neutro.
// Aqui fazemos a versão mínima para começar a popular o histórico.
async function inferOutcomes(supabase: any) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: actions } = await supabase
    .from("imphq_ai_actions")
    .select("id, kind, source, projeto_id, status, executed_at, payload")
    .in("status", ["executed", "auto_executed", "approved"])
    .lte("executed_at", cutoff)
    .limit(500);

  if (!actions?.length) return;

  const ids = actions.map((a: any) => a.id);
  const { data: existing } = await supabase
    .from("imphq_ai_action_outcomes")
    .select("action_id")
    .in("action_id", ids);
  const have = new Set((existing ?? []).map((o: any) => o.action_id));

  const toInsert = actions
    .filter((a: any) => !have.has(a.id))
    .map((a: any) => ({
      action_id: a.id,
      projeto_id: a.projeto_id,
      kind: a.kind,
      source: a.source,
      result: "neutral",
      revenue_delta: 0,
      days_to_outcome: 1,
      notes: "auto-inferido (sem sinal contrário em 24h)",
    }));

  if (toInsert.length > 0) {
    await supabase.from("imphq_ai_action_outcomes").insert(toInsert);
  }
}
