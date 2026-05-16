// Ads AI Optimizer — roda 3x/dia, propõe/executa ações
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function enqueue(supabase: any, action: any) {
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
    .insert({ ...action, source: "ads-ai-optimizer", status: action.auto_executed ? "approved" : "proposed" })
    .select()
    .single();
  if (error) { console.error(error); return null; }

  if (action.auto_executed && data) {
    await supabase.functions.invoke("imperius-executor", { body: { action_id: data.id, mode: "execute" } });
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: spend } = await supabase
      .from("imphq_ads_spend")
      .select("adset_id, conjunto_anuncios, project_id, valor, resultados, ctr, frequencia, effective_status, daily_budget, data_ref")
      .gte("data_ref", since7)
      .limit(3000);

    // Agrega por adset
    const byAdset = new Map<string, any>();
    for (const r of spend || []) {
      if (!r.adset_id) continue;
      const ex = byAdset.get(r.adset_id) || {
        adset_id: r.adset_id,
        name: r.conjunto_anuncios || r.adset_id,
        project_id: r.project_id,
        spend: 0, results: 0, ctr: 0, frequency: 0,
        status: r.effective_status || "ACTIVE",
        daily_budget: Number(r.daily_budget || 0),
      };
      ex.spend += Number(r.valor || 0);
      ex.results += Number(r.resultados || 0);
      ex.ctr = Number(r.ctr || ex.ctr);
      ex.frequency = Math.max(ex.frequency, Number(r.frequencia || 0));
      byAdset.set(r.adset_id, ex);
    }

    const { data: vendas } = await supabase
      .from("imphq_vendas")
      .select("project_id, valor")
      .eq("status", "aprovada")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const revByProj = new Map<string, number>();
    for (const v of vendas || []) {
      revByProj.set(v.project_id, (revByProj.get(v.project_id) || 0) + Number(v.valor || 0));
    }

    const proposals: any[] = [];

    for (const s of byAdset.values()) {
      if (s.spend < 50) continue;
      const cpa = s.results > 0 ? s.spend / s.results : 9999;
      const adsetsDoProj = Array.from(byAdset.values()).filter((x: any) => x.project_id === s.project_id);
      const estRev = (revByProj.get(s.project_id || "") || 0) / Math.max(adsetsDoProj.length, 1);
      const roas = s.spend > 0 ? estRev / s.spend : 0;

      if (cpa > 200 && s.spend > 100 && s.status === "ACTIVE") {
        const a = await enqueue(supabase, {
          kind: "pauseAd", risk_level: "low", confidence: 0.85, impact_brl: s.spend * 0.5,
          title: `Pausar ${s.name}`,
          reason: `CPA R$ ${cpa.toFixed(0)} em 7d (gasto R$ ${s.spend.toFixed(0)}, ${s.results} resultados).`,
          payload: { entity_id: s.adset_id, entity_type: "adset" },
          projeto_id: s.project_id, auto_executed: true,
        });
        if (a) proposals.push(a);
      }

      if (roas > 3 && s.frequency < 2 && s.status === "ACTIVE" && s.spend > 100) {
        const daily = s.daily_budget || s.spend / 7 * 100;
        const newBudget = Math.round(daily * 1.3);
        const a = await enqueue(supabase, {
          kind: "adjustBudget", risk_level: "low", confidence: 0.8, impact_brl: estRev * 0.3,
          title: `+30% budget em ${s.name}`,
          reason: `ROAS ${roas.toFixed(1)}x, freq ${s.frequency.toFixed(1)}. Espaço pra escalar.`,
          payload: { entity_id: s.adset_id, entity_type: "adset", new_budget: newBudget, old_budget: Math.round(daily) },
          projeto_id: s.project_id, auto_executed: false,
        });
        if (a) proposals.push(a);
      }

      if (s.frequency > 4 && s.status === "ACTIVE") {
        const a = await enqueue(supabase, {
          kind: "notify", risk_level: "medium", confidence: 0.7, impact_brl: s.spend * 0.2,
          title: `Fadiga criativa em ${s.name}`,
          reason: `Frequência ${s.frequency.toFixed(1)}. Renovar criativo ou pausar.`,
          payload: { adset_id: s.adset_id, frequency: s.frequency, suggestion: "duplicate_creative" },
          projeto_id: s.project_id, auto_executed: false,
        });
        if (a) proposals.push(a);
      }
    }

    return new Response(JSON.stringify({ ok: true, analyzed: byAdset.size, proposals: proposals.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ads-ai-optimizer:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
