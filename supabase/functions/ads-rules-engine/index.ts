// Ads Rules Engine — aplica regras Yoshitani autonomamente
// LOW (auto-pausa): CPA > 1.5x meta + >50 cliques | CTR < 0.8% após 3 dias + >100 cliques
// MEDIUM (propõe): ROAS > 2.5x + budget < R$500 → escala +20%
// Roda a cada hora. Cria ações em imphq_ai_actions; auto-executa low-risk via imperius-executor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const META_CPA_FALLBACK = 50; // R$
const CTR_MIN = 0.008; // 0.8%
const CPA_MULT = 1.5;
const ROAS_ESCALA = 2.5;
const BUDGET_ESCALA_MAX = 500;
const ESCALA_PCT = 0.20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const projetoIdParam = body?.projeto_id;

    let pq = supabase.from("imphq_projetos").select("id, nome, status, meta_cpa").in("status", ["vendendo", "Vendendo"]);
    if (projetoIdParam) pq = supabase.from("imphq_projetos").select("id, nome, status, meta_cpa").eq("id", projetoIdParam);
    const { data: projetos, error: pErr } = await pq;
    if (pErr) throw pErr;

    const proposed: any[] = [];
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    for (const proj of projetos || []) {
      const meta_cpa = Number(proj.meta_cpa) || META_CPA_FALLBACK;

      // Agrega métricas dos últimos 3 dias por adset
      const { data: rows } = await supabase
        .from("imphq_ads_spend")
        .select("adset_id, conjunto_anuncios, valor, cliques, impressoes, compras, daily_budget, effective_status, ctr, custo_por_compra")
        .eq("project_id", proj.id)
        .gte("data_ref", since.toISOString().slice(0, 10))
        .not("adset_id", "is", null);

      if (!rows || rows.length === 0) continue;

      // Agrupa por adset_id
      const agg: Record<string, any> = {};
      for (const r of rows) {
        const k = r.adset_id;
        if (!agg[k]) agg[k] = {
          adset_id: k, nome: r.conjunto_anuncios,
          spend: 0, clicks: 0, impressions: 0, purchases: 0,
          daily_budget: Number(r.daily_budget) || 0,
          status: r.effective_status,
        };
        agg[k].spend += Number(r.valor) || 0;
        agg[k].clicks += Number(r.cliques) || 0;
        agg[k].impressions += Number(r.impressoes) || 0;
        agg[k].purchases += Number(r.compras) || 0;
      }

      for (const a of Object.values(agg) as any[]) {
        if (a.status !== "ACTIVE") continue;
        const ctr = a.impressions > 0 ? a.clicks / a.impressions : 0;
        const cpa = a.purchases > 0 ? a.spend / a.purchases : Infinity;
        const roas_proxy = a.purchases > 0 ? (a.purchases * meta_cpa * 2) / a.spend : 0; // proxy se sem revenue

        // Anti-duplicate: já tem ação pendente/recente para esta entidade?
        const { data: recentAction } = await supabase
          .from("imphq_ai_actions")
          .select("id")
          .eq("projeto_id", proj.id)
          .contains("payload", { entity_id: a.adset_id })
          .gte("created_at", new Date(Date.now() - 24*60*60*1000).toISOString())
          .limit(1);
        if (recentAction && recentAction.length > 0) continue;

        // Regra 1: CPA alto + volume mínimo → auto-pausa (low)
        if (a.purchases > 0 && cpa > meta_cpa * CPA_MULT && a.clicks > 50) {
          const { data: act } = await supabase.from("imphq_ai_actions").insert({
            kind: "pauseAd",
            risk_level: "low",
            status: "proposed",
            confidence: 0.9,
            title: `Pausar adset "${a.nome}" — CPA R$${cpa.toFixed(2)} (meta R$${meta_cpa})`,
            reason: `CPA ${(cpa/meta_cpa).toFixed(1)}x acima da meta com ${a.clicks} cliques nos últimos 3 dias.`,
            payload: { entity_id: a.adset_id, entity_type: "adset" },
            projeto_id: proj.id,
            source: "ads-rules-engine",
          }).select().single();
          if (act) proposed.push({ kind: "auto-pause-cpa", adset: a.nome, cpa });
          continue;
        }

        // Regra 2: CTR baixo + volume → auto-pausa (low)
        if (ctr < CTR_MIN && a.clicks > 100) {
          const { data: act } = await supabase.from("imphq_ai_actions").insert({
            kind: "pauseAd",
            risk_level: "low",
            status: "proposed",
            confidence: 0.85,
            title: `Pausar adset "${a.nome}" — CTR ${(ctr*100).toFixed(2)}%`,
            reason: `CTR abaixo de ${(CTR_MIN*100).toFixed(1)}% com ${a.clicks} cliques. Criativo cansado.`,
            payload: { entity_id: a.adset_id, entity_type: "adset" },
            projeto_id: proj.id,
            source: "ads-rules-engine",
          }).select().single();
          if (act) proposed.push({ kind: "auto-pause-ctr", adset: a.nome, ctr });
          continue;
        }

        // Regra 3: ROAS alto + budget baixo → propõe escala (medium → fila)
        if (roas_proxy >= ROAS_ESCALA && a.daily_budget > 0 && a.daily_budget < BUDGET_ESCALA_MAX) {
          const new_budget = Math.round(a.daily_budget * (1 + ESCALA_PCT));
          await supabase.from("imphq_ai_actions").insert({
            kind: "adjustBudget",
            risk_level: "medium",
            status: "proposed",
            confidence: 0.75,
            title: `Escalar "${a.nome}" R$${a.daily_budget} → R$${new_budget} (+${(ESCALA_PCT*100)}%)`,
            reason: `ROAS proxy ${roas_proxy.toFixed(1)}x com budget abaixo de R$${BUDGET_ESCALA_MAX}.`,
            payload: { entity_id: a.adset_id, entity_type: "adset", new_budget, old_budget: a.daily_budget },
            projeto_id: proj.id,
            source: "ads-rules-engine",
          });
          proposed.push({ kind: "propose-scale", adset: a.nome, roas: roas_proxy });
        }
      }
    }

    // Auto-executa low-risk com confidence alto
    const { data: lowAuto } = await supabase
      .from("imphq_ai_actions")
      .select("id")
      .eq("status", "proposed")
      .eq("risk_level", "low")
      .eq("source", "ads-rules-engine")
      .gte("confidence", 0.8)
      .limit(50);

    for (const a of lowAuto || []) {
      try {
        await supabase.functions.invoke("imperius-executor", {
          body: { action_id: a.id, mode: "execute" },
        });
      } catch (e) { console.error("auto-exec fail", a.id, e); }
    }

    // Atualiza painel de regras: last_run_at + runs_24h (ações criadas pela engine nas últimas 24h)
    try {
      const since24 = new Date(Date.now() - 24*60*60*1000).toISOString();
      const { data: actions24 } = await supabase
        .from("imphq_ai_actions")
        .select("kind, title")
        .eq("source", "ads-rules-engine")
        .gte("created_at", since24);
      const counts = { auto_pause_cpa: 0, auto_pause_ctr: 0, propose_scale_roas: 0 };
      for (const a of actions24 || []) {
        if (a.kind === "adjustBudget") counts.propose_scale_roas++;
        else if (a.kind === "pauseAd" && /CTR/i.test(a.title || "")) counts.auto_pause_ctr++;
        else if (a.kind === "pauseAd") counts.auto_pause_cpa++;
      }
      const now = new Date().toISOString();
      for (const [type, count] of Object.entries(counts)) {
        await supabase.from("imphq_ads_rules")
          .update({ last_run_at: now, runs_24h: count })
          .eq("rule_type", type);
      }
    } catch (e) { console.error("rules update fail", e); }

    return new Response(JSON.stringify({ ok: true, proposed: proposed.length, auto_executed: (lowAuto||[]).length, sample: proposed.slice(0,5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ads-rules-engine:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
