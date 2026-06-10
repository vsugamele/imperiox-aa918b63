// ab-test-promoter: avalia testes A/B ativos e promove vencedor quando há significância estatística
// Roda via cron diário. Usa teste qui-quadrado para calcular confiança.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Qui-quadrado: p-value < 0.05 = confiança >= 95%
// Retorna true se a diferença entre as variantes é estatisticamente significativa
function isStatisticallySignificant(
  sentA: number, convertedA: number,
  sentB: number, convertedB: number
): boolean {
  if (sentA < 30 || sentB < 30) return false; // amostra mínima

  const notConvA = sentA - convertedA;
  const notConvB = sentB - convertedB;
  const total = sentA + sentB;
  const totalConv = convertedA + convertedB;
  const totalNotConv = notConvA + notConvB;

  // Frequências esperadas
  const eConvA = (totalConv * sentA) / total;
  const eNotConvA = (totalNotConv * sentA) / total;
  const eConvB = (totalConv * sentB) / total;
  const eNotConvB = (totalNotConv * sentB) / total;

  if (eConvA === 0 || eNotConvA === 0 || eConvB === 0 || eNotConvB === 0) return false;

  const chi2 =
    Math.pow(convertedA - eConvA, 2) / eConvA +
    Math.pow(notConvA - eNotConvA, 2) / eNotConvA +
    Math.pow(convertedB - eConvB, 2) / eConvB +
    Math.pow(notConvB - eNotConvB, 2) / eNotConvB;

  // Chi² > 3.841 = p < 0.05 para 1 grau de liberdade
  return chi2 > 3.841;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca todos os testes ativos sem vencedor ainda
    const { data: tests } = await supabase
      .from("imphq_wa_ab_tests")
      .select("id, project_id, trigger_stage, name")
      .eq("active", true)
      .is("winner_variant_id", null);

    if (!tests || tests.length === 0) {
      return new Response(JSON.stringify({ ok: true, promoted: 0, message: "Nenhum teste ativo sem vencedor" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let promoted = 0;
    const results: any[] = [];

    for (const test of tests) {
      // Busca variantes com contadores
      const { data: variants } = await supabase
        .from("imphq_wa_ab_test_variants")
        .select("id, name, sent_count, converted_count, traffic_percentage")
        .eq("test_id", test.id)
        .eq("active", true);

      if (!variants || variants.length < 2) continue;

      // Só avalia testes com 2 variantes (A/B simples)
      const [varA, varB] = variants;
      const sentA = varA.sent_count || 0;
      const sentB = varB.sent_count || 0;
      const convA = varA.converted_count || 0;
      const convB = varB.converted_count || 0;

      const rateA = sentA > 0 ? convA / sentA : 0;
      const rateB = sentB > 0 ? convB / sentB : 0;

      const significant = isStatisticallySignificant(sentA, convA, sentB, convB);

      if (!significant) {
        results.push({
          test_id: test.id,
          status: "insufficient_data",
          sent_a: sentA, sent_b: sentB,
          rate_a: (rateA * 100).toFixed(1) + "%",
          rate_b: (rateB * 100).toFixed(1) + "%",
        });
        continue;
      }

      // Determina vencedor
      const winner = rateA >= rateB ? varA : varB;
      const loser  = rateA >= rateB ? varB : varA;

      // Promove vencedor
      await supabase
        .from("imphq_wa_ab_tests")
        .update({ winner_variant_id: winner.id })
        .eq("id", test.id);

      // Registra em ai_actions
      await supabase.from("imphq_ai_actions").insert({
        projeto_id: test.project_id,
        kind: "ab_test_winner",
        risk_level: "low",
        status: "completed",
        title: `🏆 Vencedor A/B promovido: ${winner.name || winner.id.substring(0, 8)}`,
        reason: `Teste "${test.name || test.trigger_stage}": variante "${winner.name}" converteu ${(Math.max(rateA, rateB) * 100).toFixed(1)}% vs ${(Math.min(rateA, rateB) * 100).toFixed(1)}% da outra (n=${sentA + sentB}, significância estatística atingida).`,
        source: "ab-test-promoter",
        payload: {
          test_id: test.id,
          winner_id: winner.id,
          loser_id: loser.id,
          sent_winner: Math.max(sentA, sentB),
          sent_loser: Math.min(sentA, sentB),
          rate_winner: (Math.max(rateA, rateB) * 100).toFixed(2),
          rate_loser: (Math.min(rateA, rateB) * 100).toFixed(2),
        },
      });

      promoted++;
      results.push({
        test_id: test.id,
        status: "promoted",
        winner: winner.name,
        rate_winner: (Math.max(rateA, rateB) * 100).toFixed(1) + "%",
        rate_loser: (Math.min(rateA, rateB) * 100).toFixed(1) + "%",
      });

      console.log(`[ab-test-promoter] Promoted winner for test ${test.id}: variant ${winner.id}`);
    }

    return new Response(JSON.stringify({ ok: true, promoted, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ab-test-promoter] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
