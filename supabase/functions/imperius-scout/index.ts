// Imperius Scout — varre projetos ativos, propõe ações na fila imphq_ai_actions
// Auto-executa low risk (confidence ≥ 0.8). Roda via cron a cada 15min.
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
  impact_brl?: number;
};

type Projeto = {
  id: string;
  name: string;
  settings: any;
  data: any;
  daily_revenue_goal: number | null;
};

function metaCpaOf(p: Projeto): number {
  const s = p.settings || {};
  const d = p.data || {};
  return Number(s.meta_cpa ?? d.meta_cpa ?? 50);
}

async function scoutProject(supabase: any, projeto: Projeto): Promise<Proposed[]> {
  const out: Proposed[] = [];
  const projetoId = projeto.id;
  const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Hot leads quentes sem follow-up recente
  const { data: hotLeads } = await supabase
    .from("imphq_leads")
    .select("id, nome, phone, score, updated_at")
    .eq("project_id", projetoId)
    .gte("score", 70)
    .gte("updated_at", since2h)
    .limit(20);

  for (const lead of hotLeads || []) {
    if (!lead.phone) continue;
    out.push({
      kind: "notify",
      risk_level: "low",
      confidence: 0.85,
      title: `Hot lead sem toque: ${lead.nome || lead.phone}`,
      reason: `Score ${lead.score}. Follow-up recomendado.`,
      payload: { lead_id: lead.id, telefone: lead.phone, score: lead.score },
      projeto_id: projetoId,
      source: "scout-hot-leads",
      impact_brl: 300,
    });
  }

  // 2) Ads ruins nos últimos 7d (CPA alto OU CTR baixo)
  const { data: ads } = await supabase
    .from("imphq_ads_spend")
    .select("ad_id, adset_id, anuncio, conjunto_anuncios, impressoes, cliques, spend, valor, compras")
    .eq("project_id", projetoId)
    .gte("date", since7d.slice(0, 10))
    .limit(500);

  const agg = new Map<string, any>();
  for (const a of ads || []) {
    const entityId = a.ad_id || a.adset_id;
    if (!entityId) continue;
    const entityType = a.ad_id ? "ad" : "adset";
    const entityName = a.anuncio || a.conjunto_anuncios || entityId;
    if (!agg.has(entityId)) {
      agg.set(entityId, { entity_id: entityId, entity_type: entityType, entity_name: entityName, impressions: 0, clicks: 0, spend: 0, conversions: 0 });
    }
    const r = agg.get(entityId);
    r.impressions += Number(a.impressoes || 0);
    r.clicks += Number(a.cliques || 0);
    r.spend += Number(a.spend ?? a.valor ?? 0);
    r.conversions += Number(a.compras || 0);
  }

  const metaCpa = metaCpaOf(projeto);
  for (const r of agg.values()) {
    const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
    const cpa = r.conversions > 0 ? r.spend / r.conversions : 9999;
    if (r.clicks >= 50 && cpa > metaCpa * 1.5) {
      out.push({
        kind: "pauseAd",
        risk_level: "low",
        confidence: 0.9,
        title: `Pausar ${r.entity_name} (CPA R$ ${cpa.toFixed(2)})`,
        reason: `CPA ${cpa.toFixed(2)} é ${(cpa / metaCpa).toFixed(1)}x da meta R$ ${metaCpa}. Cliques: ${r.clicks}, gasto R$ ${r.spend.toFixed(2)}.`,
        payload: { entity_id: r.entity_id, entity_type: r.entity_type },
        projeto_id: projetoId,
        source: "scout-ads-cpa",
        impact_brl: Math.round(r.spend),
      });
    } else if (r.impressions >= 3000 && ctr < 0.8) {
      out.push({
        kind: "pauseAd",
        risk_level: "low",
        confidence: 0.8,
        title: `Pausar ${r.entity_name} (CTR ${ctr.toFixed(2)}%)`,
        reason: `CTR ${ctr.toFixed(2)}% após ${r.impressions} impressões. Criativo fraco.`,
        payload: { entity_id: r.entity_id, entity_type: r.entity_type },
        projeto_id: projetoId,
        source: "scout-ads-ctr",
        impact_brl: Math.round(r.spend),
      });
    }
  }

  // 3) Vendas Pix/Boleto pendentes >24h sem recuperação (join leads)
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("imphq_vendas")
    .select("id, valor, status, lead_id, data_venda, lead:imphq_leads!lead_id(nome, phone)")
    .eq("project_id", projetoId)
    .in("status", ["pending", "waiting_payment", "expired", "pendente", "aguardando_pagamento"])
    .lt("data_venda", since24)
    .gte("data_venda", since7d)
    .limit(30);

  for (const v of pending || []) {
    const phone = v.lead?.phone;
    if (!phone) continue;
    out.push({
      kind: "notify",
      risk_level: "low",
      confidence: 0.75,
      title: `Recuperar Pix/Boleto: ${v.lead?.nome || phone}`,
      reason: `Pagamento R$ ${Number(v.valor).toFixed(2)} pendente há +24h.`,
      payload: { venda_id: v.id, telefone: phone, valor: v.valor },
      projeto_id: projetoId,
      source: "scout-recovery",
      impact_brl: Math.round(Number(v.valor) * 0.2),
    });
  }

  return out;
}

// ── Detector de padrões → propõe drafts de OpenFlow ──

function dynamicConfidence(sample: number, threshold: number, base = 0.7, max = 0.95): number {
  if (sample <= threshold) return base;
  const ratio = Math.min(1, (sample - threshold) / (threshold * 3));
  return Math.min(max, base + ratio * (max - base));
}

function buildPreview(acoes: any[]): string[] {
  return acoes
    .filter((a) => a.template && a.tipo !== "aguardar")
    .map((a) => `${a.tipo}: ${String(a.template).slice(0, 90)}`);
}

async function detectFlowPatterns(supabase: any, projeto: Projeto): Promise<Proposed[]> {
  const out: Proposed[] = [];
  const projetoId = projeto.id;
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const hasFlow = async (trigger: string) => {
    const { data } = await supabase
      .from("imphq_automacoes")
      .select("id")
      .eq("project_id", projetoId)
      .eq("trigger_tipo", trigger)
      .eq("ativo", true)
      .limit(1);
    return (data?.length || 0) > 0;
  };

  const pushFlow = (cfg: {
    title: string;
    reason: string;
    flow_name: string;
    trigger_tipo: string;
    acoes: any[];
    sample: number;
    threshold: number;
    metric: string;
    estimated_recovery: string;
    source: string;
    impact_brl?: number;
  }) => {
    const conf = dynamicConfidence(cfg.sample, cfg.threshold);
    out.push({
      kind: "createFlow",
      risk_level: "low",
      confidence: conf,
      title: cfg.title,
      reason: cfg.reason,
      payload: {
        flow_name: cfg.flow_name,
        trigger_tipo: cfg.trigger_tipo,
        projeto_id: projetoId,
        acoes: cfg.acoes,
        preview_messages: buildPreview(cfg.acoes),
        pattern_evidence: {
          sample_size: cfg.sample,
          metric: cfg.metric,
          estimated_recovery: cfg.estimated_recovery,
          confidence_basis: `${cfg.sample} amostras nos últimos 7-30d`,
        },
      },
      projeto_id: projetoId,
      source: cfg.source,
      impact_brl: cfg.impact_brl,
    });
  };

  // A — Pix/Boleto sem recuperação automática
  if (!(await hasFlow("aguardando_pagamento"))) {
    const { count } = await supabase
      .from("imphq_vendas")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .in("status", ["waiting_payment", "pending", "aguardando_pagamento"])
      .gte("data_venda", since7);
    if ((count || 0) >= 10) {
      pushFlow({
        title: "Criar recuperação automática de Pix/Boleto",
        reason: `${count} pagamentos pendentes nos últimos 7d sem flow ativo. Recuperação típica: 15-25%.`,
        flow_name: "Recuperação Pix/Boleto (Imperius)",
        trigger_tipo: "aguardando_pagamento",
        acoes: [
          { tipo: "whatsapp", template: "Oi {{nome}}! Vi que você gerou o pagamento mas ainda não finalizou. Posso te ajudar?", delay_min: 15 },
          { tipo: "aguardar", template: "", delay_min: 120 },
          { tipo: "whatsapp", template: "{{nome}}, seu Pix está prestes a expirar. Quer que eu envie um novo link?", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 10,
        metric: `${count} pendentes/7d`,
        estimated_recovery: `~${Math.round((count || 0) * 0.2)} vendas/sem`,
        source: "scout-pattern-recovery",
        impact_brl: Math.round((count || 0) * 0.2 * 200),
      });
    }
  }

  // B — Hot leads sem boas-vindas
  if (!(await hasFlow("lead_novo"))) {
    const { count } = await supabase
      .from("imphq_leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .gte("score", 70)
      .gte("criado_em", since7);
    if ((count || 0) >= 15) {
      pushFlow({
        title: "Criar boas-vindas automática para leads quentes",
        reason: `${count} hot leads (score≥70) nos últimos 7d sem flow de novo lead ativo.`,
        flow_name: "Boas-vindas Lead Quente (Imperius)",
        trigger_tipo: "lead_novo",
        acoes: [
          { tipo: "whatsapp", template: "Oi {{nome}}! Que bom te ver por aqui. Em que posso ajudar?", delay_min: 5 },
          { tipo: "aguardar", template: "", delay_min: 30 },
          { tipo: "audio", template: "Áudio personalizado de boas-vindas mencionando o interesse do lead.", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 15,
        metric: `${count} hot leads/7d`,
        estimated_recovery: "+8% conversão típica",
        source: "scout-pattern-welcome",
      });
    }
  }

  // C — Compras aprovadas sem onboarding
  if (!(await hasFlow("compra_aprovada"))) {
    const { count } = await supabase
      .from("imphq_vendas")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .in("status", ["approved", "paid", "aprovada", "paga"])
      .gte("data_venda", since30);
    if ((count || 0) >= 20) {
      pushFlow({
        title: "Criar onboarding pós-compra automático",
        reason: `${count} compras aprovadas em 30d sem flow de onboarding ativo. Reduz reembolsos e melhora LTV.`,
        flow_name: "Onboarding Pós-Compra (Imperius)",
        trigger_tipo: "compra_aprovada",
        acoes: [
          { tipo: "whatsapp", template: "Parabéns pela compra, {{nome}}! Seu acesso já está liberado.", delay_min: 5 },
          { tipo: "aguardar", template: "", delay_min: 60 },
          { tipo: "whatsapp", template: "{{nome}}, já conseguiu acessar? Qualquer dúvida me chama.", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 20,
        metric: `${count} compras/30d`,
        estimated_recovery: "-30% reembolso típico",
        source: "scout-pattern-onboarding",
      });
    }
  }

  // D — Carrinho abandonado sem flow
  if (!(await hasFlow("carrinho_abandonado")) && !(await hasFlow("inicio_checkout"))) {
    const { count } = await supabase
      .from("imphq_vendas")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .in("status", ["abandoned", "checkout_abandoned", "cart_abandoned", "abandonado"])
      .gte("data_venda", since7);
    if ((count || 0) >= 8) {
      pushFlow({
        title: "Criar recuperação de carrinho abandonado",
        reason: `${count} carrinhos abandonados em 7d. Recuperação típica: 10-15%.`,
        flow_name: "Recuperação de Carrinho (Imperius)",
        trigger_tipo: "carrinho_abandonado",
        acoes: [
          { tipo: "whatsapp", template: "Oi {{nome}}! Vi que você quase finalizou {{produto}}. Travou alguma coisa?", delay_min: 30 },
          { tipo: "aguardar", template: "", delay_min: 180 },
          { tipo: "whatsapp", template: "{{nome}}, separei seu carrinho aqui. Quer que eu envie o link de novo?", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 8,
        metric: `${count} carrinhos/7d`,
        estimated_recovery: `~${Math.round((count || 0) * 0.12)} vendas/sem`,
        source: "scout-pattern-cart",
      });
    }
  }

  // E — Reembolsos sem flow de retenção
  if (!(await hasFlow("reembolso"))) {
    const { count } = await supabase
      .from("imphq_vendas")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .in("status", ["refunded", "chargeback", "reembolsada", "estornada"])
      .gte("data_venda", since30);
    if ((count || 0) >= 3) {
      pushFlow({
        title: "Criar flow de retenção pós-reembolso",
        reason: `${count} reembolsos/chargebacks em 30d. Entender o motivo reduz churn.`,
        flow_name: "Retenção Pós-Reembolso (Imperius)",
        trigger_tipo: "reembolso",
        acoes: [
          { tipo: "whatsapp", template: "Oi {{nome}}, vi que pediu reembolso. Sem pressão — pode me contar o que não rolou? Sua resposta ajuda demais.", delay_min: 60 },
          { tipo: "wait_reply", template: "", delay_min: 0, timeout_min: 2880 },
          { tipo: "notify_operator", template: "Lead {{nome}} respondeu motivo do reembolso. Avaliar oferta de retenção.", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 3,
        metric: `${count} reembolsos/30d`,
        estimated_recovery: "Insights de churn + ~10% retenção",
        source: "scout-pattern-refund",
      });
    }
  }

  // F — Leads que clicaram link mas não compraram
  if (!(await hasFlow("clicou_link")) && !(await hasFlow("tag_adicionada"))) {
    const { count } = await supabase
      .from("imphq_clicks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projetoId)
      .gte("created_at", since7);
    if ((count || 0) >= 30) {
      pushFlow({
        title: "Criar follow-up para leads que clicaram mas não compraram",
        reason: `${count} cliques de tracker em 7d sem flow de follow-up.`,
        flow_name: "Follow-up Clique sem Compra (Imperius)",
        trigger_tipo: "tag_adicionada",
        acoes: [
          { tipo: "aguardar", template: "", delay_min: 240 },
          { tipo: "whatsapp", template: "{{nome}}, vi que você clicou no link de {{produto}}. Posso te tirar alguma dúvida rápida?", delay_min: 0 },
          { tipo: "wait_reply", template: "", delay_min: 0, timeout_min: 1440 },
          { tipo: "ia_message", template: "Qualificar interesse, identificar objeção principal e oferecer ajuda.", delay_min: 0 },
        ],
        sample: count || 0,
        threshold: 30,
        metric: `${count} cliques/7d`,
        estimated_recovery: `~${Math.round((count || 0) * 0.05)} vendas/sem`,
        source: "scout-pattern-clickers",
      });
    }
  }

  return out;
}

// ── Sensores macro: anomalias, budget, CAC, nutrição parada ──
async function detectMacroSignals(supabase: any, projeto: Projeto): Promise<Proposed[]> {
  const out: Proposed[] = [];
  const projetoId = projeto.id;
  const today = new Date().toISOString().slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Anomalia de receita hoje (>2σ abaixo da média 14d)
  try {
    const { data: vendas14 } = await supabase
      .from("imphq_vendas")
      .select("valor, data_venda, status")
      .eq("project_id", projetoId)
      .in("status", ["approved", "paid", "aprovada", "paga"])
      .gte("data_venda", since14)
      .limit(2000);

    if (vendas14 && vendas14.length > 0) {
      const byDay = new Map<string, number>();
      for (const v of vendas14) {
        const d = String(v.data_venda).slice(0, 10);
        byDay.set(d, (byDay.get(d) || 0) + Number(v.valor || 0));
      }
      const todayRev = byDay.get(today) || 0;
      const historic = [...byDay.entries()].filter(([d]) => d !== today).map(([, v]) => v);
      if (historic.length >= 7) {
        const mean = historic.reduce((a, b) => a + b, 0) / historic.length;
        const variance = historic.reduce((a, b) => a + (b - mean) ** 2, 0) / historic.length;
        const std = Math.sqrt(variance);
        const hour = new Date().getHours();
        // só alerta depois das 14h pra não disparar de manhã
        if (hour >= 14 && std > 0 && todayRev < mean - 2 * std && mean > 100) {
          out.push({
            kind: "notify",
            risk_level: "medium",
            confidence: 0.85,
            title: `Receita hoje ${(todayRev / mean * 100).toFixed(0)}% da média`,
            reason: `Hoje: R$ ${todayRev.toFixed(2)}. Média 14d: R$ ${mean.toFixed(2)} (σ R$ ${std.toFixed(2)}). Queda > 2σ.`,
            payload: { tipo: "anomalia_receita", today: todayRev, mean, std },
            projeto_id: projetoId,
            source: "scout-revenue-anomaly",
            impact_brl: Math.round(mean - todayRev),
          });
        }
      }
    }
  } catch (e) { console.warn("anomaly:", e); }

  // 2) Queima de orçamento: spend hoje > 80% da meta diária (meta = goal/30 ou settings.daily_ad_budget)
  try {
    const settings = projeto.settings || {};
    const data = projeto.data || {};
    const dailyBudget = Number(settings.daily_ad_budget ?? data.daily_ad_budget ?? (projeto.daily_revenue_goal ? Number(projeto.daily_revenue_goal) * 0.3 : 0));
    if (dailyBudget > 0 && new Date().getHours() >= 12) {
      const { data: todaySpend } = await supabase
        .from("imphq_ads_spend")
        .select("spend, valor")
        .eq("project_id", projetoId)
        .eq("date", today)
        .limit(1000);
      const total = (todaySpend || []).reduce((a: number, r: any) => a + Number(r.spend ?? r.valor ?? 0), 0);
      const pct = total / dailyBudget;
      if (pct >= 0.8) {
        out.push({
          kind: "notify",
          risk_level: pct >= 1 ? "high" : "medium",
          confidence: 0.9,
          title: `Budget diário em ${(pct * 100).toFixed(0)}%`,
          reason: `Gasto hoje R$ ${total.toFixed(2)} de R$ ${dailyBudget.toFixed(2)} (meta diária). ${pct >= 1 ? "Estourou." : "Próximo do teto."}`,
          payload: { tipo: "budget_burn", spend_today: total, daily_budget: dailyBudget, pct },
          projeto_id: projetoId,
          source: "scout-budget-burn",
          impact_brl: Math.round(total),
        });
      }
    }
  } catch (e) { console.warn("budget:", e); }

  // 3) CAC subindo 3 dias seguidos
  try {
    const last4 = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const { data: spendRows } = await supabase
      .from("imphq_ads_spend")
      .select("date, spend, valor, compras")
      .eq("project_id", projetoId)
      .in("date", last4)
      .limit(1000);
    const dayMap = new Map<string, { spend: number; conv: number }>();
    for (const r of spendRows || []) {
      const d = String(r.date);
      const cur = dayMap.get(d) || { spend: 0, conv: 0 };
      cur.spend += Number(r.spend ?? r.valor ?? 0);
      cur.conv += Number(r.compras || 0);
      dayMap.set(d, cur);
    }
    const cacs = last4.slice(0, 4).reverse().map((d) => {
      const x = dayMap.get(d);
      if (!x || x.conv === 0) return null;
      return { date: d, cac: x.spend / x.conv };
    });
    const valid = cacs.filter(Boolean) as { date: string; cac: number }[];
    if (valid.length >= 4) {
      const [a, b, c, d] = valid.slice(-4);
      if (b.cac > a.cac && c.cac > b.cac && d.cac > c.cac && d.cac > a.cac * 1.3) {
        out.push({
          kind: "notify",
          risk_level: "medium",
          confidence: 0.8,
          title: `CAC subiu 3 dias seguidos`,
          reason: `${a.date}: R$ ${a.cac.toFixed(2)} → ${d.date}: R$ ${d.cac.toFixed(2)} (+${((d.cac / a.cac - 1) * 100).toFixed(0)}%). Revisar criativos.`,
          payload: { tipo: "cac_rising", trend: valid.map(v => ({ date: v.date, cac: Number(v.cac.toFixed(2)) })) },
          projeto_id: projetoId,
          source: "scout-cac-rising",
          impact_brl: Math.round((d.cac - a.cac) * (dayMap.get(d.date)?.conv || 1)),
        });
      }
    }
  } catch (e) { console.warn("cac:", e); }

  // 4) Leads quentes parados em sequência de nutrição há +24h
  try {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: stuck } = await supabase
      .from("imphq_lead_sequence_enrollments")
      .select("id, lead_id, sequence_id, current_step, updated_at, status, lead:imphq_leads!lead_id(nome, phone, score, project_id)")
      .eq("status", "active")
      .lt("updated_at", since24)
      .gte("updated_at", since7d)
      .limit(50);
    const filtered = (stuck || []).filter((s: any) => s.lead?.project_id === projetoId && (s.lead?.score || 0) >= 60 && s.lead?.phone);
    if (filtered.length >= 3) {
      out.push({
        kind: "notify",
        risk_level: "low",
        confidence: 0.8,
        title: `${filtered.length} hot leads parados em sequência`,
        reason: `Leads (score≥60) sem avanço em sequência há +24h. Possível travamento no flow.`,
        payload: { tipo: "nutrition_stuck", count: filtered.length, lead_ids: filtered.slice(0, 10).map((f: any) => f.lead_id) },
        projeto_id: projetoId,
        source: "scout-nutrition-stuck",
        impact_brl: filtered.length * 150,
      });
    }
  } catch (e) { console.warn("stuck:", e); }

  // 5) Anúncio campeão sub-investido (ROAS >3× média do projeto, budget baixo)
  try {
    const { data: adsRows } = await supabase
      .from("imphq_ads_spend")
      .select("ad_id, adset_id, anuncio, conjunto_anuncios, spend, valor, valor_conversao, budget_daily")
      .eq("project_id", projetoId)
      .gte("date", since7d.slice(0, 10))
      .limit(500);
    const agg = new Map<string, any>();
    let totalSpend = 0, totalRev = 0;
    for (const a of adsRows || []) {
      const id = a.adset_id || a.ad_id; if (!id) continue;
      const type = a.adset_id ? "adset" : "ad";
      const name = a.conjunto_anuncios || a.anuncio || id;
      const spend = Number(a.spend ?? a.valor ?? 0);
      const rev = Number(a.valor_conversao ?? 0);
      const budget = Number(a.budget_daily ?? 0);
      totalSpend += spend; totalRev += rev;
      if (!agg.has(id)) agg.set(id, { id, type, name, spend: 0, rev: 0, budget });
      const r = agg.get(id); r.spend += spend; r.rev += rev;
      if (budget > 0) r.budget = budget;
    }
    const projAvgRoas = totalSpend > 0 ? totalRev / totalSpend : 0;
    if (projAvgRoas > 0) {
      for (const r of agg.values()) {
        const roas = r.spend > 0 ? r.rev / r.spend : 0;
        if (roas >= projAvgRoas * 3 && r.spend >= 30 && r.budget > 0 && r.budget < 100) {
          const newBudget = Math.round(r.budget * 1.2);
          out.push({
            kind: "adjustBudget",
            risk_level: "medium",
            confidence: 0.85,
            title: `Escalar ${r.name} +20% (ROAS ${roas.toFixed(1)}x)`,
            reason: `ROAS ${roas.toFixed(1)}x vs média ${projAvgRoas.toFixed(1)}x do projeto. Budget atual R$ ${r.budget} → R$ ${newBudget}.`,
            payload: { entity_id: r.id, entity_type: r.type, new_budget: newBudget, old_budget: r.budget },
            projeto_id: projetoId,
            source: "scout-ads-scale-winner",
            impact_brl: Math.round((newBudget - r.budget) * roas * 7),
          });
        }
      }
    }
  } catch (e) { console.warn("ads-winner:", e); }

  // 6) Humano respondeu há +2h mas IA ainda pausada (em horário comercial) — retomar IA
  try {
    const hour = new Date().getHours();
    if (hour >= 8 && hour < 20) {
      const since2hAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const { data: paused } = await supabase
        .from("imphq_wa_conversations")
        .select("id, phone, contact_name, ai_paused_until, last_message_at, last_incoming_at, ia_ativa")
        .eq("project_id", projetoId)
        .eq("ia_ativa", true)
        .not("ai_paused_until", "is", null)
        .gt("ai_paused_until", now)
        .lt("last_message_at", since2hAgo)
        .limit(20);
      for (const c of paused || []) {
        // só se cliente está aguardando (último incoming é mais recente que último outgoing)
        if (c.last_incoming_at && c.last_message_at && c.last_incoming_at >= c.last_message_at) {
          out.push({
            kind: "resumeAi",
            risk_level: "low",
            confidence: 0.85,
            title: `Retomar IA: ${c.contact_name || c.phone}`,
            reason: `Cliente aguardando há +2h em horário comercial e IA está pausada. Retomando autônomo.`,
            payload: { conversation_id: c.id, phone: c.phone, project_id: projetoId },
            projeto_id: projetoId,
            source: "scout-resume-ai-stale",
            impact_brl: 200,
          });
        }
      }
    }
  } catch (e) { console.warn("resume-ai:", e); }

  // 7) Pix/Boleto/Carrinho abandonado sem disparo do hot-lead-responder (rede de segurança)
  try {
    const since30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const since3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: pending } = await supabase
      .from("imphq_vendas")
      .select("id, lead_id, produto_nome, valor, status, created_at, data, lead:imphq_leads!lead_id(nome, phone, score)")
      .eq("project_id", projetoId)
      .in("status", ["aguardando_pagamento", "pix_gerado", "boleto_gerado", "pendente", "abandoned", "checkout_abandoned", "abandonado"])
      .gte("created_at", since3h)
      .lt("created_at", since30min)
      .limit(30);
    for (const v of pending || []) {
      const meta: any = v.data || {};
      if (meta.hot_lead_responder_sent) continue;
      if (!v.lead?.phone || (v.lead?.score || 0) < 60) continue;
      out.push({
        kind: "runHotLeadResponder",
        risk_level: "low",
        confidence: 0.82,
        title: `Reativar hot lead: ${v.lead?.nome || v.lead?.phone}`,
        reason: `Pix/Boleto/Carrinho de R$ ${Number(v.valor || 0).toFixed(2)} há +30min sem mensagem automática. Disparar IA agora.`,
        payload: { venda_id: v.id, lead_id: v.lead_id, valor: v.valor },
        projeto_id: projetoId,
        source: "scout-hotlead-safety-net",
        impact_brl: Math.round(Number(v.valor || 0) * 0.2),
      });
    }
  } catch (e) { console.warn("hotlead-safety:", e); }

  return out;
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const projetoIdParam = url.searchParams.get("projeto_id");

    const cols = "id, name, settings, data, daily_revenue_goal";
    let q = supabase.from("imphq_projects").select(cols).eq("is_archived", false);
    if (projetoIdParam) q = supabase.from("imphq_projects").select(cols).eq("id", projetoIdParam);

    const { data: projetos, error } = await q;
    if (error) throw error;

    let proposedCount = 0;
    let autoExecCount = 0;
    let dedupSkipped = 0;
    let killedSkipped = 0;
    const errors: string[] = [];

    // Carrega política aprendida
    const { data: policies } = await supabase
      .from("imphq_ai_policy")
      .select("kind, source, auto_exec_threshold, killed");
    const policyMap = new Map<string, { threshold: number; killed: boolean }>();
    for (const p of policies ?? []) {
      policyMap.set(`${p.kind}::${p.source ?? ""}`, {
        threshold: Number(p.auto_exec_threshold ?? 0.8),
        killed: !!p.killed,
      });
    }


    for (const p of (projetos || []) as Projeto[]) {
      let proposals: Proposed[] = [];
      try {
        proposals = [
          ...(await scoutProject(supabase, p)),
          ...(await detectFlowPatterns(supabase, p)),
          ...(await detectMacroSignals(supabase, p)),
        ];
      } catch (e: any) {
        errors.push(`${p.id}: ${String(e?.message || e)}`);
        continue;
      }
      for (const prop of proposals) {
        const { data: existing } = await supabase
          .from("imphq_ai_actions")
          .select("id")
          .eq("projeto_id", prop.projeto_id || "")
          .eq("kind", prop.kind)
          .in("status", ["proposed", "approved"])
          .limit(50);

        const dupKey = prop.payload?.entity_id || prop.payload?.lead_id || prop.payload?.venda_id || prop.payload?.trigger_tipo;
        let isDup = false;
        if (existing && existing.length > 0 && dupKey) {
          const { data: full } = await supabase
            .from("imphq_ai_actions")
            .select("id, payload")
            .in("id", existing.map((x: any) => x.id));
          isDup = (full || []).some((f: any) => {
            const k = f.payload?.entity_id || f.payload?.lead_id || f.payload?.venda_id || f.payload?.trigger_tipo;
            return k === dupKey;
          });
        } else if (existing && existing.length > 0 && !dupKey) {
          isDup = true;
        }
        if (isDup) { dedupSkipped++; continue; }

        const pol = policyMap.get(`${prop.kind}::${prop.source ?? ""}`);
        if (pol?.killed) { killedSkipped++; continue; }
        const threshold = pol?.threshold ?? 0.8;
        const autoExec = prop.risk_level === "low" && prop.confidence >= threshold && prop.kind !== "notify" && prop.kind !== "createFlow";


        const { data: inserted, error: insErr } = await supabase.from("imphq_ai_actions").insert({
          kind: prop.kind,
          risk_level: prop.risk_level,
          confidence: prop.confidence,
          title: prop.title,
          reason: prop.reason,
          payload: prop.payload,
          projeto_id: prop.projeto_id,
          source: prop.source,
          impact_brl: prop.impact_brl ?? null,
          status: autoExec ? "approved" : "proposed",
          auto_executed: autoExec,
        }).select().single();

        if (insErr) { errors.push(`insert: ${insErr.message}`); continue; }
        proposedCount++;

        if (autoExec && inserted) {
          await supabase.functions.invoke("imperius-executor", { body: { action_id: inserted.id, mode: "execute" } });
          autoExecCount++;
        }
      }
    }

    const result = {
      ok: true,
      projetos: projetos?.length || 0,
      proposed: proposedCount,
      auto_executed: autoExecCount,
      dedup_skipped: dedupSkipped,
      killed_skipped: killedSkipped,

      errors,
      execution_ms: Date.now() - startedAt,
    };
    console.log("imperius-scout:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imperius-scout fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e), execution_ms: Date.now() - startedAt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
