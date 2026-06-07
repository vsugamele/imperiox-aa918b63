import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Chi-square independence test helper (df = 1, alpha = 0.05, critical value = 3.841)
function calculateChiSquare(
  s1: number, c1: number,
  s2: number, c2: number
): { chi2: number; significant: boolean; pValue: number } {
  const n1 = s1 - c1;
  const n2 = s2 - c2;
  const total = s1 + s2;
  const totalConv = c1 + c2;
  const totalNonConv = n1 + n2;

  if (total === 0 || totalConv === 0 || totalNonConv === 0) {
    return { chi2: 0, significant: false, pValue: 1 };
  }

  const expectedRateConv = totalConv / total;
  const expectedRateNonConv = totalNonConv / total;

  const ec1 = s1 * expectedRateConv;
  const en1 = s1 * expectedRateNonConv;
  const ec2 = s2 * expectedRateConv;
  const en2 = s2 * expectedRateNonConv;

  const chi2 =
    Math.pow(c1 - ec1, 2) / (ec1 || 1) +
    Math.pow(n1 - en1, 2) / (en1 || 1) +
    Math.pow(c2 - ec2, 2) / (ec2 || 1) +
    Math.pow(n2 - en2, 2) / (en2 || 1);

  // df=1, alpha=0.05 -> critical value is 3.841
  const significant = chi2 >= 3.8411;

  // Rough p-value estimation for df = 1
  let pValue = 1.0;
  if (chi2 > 0) {
    // Standard normal approximation
    const z = Math.sqrt(chi2);
    // Standard normal CDF approximation (Abramowitz and Stegun)
    const t = 1.0 / (1.0 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-chi2 / 2.0);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    pValue = Math.min(1.0, Math.max(0.0, prob * 2)); // two-tailed
  }

  return { chi2, significant, pValue };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active A/B tests
    const { data: activeTests, error: testErr } = await supabase
      .from("imphq_wa_ab_tests")
      .select("*")
      .eq("active", true);

    if (testErr) throw testErr;

    const evaluated = [];

    for (const test of activeTests || []) {
      // Fetch variants
      const { data: variants, error: varErr } = await supabase
        .from("imphq_wa_ab_test_variants")
        .select("*")
        .eq("test_id", test.id)
        .eq("active", true);

      if (varErr) {
        console.error(`Error loading variants for test ${test.id}:`, varErr.message);
        continue;
      }

      if (!variants || variants.length < 2) {
        continue; // Needs at least 2 variants
      }

      // Check if all variants reached minimum sample size
      const minSample = test.min_sample_size || 100;
      const ready = variants.every((v: any) => (v.sent_count || 0) >= minSample);

      if (!ready) {
        evaluated.push({
          test_id: test.id,
          name: test.name,
          status: "running",
          reason: "Coletando amostras. Progresso: " + variants.map((v: any) => `${v.name}: ${v.sent_count}/${minSample}`).join(", "),
        });
        continue;
      }

      // Assume 2 variants for simplicity (Variant A vs Variant B)
      const v1 = variants[0];
      const v2 = variants[1];

      const { chi2, significant, pValue } = calculateChiSquare(
        v1.sent_count || 0, v1.conversion_count || 0,
        v2.sent_count || 0, v2.conversion_count || 0
      );

      const v1Rate = (v1.conversion_count || 0) / (v1.sent_count || 1);
      const v2Rate = (v2.conversion_count || 0) / (v2.sent_count || 1);

      if (significant) {
        // Find winner
        const winner = v1Rate > v2Rate ? v1 : v2;
        const loser = v1Rate > v2Rate ? v2 : v1;

        console.log(`[ab-evaluator] Test ${test.name} reached SIGNIFICANCE! Winner: ${winner.name} (${(v1Rate > v2Rate ? v1Rate : v2Rate) * 100}% conv)`);

        // Promote Winner:
        // 1. Update Test with winner ID and set inactive
        await supabase
          .from("imphq_wa_ab_tests")
          .update({
            active: false,
            winner_variant_id: winner.id,
            updated_at: new Date().toISOString()
          })
          .eq("id", test.id);

        // 2. Set winner traffic to 100% and inactive others
        await supabase
          .from("imphq_wa_ab_test_variants")
          .update({ traffic_percentage: 100 })
          .eq("id", winner.id);

        await supabase
          .from("imphq_wa_ab_test_variants")
          .update({ traffic_percentage: 0, active: false })
          .eq("id", loser.id);

        // 3. Update automation template directly!
        const { data: automations } = await supabase
          .from("imphq_automacoes")
          .select("id, steps")
          .eq("project_id", test.project_id)
          .eq("trigger_tipo", test.trigger_stage)
          .eq("ativo", true);

        let autoUpdated = false;
        for (const auto of automations || []) {
          const steps = Array.isArray(auto.steps) ? auto.steps : [];
          let updatedSteps = false;

          const nextSteps = steps.map((s: any) => {
            if (s.tipo === "whatsapp" || s.tipo === "mensagem") {
              s.mensagem = winner.message_template;
              updatedSteps = true;
            }
            return s;
          });

          if (updatedSteps) {
            await supabase
              .from("imphq_automacoes")
              .update({ steps: nextSteps })
              .eq("id", auto.id);
            autoUpdated = true;
          }
        }

        // 4. Log Action
        await supabase.from("imphq_ai_actions").insert({
          project_id: test.project_id,
          action_type: "ab_test_promotion",
          title: `🏆 Teste A/B Concluído: ${test.name}`,
          description: `A variante "${winner.name}" venceu com ${(Math.max(v1Rate, v2Rate)*100).toFixed(1)}% de conversão vs ${(Math.min(v1Rate, v2Rate)*100).toFixed(1)}% da perdedora (p-valor: ${pValue.toFixed(4)}, Chi2: ${chi2.toFixed(2)}). O template do fluxo foi atualizado automaticamente.`,
          status: "success",
          metadata: {
            test_id: test.id,
            winner_variant_id: winner.id,
            winner_name: winner.name,
            chi2,
            p_value: pValue,
            auto_updated: autoUpdated
          }
        });

        evaluated.push({
          test_id: test.id,
          name: test.name,
          status: "significant",
          winner: winner.name,
          chi2,
          pValue,
        });

      } else {
        // Check if sample size is extremely high and still not significant (draw)
        const maxSample = minSample * 4;
        const limitReached = variants.every((v: any) => (v.sent_count || 0) >= maxSample);

        if (limitReached) {
          // Conclude test as draw
          console.log(`[ab-evaluator] Test ${test.name} concluded as DRAW (no significant difference after ${maxSample} samples)`);
          
          await supabase
            .from("imphq_wa_ab_tests")
            .update({
              active: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", test.id);

          await supabase.from("imphq_ai_actions").insert({
            project_id: test.project_id,
            action_type: "ab_test_draw",
            title: `🤝 Teste A/B Empatado: ${test.name}`,
            description: `Nenhuma diferença estatisticamente significativa foi encontrada entre as variantes após ${maxSample} envios por variante (p-valor: ${pValue.toFixed(4)}). O teste foi encerrado.`,
            status: "success",
            metadata: { test_id: test.id, p_value: pValue }
          });

          evaluated.push({
            test_id: test.id,
            name: test.name,
            status: "draw",
            pValue,
          });
        } else {
          evaluated.push({
            test_id: test.id,
            name: test.name,
            status: "running",
            reason: `Coletando mais dados. Diferença não significativa (p-valor: ${pValue.toFixed(4)}, Chi2: ${chi2.toFixed(2)}).`,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, evaluated, count: evaluated.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("A/B test evaluator error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
