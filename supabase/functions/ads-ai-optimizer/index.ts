// Ads AI Optimizer — roda 3x/dia, propõe/executa ações de otimização
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AdsetStats = {
  adset_id: string;
  adset_name: string;
  projeto_id: string | null;
  spend_7d: number;
  results_7d: number;
  cpa: number;
  roas: number;
  ctr: number;
  frequency: number;
  status: string;
};

async function enqueueAction(supabase: any, action: any) {
  // Verifica duplicata recente (mesma entidade + kind nos últimos 12h)
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: dup } = await supabase
    .from("imphq_ai_actions")
    .select("id")
    .eq("kind", action.kind)
    .gte("created_at", since)
    .contains("payload", { entity_id: action.payload?.entity_id })
    .limit(1);
  if (dup && dup.length > 0) return null;

  const { data, error } = await supabase
    .from("imphq_ai_actions")
    .insert({
      ...action,
      source: "ads-ai-optimizer",
      status: action.auto_executed ? "approved" : "proposed",
    })
    .select()
    .single();
  if (error) {
    console.error("enqueue error", error);
    return null;
  }

  // Auto-executa se low-risk
  if (action.auto_executed && data) {
    await supabase.functions.invoke("imperius-executor", { body: { action_id: data.id, mode: "execute" } });
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Coleta adsets ativos com insights 7d
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: insights, error: iErr } = await supabase
      .from("imphq_ads_insights")
      .select("adset_id, adset_name, projeto_id, spend, results, ctr, frequency, status, date")
      .gte("date", since)
      .limit(2000);

    if (iErr) throw iErr;

    // Agrega por adset
    const byAdset = new Map<string, AdsetStats>();
    for (const r of insights || []) {
      const k = r.adset_id;
      if (!k) continue;
      const ex = byAdset.get(k) || {
        adset_id: k,
        adset_name: r.adset_name || k,
        projeto_id: r.projeto_id,
        spend_7d: 0,
        results_7d: 0,
        cpa: 0,
        roas: 0,
        ctr: 0,
        frequency: 0,
        status: r.status || "ACTIVE",
      };
      ex.spend_7d += Number(r.spend || 0);
      ex.results_7d += Number(r.results || 0);
      ex.ctr = Number(r.ctr || ex.ctr);
      ex.frequency = Math.max(ex.frequency, Number(r.frequency || 0));
      byAdset.set(k, ex);
    }

    // 2. Busca receita por projeto (últimos 7d) para calcular ROAS
    const { data: vendas } = await supabase
      .from("imphq_vendas")
      .select("projeto_id, valor")
      .eq("status", "aprovada")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const revByProj = new Map<string, number>();
    for (const v of vendas || []) {
      revByProj.set(v.projeto_id, (revByProj.get(v.projeto_id) || 0) + Number(v.valor || 0));
    }

    const proposals: any[] = [];

    // 3. Aplica regras
    for (const [, s] of byAdset) {
      if (s.spend_7d < 50) continue; // sinal mínimo
      s.cpa = s.results_7d > 0 ? s.spend_7d / s.results_7d : 9999;
      const projRev = revByProj.get(s.projeto_id || "") || 0;
      // Atribuição grosseira: divide receita igualmente entre adsets ativos do projeto
      const adsetsDoProj = Array.from(byAdset.values()).filter((x) => x.projeto_id === s.projeto_id);
      const estRev = projRev / Math.max(adsetsDoProj.length, 1);
      s.roas = s.spend_7d > 0 ? estRev / s.spend_7d : 0;

      // R1: Pausar adset com CPA absurdo e gasto alto (low-risk)
      if (s.cpa > 200 && s.spend_7d > 100 && s.status === "ACTIVE") {
        const action = await enqueueAction(supabase, {
          kind: "pauseAd",
          risk_level: "low",
          confidence: 0.85,
          impact_brl: s.spend_7d * 0.5, // economiza ~50% do gasto
          title: `Pausar ${s.adset_name}`,
          reason: `CPA R$ ${s.cpa.toFixed(0)} em 7d (gasto R$ ${s.spend_7d.toFixed(0)}, ${s.results_7d} resultados). Performance crítica.`,
          payload: { entity_id: s.adset_id, entity_type: "adset" },
          projeto_id: s.projeto_id,
          auto_executed: true,
        });
        if (action) proposals.push(action);
      }

      // R2: Aumentar budget de adset campeão (low-risk até 30%)
      if (s.roas > 3 && s.frequency < 2 && s.status === "ACTIVE" && s.spend_7d > 100) {
        const dailySpend = s.spend_7d / 7;
        const newBudget = Math.round(dailySpend * 1.3 * 100); // cents
        const oldBudget = Math.round(dailySpend * 100);
        const action = await enqueueAction(supabase, {
          kind: "adjustBudget",
          risk_level: "low",
          confidence: 0.8,
          impact_brl: estRev * 0.3,
          title: `+30% budget em ${s.adset_name}`,
          reason: `ROAS ${s.roas.toFixed(1)}x, freq ${s.frequency.toFixed(1)}. Espaço pra escalar.`,
          payload: { entity_id: s.adset_id, entity_type: "adset", new_budget: newBudget, old_budget: oldBudget },
          projeto_id: s.projeto_id,
          auto_executed: false, // requer aprovação por mexer em $$
        });
        if (action) proposals.push(action);
      }

      // R3: Adset com fadiga (freq > 4) — sugere duplicar/refresh criativo
      if (s.frequency > 4 && s.status === "ACTIVE") {
        const action = await enqueueAction(supabase, {
          kind: "notify",
          risk_level: "medium",
          confidence: 0.7,
          impact_brl: s.spend_7d * 0.2,
          title: `Fadiga criativa em ${s.adset_name}`,
          reason: `Frequência ${s.frequency.toFixed(1)}. Hora de renovar criativo ou pausar.`,
          payload: { adset_id: s.adset_id, frequency: s.frequency, suggestion: "duplicate_creative" },
          projeto_id: s.projeto_id,
          auto_executed: false,
        });
        if (action) proposals.push(action);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, analyzed: byAdset.size, proposals: proposals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("ads-ai-optimizer:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
