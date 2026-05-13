// Imperius Scout — varre projetos vendendo, propõe ações na fila
// Roda via cron (15min). Auto-executa low risk.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Proposed = {
  kind: string;
  risk_level: "low" | "medium" | "high";
  confidence: number;
  title: string;
  reason: string;
  payload: any;
  projeto_id?: string;
  source?: string;
};

async function scoutProject(supabase: any, projeto: any): Promise<Proposed[]> {
  const out: Proposed[] = [];
  const projetoId = projeto.id;
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // 1) Hot leads sem follow-up nas últimas 2h
  const { data: hotLeads } = await supabase
    .from("imphq_leads")
    .select("id, nome, telefone, score, ultimo_evento, updated_at, projeto_id")
    .eq("projeto_id", projetoId)
    .gte("score", 70)
    .gte("updated_at", since2h)
    .limit(20);

  for (const lead of hotLeads || []) {
    if (!lead.telefone) continue;
    out.push({
      kind: "notify",
      risk_level: "low",
      confidence: 0.85,
      title: `Hot lead sem toque: ${lead.nome || lead.telefone}`,
      reason: `Score ${lead.score}, último evento ${lead.ultimo_evento || "n/a"}. Follow-up recomendado.`,
      payload: { lead_id: lead.id, telefone: lead.telefone, score: lead.score },
      projeto_id: projetoId,
      source: "scout-hot-leads",
    });
  }

  // 2) Anúncios com CPA ruim (>1.5x meta) ou CTR <0.8% nos últimos 7d
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ads } = await supabase
    .from("imphq_facebook_ads_insights")
    .select("entity_id, entity_type, entity_name, impressions, clicks, spend, conversions, date_start")
    .eq("projeto_id", projetoId)
    .gte("date_start", since7.slice(0, 10))
    .limit(200);

  // Agrega por entity_id
  const agg = new Map<string, any>();
  for (const a of ads || []) {
    const k = a.entity_id;
    if (!agg.has(k)) agg.set(k, { ...a, impressions: 0, clicks: 0, spend: 0, conversions: 0 });
    const r = agg.get(k);
    r.impressions += Number(a.impressions || 0);
    r.clicks += Number(a.clicks || 0);
    r.spend += Number(a.spend || 0);
    r.conversions += Number(a.conversions || 0);
  }

  const metaCpa = Number(projeto.meta_cpa || 50);
  for (const r of agg.values()) {
    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    const cpa = r.conversions > 0 ? r.spend / r.conversions : 999;
    if (r.clicks >= 50 && cpa > metaCpa * 1.5) {
      out.push({
        kind: "pauseAd",
        risk_level: "low",
        confidence: 0.9,
        title: `Pausar ${r.entity_name || r.entity_id} (CPA R$ ${cpa.toFixed(2)})`,
        reason: `CPA ${cpa.toFixed(2)} é ${(cpa / metaCpa).toFixed(1)}x da meta R$ ${metaCpa}. Cliques: ${r.clicks}, gasto R$ ${r.spend.toFixed(2)}.`,
        payload: { entity_id: r.entity_id, entity_type: r.entity_type || "adset" },
        projeto_id: projetoId,
        source: "scout-ads-cpa",
      });
    } else if (r.impressions >= 3000 && ctr < 0.8) {
      out.push({
        kind: "pauseAd",
        risk_level: "low",
        confidence: 0.8,
        title: `Pausar ${r.entity_name || r.entity_id} (CTR ${ctr.toFixed(2)}%)`,
        reason: `CTR ${ctr.toFixed(2)}% após ${r.impressions} impressões. Criativo fraco.`,
        payload: { entity_id: r.entity_id, entity_type: r.entity_type || "adset" },
        projeto_id: projetoId,
        source: "scout-ads-ctr",
      });
    }
  }

  // 3) Vendas Pix/Boleto pendentes >24h sem recuperação
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("imphq_vendas")
    .select("id, comprador_nome, comprador_telefone, valor, status, metodo_pagamento, created_at, projeto_id")
    .eq("projeto_id", projetoId)
    .in("status", ["pending", "waiting_payment", "expired"])
    .lt("created_at", since24)
    .limit(20);

  for (const v of pending || []) {
    if (!v.comprador_telefone) continue;
    out.push({
      kind: "notify",
      risk_level: "low",
      confidence: 0.75,
      title: `Recuperar Pix/Boleto: ${v.comprador_nome || v.comprador_telefone}`,
      reason: `${v.metodo_pagamento || "pagamento"} R$ ${Number(v.valor).toFixed(2)} pendente há +24h.`,
      payload: { venda_id: v.id, telefone: v.comprador_telefone, valor: v.valor },
      projeto_id: projetoId,
      source: "scout-recovery",
    });
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const projetoIdParam = url.searchParams.get("projeto_id");

    let q = supabase.from("imphq_projetos").select("id, nome, status, meta_cpa").in("status", ["vendendo", "Vendendo"]);
    if (projetoIdParam) q = supabase.from("imphq_projetos").select("id, nome, status, meta_cpa").eq("id", projetoIdParam);

    const { data: projetos, error } = await q;
    if (error) throw error;

    let proposedCount = 0;
    let autoExecCount = 0;

    for (const p of projetos || []) {
      const proposals = await scoutProject(supabase, p);
      for (const prop of proposals) {
        // Dedup: não duplica ação aberta para mesmo (kind + payload chave)
        const dedupKey = JSON.stringify({ kind: prop.kind, projeto: prop.projeto_id, key: prop.payload?.entity_id || prop.payload?.lead_id || prop.payload?.venda_id });
        const { data: existing } = await supabase
          .from("imphq_ai_actions")
          .select("id")
          .eq("projeto_id", prop.projeto_id || "")
          .eq("kind", prop.kind)
          .in("status", ["proposed", "approved"])
          .limit(1);
        if (existing && existing.length > 0) continue;

        const autoExec = prop.risk_level === "low" && prop.confidence >= 0.8 && prop.kind !== "notify";

        const { data: inserted } = await supabase.from("imphq_ai_actions").insert({
          ...prop,
          status: autoExec ? "approved" : "proposed",
          auto_executed: autoExec,
        }).select().single();

        proposedCount++;

        if (autoExec && inserted) {
          // Dispara executor
          await supabase.functions.invoke("imperius-executor", { body: { action_id: inserted.id, mode: "execute" } });
          autoExecCount++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, projetos: projetos?.length || 0, proposed: proposedCount, auto_executed: autoExecCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imperius-scout:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
