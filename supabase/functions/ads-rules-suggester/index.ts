// ads-rules-suggester — analisa últimos 30d de imphq_ads_actions, cruza com imphq_ads_spend
// (janela 7d antes/depois) e sugere regras automáticas com base em padrões que deram delta positivo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: actions } = await supabase
      .from("imphq_ads_actions")
      .select("id, project_id, tipo, entidade_id, acao, valor_anterior, valor_novo, created_at")
      .gte("created_at", sinceIso)
      .in("acao", ["pause", "activate", "increase_budget", "decrease_budget"])
      .limit(500);

    type Sample = {
      acao: string;
      preCtr: number; postCtr: number; preSpend: number; postSpend: number;
      preCpc: number; postCpc: number;
      deltaCtr: number; deltaSpend: number;
    };
    const samples: Sample[] = [];

    for (const a of actions || []) {
      if (!a.entidade_id || !a.project_id) continue;
      const t = new Date(a.created_at).getTime();
      const preFrom = new Date(t - 7 * 86400000).toISOString().slice(0, 10);
      const preTo = new Date(t - 1).toISOString().slice(0, 10);
      const postFrom = new Date(t + 86400000).toISOString().slice(0, 10);
      const postTo = new Date(t + 7 * 86400000).toISOString().slice(0, 10);

      const col = a.tipo === "campanha" ? "campaign_id" : a.tipo === "anuncio" ? "ad_id" : "adset_id";

      const [pre, post] = await Promise.all([
        supabase.from("imphq_ads_spend").select("valor, ctr, cliques").eq("project_id", a.project_id).eq(col, a.entidade_id).gte("data_ref", preFrom).lte("data_ref", preTo),
        supabase.from("imphq_ads_spend").select("valor, ctr, cliques").eq("project_id", a.project_id).eq(col, a.entidade_id).gte("data_ref", postFrom).lte("data_ref", postTo),
      ]);

      const agg = (rows: any[] | null) => {
        const arr = rows || [];
        const spend = arr.reduce((s, r) => s + Number(r.valor || 0), 0);
        const clicks = arr.reduce((s, r) => s + Number(r.cliques || 0), 0);
        const ctrs = arr.map((r) => Number(r.ctr || 0)).filter((x) => x > 0);
        const ctr = ctrs.length ? ctrs.reduce((s, x) => s + x, 0) / ctrs.length : 0;
        return { spend, clicks, ctr };
      };
      const P = agg(pre.data); const Q = agg(post.data);
      if (P.spend === 0 && Q.spend === 0) continue;

      samples.push({
        acao: a.acao,
        preCtr: P.ctr, postCtr: Q.ctr,
        preSpend: P.spend, postSpend: Q.spend,
        preCpc: P.clicks > 0 ? P.spend / P.clicks : 0,
        postCpc: Q.clicks > 0 ? Q.spend / Q.clicks : 0,
        deltaCtr: Q.ctr - P.ctr,
        deltaSpend: Q.spend - P.spend,
      });
    }

    // Agrupa por ação e calcula sugestões
    const rules: any[] = [];

    // 1) Pausar quando CTR baixo + gasto alto
    const pauses = samples.filter((s) => s.acao === "pause" && s.preCtr > 0);
    if (pauses.length >= 3) {
      const winners = pauses.filter((s) => s.postSpend < s.preSpend);
      if (winners.length >= 2) {
        const avgCtr = winners.reduce((s, x) => s + x.preCtr, 0) / winners.length;
        const avgSpend = winners.reduce((s, x) => s + x.preSpend, 0) / winners.length;
        const avgSaving = winners.reduce((s, x) => s + (x.preSpend - x.postSpend), 0) / winners.length;
        rules.push({
          name: "Pausar baixo desempenho (CTR + spend)",
          rule_type: "auto_pause_ctr",
          conditions: { min_ctr: Math.max(0.5, Number((avgCtr * 100).toFixed(2))), min_spend: Math.round(avgSpend) },
          expected_delta: `Economia média ~R$${avgSaving.toFixed(0)} em 7d`,
          confidence: Math.min(100, Math.round((winners.length / pauses.length) * 100)),
          samples: pauses.length,
          rationale: `${winners.length}/${pauses.length} pauses com CTR<${(avgCtr * 100).toFixed(2)}% e spend>R$${avgSpend.toFixed(0)} reduziram gasto.`,
        });
      }
    }

    // 2) Escalar (increase_budget) que melhoraram resultado
    const scales = samples.filter((s) => s.acao === "increase_budget");
    if (scales.length >= 2) {
      const winners = scales.filter((s) => s.postCtr >= s.preCtr * 0.9 && s.postSpend > s.preSpend);
      if (winners.length >= 2) {
        const avgCtr = winners.reduce((s, x) => s + x.preCtr, 0) / winners.length;
        rules.push({
          name: "Escalar vencedores (manter CTR ao subir budget)",
          rule_type: "propose_scale_roas",
          conditions: { min_ctr: Number((avgCtr * 100).toFixed(2)), scale_pct: 20 },
          expected_delta: `CTR mantido (${(avgCtr * 100).toFixed(2)}%) ao escalar +20%`,
          confidence: Math.min(100, Math.round((winners.length / scales.length) * 100)),
          samples: scales.length,
          rationale: `${winners.length}/${scales.length} escalas mantiveram CTR ao aumentar budget.`,
        });
      }
    }

    return new Response(JSON.stringify({ rules, total_samples: samples.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
